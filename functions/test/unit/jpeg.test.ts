import { describe, expect, it } from 'vitest';
import { sizeOk, stripJpeg } from '../../src/photos/jpeg';

import { testJpeg } from '../helpers/jpeg';

describe('JPEG sanitising (§9 Photos)', () => {
  it('drops APP1–APP15 and COM, keeps the rest, and reads the frame size', () => {
    const r = stripJpeg(testJpeg(800, 600))!;
    expect(r).toMatchObject({ width: 800, height: 600, stripped: 2 });
    const text = Buffer.from(r.bytes).toString('latin1');
    expect(text).not.toMatch(/Exif|GPS|secret|shot at home/);
    expect(text).toContain('JFIF');
    expect(r.bytes.slice(-2)).toEqual(new Uint8Array([0xff, 0xd9]));
    expect(stripJpeg(testJpeg(800, 600, { exif: false }))!.bytes).toEqual(testJpeg(800, 600, { exif: false }));
  });

  it('refuses what is not a well-formed JPEG, and checks the sizes', () => {
    expect(stripJpeg(new Uint8Array([0x89, 0x50, 0x4e, 0x47]))).toBeNull();
    const truncated = testJpeg(800, 600).slice(0, 40);
    expect(stripJpeg(truncated)).toBeNull();
    const noEoi = testJpeg(800, 600).slice(0, -2);
    expect(stripJpeg(noEoi)).toBeNull();
    expect(sizeOk(stripJpeg(testJpeg(800, 600))!, 'full')).toBe(true);
    expect(sizeOk(stripJpeg(testJpeg(5000, 600))!, 'full')).toBe(false);
    expect(sizeOk(stripJpeg(testJpeg(256, 192))!, 'thumb')).toBe(true);
    expect(sizeOk(stripJpeg(testJpeg(800, 600))!, 'thumb')).toBe(false);
  });
});
