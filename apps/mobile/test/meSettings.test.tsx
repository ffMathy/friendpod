import { currentLegalText, POSTCODE_ATTRIBUTION } from '@grouper/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import Me from '../app/(tabs)/(me)/me';
import HowMatchingWorks from '../app/info/how-matching-works';
import LegalDoc from '../app/info/legal/[doc]';
import Safety from '../app/info/safety';
import SensitiveInterests from '../app/info/sensitive-interests';
import Blocked from '../app/settings/blocked';
import Settings from '../app/settings/index';
import NotificationSettings from '../app/settings/notifications';

const mockRouter = { push: jest.fn(), back: jest.fn(), replace: jest.fn(), dismissTo: jest.fn(), canGoBack: jest.fn(() => true) };
let mockParams: Record<string, string> = {};
jest.mock('expo-router', () => ({ useRouter: () => mockRouter, useLocalSearchParams: () => mockParams }));
jest.mock('@/features/session/SessionProvider', () => ({ useUid: () => 'me' }));
jest.mock('@/features/photos/PhotoCard', () => ({ PhotoCard: () => null }));
jest.mock('@/features/account/account', () => ({ signOut: jest.fn(async () => undefined) }));
jest.mock('@/features/notifications/push', () => ({
  pushPermissionGranted: jest.fn(async () => false),
  requestPushPermission: jest.fn(async () => true),
  registerPushToken: jest.fn(async () => undefined),
  unregisterPush: jest.fn(async () => undefined),
}));

const mockCall = jest.fn();
jest.mock('@/firebase/callables', () => ({
  callFunction: (...args: unknown[]) => mockCall(...args),
  toAppError: (e: unknown) => e,
}));

const live = (data: unknown) => ({ data, error: null, isLoading: false });
let mockUser: Record<string, unknown> = {};
jest.mock('@/data/docs', () => ({
  useUserDoc: () => live(mockUser),
  useBlocks: () => live([]),
}));

function user(over: Record<string, unknown> = {}) {
  return {
    firstName: 'Mia',
    area: { label: 'Aarhus C' },
    photo: null,
    aboutMe: '',
    stats: { attended: 3, noShows: 1 },
    participation: { mode: 'auto' },
    status: 'active',
    prefs: { sameGenderOnly: false },
    ...over,
  };
}

let client: QueryClient;
async function renderWith(ui: ReactElement) {
  client = new QueryClient({ defaultOptions: { mutations: { retry: false, gcTime: Infinity } } });
  await render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

beforeEach(() => {
  jest.clearAllMocks();
  mockCall.mockResolvedValue({ effectiveWeekId: '2026-W46' });
  mockUser = user();
  mockParams = {};
});
afterEach(() => client.clear());

describe('Me', () => {
  it('shows the profile, record and participation, and links to Privacy', async () => {
    await renderWith(<Me />);
    expect(screen.getByRole('header', { name: 'Mia' })).toBeOnTheScreen();
    expect(screen.getByText('Aarhus C')).toBeOnTheScreen();
    expect(screen.getByText('3/4 attended')).toBeOnTheScreen();
    expect(screen.getByRole('switch', { name: 'Every week' })).toBeChecked();
    await fireEvent.press(screen.getByRole('switch', { name: 'Skip next drop' }));
    expect(mockCall).toHaveBeenCalledWith('setParticipation', { mode: 'skipNext' });
    expect(screen.getByText('Applies from week 2026-W46')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('link', { name: /^Privacy/ }));
    expect(mockRouter.push).toHaveBeenCalledWith('/settings/privacy');
  });

  it('names the setting that blocks matching, with a way to change it', async () => {
    mockUser = user({ lastDrop: { outcome: 'unmatched', reason: 'RADIUS' } });
    await renderWith(<Me />);
    expect(screen.getByText('Your distance is small for your area. A larger distance would help.')).toBeOnTheScreen();
    // The banner's link comes first; the list row below opens the same page.
    await fireEvent.press(screen.getAllByRole('link', { name: 'Pod preferences' })[0]!);
    expect(mockRouter.push).toHaveBeenCalledWith('/settings/preferences');
  });
});

describe('Settings', () => {
  it('lists the settings and the legal pages, and goes back from the in-page header', async () => {
    await renderWith(<Settings />);
    await fireEvent.press(screen.getByRole('link', { name: 'Terms' }));
    expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/info/legal/[doc]', params: { doc: 'terms' } });
    // Privacy is a page of the Me tab (storyboard 5.3): Settings closes and shows it there.
    await fireEvent.press(screen.getByRole('link', { name: 'Privacy' }));
    expect(mockRouter.dismissTo).toHaveBeenCalledWith('/settings/privacy', { withAnchor: true });
    await fireEvent.press(screen.getByRole('link', { name: 'Messages from Grouper' }));
    expect(mockRouter.push).toHaveBeenCalledWith('/settings/notices');
    await fireEvent.press(screen.getByRole('button', { name: 'Back' }));
    expect(mockRouter.back).toHaveBeenCalled();
    mockRouter.canGoBack.mockReturnValueOnce(false);
    await fireEvent.press(screen.getByRole('button', { name: 'Back' }));
    expect(mockRouter.replace).toHaveBeenCalledWith('/me', { withAnchor: true });
  });

  it('says when nobody is blocked', async () => {
    await renderWith(<Blocked />);
    expect(screen.getByText("You haven't blocked anyone.")).toBeOnTheScreen();
  });

  it('notifications explain what pushes contain', async () => {
    await renderWith(<NotificationSettings />);
    expect(screen.getByText(/never an interest, a name or the message/)).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Turn on notifications' })).toBeOnTheScreen();
  });
});

describe('info pages', () => {
  it('how matching works lists every automated pause and that no person reviews them', async () => {
    await renderWith(<HowMatchingWorks />);
    expect(screen.getByRole('header', { name: 'Automatic pauses' })).toBeOnTheScreen();
    expect(screen.getByText(/Two missed meetups within 8 weeks/)).toBeOnTheScreen();
    expect(screen.getByText(/No person reviews these decisions/)).toBeOnTheScreen();
  });

  it('safety tips include 112', async () => {
    await renderWith(<Safety />);
    expect(screen.getByText('Use Report if something feels wrong; call 112 in an emergency.')).toBeOnTheScreen();
  });

  it('sensitive interests shows the standing notice verbatim', async () => {
    const notice = currentLegalText('interestNotice', 'en');
    await renderWith(<SensitiveInterests />);
    if (notice.kind === 'interestNotice') expect(screen.getByText(notice.content.text)).toBeOnTheScreen();
  });

  it('legal pages show the draft, its version or the attribution', async () => {
    mockParams = { doc: 'licences' };
    await renderWith(<LegalDoc />);
    expect(screen.getByRole('header', { name: 'Licences' })).toBeOnTheScreen();
    expect(screen.getByText(POSTCODE_ATTRIBUTION)).toBeOnTheScreen();
    client.clear();
    mockParams = { doc: 'nope' };
    await renderWith(<LegalDoc />);
    expect(screen.getByText('This page does not exist.')).toBeOnTheScreen();
  });
});
