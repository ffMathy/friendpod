import { createLifecycle } from '@/features/interests/embedder/lifecycle';
import { EmbedderUnavailableError } from '@/features/interests/embedder/types';

function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

function setup() {
  const created: { id: number; released: boolean }[] = [];
  const pending: ReturnType<typeof deferred<void>>[] = [];
  const create = jest.fn(async () => {
    const gate = deferred<void>();
    pending.push(gate);
    await gate.promise;
    const s = { id: created.length + 1, released: false };
    created.push(s);
    return s;
  });
  const lc = createLifecycle(create, async (s) => {
    s.released = true;
  });
  return { lc, created, pending, create };
}

describe('embedder lifecycle (D1: free the model when the screen loses focus)', () => {
  it('frees a session whose load finishes after the screen released it', async () => {
    const { lc, created, pending } = setup();
    const load = lc.load();
    await lc.release();
    pending[0]!.resolve();
    await expect(load).rejects.toBeInstanceOf(EmbedderUnavailableError);
    expect(created).toEqual([{ id: 1, released: true }]);
    await expect(lc.use(async () => 'x')).rejects.toBeInstanceOf(EmbedderUnavailableError);
  });

  it('keeps a load that was released and asked for again before it finished, without loading twice', async () => {
    const { lc, created, pending, create } = setup();
    const first = lc.load();
    await lc.release();
    const second = lc.load();
    pending[0]!.resolve();
    await Promise.all([first, second]);
    expect(create).toHaveBeenCalledTimes(1);
    expect(created).toEqual([{ id: 1, released: false }]);
    await expect(lc.use(async (s) => s.id)).resolves.toBe(1);
  });

  it('waits for a running embed before it frees the session', async () => {
    const { lc, created, pending } = setup();
    const load = lc.load();
    pending[0]!.resolve();
    await load;
    const gate = deferred<void>();
    const embed = lc.use(async (s) => {
      await gate.promise;
      return s.released;
    });
    const release = lc.release();
    await Promise.resolve();
    expect(created[0]!.released).toBe(false);
    gate.resolve();
    await expect(embed).resolves.toBe(false);
    await release;
    expect(created[0]!.released).toBe(true);
  });
});
