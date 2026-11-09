import { currentLegalText } from '@grouper/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import { Alert, Linking, type AlertButton } from 'react-native';
import { Colors } from '@/components/theme';
import Welcome from '../app/(auth)/index';
import DeleteAccount from '../app/settings/delete-account';
import Notices from '../app/settings/notices';
import Privacy from '../app/settings/privacy';
import SettingsSensitiveConsent from '../app/settings/sensitive-consent';

const mockRouter = { push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: () => true };
// Screens that draw their own header hide the native one with <Stack.Screen options={{ headerShown: false }} />.
// useFocusEffect: the welcome sets the status bar while it is in front (signIn.test covers it).
jest.mock('expo-router', () => ({ useRouter: () => mockRouter, useLocalSearchParams: () => ({}), Stack: { Screen: () => null }, useFocusEffect: () => undefined }));
jest.mock('@/features/session/SessionProvider', () => ({ useUid: () => 'me' }));

const mockCall = jest.fn();
jest.mock('@/firebase/callables', () => ({
  callFunction: (...args: unknown[]) => mockCall(...args),
  toAppError: (e: unknown) => e,
}));
const mockRequestExport = jest.fn();
const mockDeleteAccount = jest.fn();
let mockDeleted = false;
jest.mock('@/features/account/account', () => ({
  requestDataExport: () => mockRequestExport(),
  deleteAccount: () => mockDeleteAccount(),
  consumeAccountDeleted: () => {
    const was = mockDeleted;
    mockDeleted = false;
    return was;
  },
}));
// The welcome screen carries the sign-in buttons (Main.dc.html); their providers load native modules.
jest.mock('@/features/auth/apple', () => ({ isAppleSignInAvailable: async () => false, signInWithApple: jest.fn() }));
jest.mock('@/features/auth/google', () => ({ signInWithGoogle: jest.fn() }));
const mockDownload = jest.fn(async () => undefined);
jest.mock('@/features/account/exportDownload', () => ({
  downloadExport: (...args: unknown[]) => mockDownload(...(args as [])),
}));
const mockClearImageCaches = jest.fn(async () => undefined);
jest.mock('@/features/account/clearDeviceData', () => ({ clearImageCaches: () => mockClearImageCaches() }));

const ts = (ms: number) => ({ toMillis: () => ms });
const live = (data: unknown) => ({ data, error: null, isLoading: false });
const NOW = Date.now();
let mockUser: Record<string, unknown> = {};
let mockExports: unknown[] = [];
let mockNotices: unknown[] = [];
let mockBlocks: unknown[] = [];
jest.mock('@/data/docs', () => ({
  useUserDoc: () => live(mockUser),
  useSensitiveInterests: () => live([{ id: 'p1', data: {} }, { id: 'p2', data: {} }]),
  useExports: () => live(mockExports),
  useBlocks: () => live(mockBlocks),
  useNotices: () => live(mockNotices),
}));

function user(over: Record<string, unknown> = {}) {
  return {
    prefs: { sameGenderOnly: false },
    photo: { v: 3 },
    status: 'active',
    participation: { mode: 'auto' },
    legal: { terms: 't', privacy: 'p', art9: { textVersion: 'art9-blanket-en-v1', textSha256: 'x', at: ts(0) } },
    ...over,
  };
}

let client: QueryClient;
async function renderWith(ui: ReactElement) {
  client = new QueryClient({ defaultOptions: { mutations: { retry: false, gcTime: Infinity } } });
  await render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}
async function confirmAlert(alert: jest.SpyInstance) {
  const buttons = alert.mock.calls.at(-1)?.[2] as AlertButton[];
  await act(async () => {
    buttons.find((b) => b.style === 'destructive')?.onPress?.();
  });
}

let alert: jest.SpyInstance;
beforeEach(() => {
  jest.clearAllMocks();
  mockCall.mockResolvedValue({ ok: true });
  mockUser = user();
  mockExports = [];
  mockNotices = [];
  mockBlocks = [];
  alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
});
afterEach(() => {
  alert.mockRestore();
  client.clear();
});

describe('Settings → Privacy (priv-settings; PRIVACY.md §6)', () => {
  it('lists what was agreed to, each linking to where it is changed', async () => {
    mockBlocks = [{ id: 'u_x', data: { firstName: 'X', podId: 'p', since: ts(0) } }];
    await renderWith(<Privacy />);
    expect(screen.getByText('2 interests, consent given')).toBeOnTheScreen();
    expect(screen.getByText('Off, no gender stored')).toBeOnTheScreen();
    expect(screen.getByText('Shown to confirmed pods')).toBeOnTheScreen();
    expect(screen.getByText('1 person')).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('privacy-sensitive'));
    expect(mockRouter.push).toHaveBeenLastCalledWith('/settings/sensitive-consent');
    await fireEvent.press(screen.getByTestId('privacy-same-gender'));
    expect(mockRouter.push).toHaveBeenLastCalledWith('/settings/preferences');
    // The photo is changed or deleted (with its confirmation and cache clearing) on Me (PhotoCard, media.test).
    await fireEvent.press(screen.getByTestId('privacy-photo'));
    expect(mockRouter.push).toHaveBeenLastCalledWith('/me');
  });

  it('without the consent, says nothing sensitive is saved and links to the consent screen', async () => {
    mockUser = user({ legal: { terms: 't', privacy: 'p' } });
    await renderWith(<Privacy />);
    expect(screen.getByText('Not given, so nothing sensitive is saved')).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('privacy-sensitive'));
    expect(mockRouter.push).toHaveBeenCalledWith('/settings/sensitive-consent');
  });

  it('with same-gender pods on, turns them off and deletes the gender in one tap', async () => {
    mockUser = user({ prefs: { sameGenderOnly: true } });
    await renderWith(<Privacy />);
    expect(screen.getByText('On, uses your gender')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Turn off and delete my gender' }));
    expect(mockCall).toHaveBeenCalledWith('updateProfile', { prefs: { sameGenderOnly: false } });
  });

  it('pauses matching, and shows from which week', async () => {
    mockCall.mockResolvedValue({ effectiveWeekId: '2026-W46' });
    await renderWith(<Privacy />);
    await fireEvent.press(screen.getByTestId('pause'));
    expect(mockCall).toHaveBeenCalledWith('setParticipation', { mode: 'pause' });
    expect(screen.getByText(/2026-W46/)).toBeOnTheScreen();
  });

  it('requests the export (re-authenticating first), and says when a sign-in link was sent instead', async () => {
    mockRequestExport.mockResolvedValueOnce({ kind: 'done' }).mockResolvedValueOnce({ kind: 'emailLinkSent' });
    await renderWith(<Privacy />);
    await fireEvent.press(screen.getByTestId('export-request'));
    expect(screen.getByText("We're preparing your file and will let you know when it's ready.")).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('export-request'));
    expect(screen.getByText(/we sent a sign-in link to your email/)).toBeOnTheScreen();
  });

  it('offers the authenticated download once the export is ready, and nothing after it expired', async () => {
    mockExports = [{ id: 'exp1', data: { status: 'ready', path: 'exports/me/exp1.json', expiresAt: ts(NOW + 3_600_000) } }];
    await renderWith(<Privacy />);
    expect(screen.getByText(/^Your file is ready until /)).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('export-download'));
    expect(mockDownload).toHaveBeenCalledWith('me', 'exp1', 'Your Grouper data');
    client.clear();

    mockExports = [{ id: 'exp1', data: { status: 'ready', expiresAt: ts(NOW - 1) } }];
    await renderWith(<Privacy />);
    expect(screen.queryByTestId('export-download')).toBeNull();
    client.clear();

    mockExports = [{ id: 'exp2', data: { status: 'pending', expiresAt: ts(NOW + 3_600_000) } }];
    await renderWith(<Privacy />);
    expect(screen.getByText("We're preparing your file.")).toBeOnTheScreen();
  });

  it('says when the download failed', async () => {
    mockDownload.mockRejectedValueOnce(new Error('403'));
    mockExports = [{ id: 'exp1', data: { status: 'ready', expiresAt: ts(NOW + 3_600_000) } }];
    await renderWith(<Privacy />);
    await fireEvent.press(screen.getByTestId('export-download'));
    expect(screen.getByText("The download didn't work. Try again.")).toBeOnTheScreen();
  });

  it('links to blocked people, how matching works and delete account, and names the right to complain', async () => {
    await renderWith(<Privacy />);
    expect(screen.getByText('Nobody')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('link', { name: /^Blocked people/ }));
    expect(mockRouter.push).toHaveBeenCalledWith('/settings/blocked');
    await fireEvent.press(screen.getByRole('link', { name: 'How matching works' }));
    expect(mockRouter.push).toHaveBeenCalledWith('/info/how-matching-works');
    // Destructive: the danger outline (white, Danger border), never a red or pink fill (decision 4).
    expect(screen.getByTestId('privacy-delete')).toHaveStyle({ backgroundColor: Colors.light.surface, borderColor: Colors.light.danger });
    await fireEvent.press(screen.getByRole('button', { name: 'Delete account' }));
    expect(mockRouter.push).toHaveBeenCalledWith('/settings/delete-account');
    // PRIVACY.md §6: the complaint path is a link to datatilsynet.dk.
    expect(screen.getByText(/You can complain to the Danish Data Protection Agency/)).toBeOnTheScreen();
    const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    await fireEvent.press(screen.getByRole('link', { name: 'datatilsynet.dk' }));
    expect(openURL).toHaveBeenCalledWith('https://www.datatilsynet.dk');
    openURL.mockRestore();
  });

  it('"Me" above the title goes back when there is somewhere to go back to', async () => {
    await renderWith(<Privacy />);
    await fireEvent.press(screen.getByRole('button', { name: 'Back: Me' }));
    expect(mockRouter.back).toHaveBeenCalled();
  });
});

describe('Settings → Privacy → Private interests (the blanket Art. 9 consent, PRIVACY.md §3.3, §3.5)', () => {
  it('with the consent, says when it was given and withdraws it only after the locked withdrawal copy is confirmed', async () => {
    mockCall.mockResolvedValue({ removed: 2 });
    await renderWith(<SettingsSensitiveConsent />);
    expect(screen.getByText('You agreed on 1 Jan 1970.')).toBeOnTheScreen();
    expect(screen.getByText('2 of your interests are private.')).toBeOnTheScreen();
    // The text it covers sits in onboarding's consent card: white, the 1.5 px Ink border (private stays quiet).
    expect(screen.getByTestId('art9-text')).toHaveStyle({ backgroundColor: Colors.light.privateBg, borderColor: Colors.light.privateBorder, borderWidth: 1.5 });
    await fireEvent.press(screen.getByRole('button', { name: 'Withdraw consent' }));
    expect(mockCall).not.toHaveBeenCalled();
    const withdrawCopy = currentLegalText('withdrawConfirmation', 'en');
    expect(alert.mock.calls.at(-1)?.[1]).toBe(withdrawCopy.kind === 'withdrawConfirmation' ? withdrawCopy.content.text : null);
    await confirmAlert(alert);
    expect(mockCall).toHaveBeenCalledWith('withdrawArt9Consent', {});
    expect(mockRouter.back).toHaveBeenCalled();
  });

  it('without it, shows the consent: "I agree" stays disabled until the box is ticked', async () => {
    mockUser = user({ legal: { terms: 't', privacy: 'p' } });
    await renderWith(<SettingsSensitiveConsent />);
    // The same card as onboarding step 3, the locked copy scrolling inside it.
    expect(screen.getByTestId('art9-text')).toHaveStyle({ backgroundColor: Colors.light.privateBg, borderColor: Colors.light.privateBorder, borderWidth: 1.5 });
    expect(screen.getByTestId('art9-text-scroll')).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('art9-agree'));
    expect(mockCall).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByTestId('art9-checkbox'));
    await fireEvent.press(screen.getByTestId('art9-agree'));
    expect(mockCall).toHaveBeenCalledWith('setArt9Consent', { consent: expect.objectContaining({ textVersion: 'art9-blanket-en-v1', checked: true }) });
  });
});

describe('delete account (priv-delete; §3.10)', () => {
  it('explains what happens, asks once more, then deletes; the welcome screen confirms it afterwards', async () => {
    mockDeleteAccount.mockImplementation(async () => {
      mockDeleted = true;
      return { kind: 'done' };
    });
    await renderWith(<DeleteAccount />);
    expect(screen.getByTestId('delete-account')).toHaveStyle({ backgroundColor: Colors.light.surface, borderColor: Colors.light.danger });
    // The numbers keep their unit on the same line (non-breaking spaces), as on priv-delete.
    expect(screen.getByText('Copies in our backups disappear within 7\u00a0days.')).toBeOnTheScreen();
    expect(screen.getByText("Your sign-in record at Google's login service can take up to 180\u00a0days to clear.")).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('delete-account'));
    expect(mockDeleteAccount).not.toHaveBeenCalled();
    await confirmAlert(alert);
    expect(mockDeleteAccount).toHaveBeenCalledTimes(1);
    client.clear();

    await renderWith(<Welcome />);
    expect(screen.getByText('Your account has been deleted. Thanks for trying Grouper.')).toBeOnTheScreen();
  });

  it('for email-link accounts, says a sign-in link was sent', async () => {
    mockDeleteAccount.mockResolvedValue({ kind: 'emailLinkSent' });
    await renderWith(<DeleteAccount />);
    await fireEvent.press(screen.getByTestId('delete-account'));
    await confirmAlert(alert);
    expect(screen.getByText(/we sent a sign-in link to your email/)).toBeOnTheScreen();
  });

  it('"Download my data first" asks for the export, or downloads the file when one is ready', async () => {
    mockRequestExport.mockResolvedValueOnce({ kind: 'done' });
    await renderWith(<DeleteAccount />);
    await fireEvent.press(screen.getByTestId('delete-export'));
    expect(mockRequestExport).toHaveBeenCalledTimes(1);
    expect(screen.getByText("We're preparing your file and will let you know when it's ready.")).toBeOnTheScreen();
    client.clear();

    mockExports = [{ id: 'exp1', data: { status: 'ready', expiresAt: ts(NOW + 3_600_000) } }];
    await renderWith(<DeleteAccount />);
    await fireEvent.press(screen.getByRole('button', { name: 'Download my data first' }));
    expect(mockDownload).toHaveBeenCalledWith('me', 'exp1', 'Your Grouper data');
    expect(mockRequestExport).toHaveBeenCalledTimes(1);
  });

  it('"Cancel" goes back without deleting', async () => {
    await renderWith(<DeleteAccount />);
    await fireEvent.press(screen.getByRole('button', { name: 'Cancel' }));
    expect(mockRouter.back).toHaveBeenCalled();
    expect(mockDeleteAccount).not.toHaveBeenCalled();
  });
});

describe('messages from Grouper (notices)', () => {
  it('renders a statement of reasons from its code and date, automated and with the contact address', async () => {
    mockNotices = [
      { id: 'n1', data: { type: 'statementOfReasons', code: 'PAUSE_REPORTS', params: { until: Date.UTC(2026, 11, 3, 12), type: 'pause' }, createdAt: ts(NOW), expiresAt: ts(NOW + 1e10) } },
      { id: 'n2', data: { type: 'system', code: 'POD_MEMBER_LEFT', params: { podId: 'abcdefghijklmnopqrst' }, createdAt: ts(NOW), expiresAt: ts(NOW + 1e10) } },
      { id: 'n3', data: { type: 'system', code: 'SOMETHING_NEW', params: {}, createdAt: ts(NOW), expiresAt: ts(NOW + 1e10) } },
    ];
    await renderWith(<Notices />);
    // A short title over each notice; an unknown code gets a generic one.
    expect(screen.getByRole('header', { name: 'Matching paused' })).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: 'Message from Grouper' })).toBeOnTheScreen();
    expect(screen.getByText(/^You are paused from drops until .*3 Dec.* because two members reported you within 30 days\.$/)).toBeOnTheScreen();
    expect(screen.getByText('This was decided automatically; no person reviewed it. The pause ends on its own.')).toBeOnTheScreen();
    expect(screen.getByText('Questions? Write to privacy@grouper.example.')).toBeOnTheScreen();
    expect(screen.getByText('A member left one of your pods.')).toBeOnTheScreen();
    expect(screen.getByText('You have a message from Grouper. Update the app to read it.')).toBeOnTheScreen();
    // Only the statement of reasons carries the "automated" line.
    expect(screen.getAllByText(/decided automatically/)).toHaveLength(1);
  });

  it('a safety report receipt adds the 112 line, worded as on after-report and Meeting safely', async () => {
    mockNotices = [
      { id: 'n1', data: { type: 'system', code: 'REPORT_RECEIVED', params: { reportId: 'r1', category: 'safety' }, createdAt: ts(NOW), expiresAt: ts(NOW + 1e10) } },
    ];
    await renderWith(<Notices />);
    expect(screen.getByRole('header', { name: 'Thanks for your report' })).toBeOnTheScreen();
    expect(screen.getByText('In danger right now? Call 112.')).toBeOnTheScreen();
    // Bold, as after-report sets it (<strong>) and Meeting safely shows it: the banner's title.
    expect(screen.getByText('In danger right now? Call 112.')).toHaveStyle({ fontFamily: 'PlusJakartaSans_700Bold' });
  });

  it('"Your data is ready" downloads that export while it exists', async () => {
    mockNotices = [
      { id: 'n1', data: { type: 'system', code: 'EXPORT_READY', params: { exportId: 'exp1' }, createdAt: ts(NOW), expiresAt: ts(NOW + 1e10) } },
      { id: 'n0', data: { type: 'system', code: 'EXPORT_READY', params: { exportId: 'old' }, createdAt: ts(NOW - 1e9), expiresAt: ts(NOW + 1e10) } },
    ];
    mockExports = [{ id: 'exp1', data: { status: 'ready', expiresAt: ts(NOW + 3_600_000) } }];
    await renderWith(<Notices />);
    expect(screen.getAllByTestId('export-download')).toHaveLength(1);
    expect(screen.getByText(/This file is no longer available/)).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('export-download'));
    expect(mockDownload).toHaveBeenCalledWith('me', 'exp1', 'Your Grouper data');
  });

  it('says when there are none', async () => {
    await renderWith(<Notices />);
    expect(screen.getByText('No messages from Grouper.')).toBeOnTheScreen();
  });
});
