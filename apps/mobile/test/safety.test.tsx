import { blockUserInput, reportInput } from '@grouper/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import { Alert, type AlertButton } from 'react-native';
import MemberSheet from '../app/pod/[podId]/member/[uid]';
import Blocked from '../app/settings/blocked';
import Report from '../app/sheets/report';

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
    expect(screen.getByText('New in Aarhus, loves long walks.')).toBeOnTheScreen();
    // Re-planning is offered only once the meetup is scheduled.
    expect(screen.queryByTestId('block-replan')).toBeNull();
    await fireEvent.press(screen.getByTestId('member-block'));
    expect(mockCall).not.toHaveBeenCalled();
    await confirmAlert(alert);
    expect(mockCall).toHaveBeenCalledWith('blockUser', { podId: POD_ID, uid: 'anna' });
    expect(mockClearImageCaches).toHaveBeenCalled();
    expect(mockRouter.back).toHaveBeenCalled();
  });

  it('can leave instead of removing the blocked member', async () => {
    await renderWith(<MemberSheet />);
    await fireEvent.press(screen.getByTestId('block-leave'));
    await fireEvent.press(screen.getByTestId('member-block'));
    await confirmAlert(alert);
    expect(mockCall).toHaveBeenCalledWith('blockUser', { podId: POD_ID, uid: 'anna', leave: true });
  });

  it('in a scheduled pod, offers "Re-plan the meetup", which excludes leaving', async () => {
    mockState = 'scheduled';
    await renderWith(<MemberSheet />);
    await fireEvent.press(screen.getByTestId('block-leave'));
    await fireEvent.press(screen.getByTestId('block-replan'));
    await fireEvent.press(screen.getByTestId('member-block'));
    expect(alert.mock.calls.at(-1)?.[1]).toContain('plans a new meetup within 48 hours');
    await confirmAlert(alert);
    const input = mockCall.mock.calls[0]?.[1];
    expect(input).toEqual({ podId: POD_ID, uid: 'anna', replan: true });
    expect(blockUserInput.safeParse(input).success).toBe(true);
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
    expect(screen.getByRole('button', { name: 'Send report' })).toBeDisabled();
    await fireEvent.press(screen.getByText('Harassment'));
    await fireEvent.changeText(screen.getByLabelText('What happened? (optional)'), '  rude  ');
    await fireEvent.press(screen.getByRole('button', { name: 'Send report' }));
    expect(sent()).toEqual({ target: { type: 'user', podId: POD_ID, uid: 'anna' }, category: 'harassment', text: 'rude' });
    expect(mockRouter.back).toHaveBeenCalled();
  });

  it('reports an option without naming its author (the server takes it from the option)', async () => {
    mockCall.mockResolvedValue({ reportId: 'r1' });
    mockParams = { podId: POD_ID, optionId: 'opt1' };
    await renderWith(<Report />);
    await fireEvent.press(screen.getByText('Content'));
    await fireEvent.press(screen.getByRole('button', { name: 'Send report' }));
    expect(sent()).toEqual({ target: { type: 'option', podId: POD_ID, optionId: 'opt1' }, category: 'content' });
  });

  it('reports a chat message, saying a copy is kept', async () => {
    mockCall.mockResolvedValue({ reportId: 'r1' });
    mockParams = { podId: POD_ID, messageId: 'msg1' };
    await renderWith(<Report />);
    expect(screen.getByText(/We keep a copy of this message/)).toBeOnTheScreen();
    await fireEvent.press(screen.getByText('Safety'));
    expect(screen.getByText('In an emergency, call 112.')).toBeOnTheScreen();
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
