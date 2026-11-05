/** Synthetic JPEGs for the photo tests (no image library needed: the server never decodes pixels). */
const seg = (marker: number, payload: number[]) => [0xff, marker, ((payload.length + 2) >> 8) & 0xff, (payload.length + 2) & 0xff, ...payload];
const ascii = (s: string) => [...Buffer.from(s, 'latin1')];

/** A structurally valid JPEG: SOI, APP0, APP1 (EXIF with GPS), COM, DQT, SOF0, SOS, scan data, EOI. */
export function testJpeg(width: number, height: number, o: { exif?: boolean } = {}): Uint8Array {
  const bytes = [
    0xff, 0xd8,
    ...seg(0xe0, ascii('JFIF\0\x01\x01\0\0\x01\0\x01\0\0')),
    ...(o.exif === false ? [] : seg(0xe1, ascii('Exif\0\0GPS 55.6761N 12.5683E secret'))),
    ...(o.exif === false ? [] : seg(0xfe, ascii('shot at home'))),
    ...seg(0xdb, [0, ...Array.from({ length: 64 }, () => 1)]),
    ...seg(0xc0, [8, height >> 8, height & 0xff, width >> 8, width & 0xff, 1, 1, 0x11, 0]),
    ...seg(0xda, [1, 1, 0, 0, 63, 0]),
    0x12, 0x34, 0xff, 0x00, 0x56,
    0xff, 0xd9,
  ];
  return new Uint8Array(bytes);
}

