import { act, render } from '@testing-library/react-native';
import { AppState, type AppStateStatus } from 'react-native';
import { APP_OPENED_MIN_INTERVAL_MS, useAppOpened } from '@/features/session/useAppOpened';

const mockCall = jest.fn(async (..._a: unknown[]) => ({ ok: true }));
jest.mock('@/firebase/callables', () => ({ callFunction: (...a: unknown[]) => mockCall(...a) }));

let listener: ((s: AppStateStatus) => void) | null = null;
const remove = jest.fn();
beforeEach(() => {
  jest.clearAllMocks();
  listener = null;
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_t, l) => {
    listener = l as (s: AppStateStatus) => void;
    return { remove } as never;
  });
});

const clock = { t: 1_000_000 };
const now = () => clock.t;
function Probe() {
  useAppOpened(now);
  return null;
}
const flush = () => act(async () => Promise.resolve());

it('calls appOpened at start and again on a foreground after 6 hours, not before', async () => {
  const view = await render(<Probe />);
  await flush();
  expect(mockCall).toHaveBeenCalledTimes(1);
  expect(mockCall).toHaveBeenLastCalledWith('appOpened', {});

  clock.t += APP_OPENED_MIN_INTERVAL_MS - 1;
  await act(async () => listener!('active'));
  expect(mockCall).toHaveBeenCalledTimes(1);

  await act(async () => listener!('background'));
  clock.t += 1;
  await act(async () => listener!('active'));
  expect(mockCall).toHaveBeenCalledTimes(2);

  await view.unmount();
  expect(remove).toHaveBeenCalled();
});

it('retries at the next foreground after a failed call', async () => {
  mockCall.mockRejectedValueOnce(new Error('offline'));
  const view = await render(<Probe />);
  await flush();
  expect(mockCall).toHaveBeenCalledTimes(1);
  clock.t += 1000;
  await act(async () => listener!('active'));
  expect(mockCall).toHaveBeenCalledTimes(2);
  await view.unmount();
});
