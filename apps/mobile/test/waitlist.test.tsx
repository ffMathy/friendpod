import { getLaunchArea } from '@grouper/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import * as Clipboard from 'expo-clipboard';
import type * as ReactModule from 'react';
import { Share } from 'react-native';
import ThisWeek from '../app/(tabs)/index';
import Area from '../app/(onboarding)/area';

const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: () => true, canDismiss: () => true, dismissAll: jest.fn() };
// WaitlistScreen hides the tab header and the tab bar through the tab's options; there is no navigator in these tests.
const mockNavigation = { setOptions: jest.fn() };
jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual<typeof ReactModule>('react');
  return { useRouter: () => mockRouter, useNavigation: () => mockNavigation, useFocusEffect: (effect: () => void | (() => void)) => useEffect(effect, [effect]) };
});
jest.mock('expo-router/js-tabs', () => ({ Tabs: { Screen: () => null } }));
jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn(async () => true) }));
jest.mock('expo-location', () => ({ requestForegroundPermissionsAsync: jest.fn(), getCurrentPositionAsync: jest.fn(), Accuracy: { Lowest: 1 } }));
jest.mock('@/features/session/SessionProvider', () => ({ useUid: () => 'me', useSession: () => ({ refreshClaims: async () => undefined }) }));
jest.mock('@/features/account/account', () => ({ signOut: async () => undefined }));
jest.mock('@/features/pods/ProposalCard', () => ({ ProposalCard: () => null }));

const live = (data: unknown) => ({ data, error: null, isLoading: false });
const ts = (ms: number) => ({ toMillis: () => ms });
const VEJLE = getLaunchArea('vejle')!;
let mockArea: Record<string, unknown> | null = null;
const mockUser = {
  area: { gh5: VEJLE.cells[0], label: 'Vejle', areaId: 'vejle' },
  lastDrop: null,
  status: 'active',
  participation: { mode: 'auto' },
  prefs: { ageMin: 28, ageMax: 42, maxKm: 10, languages: ['da'], availability: 63, sameGenderOnly: false, openToAnyone: false },
};
jest.mock('@/data/docs', () => ({
  useUserDoc: () => live(mockUser),
  usePodCards: () => live([]),
  useAreaDoc: () => live(mockArea),
  useInterests: () => live([]),
  usePod: () => live(undefined),
}));

const mockCall = jest.fn();
jest.mock('@/firebase/callables', () => ({
  callFunction: (...args: unknown[]) => mockCall(...args),
  toAppError: (e: unknown) => e,
}));

const mockDraft = { legalAccepted: true, dob: '1990-01-01', firstName: 'Ea', gh5: VEJLE.cells[0] };
jest.mock('@/features/onboarding/draft', () => ({ useOnboardingDraft: () => ({ draft: mockDraft, update: jest.fn(), reset: jest.fn() }) }));

const areaDoc = (status: string, waitlistCount: number) => ({
  label: { da: 'Vejle', en: 'Vejle' },
  status,
  profile: 'alpha',
  waitlistCount,
  goal: { waitlist: 250, optedIn: 200, predictedMatchRate: 0.5, consecutiveWeeks: 2 },
  chips: [],
  configVersion: 2,
  updatedAt: ts(0),
});

let client: QueryClient;
async function renderWith(node: React.ReactElement) {
  client = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity }, mutations: { retry: false, gcTime: Infinity } } });
  return render(<QueryClientProvider client={client}>{node}</QueryClientProvider>);
}
afterEach(() => client.clear());

describe('in-app waitlist (§3.1 step 12)', () => {
  it('shows the city, the live counter "N of goal" with a progress bar, and what happens next', async () => {
    mockArea = areaDoc('waitlist', 137);
    await renderWith(<ThisWeek />);
    expect(screen.getByText("You're on the list")).toBeTruthy();
    expect(screen.getByText('Vejle opens soon')).toBeTruthy();
    expect(screen.getByText('Vejle waitlist')).toBeTruthy();
    expect(screen.getByLabelText('137 of 250 signed up')).toBeTruthy();
    expect(screen.getByText('137')).toBeTruthy();
    expect(screen.getByText('of 250')).toBeTruthy();
    expect(screen.getByTestId('waitlist-progress').props.accessibilityValue).toEqual({ min: 0, max: 250, now: 137 });
    expect(screen.getByTestId('waitlist-progress').props.accessibilityLabel).toBe('People on the Vejle waitlist');
    expect(screen.getByText(/Your first drop is the Thursday after, at 18:00\. We'll send you a notification\./)).toBeTruthy();
    expect(screen.queryByTestId('next-drop')).toBeNull();
  });

  it('shows "<10" below 10', async () => {
    mockArea = areaDoc('waitlist', 4);
    await renderWith(<ThisWeek />);
    expect(screen.getByLabelText('<10 of 250 signed up')).toBeTruthy();
    expect(screen.getByText('<10')).toBeTruthy();
  });

  it('shares the city link with the native share sheet and copies it, with no personal data', async () => {
    mockArea = areaDoc('waitlist', 42);
    const share = jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction' } as never);
    await renderWith(<ThisWeek />);
    await act(async () => await fireEvent.press(screen.getByTestId('waitlist-share')));
    expect(share).toHaveBeenCalledTimes(1);
    const [content] = share.mock.calls[0]!;
    // The public brand host, not the Firebase Hosting domain the email sign-in links use (grouper-staging.firebaseapp.com here).
    const link = 'https://grouper.dk/c/vejle';
    expect(content).toMatchObject({ url: link });
    expect((content as { message: string }).message).toContain(link);
    expect((content as { message: string }).message).toContain('Vejle');
    expect(JSON.stringify(content)).not.toMatch(/me\b|Ea|uid|ref=/);

    await act(async () => await fireEvent.press(screen.getByTestId('waitlist-copy')));
    expect(Clipboard.setStringAsync).toHaveBeenCalledWith(link);
    expect(screen.getByText('Copied')).toBeTruthy();
    expect(JSON.stringify(content)).not.toContain('firebaseapp.com');
    // The link is shown without the scheme, on one line, as on the storyboard.
    expect(screen.getByLabelText('grouper.dk/c/vejle')).toBeTruthy();
    expect(screen.getByText('grouper.dk/c/vejle').props.numberOfLines).toBe(1);
  });

  it('stands alone like the storyboard: no tab bar while waitlisted, with a way to Me, and the bar comes back after', async () => {
    mockArea = areaDoc('waitlist', 42);
    mockNavigation.setOptions.mockClear();
    const view = await renderWith(<ThisWeek />);
    expect(mockNavigation.setOptions).toHaveBeenCalledWith({ headerShown: false, tabBarStyle: { display: 'none' } });
    await fireEvent.press(screen.getByRole('link', { name: 'Profile and settings' }));
    expect(mockRouter.push).toHaveBeenCalledWith('/me');
    await view.unmount();
    const restored = mockNavigation.setOptions.mock.calls.at(-1)![0] as { tabBarStyle: { display?: string; backgroundColor?: string } };
    expect(restored.tabBarStyle.display).toBeUndefined();
    expect(restored.tabBarStyle.backgroundColor).toBeTruthy();
  });

  it('points to the interests while you wait', async () => {
    mockArea = areaDoc('waitlist', 42);
    await renderWith(<ThisWeek />);
    await fireEvent.press(screen.getByRole('link', { name: 'Add a few more interests' }));
    expect(mockRouter.push).toHaveBeenCalledWith('/interests');
  });

  it('keeps showing on every open while waitlisted, and gives way to Home when the city goes live', async () => {
    mockArea = areaDoc('waitlist', 12);
    const first = await renderWith(<ThisWeek />);
    expect(screen.getByLabelText('12 of 250 signed up')).toBeTruthy();
    await first.unmount();
    // The next app open: still waitlisted, with a newer count from the live area doc.
    mockArea = areaDoc('waitlist', 13);
    const second = await renderWith(<ThisWeek />);
    expect(screen.getByLabelText('13 of 250 signed up')).toBeTruthy();
    // Beta areas are not matched either.
    mockArea = areaDoc('beta', 13);
    await second.rerender(
      <QueryClientProvider client={client}>
        <ThisWeek />
      </QueryClientProvider>,
    );
    expect(screen.getByText('Vejle opens soon')).toBeTruthy();
    mockArea = areaDoc('live', 260);
    await second.rerender(
      <QueryClientProvider client={client}>
        <ThisWeek />
      </QueryClientProvider>,
    );
    expect(screen.queryByText('Vejle opens soon')).toBeNull();
    // Home before the drop: the next drop with its countdown.
    expect(screen.getByTestId('next-drop')).toBeTruthy();
    expect(screen.getByText('Next drop')).toBeTruthy();
  });

  it('falls back to areas.json when the area doc has not been synced yet', async () => {
    mockArea = null;
    await renderWith(<ThisWeek />);
    expect(screen.getByLabelText('<10 of 250 signed up')).toBeTruthy();
  });
});

describe('"Where did you hear about Grouper?" (optional, single choice)', () => {
  beforeEach(() => mockCall.mockReset().mockResolvedValue({ areaStatus: 'waitlist' }));

  it('sends the one chosen answer with completeOnboarding', async () => {
    await renderWith(<Area />);
    await fireEvent.press(screen.getByTestId('heard-from-friend'));
    await fireEvent.press(screen.getByTestId('heard-from-dadsGroup'));
    expect(screen.getByTestId('heard-from-dadsGroup').props.accessibilityState).toMatchObject({ checked: true });
    expect(screen.getByTestId('heard-from-friend').props.accessibilityState).toMatchObject({ checked: false });
    await act(async () => await fireEvent.press(screen.getByText('Continue')));
    expect(mockCall).toHaveBeenCalledWith('completeOnboarding', expect.objectContaining({ heardFrom: 'dadsGroup' }));
  });

  it('is skippable: no answer, no field', async () => {
    await renderWith(<Area />);
    await fireEvent.press(screen.getByTestId('heard-from-press'));
    await fireEvent.press(screen.getByTestId('heard-from-press'));
    await act(async () => await fireEvent.press(screen.getByText('Continue')));
    expect(mockCall).toHaveBeenCalledTimes(1);
    expect(mockCall.mock.calls[0]![1]).not.toHaveProperty('heardFrom');
  });
});
