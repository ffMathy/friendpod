#!/usr/bin/env bash
# Reproduce the whole calibration: pinned model download -> sanity checks -> embeddings -> perf -> analysis -> comparison.
# Usage (from research/embedding-calibration/):  bash scripts/run-all.sh
#   SKIP_PERF=1   skip the latency/RSS measurements (about 10 minutes; they need a quiet machine)
#   PERF_REPS=3   repetitions per perf configuration (default 3)
# Needs ~3 GB of disk for models (v1+v2, q4+q8+fp32) and ~750 MB for node_modules.
set -euo pipefail
cd "$(dirname "$0")/.."

V1=onnx-community/embeddinggemma-300m-ONNX; V1_REV=5090578d9565bb06545b4552f76e6bc2c93e4a66
V2=onnx-community/embeddinggemma-2-ONNX;    V2_REV=daa72c51243991dfcaf9f9137d2c573d8f7790c0
RUNS="v1:q4 v1:q8 v1:fp32 v2:q4 v2:q8 v2:fp32"

[ -d node_modules ] || npm ci

echo "== 1. download pinned models (sha256-verified)"
bash scripts/download-model.sh "$V1" "$V1_REV" q4 q8 fp32
bash scripts/download-model.sh "$V2" "$V2_REV" q4 q8 fp32

echo "== 2. sanity: v2 text-only load, unit-norm output, model-card reference scores"
node scripts/smoke.mjs v2 q4   # expect card example 768d 0.684 0.854 0.752 0.783 / 256d 0.706 0.871 0.775 0.807

echo "== 3. embeddings (every tag, prototype and anchor x 7 prompts)"
for r in $RUNS; do node scripts/embed.mjs "${r%%:*}" "${r##*:}"; done

if [ "${SKIP_PERF:-0}" != "1" ]; then
  echo "== 4. perf: load, RSS, single-tag and batch latency at 4 and 1 threads (interleaved repetitions)"
  for rep in $(seq 1 "${PERF_REPS:-3}"); do
    for th in 4 1; do
      for r in v1:q4 v2:q4 v2:q8; do node scripts/embed.mjs "${r%%:*}" "${r##*:}" --perf --threads "$th" --rep "$rep" > /dev/null; done
    done
  done
  for th in 4 1; do for r in v1:q8 v1:fp32 v2:fp32; do node scripts/embed.mjs "${r%%:*}" "${r##*:}" --perf --threads "$th" --rep 1 > /dev/null; done; done
fi

echo "== 5. analysis per run -> results/<model>-<dtype>.json"
for r in $RUNS; do node scripts/analyze.mjs "$r" --ref "${r%%:*}:fp32"; done

echo "== 6. side-by-side comparison + paired bootstrap -> results/comparison*.md"
node scripts/compare.mjs v1:q4 v2:q4,v2:q8,v2:fp32 --boot 500 > /dev/null
node scripts/compare.mjs v2:q4 v2:q8 --boot 500 --out comparison_v2q4_vs_v2q8 > /dev/null
echo "done: see results/comparison.md"
