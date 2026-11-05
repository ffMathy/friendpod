import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import { Alert, type AlertButton } from 'react-native';
import Welcome from '../app/(auth)/index';
import DeleteAccount from '../app/settings/delete-account';
import Notices from '../app/settings/notices';
import Privacy from '../app/settings/privacy';

const mockRouter = { push: jest.fn(), back: jest.fn() };
jest.mock('expo-router', () => ({ useRouter: () => mockRouter, useLocalSearchParams: () => ({}) }));
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
jest.mock('@/data/docs', () => ({
  useUserDoc: () => live(mockUser),
  useSensitiveInterests: () => live([{ id: 'p1', data: {} }, { id: 'p2', data: {} }]),
  useExports: () => live(mockExports),
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
  alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
});
afterEach(() => {
  alert.mockRestore();
  client.clear();
});

describe('Settings → Privacy (PRIVACY.md §6)', () => {
  it('withdraws the Art. 9 consent only after the withdrawal copy is confirmed', async () => {
    mockCall.mockResolvedValue({ removed: 2 });
    await renderWith(<Privacy />);
    expect(screen.getByText("You've agreed to sensitive interests. 2 of your interests are private.")).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Withdraw consent for sensitive interests' }));
    expect(mockCall).not.toHaveBeenCalled();
    await confirmAlert(alert);
    expect(mockCall).toHaveBeenCalledWith('withdrawArt9Consent', {});
  });

  it('without the consent, links to the consent screen', async () => {
    mockUser = user({ legal: { terms: 't', privacy: 'p' } });
    await renderWith(<Privacy />);
    await fireEvent.press(screen.getByRole('button', { name: 'Agree to sensitive interests' }));
    expect(mockRouter.push).toHaveBeenCalledWith('/settings/sensitive-consent');
  });

  it('pauses or skips the next drop, and shows from which week', async () => {
    mockCall.mockResolvedValue({ effectiveWeekId: '2026-W46' });
    await renderWith(<Privacy />);
    await fireEvent.press(screen.getByTestId('skip-next'));
    expect(mockCall).toHaveBeenCalledWith('setParticipation', { mode: 'skipNext' });
    await fireEvent.press(screen.getByTestId('pause'));
    expect(mockCall).toHaveBeenCalledWith('setParticipation', { mode: 'pause' });
    expect(screen.getByText(/2026-W46/)).toBeOnTheScreen();
  });

  it('deletes the photo after a confirmation and clears the image caches', async () => {
    await renderWith(<Privacy />);
    await fireEvent.press(screen.getByTestId('delete-photo'));
    expect(mockCall).not.toHaveBeenCalled();
    await confirmAlert(alert);
    expect(mockCall).toHaveBeenCalledWith('deletePhoto', {});
    expect(mockClearImageCaches).toHaveBeenCalled();
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

  it('links to blocked people and messages from Grouper', async () => {
    await renderWith(<Privacy />);
    await fireEvent.press(screen.getByRole('link', { name: 'Blocked people' }));
    expect(mockRouter.push).toHaveBeenCalledWith('/settings/blocked');
    await fireEvent.press(screen.getByRole('link', { name: 'Messages from Grouper' }));
    expect(mockRouter.push).toHaveBeenCalledWith('/settings/notices');
  });
});

describe('delete account (§3.10)', () => {
  it('asks once more, then deletes; the welcome screen confirms it afterwards', async () => {
    mockDeleteAccount.mockImplementation(async () => {
      mockDeleted = true;
      return { kind: 'done' };
    });
    await renderWith(<DeleteAccount />);
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
});

describe('messages from Grouper (notices)', () => {
  it('renders a statement of reasons from its code and date, automated and with the contact address', async () => {
    mockNotices = [
      { id: 'n1', data: { type: 'statementOfReasons', code: 'PAUSE_REPORTS', params: { until: Date.UTC(2026, 11, 3, 12), type: 'pause' }, createdAt: ts(NOW), expiresAt: ts(NOW + 1e10) } },
      { id: 'n2', data: { type: 'system', code: 'POD_MEMBER_LEFT', params: { podId: 'abcdefghijklmnopqrst' }, createdAt: ts(NOW), expiresAt: ts(NOW + 1e10) } },
      { id: 'n3', data: { type: 'system', code: 'SOMETHING_NEW', params: {}, createdAt: ts(NOW), expiresAt: ts(NOW + 1e10) } },
    ];
    await renderWith(<Notices />);
    expect(screen.getByText(/^You are paused from drops until .*3 Dec.* because two members reported you within 30 days\.$/)).toBeOnTheScreen();
    expect(screen.getByText('This was decided automatically; no person reviewed it. It ends on its own.')).toBeOnTheScreen();
    expect(screen.getByText('Questions? Write to privacy@grouper.example.')).toBeOnTheScreen();
    expect(screen.getByText('A member left one of your pods.')).toBeOnTheScreen();
    expect(screen.getByText('You have a message from Grouper. Update the app to read it.')).toBeOnTheScreen();
    // Only the statement of reasons carries the "automated" line.
    expect(screen.getAllByText(/decided automatically/)).toHaveLength(1);
  });

  it('a safety report receipt adds the 112 line', async () => {
    mockNotices = [
      { id: 'n1', data: { type: 'system', code: 'REPORT_RECEIVED', params: { reportId: 'r1', category: 'safety' }, createdAt: ts(NOW), expiresAt: ts(NOW + 1e10) } },
    ];
    await renderWith(<Notices />);
    expect(screen.getByText('In an emergency, call 112.')).toBeOnTheScreen();
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
