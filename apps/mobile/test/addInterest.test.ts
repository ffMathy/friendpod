import { EMBEDDING_DIM, EMBEDDING_MODEL_ID, addInterestsInput, isModelVector } from '@grouper/core';
import { act, renderHook } from '@testing-library/react-native';
import { getEmbedder } from '@/features/interests/embedder';
import { useAddInterest } from '@/features/interests/useAddInterest';

const mockCall = jest.fn();
jest.mock('@/firebase/callables', () => ({
  callFunction: (...args: unknown[]) => mockCall(...args),
  toAppError: (e: unknown) => e,
}));

const added = { results: [{ status: 'added', interestId: 'abcdefghijklmnop' }] };

beforeEach(() => {
  mockCall.mockReset();
});

type Sent = { modelKey: string; items: { text: string; vector: number[]; detector: { margin: number; lexiconHit: boolean } }[] };
const sent = (call = 0): Sent => mockCall.mock.calls[call]?.[1] as Sent;

describe('useAddInterest (D1: embedded on the device)', () => {
  it('uses the deterministic stub embedder in tests', () => {
    expect(getEmbedder().kind).toBe('stub');
  });

  it('sends {text, vector, detector} under the pinned modelKey, valid for the server schema', async () => {
    mockCall.mockResolvedValue(added);
    const { result } = await renderHook(() => useAddInterest());
    await act(async () => {
      await expect(result.current.add('Brætspil', { hasArt9Consent: false })).resolves.toMatchObject({ kind: 'done', result: { status: 'added' } });
    });
    expect(mockCall).toHaveBeenCalledTimes(1);
    expect(mockCall.mock.calls[0]?.[0]).toBe('addInterests');
    const body = sent();
    expect(body.modelKey).toBe(EMBEDDING_MODEL_ID);
    expect(body.items).toHaveLength(1);
    const item = body.items[0]!;
    expect(item.text).toBe('Brætspil');
    expect(item.vector).toHaveLength(EMBEDDING_DIM);
    expect(isModelVector(item.vector)).toBe(true);
    expect(item.detector).toEqual({ margin: expect.any(Number), lexiconHit: false });
    expect(item.detector.margin).toBeLessThan(0);
    expect(addInterestsInput.safeParse(body).success).toBe(true);
  });

  it('gives the same tag the same vector, so the server can merge it', async () => {
    mockCall.mockResolvedValue(added);
    const { result } = await renderHook(() => useAddInterest());
    await act(async () => {
      await result.current.add('madlavning', { hasArt9Consent: false });
      await result.current.add('  Madlavning ', { hasArt9Consent: false });
    });
    expect(sent(0).items[0]!.vector).toEqual(sent(1).items[0]!.vector);
  });

  it('without the blanket consent, refuses a sensitive tag on the device and sends nothing (D3)', async () => {
    const { result } = await renderHook(() => useAddInterest());
    await act(async () => {
      await expect(result.current.add('gravid', { hasArt9Consent: false })).resolves.toEqual({ kind: 'rejected', code: 'ART9_CONSENT_REQUIRED' });
      await expect(result.current.add('brætspil', { hasArt9Consent: false, choice: 'selfFlagPrivate' })).resolves.toEqual({
        kind: 'rejected',
        code: 'ART9_CONSENT_REQUIRED',
      });
    });
    expect(mockCall).not.toHaveBeenCalled();
  });

  it('with the blanket consent, sends a sensitive tag without any prompt; the server marks it private', async () => {
    mockCall.mockResolvedValue({ results: [{ status: 'added', interestId: 'abcdefghijklmnop', private: true }] });
    const { result } = await renderHook(() => useAddInterest());
    await act(async () => {
      await expect(result.current.add('gravid', { hasArt9Consent: true })).resolves.toMatchObject({ result: { private: true } });
    });
    const item = sent().items[0]!;
    expect(item.detector.lexiconHit).toBe(true);
    expect(item.detector.margin).toBeGreaterThan(0);
  });

  it('sends "Keep this private" and "This isn\'t sensitive for me" as holding flags', async () => {
    mockCall.mockResolvedValueOnce({ results: [{ status: 'madePrivate', interestId: 'abcdefghijklmnop', private: true }] });
    mockCall.mockResolvedValueOnce({ results: [{ status: 'madeOrdinary', interestId: 'abcdefghijklmnop' }] });
    const { result } = await renderHook(() => useAddInterest());
    await act(async () => {
      await result.current.add('brætspil', { hasArt9Consent: true, choice: 'selfFlagPrivate' });
      await result.current.add('gravid', { hasArt9Consent: true, choice: 'notSensitiveForMe' });
    });
    expect(sent(0).items[0]).toMatchObject({ text: 'brætspil', selfFlagPrivate: true });
    expect(sent(0).items[0]).not.toHaveProperty('notSensitiveForMe');
    expect(sent(1).items[0]).toMatchObject({ text: 'gravid', notSensitiveForMe: true });
  });

  it('batches several tags into one call and keeps device rejections in place', async () => {
    mockCall.mockResolvedValue({ results: [{ status: 'added', interestId: 'abcdefghijklmnop' }, { status: 'duplicate' }] });
    const { result } = await renderHook(() => useAddInterest());
    let outcomes: unknown;
    await act(async () => {
      outcomes = await result.current.addMany(['løb', 'ring 12345678', 'yoga'], { hasArt9Consent: false });
    });
    expect(mockCall).toHaveBeenCalledTimes(1);
    expect(sent().items.map((i) => i.text)).toEqual(['løb', 'yoga']);
    expect(outcomes).toEqual([
      { kind: 'done', result: { status: 'added', interestId: 'abcdefghijklmnop' } },
      { kind: 'rejected', code: 'PII' },
      { kind: 'done', result: { status: 'duplicate' } },
    ]);
  });

  it("stops contact details and someone else's sensitive data on the device", async () => {
    const { result } = await renderHook(() => useAddInterest());
    await act(async () => {
      await expect(result.current.add('ring 12345678', { hasArt9Consent: true })).resolves.toEqual({ kind: 'rejected', code: 'PII' });
      await expect(result.current.add('min søns autisme', { hasArt9Consent: true })).resolves.toEqual({ kind: 'rejected', code: 'THIRD_PARTY_SENSITIVE' });
    });
    expect(mockCall).not.toHaveBeenCalled();
  });
});
