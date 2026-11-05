# Usage: python -I scripts/tokcheck.py <tokenizer.json> <out/token_ids_<key>.json>
# Cross-checks transformers.js token ids against the reference Rust `tokenizers` implementation.
import json, sys
from tokenizers import Tokenizer
tok = Tokenizer.from_file(sys.argv[1])
js = json.load(open(sys.argv[2], encoding="utf-8"))
p = "task: sentence similarity | query: "
mism = [t for t, ids in js.items() if tok.encode(p + t).ids != ids]
print(json.dumps({"checked": len(js), "mismatches": mism, "example": {"text": p + "madlavning", "ids": tok.encode(p + "madlavning").ids}}, ensure_ascii=False))
