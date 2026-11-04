import { act, fireEvent, render, screen } from '@testing-library/react-native';
import ConsentSheetRoute from '../app/sheets/consent';
import { requestArt9Consent } from '@/features/consent/requests';

const mockRouter = { back: jest.fn(), push: jest.fn() };
let mockParams: { request?: string } = {};

jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
  useLocalSearchParams: () => mockParams,
}));

function openRequest(tag: string) {
  let requestId = '';
  const result = requestArt9Consent(tag, (id) => {
    requestId = id;
  });
  mockParams = { request: requestId };
  return result;
}

beforeEach(() => {
  mockRouter.back.mockClear();
  mockRouter.push.mockClear();
});

describe('sheets/consent route', () => {
  it('resolves the pending request with the consent payload and closes', async () => {
    const result = openRequest('gravid');
    await render(<ConsentSheetRoute />);
    expect(screen.getByText(/^"gravid" may reveal/)).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('consent-checkbox'));
    await fireEvent.press(screen.getByTestId('consent-add'));
    await expect(result).resolves.toEqual({
      consent: expect.objectContaining({ textVersion: 'art9-tag-en-v1', checked: true }),
    });
    expect(mockRouter.back).toHaveBeenCalledTimes(1);
  });

  it('"Don\'t add" resolves with null (the tag is discarded)', async () => {
    const result = openRequest('gravid');
    await render(<ConsentSheetRoute />);
    await fireEvent.press(screen.getByTestId('consent-dont-add'));
    await expect(result).resolves.toBeNull();
  });

  it('dismissing the sheet any other way also discards', async () => {
    const result = openRequest('gravid');
    const { unmount } = await render(<ConsentSheetRoute />);
    await act(async () => {
      await unmount();
    });
    await expect(result).resolves.toBeNull();
  });

  it('never takes the tag from the URL', async () => {
    mockParams = { request: 'unknown-request' };
    await render(<ConsentSheetRoute />);
    expect(screen.getByText('This request has expired. Please add the interest again.')).toBeOnTheScreen();
    expect(screen.queryByTestId('consent-add')).toBeNull();
  });
});
