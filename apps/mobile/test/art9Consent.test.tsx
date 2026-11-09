import { LEGAL_TEXT_SHA256, setArt9ConsentInput } from '@grouper/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, within } from '@testing-library/react-native';
import { Art9BlanketConsent } from '@/features/consent/Art9BlanketConsent';
import { appVersion } from '@/lib/appVersion';
import SensitiveConsentStep from '../app/(onboarding)/sensitive-consent';

const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => false) };
jest.mock('expo-router', () => ({ useRouter: () => mockRouter }));

const mockCall = jest.fn();
jest.mock('@/firebase/callables', () => ({
  callFunction: (...args: unknown[]) => mockCall(...args),
  toAppError: (e: unknown) => e,
}));

const handlers = () => ({ onAgree: jest.fn(), onNotNow: jest.fn(), onReadMore: jest.fn() });

beforeEach(() => {
  mockCall.mockReset();
  Object.values(mockRouter).forEach((f) => f.mockClear());
  mockRouter.canGoBack.mockReturnValue(false);
});

describe('blanket Art. 9 consent (D3, PRIVACY.md §3.3)', () => {
  it('shows the versioned copy, including the meetup chat and the user downgrade', async () => {
    await render(<Art9BlanketConsent locale="en" {...handlers()} />);
    expect(screen.getByText('Sensitive interests')).toBeOnTheScreen();
    expect(screen.getByText(/short meetup chat, open from 24 hours before/)).toBeOnTheScreen();
    expect(screen.getByText(/choose "This isn't sensitive for me" on it/)).toBeOnTheScreen();
    expect(screen.getByRole('checkbox', { name: /^I explicitly consent to Friendpod processing interests/ })).toBeOnTheScreen();
  });

  it('starts unticked, with "I agree" disabled until the box is ticked', async () => {
    const h = handlers();
    await render(<Art9BlanketConsent locale="en" {...h} />);
    const checkbox = screen.getByTestId('art9-checkbox');
    const agree = screen.getByTestId('art9-agree');
    expect(checkbox).not.toBeChecked();
    expect(agree).toBeDisabled();
    await fireEvent.press(agree);
    expect(h.onAgree).not.toHaveBeenCalled();

    await fireEvent.press(checkbox);
    expect(agree).toBeEnabled();
    await fireEvent.press(agree);
    expect(h.onAgree).toHaveBeenCalledWith({
      textVersion: 'art9-blanket-en-v2',
      textSha256: LEGAL_TEXT_SHA256['art9-blanket-en-v2'],
      appVersion,
      checked: true,
    });
  });

  it('records the Danish text and its own hash in Danish', async () => {
    const h = handlers();
    await render(<Art9BlanketConsent locale="da" {...h} />);
    expect(screen.getByText('Følsomme interesser')).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('art9-checkbox'));
    await fireEvent.press(screen.getByRole('button', { name: 'Jeg siger ja' }));
    expect(h.onAgree).toHaveBeenCalledWith(expect.objectContaining({ textVersion: 'art9-blanket-da-v2', textSha256: LEGAL_TEXT_SHA256['art9-blanket-da-v2'] }));
  });

  describe('onboarding step', () => {
    let client: QueryClient;
    const renderStep = async () => {
      client = new QueryClient({ defaultOptions: { mutations: { retry: false, gcTime: Infinity } } });
      await render(
        <QueryClientProvider client={client}>
          <SensitiveConsentStep />
        </QueryClientProvider>,
      );
    };
    afterEach(() => client.clear());

    it('is step 3 of 6, with the locked title under the "Private interests" badge and no way back to the submitted steps', async () => {
      await renderStep();
      expect(screen.getByText('Step 3 of 6')).toBeOnTheScreen();
      expect(screen.getByText('Private interests')).toBeOnTheScreen();
      expect(screen.getByRole('header', { name: 'Sensitive interests' })).toBeOnTheScreen();
      expect(screen.queryByRole('button', { name: 'Back' })).toBeNull();
    });

    it('keeps the locked copy in its own scrolling box, with the consent box and the actions outside it', async () => {
      await renderStep();
      const box = screen.getByTestId('art9-text');
      expect(within(box).getByText(/short meetup chat, open from 24 hours before/)).toBeOnTheScreen();
      expect(within(box).getByRole('link', { name: 'Read more about sensitive interests' })).toBeOnTheScreen();
      expect(within(box).queryByTestId('art9-checkbox')).toBeNull();
      expect(within(box).queryByRole('button', { name: 'Not now' })).toBeNull();
    });

    it('where the box gets too little room to read in, the copy and the actions flow in one scrolling column', async () => {
      await renderStep();
      // The box scrolls inside itself while it has the room.
      expect(within(screen.getByTestId('art9-text')).getByTestId('art9-text-scroll')).toBeOnTheScreen();
      await fireEvent.press(screen.getByTestId('art9-checkbox'));
      await fireEvent(screen.getByTestId('art9-text'), 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 342, height: 120 } } });
      // Then the copy runs at its full height, and nothing already answered is lost.
      expect(screen.queryByTestId('art9-text-scroll')).toBeNull();
      expect(within(screen.getByTestId('art9-text')).getByText(/short meetup chat, open from 24 hours before/)).toBeOnTheScreen();
      expect(screen.getByTestId('art9-checkbox')).toBeChecked();
      expect(screen.getByRole('button', { name: 'I agree' })).toBeEnabled();
    });

    it('"Not now" waits while the consent is being sent', async () => {
      mockCall.mockReturnValue(new Promise(() => undefined));
      await renderStep();
      expect(screen.getByRole('button', { name: 'Not now' })).toBeEnabled();
      await fireEvent.press(screen.getByTestId('art9-checkbox'));
      await act(async () => await fireEvent.press(screen.getByRole('button', { name: 'I agree' })));
      expect(screen.getByRole('button', { name: 'Not now' })).toBeDisabled();
      await fireEvent.press(screen.getByRole('button', { name: 'Not now' }));
      expect(mockRouter.push).not.toHaveBeenCalled();
    });

    it('"Not now" carries on to the interests and records nothing, so saying no keeps the app usable', async () => {
      await renderStep();
      await fireEvent.press(screen.getByRole('button', { name: 'Not now' }));
      expect(mockCall).not.toHaveBeenCalled();
      expect(mockRouter.push).toHaveBeenCalledWith('/add-interests');
    });

    it('opened from the interests step (a refused sensitive interest), it returns there', async () => {
      mockCall.mockResolvedValue({ ok: true });
      mockRouter.canGoBack.mockReturnValue(true);
      await renderStep();
      await fireEvent.press(screen.getByTestId('art9-checkbox'));
      await fireEvent.press(screen.getByRole('button', { name: 'I agree' }));
      await act(async () => {
        await Promise.resolve();
      });
      expect(mockRouter.back).toHaveBeenCalledTimes(1);
      expect(mockRouter.push).not.toHaveBeenCalled();
    });

    it('"I agree" calls setArt9Consent with the proof, then carries on', async () => {
      mockCall.mockResolvedValue({ ok: true });
      await renderStep();
      await fireEvent.press(screen.getByTestId('art9-checkbox'));
      await fireEvent.press(screen.getByRole('button', { name: 'I agree' }));
      await act(async () => {
        await Promise.resolve();
      });
      expect(mockCall).toHaveBeenCalledTimes(1);
      const [name, input] = mockCall.mock.calls[0] as [string, unknown];
      expect(name).toBe('setArt9Consent');
      expect(setArt9ConsentInput.parse(input)).toEqual({
        consent: { textVersion: 'art9-blanket-en-v2', textSha256: LEGAL_TEXT_SHA256['art9-blanket-en-v2'], appVersion, checked: true },
      });
      expect(mockRouter.push).toHaveBeenCalledWith('/add-interests');
    });
  });
});
