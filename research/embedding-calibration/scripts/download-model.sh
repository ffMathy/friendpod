#!/usr/bin/env bash
# Download an ONNX embedding model from the Hugging Face Hub at a PINNED revision into ./models/<model_id>/,
# and verify every large file against the sha256 the Hub reports for that revision.
#
# Usage: scripts/download-model.sh <model_id> <revision_sha> <dtype> [<dtype> ...]
#   dtype: fp32 | q8 | q4      (fp16/q4f16 are deliberately not offered: EmbeddingGemma activations overflow fp16)
# Example:
#   scripts/download-model.sh onnx-community/embeddinggemma-2-ONNX daa72c51243991dfcaf9f9137d2c573d8f7790c0 q4 q8
#
# Only the TEXT model (onnx/model*.onnx) is fetched. For EmbeddingGemma 2 the vision/audio encoders are skipped
# on purpose; embed.mjs loads the model with vision_config = audio_config = null, so they are never needed.
# Requires: bash, curl, sha256sum, node (for JSON parsing). Honors HTTPS_PROXY / CA settings of your curl.
set -euo pipefail
MODEL_ID="$1"; REV="$2"; shift 2
[ "$#" -ge 1 ] || { echo "need at least one dtype" >&2; exit 2; }
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEST="$ROOT/models/$MODEL_ID"
mkdir -p "$DEST/onnx"
BASE="https://huggingface.co/$MODEL_ID/resolve/$REV"
API="https://huggingface.co/api/models/$MODEL_ID/revision/$REV?blobs=true"
MANIFEST="$DEST/.hub_manifest.json"
curl -sSfL --retry 3 -o "$MANIFEST" "$API"

files=(config.json tokenizer.json tokenizer_config.json)
for opt in config_sentence_transformers.json special_tokens_map.json added_tokens.json generation_config.json; do
  if node -e 'const m=require(process.argv[1]);process.exit(m.siblings.some(s=>s.rfilename===process.argv[2])?0:1)' "$MANIFEST" "$opt"; then files+=("$opt"); fi
done
for d in "$@"; do
  case "$d" in
    fp32) stem=model ;; q8) stem=model_quantized ;; q4) stem=model_q4 ;;
    *) echo "unsupported dtype $d" >&2; exit 2 ;;
  esac
  files+=("onnx/$stem.onnx" "onnx/$stem.onnx_data")
done

for f in "${files[@]}"; do
  out="$DEST/$f"
  want=$(node -e 'const m=require(process.argv[1]);const s=m.siblings.find(s=>s.rfilename===process.argv[2]);if(!s){process.exit(3)}console.log(s.lfs?.sha256??"")' "$MANIFEST" "$f") || { echo "missing on hub: $f" >&2; exit 3; }
  if [ -n "$want" ] && [ -f "$out" ] && [ "$(sha256sum "$out" | cut -d' ' -f1)" = "$want" ]; then echo "ok (cached) $f"; continue; fi
  echo "GET $f"
  curl -sSfL --retry 3 -C - -o "$out.part" "$BASE/$f" || curl -sSfL --retry 3 -o "$out.part" "$BASE/$f"
  mv "$out.part" "$out"
  if [ -n "$want" ]; then
    got=$(sha256sum "$out" | cut -d' ' -f1)
    [ "$got" = "$want" ] || { echo "SHA256 MISMATCH $f: got $got want $want" >&2; exit 4; }
    echo "ok sha256 $f"
  fi
done
node -e 'const m=require(process.argv[1]);console.log(`revision ${m.sha} (requested ${process.argv[2]})`);if(m.sha!==process.argv[2])process.exit(5)' "$MANIFEST" "$REV"
