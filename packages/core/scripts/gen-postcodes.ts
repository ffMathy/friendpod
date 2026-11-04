/**
 * Regenerates src/geo/dk-postcodes.json (postcode -> centroid) from GeoNames postal codes.
 *
 *   npm -w packages/core run gen:postcodes                 # downloads DK.zip
 *   npm -w packages/core run gen:postcodes -- --input DK.txt   # or a local DK.txt / DK.zip
 *
 * DESIGN-DEVIATION: DESIGN.md §14 names DAWA (api.dataforsyningen.dk/postnumre). DAWA now answers
 * HTTP 410 Gone (checked 2026-11-04), and its successor GSearch needs an access token, so this script
 * uses the GeoNames postal-code extract instead (CC BY 4.0; attribution "GeoNames, www.geonames.org").
 * Postcodes below 1000 are non-geographic service codes and are dropped.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { inflateRawSync } from 'node:zlib';

const SOURCE_URL = 'https://download.geonames.org/export/zip/DK.zip';
const OUT = resolve(dirname(fileURLToPath(import.meta.url)), '../src/geo/dk-postcodes.json');
const DK_BBOX = { minLat: 54.4, maxLat: 57.9, minLon: 7.9, maxLon: 15.3 };

/** Reads one stored or deflated entry from a zip archive (enough for the GeoNames extracts). */
function unzipEntry(zip: Buffer, name: string): Buffer {
  const eocd = zip.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (eocd < 0) throw new Error('zip: end of central directory not found');
  const entries = zip.readUInt16LE(eocd + 10);
  let p = zip.readUInt32LE(eocd + 16);
  for (let i = 0; i < entries; i++) {
    if (zip.readUInt32LE(p) !== 0x02014b50) throw new Error('zip: bad central directory');
    const method = zip.readUInt16LE(p + 10);
    const compressed = zip.readUInt32LE(p + 20);
    const nameLen = zip.readUInt16LE(p + 28);
    const extraLen = zip.readUInt16LE(p + 30);
    const commentLen = zip.readUInt16LE(p + 32);
    const local = zip.readUInt32LE(p + 42);
    const entryName = zip.toString('utf8', p + 46, p + 46 + nameLen);
    if (entryName === name) {
      const dataStart = local + 30 + zip.readUInt16LE(local + 26) + zip.readUInt16LE(local + 28);
      const data = zip.subarray(dataStart, dataStart + compressed);
      if (method === 0) return data;
      if (method === 8) return inflateRawSync(data);
      throw new Error(`zip: unsupported compression method ${method}`);
    }
    p += 46 + nameLen + extraLen + commentLen;
  }
  throw new Error(`zip: ${name} not found`);
}

async function loadText(input: string | undefined): Promise<string> {
  if (input) {
    const raw = await readFile(input);
    return (input.endsWith('.zip') ? unzipEntry(raw, 'DK.txt') : raw).toString('utf8');
  }
  const res = await fetch(SOURCE_URL);
  if (!res.ok) throw new Error(`download failed: HTTP ${res.status}`);
  return unzipEntry(Buffer.from(await res.arrayBuffer()), 'DK.txt').toString('utf8');
}

async function main(): Promise<void> {
  const { values } = parseArgs({ options: { input: { type: 'string' } } });
  const text = await loadText(values.input);
  const postcodes: Record<string, [string, number, number]> = {};
  for (const line of text.split('\n')) {
    const f = line.split('\t');
    if (f.length < 11 || f[0] !== 'DK') continue;
    const code = f[1]!;
    const lat = Number(f[9]);
    const lon = Number(f[10]);
    if (!/^\d{4}$/.test(code) || Number(code) < 1000) continue;
    if (!(lat >= DK_BBOX.minLat && lat <= DK_BBOX.maxLat && lon >= DK_BBOX.minLon && lon <= DK_BBOX.maxLon)) continue;
    postcodes[code] = [f[2]!, Math.round(lat * 1e4) / 1e4, Math.round(lon * 1e4) / 1e4];
  }
  const sorted = Object.fromEntries(Object.entries(postcodes).sort(([a], [b]) => (a < b ? -1 : 1)));
  const doc = {
    source: SOURCE_URL,
    license: 'CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/)',
    attribution: 'Postal code data: GeoNames (www.geonames.org)',
    note: 'Centroids as published by GeoNames (mostly address centroids). Used on the device only to derive the geohash-5 cell; the postcode is never sent.',
    format: 'postcode -> [name, lat, lon]',
    postcodes: sorted,
  };
  await writeFile(OUT, `${JSON.stringify(doc, null, 0).replace(/\],"/g, '],\n"')}\n`);
  console.log(`wrote ${Object.keys(sorted).length} postcodes to ${OUT}`);
}

await main();
