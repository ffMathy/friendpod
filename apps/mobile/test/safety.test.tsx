import { blockUserInput, reportInput } from '@grouper/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, within } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import { Alert, type AlertButton } from 'react-native';
import MemberSheet from '../app/pod/[podId]/member/[uid]';
import Blocked from '../app/settings/blocked';
import Report from '../app/sheets/report';
import da from '@/i18n/da.json';
import en from '@/i18n/en.json';

const POD_ID = 'abcdefghijklmnopqrst';
const mockRouter = { push: jest.fn(), back: jest.fn() };
let mockParams: Record<string, string> = {};
jest.mock('expo-router', () => ({ useRouter: () => mockRouter, useLocalSearchParams: () => mockParams }));
jest.mock('@/features/session/SessionProvider', () => ({ useUid: () => 'me' }));
jest.mock('@/features/photos/AuthenticatedPhoto', () => ({ AuthenticatedPhoto: () => null }));
const mockClearImageCaches = jest.fn(async () => undefined);
jest.mock('@/features/account/clearDeviceData', () => ({ clearImageCaches: () => mockClearImageCaches() }));

const mockCall = jest.fn();
jest.mock('@/firebase/callables', () => ({
  callFunction: (...args: unknown[]) => mockCall(...args),
  toAppError: (e: unknown) => e,
}));

const ts = (ms: number) => ({ toMillis: () => ms });
const live = (data: unknown) => ({ data, error: null, isLoading: false });
let mockState = 'planning';
let mockSensitive = false;
let mockBlocks: unknown[] = [];
jest.mock('@/data/docs', () => ({
  usePodCard: () => live({ state: mockState, myStatus: 'accepted', themeLabel: 'x', themeSensitive: mockSensitive }),
  usePod: () =>
    live({
      state: mockState,
      memberUids: ['me', 'anna'],
      roster: { me: { firstName: 'Mia', photoV: null }, anna: { firstName: 'Anna', photoV: 2, aboutMe: 'New in Aarhus, loves long walks.' } },
    }),
  useBlocks: () => live(mockBlocks),
}));

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
const alertButtons = (alert: jest.SpyInstance) => (alert.mock.calls.at(-1)?.[2] as AlertButton[]).map((b) => b.text);
async function pressAlertButton(alert: jest.SpyInstance, text: string) {
  const buttons = alert.mock.calls.at(-1)?.[2] as AlertButton[];
  await act(async () => {
    buttons.find((b) => b.text === text)?.onPress?.();
  });
}

let alert: jest.SpyInstance;
beforeEach(() => {
  mockCall.mockReset();
  mockCall.mockResolvedValue({ ok: true });
  mockRouter.push.mockClear();
  mockRouter.back.mockClear();
  mockClearImageCaches.mockClear();
  mockState = 'planning';
  mockSensitive = false;
  mockBlocks = [];
  mockParams = { podId: POD_ID, uid: 'anna' };
  alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
});
afterEach(() => {
  alert.mockRestore();
  client.clear();
});

describe('member sheet (§3.7)', () => {
  it('shows the first name and "about me", and blocks after a confirmation, removing the member by default', async () => {
    await renderWith(<MemberSheet />);
    expect(screen.getByText('Anna')).toBeOnTheScreen();
    expect(screen.getByText('In your x pod')).toBeOnTheScreen();
    expect(screen.getByText('New in Aarhus, loves long walks.')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Report Anna' })).toBeOnTheScreen();
    // Storyboard 4.2: one Block row, and the footnote about leaving without blocking.
    expect(screen.getByText("You'll never be matched again. Anna is taken out of this pod and only sees that the pod changed.")).toBeOnTheScreen();
    expect(screen.getByTestId('member-leave-note')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Block Anna' }));
    expect(mockCall).not.toHaveBeenCalled();
    // Re-planning is offered only once the meetup is scheduled: the destructive button blocks straight away.
    expect(alertButtons(alert)).toEqual(['Cancel', 'Block and leave the pod myself', 'Block']);
    await confirmAlert(alert);
    expect(mockCall).toHaveBeenCalledWith('blockUser', { podId: POD_ID, uid: 'anna' });
    expect(mockClearImageCaches).toHaveBeenCalled();
    expect(mockRouter.back).toHaveBeenCalled();
  });

  it('leaves a private theme out of the sheet', async () => {
    mockSensitive = true;
    await renderWith(<MemberSheet />);
    expect(screen.getByText('In your pod')).toBeOnTheScreen();
    expect(screen.queryByText(/In your x pod/)).toBeNull();
  });

  it('can leave instead of removing the blocked member', async () => {
    await renderWith(<MemberSheet />);
    await fireEvent.press(screen.getByTestId('member-block'));
    await pressAlertButton(alert, 'Block and leave the pod myself');
    expect(mockCall).toHaveBeenCalledWith('blockUser', { podId: POD_ID, uid: 'anna', leave: true });
  });

  it('in a scheduled pod, asks whether to re-plan the meetup, which excludes leaving', async () => {
    mockState = 'scheduled';
    await renderWith(<MemberSheet />);
    await fireEvent.press(screen.getByTestId('member-block'));
    await confirmAlert(alert);
    expect(mockCall).not.toHaveBeenCalled();
    expect(alert.mock.calls.at(-1)?.[0]).toBe('Re-plan the meetup?');
    expect(alert.mock.calls.at(-1)?.[1]).toContain('within 48 hours');
    await pressAlertButton(alert, 'Block and re-plan');
    const input = mockCall.mock.calls[0]?.[1];
    expect(input).toEqual({ podId: POD_ID, uid: 'anna', replan: true });
    expect(blockUserInput.safeParse(input).success).toBe(true);
  });

  it('in a scheduled pod, can keep the plan, and Cancel on the second question drops the block', async () => {
    mockState = 'scheduled';
    await renderWith(<MemberSheet />);
    await fireEvent.press(screen.getByTestId('member-block'));
    await confirmAlert(alert);
    await pressAlertButton(alert, 'Cancel');
    expect(mockCall).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByTestId('member-block'));
    await confirmAlert(alert);
    await pressAlertButton(alert, 'Block, keep the plan');
    expect(mockCall).toHaveBeenCalledWith('blockUser', { podId: POD_ID, uid: 'anna' });
  });

  it('outside an active pod, blocking takes nobody out, so there is no leave choice', async () => {
    mockState = 'archived';
    await renderWith(<MemberSheet />);
    expect(screen.getByText('You will never be matched again, and photos are hidden both ways.')).toBeOnTheScreen();
    expect(screen.queryByTestId('member-leave-note')).toBeNull();
    await fireEvent.press(screen.getByTestId('member-block'));
    expect(alertButtons(alert)).toEqual(['Cancel', 'Block']);
    await confirmAlert(alert);
    expect(mockCall).toHaveBeenCalledWith('blockUser', { podId: POD_ID, uid: 'anna' });
  });

  it('offers Unblock instead of Block for someone already blocked', async () => {
    mockState = 'archived';
    mockBlocks = [{ id: 'anna', data: { firstName: 'Anna', podId: POD_ID, since: ts(0) } }];
    await renderWith(<MemberSheet />);
    expect(screen.queryByTestId('member-block')).toBeNull();
    expect(screen.getByText("You've blocked Anna.")).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('member-unblock'));
    expect(mockCall).toHaveBeenCalledWith('unblockUser', { uid: 'anna' });
  });

  it('says on the Report row only what is true: the reporter stays anonymous, and no person reviews reports (F17)', async () => {
    await renderWith(<MemberSheet />);
    const row = screen.getByTestId('member-report');
    expect(within(row).getByText("Anna won't know who reported.")).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Report Anna' }).props.accessibilityHint).toBe("Anna won't know who reported.");
    // Storyboard 4.2 adds "A person on our team reviews it."; nobody reads reports (DESIGN.md §3.7, PRIVACY.md §13), so
    // neither the row nor any report wording may promise a human review, in either language.
    expect(within(row).queryByText(/review|our team/i)).toBeNull();
    const strings = (node: unknown): string[] => (typeof node === 'string' ? [node] : Object.values(node as object).flatMap(strings));
    const reportCopy = [en, da].flatMap((lang) => [...strings(lang.report), lang.member.report, lang.member.reportName]);
    expect(reportCopy).toContain("{{name}} won't know who reported.");
    for (const line of reportCopy) expect(line).not.toMatch(/review|our team|gennemg|vores team/i);
  });

  it('opens the report sheet for the member; there is no block or report on oneself', async () => {
    await renderWith(<MemberSheet />);
    await fireEvent.press(screen.getByTestId('member-report'));
    expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/sheets/report', params: { podId: POD_ID, uid: 'anna' } });
    client.clear();
    mockParams = { podId: POD_ID, uid: 'me' };
    await renderWith(<MemberSheet />);
    expect(screen.queryByTestId('member-report')).toBeNull();
    expect(screen.queryByTestId('member-block')).toBeNull();
  });
});

describe('report sheet (§3.7)', () => {
  const sent = () => {
    const input = mockCall.mock.calls[0]?.[1];
    expect(mockCall.mock.calls[0]?.[0]).toBe('report');
    expect(reportInput.safeParse(input).success).toBe(true);
    return input;
  };

  it('reports a member with a category and optional text', async () => {
    mockCall.mockResolvedValue({ reportId: 'r1' });
    await renderWith(<Report />);
    expect(screen.getByText('Report Anna')).toBeOnTheScreen();
    // 112 comes first on every report, before a category is chosen.
    expect(screen.getByText('In danger right now? Call 112.')).toBeOnTheScreen();
    expect(screen.getByText(/Anna won't know who reported\./)).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Send report' })).toBeDisabled();
    await fireEvent.press(screen.getByRole('radio', { name: 'Harassment or disrespect' }));
    expect(screen.getByRole('radio', { name: 'Harassment or disrespect' })).toBeChecked();
    await fireEvent.changeText(screen.getByLabelText('Tell us more (optional)'), '  rude  ');
    expect(screen.getByText('8 / 500')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Send report' }));
    expect(sent()).toEqual({ target: { type: 'user', podId: POD_ID, uid: 'anna' }, category: 'harassment', text: 'rude' });
    expect(mockRouter.back).toHaveBeenCalled();
  });

  it('reports an option without naming its author (the server takes it from the option)', async () => {
    mockCall.mockResolvedValue({ reportId: 'r1' });
    mockParams = { podId: POD_ID, optionId: 'opt1' };
    await renderWith(<Report />);
    await fireEvent.press(screen.getByText('Something they wrote'));
    await fireEvent.press(screen.getByRole('button', { name: 'Send report' }));
    expect(sent()).toEqual({ target: { type: 'option', podId: POD_ID, optionId: 'opt1' }, category: 'content' });
  });

  it('reports a chat message, saying a copy is kept', async () => {
    mockCall.mockResolvedValue({ reportId: 'r1' });
    mockParams = { podId: POD_ID, messageId: 'msg1' };
    await renderWith(<Report />);
    expect(screen.getByText(/We keep a copy of this message/)).toBeOnTheScreen();
    expect(screen.getByText('Report')).toBeOnTheScreen();
    await fireEvent.press(screen.getByText('I felt unsafe'));
    expect(screen.getByText('In danger right now? Call 112.')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Send report' }));
    expect(sent()).toEqual({ target: { type: 'message', podId: POD_ID, messageId: 'msg1' }, category: 'safety' });
  });

  it('offers "Not a genuine member" in sensitive-themed pods only', async () => {
    await renderWith(<Report />);
    expect(screen.queryByText('Not a genuine member')).toBeNull();
    client.clear();
    mockSensitive = true;
    await renderWith(<Report />);
    expect(screen.getByText('Not a genuine member')).toBeOnTheScreen();
  });
});

describe('blocked people (Settings)', () => {
  it('lists blocks with the name seen in the pod and unblocks', async () => {
    mockBlocks = [
      { id: 'anna', data: { firstName: 'Anna', podId: POD_ID, since: ts(0) } },
      { id: 'bo', data: { firstName: '', podId: POD_ID, since: ts(0) } },
    ];
    await renderWith(<Blocked />);
    expect(screen.getByText('Anna')).toBeOnTheScreen();
    expect(screen.getByText('Someone from an unconfirmed pod')).toBeOnTheScreen();
    await fireEvent.press(screen.getAllByRole('button', { name: 'Unblock' })[1]!);
    expect(mockCall).toHaveBeenCalledWith('unblockUser', { uid: 'bo' });
  });
});
