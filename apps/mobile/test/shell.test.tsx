import { readFileSync } from 'node:fs';
import { nextDropWeek, type Prefs } from '@grouper/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import i18next from 'i18next';
import type { ReactElement } from 'react';
import { Alert, Linking, type AlertButton } from 'react-native';
import Me from '../app/(tabs)/me';
import HowMatchingWorks from '../app/info/how-matching-works';
import LegalDoc from '../app/info/legal/[doc]';
import Safety from '../app/info/safety';
import SensitiveInterests from '../app/info/sensitive-interests';
import Settings from '../app/settings/index';
import NotificationSettings from '../app/settings/notifications';
import { Colors, POD_PALETTE } from '@/components/theme';
import { FONT_CREDITS } from '@/features/shell/licences';
import { MainTabBar, tabUnder } from '@/features/shell/MainTabBar';
import { formatDay } from '@/features/shell/parts';
import { prefsSummary } from '@/features/shell/prefsSummary';
import { initI18n } from '@/i18n';
import { podColorFor } from '@/lib/podColor';

const mockRouter = { push: jest.fn(), back: jest.fn(), dismissTo: jest.fn(), canGoBack: jest.fn(() => true) };
let mockParams: Record<string, string> = {};
jest.mock('expo-router', () => ({ useRouter: () => mockRouter, useLocalSearchParams: () => mockParams }));
jest.mock('expo-router/js-tabs', () => ({ Tabs: { Screen: () => null } }));
let mockPhase = 'ready';
jest.mock('@/features/session/SessionProvider', () => ({ useUid: () => 'me', useSession: () => ({ phase: mockPhase }) }));

const mockCall = jest.fn();
jest.mock('@/firebase/callables', () => ({
  callFunction: (...args: unknown[]) => mockCall(...args),
  toAppError: (e: unknown) => e,
}));
const mockSignOut = jest.fn(async () => undefined);
jest.mock('@/features/account/account', () => ({ signOut: () => mockSignOut() }));
const mockClearImageCaches = jest.fn(async () => undefined);
jest.mock('@/features/account/clearDeviceData', () => ({ clearImageCaches: () => mockClearImageCaches() }));
const mockChoose = jest.fn(async () => undefined);
jest.mock('@/features/photos/upload', () => ({ usePhotoUpload: () => ({ state: 'idle', choose: () => mockChoose() }) }));
jest.mock('@/features/photos/AuthenticatedPhoto', () => ({ AuthenticatedPhoto: () => null }));
const mockPush = { granted: false, request: jest.fn(async () => true), register: jest.fn(async () => undefined), unregister: jest.fn(async () => undefined) };
jest.mock('@/features/notifications/push', () => ({
  pushPermissionGranted: async () => mockPush.granted,
  requestPushPermission: () => mockPush.request(),
  registerPushToken: () => mockPush.register(),
  unregisterPush: () => mockPush.unregister(),
}));

const live = (data: unknown) => ({ data, error: null, isLoading: false });
let mockUser: Record<string, unknown> = {};
let mockBlocks: unknown[] = [];
let mockInterests: unknown[] = [];
let mockSensitive: unknown[] = [];
jest.mock('@/data/docs', () => ({
  useUserDoc: () => live(mockUser),
  useBlocks: () => live(mockBlocks),
  useInterests: () => live(mockInterests),
  useSensitiveInterests: () => live(mockSensitive),
}));

const interest = (id: string, display: string, conceptId: string, starred = false) => ({ id, data: { display, norm: display, conceptId, starred } });

function user(over: Record<string, unknown> = {}) {
  return {
    firstName: 'Emil',
    area: { gh5: 'u1zr2', label: 'Aarhus C', areaId: 'aarhus' },
    prefs: { ageMin: 28, ageMax: 42, maxKm: 10, languages: ['da', 'en'], availability: 0, sameGenderOnly: false, openToAnyone: false },
    photo: { v: 3 },
    stats: { attended: 2, noShows: 1, lateCancels: 0 },
    status: 'active',
    participation: { mode: 'auto' },
    lastDrop: null,
    aboutMe: 'Always up for a game',
    ...over,
  };
}

let client: QueryClient;
async function renderWith(ui: ReactElement) {
  client = new QueryClient({ defaultOptions: { mutations: { retry: false, gcTime: Infinity } } });
  await render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

let alert: jest.SpyInstance;
beforeEach(() => {
  jest.clearAllMocks();
  mockCall.mockResolvedValue({ ok: true });
  mockUser = user();
  mockBlocks = [];
  mockInterests = [interest('i1', 'brætspil', 'seed_board_games', true), interest('i2', 'sourdough', 'seed_sourdough')];
  mockSensitive = [{ id: 's1', data: { display: 'gravid', norm: 'gravid', conceptId: 'c_private', starred: false } }];
  mockParams = {};
  mockPhase = 'ready';
  mockPush.granted = false;
  alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
});
afterEach(() => {
  alert.mockRestore();
  client?.clear();
});

describe('Me', () => {
  it('shows the profile: name, area, the own attendance record and "About me"', async () => {
    await renderWith(<Me />);
    expect(screen.getByRole('header', { name: 'Me' })).toBeOnTheScreen();
    expect(screen.getByText('Emil')).toBeOnTheScreen();
    expect(screen.getByText('Aarhus C')).toBeOnTheScreen();
    expect(screen.getByText('Attended 2 of 3 meetups')).toBeOnTheScreen();
    expect(screen.getByDisplayValue('Always up for a game')).toBeOnTheScreen();
    expect(screen.getByText(/In pods about a private interest, you choose per pod/)).toBeOnTheScreen();
  });

  it('shows the interests as pod chips in their word\'s colour, the main one starred; private ones only as a quiet count', async () => {
    await renderWith(<Me />);
    // The colour comes from the word: brætspil is Tomat, sourdough Solsikke (whatever their concept ids).
    expect(podColorFor({ word: 'brætspil' })).toBe('tomat');
    expect(screen.getByTestId('me-interest-i1')).toHaveStyle({ backgroundColor: POD_PALETTE.tomat.tint });
    expect(screen.getByTestId('me-interest-i2')).toHaveStyle({ backgroundColor: POD_PALETTE.solsikke.tint });
    expect(screen.getByLabelText('Main interest')).toBeOnTheScreen();
    // Private interests are never named here: a count with the lock.
    expect(screen.queryByText('gravid')).toBeNull();
    expect(screen.getByText('1 private interest')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('link', { name: 'Edit your interests' }));
    expect(mockRouter.push).toHaveBeenCalledWith('/interests');
  });

  it('says when there are no interests yet', async () => {
    mockInterests = [];
    mockSensitive = [];
    await renderWith(<Me />);
    expect(screen.getByText('No interests yet. Add a few so we can find you a pod.')).toBeOnTheScreen();
    expect(screen.queryByTestId('me-private-count')).toBeNull();
  });

  it('deletes the photo with a Danger outline button', async () => {
    await renderWith(<Me />);
    expect(screen.getByTestId('photo-delete')).toHaveStyle({ borderColor: Colors.light.danger, backgroundColor: Colors.light.surface });
  });

  it('says when there are no meetups yet, and offers to add a photo when there is none', async () => {
    mockUser = user({ photo: null, stats: { attended: 0, noShows: 0, lateCancels: 0 } });
    await renderWith(<Me />);
    expect(screen.getByText('No meetups yet')).toBeOnTheScreen();
    expect(screen.queryByTestId('photo-delete')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Add a photo' }));
    expect(mockChoose).toHaveBeenCalled();
  });

  it('deletes the photo only after a confirmation, then clears the image caches', async () => {
    await renderWith(<Me />);
    await fireEvent.press(screen.getByTestId('photo-delete'));
    expect(mockCall).not.toHaveBeenCalled();
    const buttons = alert.mock.calls.at(-1)?.[2] as AlertButton[];
    await act(async () => {
      buttons.find((b) => b.style === 'destructive')?.onPress?.();
    });
    expect(mockCall).toHaveBeenCalledWith('deletePhoto', {});
    expect(mockClearImageCaches).toHaveBeenCalled();
  });

  it('weekly drops: the standing mode is a choice of two, skip and pause are Home\'s one-off actions', async () => {
    mockCall.mockResolvedValue({ effectiveWeekId: '2026-W47' });
    await renderWith(<Me />);
    expect(screen.getByText("You're in this week")).toBeOnTheScreen();
    expect(screen.getByRole('radio', { name: 'Every week' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'When I opt in' })).not.toBeChecked();
    // The one-off actions carry Home's labels (drop-home), not a third and fourth mode.
    expect(screen.queryByRole('radio', { name: /Skip|Pause/ })).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Skip this week' }));
    expect(mockCall).toHaveBeenLastCalledWith('setParticipation', { mode: 'skipNext' });
    await fireEvent.press(screen.getByRole('button', { name: 'Pause matching' }));
    expect(mockCall).toHaveBeenLastCalledWith('setParticipation', { mode: 'pause' });
    await fireEvent.press(screen.getByRole('radio', { name: 'When I opt in' }));
    expect(mockCall).toHaveBeenLastCalledWith('setParticipation', { mode: 'manual' });
    expect(screen.getByText('Applies from week 47')).toBeOnTheScreen();
  });

  it('skipping this week offers the way back in', async () => {
    mockUser = user({ participation: { mode: 'auto', skipWeekId: nextDropWeek(Date.now()) } });
    await renderWith(<Me />);
    expect(screen.getByText("You're skipping this week")).toBeOnTheScreen();
    expect(screen.getByRole('radio', { name: 'Every week' })).toBeChecked();
    await fireEvent.press(screen.getByRole('button', { name: 'Join this week' }));
    expect(mockCall).toHaveBeenCalledWith('setParticipation', { mode: 'auto' });
  });

  it('a paused account keeps its mode and offers "Resume matching"', async () => {
    mockUser = user({ status: 'paused', participation: { mode: 'manual', pauseReason: 'user' } });
    await renderWith(<Me />);
    expect(screen.getByText('Matching is paused')).toBeOnTheScreen();
    expect(screen.getByRole('radio', { name: 'When I opt in' })).toBeChecked();
    expect(screen.queryByRole('button', { name: 'Pause matching' })).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Resume matching' }));
    expect(mockCall).toHaveBeenCalledWith('setParticipation', { mode: 'manual' });
  });

  it('an automated pause can\'t be lifted from Me: the modes are disabled and no action shows', async () => {
    mockUser = user({ status: 'paused', participation: { mode: 'auto', pauseReason: 'reports' } });
    await renderWith(<Me />);
    expect(screen.getByRole('radio', { name: 'Every week' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Resume matching' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Pause matching' })).toBeNull();
  });

  it('names a setting that keeps the user out of pods, with a way to change it', async () => {
    mockUser = user({ lastDrop: { weekId: '2026-W45', outcome: 'unmatched', reason: 'RADIUS' } });
    await renderWith(<Me />);
    expect(screen.getByText('Your distance is short for your area. Going a little further would help.')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Change preferences' }));
    expect(mockRouter.push).toHaveBeenCalledWith('/settings/preferences');
  });

  it('links to preferences (with a summary), privacy, messages, settings and the info pages', async () => {
    await renderWith(<Me />);
    // Two lines: the ages and distance, then the languages (the matcher folds the line break into a space).
    expect(screen.getByText('Ages 28–42 · about 10 km Danish, English')).toBeOnTheScreen();
    expect(screen.getByText('Language, notifications, legal, sign out')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('link', { name: /Pod preferences/ }));
    await fireEvent.press(screen.getByRole('link', { name: /^Privacy/ }));
    await fireEvent.press(screen.getByRole('link', { name: /Messages from Friendpod/ }));
    await fireEvent.press(screen.getByRole('link', { name: /^Settings/ }));
    await fireEvent.press(screen.getByRole('link', { name: 'How matching works' }));
    await fireEvent.press(screen.getByRole('link', { name: 'Meeting safely' }));
    await fireEvent.press(screen.getByRole('link', { name: 'Private interests' }));
    expect(mockRouter.push.mock.calls.map((c) => c[0])).toEqual([
      '/settings/preferences',
      '/settings/privacy',
      '/settings/notices',
      '/settings',
      '/info/how-matching-works',
      '/info/safety',
      '/info/sensitive-interests',
    ]);
  });

  it('the summary names the languages as the preferences page does, in both app languages', async () => {
    initI18n('da');
    try {
      await renderWith(<Me />);
      expect(screen.getByText('28–42 år · ca. 10 km Dansk, Engelsk')).toBeOnTheScreen();
    } finally {
      await act(async () => {
        initI18n('en');
      });
    }
  });

  it('the summary puts the languages on their own line, so no "·" is left at the end of a line', () => {
    const prefs: Pick<Prefs, 'ageMin' | 'ageMax' | 'maxKm' | 'languages'> = { ageMin: 28, ageMax: 42, maxKm: 10, languages: ['da', 'en'] };
    // Spaces inside a part don't break (NBSP); the only break is before the languages.
    expect(prefsSummary(i18next.t, prefs)).toBe('Ages\u00a028–42 · about\u00a010\u00a0km\nDanish, English');
  });

  it('"About me" offers Save only once the text has changed, then saves it', async () => {
    await renderWith(<Me />);
    expect(screen.queryByTestId('about-me-save')).toBeNull();
    await fireEvent.changeText(screen.getByTestId('about-me'), 'New in town, always up for a board game');
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    expect(mockCall).toHaveBeenCalledWith('updateProfile', { aboutMe: 'New in town, always up for a board game' });
  });

  it('"About me" refuses contact details before saving', async () => {
    await renderWith(<Me />);
    await fireEvent.changeText(screen.getByTestId('about-me'), 'Text me on 12 34 56 78');
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    expect(mockCall).not.toHaveBeenCalled();
  });
});

describe('main tab bar under Settings', () => {
  it('shows the four tabs with Me selected, and a tab goes back down to it', async () => {
    await renderWith(<MainTabBar selected="me" />);
    expect(screen.getByRole('tab', { name: 'Me' })).toBeSelected();
    expect(screen.getByRole('tab', { name: 'This week' })).not.toBeSelected();
    await fireEvent.press(screen.getByRole('tab', { name: 'This week' }));
    await fireEvent.press(screen.getByRole('tab', { name: 'Me' }));
    expect(mockRouter.dismissTo.mock.calls.map((c) => c[0])).toEqual(['/', '/me']);
  });
});

describe('tab under an info page', () => {
  const r = (name: string, state?: { index?: number; routes: { name: string }[] }) => ({ name, ...(state ? { state } : {}) });
  const tabs = (focused: string) => r('(tabs)', { index: 0, routes: [{ name: focused }] });
  it('keeps the tab it was opened from: the open tab, Pods under a pod, Me under Settings, through a sheet', () => {
    expect(tabUnder({ routes: [tabs('me'), r('info')] }, 'info')).toBe('me');
    expect(tabUnder({ routes: [tabs('index'), r('sheets'), r('info')] }, 'info')).toBe('index');
    expect(tabUnder({ routes: [tabs('pods'), r('pod/[podId]'), r('info')] }, 'info')).toBe('pods');
    expect(tabUnder({ routes: [tabs('me'), r('settings', { index: 1, routes: [{ name: 'index' }, { name: 'privacy' }] }), r('info')] }, 'info')).toBe('me');
  });
  it('stays full screen over a full-screen flow or outside the signed-in app, and is Me\'s on its own', () => {
    expect(tabUnder({ routes: [tabs('me'), r('settings', { index: 1, routes: [{ name: 'privacy' }, { name: 'sensitive-consent' }] }), r('info')] }, 'info')).toBeNull();
    expect(tabUnder({ routes: [r('(auth)'), r('info')] }, 'info')).toBeNull();
    expect(tabUnder({ routes: [r('(onboarding)'), r('info')] }, 'info')).toBeNull();
    expect(tabUnder({ routes: [r('info')] }, 'info')).toBe('me');
    expect(tabUnder({ routes: [tabs('me')] }, 'info')).toBeNull();
  });
  it('finds the app\'s stack inside the container\'s', () => {
    const root = (...routes: { name: string }[]) => ({ index: 0, routes: [r('__root', { index: routes.length - 1, routes })] });
    expect(tabUnder(root(r('info')), 'info')).toBe('me');
    expect(tabUnder(root(tabs('pods'), r('info')), 'info')).toBe('pods');
    expect(tabUnder(root(r('(auth)'), r('info')), 'info')).toBeNull();
  });
});

describe('formatDay', () => {
  it('drops the year within the current year and keeps it before', () => {
    const now = Date.UTC(2026, 10, 6, 12);
    expect(formatDay(Date.UTC(2026, 9, 31, 12), 'en', now)).toBe('31 Oct');
    expect(formatDay(Date.UTC(2026, 9, 31, 12), 'da', now)).toBe('31. okt.');
    expect(formatDay(Date.UTC(2025, 9, 31, 12), 'en', now)).toBe('31 Oct 2025');
  });
});

describe('Settings', () => {
  afterEach(async () => {
    await act(async () => {
      initI18n('en');
    });
  });

  it('switches the language on the profile, then in the app', async () => {
    await renderWith(<Settings />);
    expect(screen.getByRole('radio', { name: 'English' })).toBeChecked();
    await fireEvent.press(screen.getByRole('radio', { name: 'Dansk' }));
    expect(mockCall).toHaveBeenCalledWith('updateProfile', { locale: 'da' });
    expect(screen.getByRole('header', { name: 'Indstillinger' })).toBeOnTheScreen();
  });

  it('holds what Me promises (language, notifications, legal, sign out) plus Privacy for the locked "Settings → Privacy"', async () => {
    await renderWith(<Settings />);
    await fireEvent.press(screen.getByRole('link', { name: /Notifications/ }));
    await fireEvent.press(screen.getByRole('link', { name: /^Privacy(?! notice)/ }));
    await fireEvent.press(screen.getByRole('link', { name: 'Terms' }));
    expect(mockRouter.push).toHaveBeenCalledWith('/settings/notifications');
    expect(mockRouter.push).toHaveBeenCalledWith('/settings/privacy');
    expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/info/legal/[doc]', params: { doc: 'terms' } });
    // Pod preferences and messages from Friendpod are on Me, blocked people under Privacy: not repeated here.
    expect(screen.queryByRole('link', { name: /Pod preferences/ })).toBeNull();
    expect(screen.queryByRole('link', { name: /Messages from Friendpod/ })).toBeNull();
    expect(screen.queryByRole('link', { name: /Blocked people/ })).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Sign out' }));
    expect(mockSignOut).toHaveBeenCalled();
  });

  it('goes back with the back chevron', async () => {
    await renderWith(<Settings />);
    await fireEvent.press(screen.getByRole('button', { name: 'Back' }));
    expect(mockRouter.back).toHaveBeenCalled();
  });
});

describe('Notifications', () => {
  it('turns them on: asks for the permission and registers the token', async () => {
    await renderWith(<NotificationSettings />);
    await fireEvent.press(screen.getByRole('button', { name: 'Turn on notifications' }));
    expect(mockPush.request).toHaveBeenCalled();
    expect(mockPush.register).toHaveBeenCalled();
    expect(screen.getByText('Notifications are on')).toBeOnTheScreen();
    expect(screen.getByText("Who is in a pod, what it's about, your interests or what anyone wrote.")).toBeOnTheScreen();
  });

  it('turns them off: drops the token and opens the phone settings', async () => {
    mockPush.granted = true;
    const open = jest.spyOn(Linking, 'openSettings').mockResolvedValue(undefined);
    await renderWith(<NotificationSettings />);
    await fireEvent.press(await screen.findByRole('button', { name: 'Turn off in phone settings' }));
    expect(mockPush.unregister).toHaveBeenCalled();
    expect(open).toHaveBeenCalled();
    open.mockRestore();
  });
});

describe('info pages', () => {
  it('"How matching works" lists every automated pause with its length, meet-again and that nobody reviews', async () => {
    await renderWith(<HowMatchingWorks />);
    expect(screen.getByText('Two independent reports within 30 days, or one safety report: no drops for 28 days.')).toBeOnTheScreen();
    expect(screen.getByText('Two missed meetups within 8 weeks: a 2-week pause. Three: no drops for 8 weeks.')).toBeOnTheScreen();
    // The reasons are quoted with the report sheet's own option labels.
    expect(screen.getByText('A report marked “May be under 18”: no drops for 28 days. A new such report from another pod starts it again.')).toBeOnTheScreen();
    expect(screen.getByText('A report marked “Not a genuine member”: no pods about private interests for 28 days.')).toBeOnTheScreen();
    expect(screen.getByText(/can be matched again after 4 weeks/)).toBeOnTheScreen();
    expect(screen.getByText(/Photos, your “About me”/)).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: 'No person reviews these decisions' })).toBeOnTheScreen();
    expect(screen.getByText('Private interests')).toBeOnTheScreen();
  });

  it('"How matching works": pausing is a link to Me when signed in, a note when signed out', async () => {
    await renderWith(<HowMatchingWorks />);
    await fireEvent.press(screen.getByRole('link', { name: /Pause matching/ }));
    expect(mockRouter.dismissTo).toHaveBeenCalledWith('/me');
    mockPhase = 'signedOut';
    await renderWith(<HowMatchingWorks />);
    expect(screen.queryByRole('link', { name: /Pause matching/ })).toBeNull();
    expect(screen.getByText('You can pause matching at any time.')).toBeOnTheScreen();
  });

  it('safety shows 112 and every tip, and signed in the pledge the user agreed to', async () => {
    await renderWith(<Safety />);
    expect(screen.getByText('In danger right now? Call 112.')).toBeOnTheScreen();
    expect(screen.getByText('Never share your home address.')).toBeOnTheScreen();
    expect(screen.getByText('Use Report in the pod if something feels wrong.')).toBeOnTheScreen();
    expect(screen.getByText(/^I'll meet in public places/)).toBeOnTheScreen();
    mockPhase = 'signedOut';
    await renderWith(<Safety />);
    expect(screen.queryByTestId('safety-pledge')).toBeNull();
  });

  it('private interests: titled as the storyboards name them; the box on adding one says it in the page\'s voice, not the field\'s tip', async () => {
    await renderWith(<SensitiveInterests />);
    expect(screen.getByRole('header', { name: 'Private interests' })).toBeOnTheScreen();
    expect(screen.getByText('When you add an interest')).toBeOnTheScreen();
    expect(screen.getByText(/^If it says something about your health, beliefs, sexuality, politics, ethnic origin or union membership/)).toBeOnTheScreen();
    expect(screen.queryByText(/^Tip:/)).toBeNull();
    expect(screen.queryByText(/Settings → Privacy/)).toBeNull();
  });

  it('how matching works, in Danish: the report reasons are the report sheet\'s own labels', async () => {
    initI18n('da');
    try {
      await renderWith(<HowMatchingWorks />);
      expect(screen.getByText(/^En anmeldelse med begrundelsen »Kan være under 18«: ingen drops i 28 dage\./)).toBeOnTheScreen();
      expect(screen.getByText('En anmeldelse med begrundelsen »Ikke et ægte medlem«: ingen pods om private interesser i 28 dage.')).toBeOnTheScreen();
    } finally {
      await act(async () => {
        initI18n('en');
      });
    }
  });

  it('legal pages are marked as drafts with the month of the draft, never the raw version id; an unknown page says so', async () => {
    mockParams = { doc: 'terms' };
    await renderWith(<LegalDoc />);
    expect(screen.getByText('Draft')).toBeOnTheScreen();
    // The Ink status pill (blend-spec 6.4), not an ad-hoc outline badge.
    expect(screen.getByTestId('legal-draft')).toHaveStyle({ backgroundColor: Colors.light.ink });
    expect(screen.getByText('Draft')).toHaveStyle({ color: Colors.light.onInk });
    expect(screen.getByText('Version of November 2026')).toBeOnTheScreen();
    expect(screen.queryByText(/draft-1/)).toBeNull();
    mockParams = { doc: 'nope' };
    await renderWith(<LegalDoc />);
    expect(screen.getByText('This page does not exist.')).toBeOnTheScreen();
  });

  it('licences credit the postcode data, both bundled fonts with their full licences, and the open-source software', async () => {
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    mockParams = { doc: 'licences' };
    await renderWith(<LegalDoc />);
    await fireEvent.press(screen.getByText('GeoNames (www.geonames.org)'));
    await fireEvent.press(screen.getByText('CC BY 4.0'));
    expect(open.mock.calls.map((c) => c[0])).toEqual(['https://www.geonames.org', 'https://creativecommons.org/licenses/by/4.0/']);
    expect(screen.getByText('Plus Jakarta Sans, SIL Open Font License 1.1')).toBeOnTheScreen();
    expect(screen.getByText('Bricolage Grotesque, SIL Open Font License 1.1')).toBeOnTheScreen();
    expect(screen.queryByTestId('font-licence-text-bricolage-grotesque')).toBeNull();
    await fireEvent.press(screen.getByRole('link', { name: 'Show the licence for Bricolage Grotesque' }));
    expect(screen.getByTestId('font-licence-text-bricolage-grotesque')).toHaveTextContent(/SIL OPEN FONT LICENSE Version 1\.1/);
    expect(screen.getByTestId('font-licence-text-bricolage-grotesque')).toHaveTextContent(/The Bricolage Grotesque Project Authors/);
    expect(screen.getByRole('link', { name: 'Hide the licence for Bricolage Grotesque' })).toBeOnTheScreen();
    expect(screen.queryByTestId('font-licence-text-plus-jakarta-sans')).toBeNull();
    expect(screen.getByText('React Native Firebase')).toBeOnTheScreen();
    expect(screen.getByText('React and React Native')).toBeOnTheScreen();
    expect(screen.getByText('EmbeddingGemma 2 (the on-device model)')).toBeOnTheScreen();
    open.mockRestore();
  });

  it('the font licences are the packages\' LICENSE_FONT files, verbatim', () => {
    const file = (pkg: string) => readFileSync(require.resolve(`@expo-google-fonts/${pkg}/LICENSE_FONT`), 'utf8').trimEnd();
    expect(FONT_CREDITS.map((f) => f.name)).toEqual(['Plus Jakarta Sans', 'Bricolage Grotesque']);
    expect(FONT_CREDITS[0]?.licenceText).toBe(file('plus-jakarta-sans'));
    expect(FONT_CREDITS[1]?.licenceText).toBe(file('bricolage-grotesque'));
  });

  it('licences: in Danish the names are joined and the model described in Danish', async () => {
    mockParams = { doc: 'licences' };
    initI18n('da');
    try {
      await renderWith(<LegalDoc />);
      expect(screen.getByText('React og React Native')).toBeOnTheScreen();
      expect(screen.getByText('Expo, Expo Router og Expo Modules')).toBeOnTheScreen();
      expect(screen.getByText('EmbeddingGemma 2 (modellen på telefonen)')).toBeOnTheScreen();
      expect(screen.queryByText(/ and |on-device/)).toBeNull();
    } finally {
      await act(async () => {
        initI18n('en');
      });
    }
  });
});
