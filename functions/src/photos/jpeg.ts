/**
 * JPEG sanitising for `onPhotoUploaded` (DESIGN.md §9 Photos): drops every APP1–APP15 segment (EXIF, GPS, XMP, ICC,
 * maker notes) and every COM segment, keeps APP0 (JFIF) and the decoding segments, and reads the frame size. The
 * entropy-coded data after the first SOS is copied unchanged. Anything that is not a well-formed baseline or
 * progressive JPEG is refused; nothing is re-encoded. The app bakes the orientation into the pixels before upload,
 * because the EXIF orientation tag goes with APP1.
 */

export interface JpegResult {
  readonly width: number;
  readonly height: number;
  readonly bytes: Uint8Array;
  /** Segments removed (APPn n ≥ 1, COM). */
  readonly stripped: number;
}

const SOI = 0xd8;
const EOI = 0xd9;
const SOS = 0xda;
const COM = 0xfe;
const SOF_MARKERS = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);
const STANDALONE = (m: number) => m === 0x01 || (m >= 0xd0 && m <= 0xd7);

export function stripJpeg(input: Uint8Array): JpegResult | null {
  if (input.length < 4 || input[0] !== 0xff || input[1] !== SOI) return null;
  const out: Uint8Array[] = [input.subarray(0, 2)];
  let pos = 2;
  let width = 0;
  let height = 0;
  let stripped = 0;
  while (pos < input.length) {
    if (input[pos] !== 0xff) return null;
    let mpos = pos + 1;
    while (mpos < input.length && input[mpos] === 0xff) mpos++;
    if (mpos >= input.length) return null;
    const marker = input[mpos]!;
    if (marker === EOI) return null; // an image without scan data
    if (STANDALONE(marker)) {
      out.push(input.subarray(pos, mpos + 1));
      pos = mpos + 1;
      continue;
    }
    if (mpos + 2 >= input.length) return null;
    const len = (input[mpos + 1]! << 8) | input[mpos + 2]!;
    const end = mpos + 1 + len;
    if (len < 2 || end > input.length) return null;
    if (SOF_MARKERS.has(marker)) {
      if (len < 7) return null;
      height = (input[mpos + 4]! << 8) | input[mpos + 5]!;
      width = (input[mpos + 6]! << 8) | input[mpos + 7]!;
    }
    if (marker === SOS) {
      if (width === 0 || height === 0) return null;
      const rest = input.subarray(pos);
      if (rest.length < 4 || rest[rest.length - 2] !== 0xff || rest[rest.length - 1] !== EOI) return null;
      out.push(rest);
      const bytes = new Uint8Array(out.reduce((n, p) => n + p.length, 0));
      let o = 0;
      for (const p of out) {
        bytes.set(p, o);
        o += p.length;
      }
      return { width, height, bytes, stripped };
    }
    const dropped = (marker >= 0xe1 && marker <= 0xef) || marker === COM;
    if (dropped) stripped++;
    else out.push(input.subarray(pos, end));
    pos = end;
  }
  return null;
}

/** Size limits (§9): the full photo and the 256-px thumbnail the app uploads next to it. */
export const PHOTO_LIMITS = {
  full: { minSide: 128, maxSide: 4096 },
  thumb: { minSide: 32, maxSide: 256 },
} as const;

export function sizeOk(r: JpegResult, kind: keyof typeof PHOTO_LIMITS): boolean {
  const l = PHOTO_LIMITS[kind];
  return Math.min(r.width, r.height) >= l.minSide && Math.max(r.width, r.height) <= l.maxSide;
}
