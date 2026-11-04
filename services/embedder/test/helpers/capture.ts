/** Captures every byte written to stdout/stderr (vitest runs with disableConsoleIntercept). */
import { vi } from 'vitest';

export interface Capture {
  readonly text: () => string;
  readonly restore: () => void;
}

export function captureOutput(): Capture {
  const chunks: string[] = [];
  const grab = (chunk: unknown): void => {
    chunks.push(typeof chunk === 'string' ? chunk : Buffer.from(chunk as Uint8Array).toString('utf8'));
  };
  const out = vi.spyOn(process.stdout, 'write').mockImplementation((chunk: unknown) => {
    grab(chunk);
    return true;
  });
  const err = vi.spyOn(process.stderr, 'write').mockImplementation((chunk: unknown) => {
    grab(chunk);
    return true;
  });
  return {
    text: () => chunks.join(''),
    restore: () => {
      out.mockRestore();
      err.mockRestore();
    },
  };
}
