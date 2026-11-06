import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import AlmostDone from '../app/(onboarding)/done';
import PodPreferences from '../app/(onboarding)/pod-preferences';

const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn() };
jest.mock('expo-router', () => ({ useRouter: () => mockRouter, Redirect: () => null }));
const mockCall = jest.fn();
jest.mock('@/firebase/callables', () => ({ callFunction: (...a: unknown[]) => mockCall(...a), toAppError: (e: unknown) => e }));
const mockFinish = jest.fn(async () => undefined);
jest.mock('@/features/session/SessionProvider', () => ({ useUid: () => 'me', useSession: () => ({ finishOnboarding: mockFinish }) }));
const mockPush = { request: jest.fn(async () => true), register: jest.fn(async () => undefined) };
jest.mock('@/features/notifications/push', () => ({
  requestPushPermission: () => mockPush.request(),
  registerPushToken: () => mockPush.register(),
}));
jest.mock('@/features/photos/upload', () => ({ usePhotoUpload: () => ({ state: 'idle', choose: jest.fn() }) }));
jest.mock('@/features/account/clearDeviceData', () => ({ clearImageCaches: async () => undefined }));
jest.mock('@/firebase/storageRest', () => ({ storageAuthHeaders: async () => ({}), storageObjectUrl: (p: string) => p }));
const live = (data: unknown) => ({ data, error: null, isLoading: false });
const prefs = { ageMin: 28, ageMax: 42, maxKm: 10, languages: ['da', 'en'], availability: 4 | 16 | 2, sameGenderOnly: false, openToAnyone: false };
jest.mock('@/data/docs', () => ({
  useUserDoc: () => live({ area: { areaId: null }, prefs, aboutMe: '', photo: null, legal: {} }),
  useAreaDoc: () => live(null),
}));

let client: QueryClient;
const wrap = (node: ReactNode) => {
  client = new QueryClient({ defaultOptions: { mutations: { retry: false, gcTime: Infinity } } });
  return <QueryClientProvider client={client}>{node}</QueryClientProvider>;
};
beforeEach(() => {
  mockCall.mockReset();
  mockFinish.mockClear();
  Object.values(mockRouter).forEach((f) => f.mockClear());
});
afterEach(() => client.clear());
const flush = () => act(async () => { await Promise.resolve(); await Promise.resolve(); });

describe('1.6 Who would you like to meet', () => {
  it('moves the age thumbs with screen-reader actions, keeps 5 years apart, and saves without sameGenderOnly', async () => {
    mockCall.mockResolvedValue({ ok: true });
    await render(wrap(<PodPreferences />));
    expect(screen.getByText('Step 5 of 6')).toBeOnTheScreen();
    expect(screen.getByText('Who would you like to meet?')).toBeOnTheScreen();
    expect(screen.getByText('28–42')).toBeOnTheScreen();
    expect(screen.getByText("Starts at your age ±7. Everyone in a pod fits everyone else's range.")).toBeOnTheScreen();
    const oldest = screen.getByLabelText('Oldest age');
    await fireEvent(oldest, 'accessibilityAction', { nativeEvent: { actionName: 'decrement' } });
    expect(screen.getByText('28–41')).toBeOnTheScreen();
    const youngest = screen.getByLabelText('Youngest age');
    for (let i = 0; i < 12; i++) await fireEvent(screen.getByLabelText('Youngest age'), 'accessibilityAction', { nativeEvent: { actionName: 'increment' } });
    expect(screen.getByText('36–41')).toBeOnTheScreen();
    expect(youngest).toBeTruthy();
    await fireEvent.press(screen.getByRole('switch', { name: 'about 25 km' }));
    await fireEvent.press(screen.getByRole('switch', { name: 'Weekdays, daytime' }));
    await fireEvent.press(screen.getByRole('checkbox', { name: 'English' }));
    await fireEvent.press(screen.getByTestId('prefs-save'));
    await flush();
    expect(mockCall).toHaveBeenCalledWith('updateProfile', {
      prefs: { ageMin: 36, ageMax: 41, maxKm: 25, languages: ['da'], availability: 4 | 16 | 2 | 1, openToAnyone: false },
    });
    expect(mockRouter.push).toHaveBeenCalledWith('/done');
  });

  it('turning on same-gender pods opens the gender sheet instead of saving', async () => {
    await render(wrap(<PodPreferences />));
    await fireEvent(screen.getByTestId('prefs-same-gender'), 'valueChange', true);
    expect(screen.getByText('Your gender')).toBeOnTheScreen();
    expect(screen.getByTestId('gender-confirm')).toBeDisabled();
    await fireEvent.press(screen.getByRole('radio', { name: 'Woman' }));
    expect(screen.getByTestId('gender-confirm')).toBeDisabled();
    await fireEvent.press(screen.getByTestId('gender-consent'));
    expect(screen.getByTestId('gender-confirm')).toBeEnabled();
    expect(mockCall).not.toHaveBeenCalled();
  });
});

describe('1.7 Almost done', () => {
  it('needs the pledge, saves a changed about me, then finishes', async () => {
    mockCall.mockResolvedValue({ ok: true });
    await render(wrap(<AlmostDone />));
    expect(screen.getByText('Almost done')).toBeOnTheScreen();
    expect(screen.getByText("Grouper isn't in your area yet. We'll let you know when it is.")).toBeOnTheScreen();
    expect(screen.getByTestId('onboarding-finish')).toBeDisabled();
    await fireEvent.changeText(screen.getByTestId('about-me'), 'New in Aarhus and up for board games');
    expect(screen.getByText('36 / 140')).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('pledge-checkbox'));
    expect(screen.getByTestId('onboarding-finish')).toBeEnabled();
    await fireEvent.press(screen.getByTestId('onboarding-finish'));
    await flush();
    expect(mockCall).toHaveBeenCalledWith('updateProfile', { aboutMe: 'New in Aarhus and up for board games' });
    expect(mockFinish).toHaveBeenCalledTimes(1);
  });

  it('blocks Finish while about me has contact details, and does not finish when the save fails', async () => {
    await render(wrap(<AlmostDone />));
    await fireEvent.press(screen.getByTestId('pledge-checkbox'));
    await fireEvent.changeText(screen.getByTestId('about-me'), 'call me on 12345678');
    expect(screen.getByTestId('onboarding-finish')).toBeDisabled();
    await fireEvent.changeText(screen.getByTestId('about-me'), 'Hello there');
    mockCall.mockRejectedValueOnce({ code: 'UNAVAILABLE' });
    await fireEvent.press(screen.getByTestId('onboarding-finish'));
    await flush();
    expect(mockFinish).not.toHaveBeenCalled();
  });

  it('turns on notifications in place', async () => {
    await render(wrap(<AlmostDone />));
    await fireEvent.press(screen.getByTestId('notifications-enable'));
    await flush();
    expect(mockPush.request).toHaveBeenCalled();
    expect(mockPush.register).toHaveBeenCalled();
    expect(screen.getByText('Notifications are on')).toBeOnTheScreen();
  });
});
