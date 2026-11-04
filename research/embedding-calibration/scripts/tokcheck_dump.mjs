// Usage: node scripts/tokcheck_dump.mjs <v1|v2>  -> out/token_ids_<key>.json (JS tokenizer ids for every tag with the STS prompt)
import { AutoTokenizer, env } from '@huggingface/transformers';
import { writeFileSync } from 'node:fs';
import { MODELS, PROMPTS } from './models.mjs';
import { tags } from '../data/testset.mjs';
const key = process.argv[2] ?? 'v2';
env.allowRemoteModels = false; env.localModelPath = new URL('../models/', import.meta.url).pathname;
const tok = await AutoTokenizer.from_pretrained(MODELS[key].id);
const ids = {};
for (const t of tags.map((x) => x.t)) ids[t] = Array.from((await tok(PROMPTS.sts + t)).input_ids.data, Number);
writeFileSync(new URL(`../out/token_ids_${key}.json`, import.meta.url), JSON.stringify(ids));
console.log('wrote', Object.keys(ids).length, 'example', PROMPTS.sts + 'madlavning', ids['madlavning']);
