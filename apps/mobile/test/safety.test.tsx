import { blockUserInput, reportInput } from '@grouper/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import { Alert } from 'react-native';
import MemberSheet from '../app/pod/[podId]/member/[uid]';
import Blocked from '../app/settings/blocked';
import Report from '../app/sheets/report';

const POD_ID = 'abcdefghijklmnopqrst';
const mockRouter = { push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: () => true };
let mockParams: Record<string, string> = {};
jest.mock('expo-router', () => ({ Stack: { Screen: () => null }, useRouter: () => mockRouter, useLocalSearchParams: () => mockParams }));
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
      planning: { deadline: ts(0) },
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
  it('shows the first name and "about me", and blocks after a confirmation in the sheet, removing the member by default', async () => {
    await renderWith(<MemberSheet />);
    expect(screen.getByText('Anna')).toBeOnTheScreen();
    expect(screen.getByText('New in Aarhus, loves long walks.')).toBeOnTheScreen();
    expect(screen.getByText(/Anna is taken out of this pod/)).toBeOnTheScreen();
    expect(screen.getByText(/Want to leave instead\?/)).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('member-block'));
    expect(mockCall).not.toHaveBeenCalled();
    expect(screen.getByText('Block Anna?')).toBeOnTheScreen();
    expect(screen.getByTestId('block-remove')).toBeChecked();
    // Re-planning is offered only once the meetup is scheduled.
    expect(screen.queryByTestId('block-replan')).toBeNull();
    await fireEvent.press(screen.getByTestId('member-block-confirm'));
    await act(async () => {
      await Promise.resolve();
    });
    expect(mockCall).toHaveBeenCalledWith('blockUser', { podId: POD_ID, uid: 'anna' });
    expect(mockClearImageCaches).toHaveBeenCalled();
    expect(mockRouter.back).toHaveBeenCalled();
    // The sheet itself asks first; there is no system alert (it cannot offer three choices on Android).
    expect(alert).not.toHaveBeenCalled();
  });

  it('can leave instead of removing the blocked member, and cancel goes back without blocking', async () => {
    await renderWith(<MemberSheet />);
    await fireEvent.press(screen.getByTestId('member-block'));
    await fireEvent.press(screen.getByTestId('member-block-cancel'));
    expect(screen.queryByTestId('block-confirm')).toBeNull();
    expect(mockCall).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByTestId('member-block'));
    await fireEvent.press(screen.getByTestId('block-leave'));
    expect(screen.getByText(/Anna stays in the pod/)).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('member-block-confirm'));
    expect(mockCall).toHaveBeenCalledWith('blockUser', { podId: POD_ID, uid: 'anna', leave: true });
  });

  it('in a scheduled pod, offers "Re-plan the meetup", which excludes leaving', async () => {
    mockState = 'scheduled';
    await renderWith(<MemberSheet />);
    await fireEvent.press(screen.getByTestId('member-block'));
    await fireEvent.press(screen.getByTestId('block-leave'));
    await fireEvent.press(screen.getByTestId('block-replan'));
    expect(screen.getByTestId('block-leave')).not.toBeChecked();
    expect(screen.getByText(/picks a new time and place within 48 hours/)).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('member-block-confirm'));
    const input = mockCall.mock.calls[0]?.[1];
    expect(input).toEqual({ podId: POD_ID, uid: 'anna', replan: true });
    expect(blockUserInput.safeParse(input).success).toBe(true);
  });

  it('after the pod has ended, blocking has no pod choices', async () => {
    mockState = 'archived';
    await renderWith(<MemberSheet />);
    expect(screen.queryByText(/Want to leave instead\?/)).toBeNull();
    await fireEvent.press(screen.getByTestId('member-block'));
    expect(screen.queryByTestId('block-leave')).toBeNull();
    await fireEvent.press(screen.getByTestId('member-block-confirm'));
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

  it('opens the report sheet for the member; there is no block or report on oneself', async () => {
    await renderWith(<MemberSheet />);
    expect(screen.getByRole('button', { name: 'Report Anna' })).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('member-report'));
    expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/sheets/report', params: { podId: POD_ID, uid: 'anna' } });
    client.clear();
    mockParams = { podId: POD_ID, uid: 'me' };
    await renderWith(<MemberSheet />);
    expect(screen.queryByTestId('member-report')).toBeNull();
    expect(screen.queryByTestId('member-block')).toBeNull();
  });

  it('closes with the close button', async () => {
    await renderWith(<MemberSheet />);
    await fireEvent.press(screen.getByRole('button', { name: 'Close' }));
    expect(mockRouter.back).toHaveBeenCalled();
  });
});

describe('report sheet (§3.7)', () => {
  const sent = () => {
    const input = mockCall.mock.calls[0]?.[1];
    expect(mockCall.mock.calls[0]?.[0]).toBe('report');
    expect(reportInput.safeParse(input).success).toBe(true);
    return input;
  };

  it('reports a member with a category and optional text; 112 is always shown', async () => {
    mockCall.mockResolvedValue({ reportId: 'r1' });
    await renderWith(<Report />);
    expect(screen.getByText('Report Anna')).toBeOnTheScreen();
    expect(screen.getByText('In danger right now? Call 112.')).toBeOnTheScreen();
    expect(screen.getByText(/Anna will not know who reported/)).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Send report' })).toBeDisabled();
    await fireEvent.press(screen.getByRole('radio', { name: 'Harassment or disrespect' }));
    expect(screen.getByRole('radio', { name: 'Harassment or disrespect' })).toBeChecked();
    await fireEvent.changeText(screen.getByLabelText('Tell us more'), '  rude  ');
    expect(screen.getByText('8 / 500')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Send report' }));
    expect(sent()).toEqual({ target: { type: 'user', podId: POD_ID, uid: 'anna' }, category: 'harassment', text: 'rude' });
    expect(mockRouter.back).toHaveBeenCalled();
  });

  it('reports an option without naming its author (the server takes it from the option)', async () => {
    mockCall.mockResolvedValue({ reportId: 'r1' });
    mockParams = { podId: POD_ID, optionId: 'opt1' };
    await renderWith(<Report />);
    expect(screen.getByText('Report a suggestion')).toBeOnTheScreen();
    await fireEvent.press(screen.getByText('Something they wrote'));
    await fireEvent.press(screen.getByRole('button', { name: 'Send report' }));
    expect(sent()).toEqual({ target: { type: 'option', podId: POD_ID, optionId: 'opt1' }, category: 'content' });
  });

  it('reports a chat message, saying a copy is kept', async () => {
    mockCall.mockResolvedValue({ reportId: 'r1' });
    mockParams = { podId: POD_ID, messageId: 'msg1' };
    await renderWith(<Report />);
    expect(screen.getByText('Report a message')).toBeOnTheScreen();
    expect(screen.getByText(/We keep a copy of this message/)).toBeOnTheScreen();
    // The same categories, with "Something they wrote" first for a message.
    expect(screen.getAllByRole('radio').map((r) => r.props.accessibilityLabel)).toEqual([
      'Something they wrote',
      'Harassment or disrespect',
      'I felt unsafe',
      "Didn't show up",
      'May be under 18',
    ]);
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
    // Each Unblock button names the person it is for.
    expect(screen.getByRole('button', { name: 'Unblock Anna' })).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Unblock Someone from an unconfirmed pod' }));
    expect(mockCall).toHaveBeenCalledWith('unblockUser', { uid: 'bo' });
    // How to block someone is said under the list too, not only when it is empty.
    expect(screen.getByText('To block someone, tap their name in a pod.')).toBeOnTheScreen();
  });

  it('says when nobody is blocked, and how to block someone', async () => {
    mockBlocks = [];
    await renderWith(<Blocked />);
    expect(screen.getByText("You haven't blocked anyone.")).toBeOnTheScreen();
    expect(screen.getByText('To block someone, tap their name in a pod.')).toBeOnTheScreen();
  });
});
