import { act, renderHook } from '@testing-library/react-native';
import { settleConsentRequest } from '@/features/consent/requests';
import { art9ConsentPayload } from '@/features/consent/art9';
import { useAddInterest } from '@/features/interests/useAddInterest';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));

const mockCall = jest.fn();
jest.mock('@/firebase/callables', () => ({
  callFunction: (...args: unknown[]) => mockCall(...args),
  toAppError: (e: unknown) => e,
}));

const grant = { consent: art9ConsentPayload('art9-tag-en-v1') };
const added = { results: [{ status: 'added', interestId: 'abcdefghijklmnop' }] };

/** Answers the consent sheet that the hook opened via router.push. */
function answerSheet(answer: typeof grant | null) {
  const call = mockPush.mock.calls.at(-1);
  if (!call) throw new Error('consent sheet was not opened');
  const { params } = call[0] as { params: { request: string } };
  settleConsentRequest(params.request, answer);
}

beforeEach(() => {
  mockPush.mockClear();
  mockCall.mockReset();
});

async function flush() {
  await act(async () => {
    await Promise.resolve();
  });
}

describe('useAddInterest', () => {
  it('opens the consent sheet before any text leaves the device on a lexicon hit', async () => {
    const { result } = await renderHook(() => useAddInterest());
    let outcome: Promise<unknown> = Promise.resolve();
    await act(async () => {
      outcome = result.current.add('Gravid');
    });
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/sheets/consent', params: { request: expect.any(String) } });
    expect(mockCall).not.toHaveBeenCalled();

    answerSheet(null);
    await flush();
    await expect(outcome).resolves.toEqual({ kind: 'discarded' });
    expect(mockCall).not.toHaveBeenCalled();
  });

  it('sends the text only together with the consent payload once the user agrees', async () => {
    mockCall.mockResolvedValue(added);
    const { result } = await renderHook(() => useAddInterest());
    let outcome: Promise<unknown> = Promise.resolve();
    await act(async () => {
      outcome = result.current.add('Gravid');
    });
    answerSheet(grant);
    await flush();
    await expect(outcome).resolves.toMatchObject({ kind: 'done', result: { status: 'added' } });
    expect(mockCall).toHaveBeenCalledTimes(1);
    expect(mockCall).toHaveBeenCalledWith('addInterests', { items: [{ text: 'Gravid', consent: grant.consent }] });
  });

  it('asks for consent when the server-side detector flags an ordinary-looking tag', async () => {
    mockCall.mockResolvedValueOnce({ results: [{ status: 'needsConsent' }] }).mockResolvedValueOnce(added);
    const { result } = await renderHook(() => useAddInterest());
    let outcome: Promise<unknown> = Promise.resolve();
    await act(async () => {
      outcome = result.current.add('surdejsbrød');
    });
    expect(mockCall).toHaveBeenNthCalledWith(1, 'addInterests', { items: [{ text: 'surdejsbrød' }] });
    answerSheet(grant);
    await flush();
    await expect(outcome).resolves.toMatchObject({ kind: 'done', result: { status: 'added' } });
    expect(mockCall).toHaveBeenNthCalledWith(2, 'addInterests', { items: [{ text: 'surdejsbrød', consent: grant.consent }] });
  });

  it('makes an existing interest private only with consent', async () => {
    mockCall.mockResolvedValue({ results: [{ status: 'madePrivate', interestId: 'abcdefghijklmnop' }] });
    const { result } = await renderHook(() => useAddInterest());
    let outcome: Promise<unknown> = Promise.resolve();
    await act(async () => {
      outcome = result.current.add('brætspil', { selfFlag: true });
    });
    expect(mockCall).not.toHaveBeenCalled();
    answerSheet(grant);
    await flush();
    await expect(outcome).resolves.toMatchObject({ result: { status: 'madePrivate' } });
    expect(mockCall).toHaveBeenCalledWith('addInterests', { items: [{ text: 'brætspil', selfFlag: true, consent: grant.consent }] });
  });

  it('stops contact details and refused third-party tags on the device', async () => {
    const { result } = await renderHook(() => useAddInterest());
    await act(async () => {
      await expect(result.current.add('ring 12345678')).resolves.toEqual({ kind: 'rejected', code: 'PII' });
      await expect(result.current.add('min søns autisme')).resolves.toEqual({ kind: 'rejected', code: 'THIRD_PARTY_SENSITIVE' });
    });
    expect(mockPush).not.toHaveBeenCalled();
    expect(mockCall).not.toHaveBeenCalled();
  });
});
