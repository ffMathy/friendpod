import { getLaunchArea } from '@grouper/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Platform } from 'react-native';
import Welcome from '../app/(auth)/index';
import EmailSignIn from '../app/(auth)/email';
import Terms from '../app/(onboarding)/terms';
import AboutYou from '../app/(onboarding)/name';
import Area from '../app/(onboarding)/area';
import CompleteEmailLink from '../app/auth/complete';

const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: () => true };
jest.mock('expo-router', () => ({ useRouter: () => mockRouter, useLocalSearchParams: () => ({}), Stack: { Screen: () => null } }));
jest.mock('expo-apple-authentication', () => ({ isAvailableAsync: jest.fn(async () => true), signInAsync: jest.fn() }));
jest.mock('@/features/auth/google', () => ({ signInWithGoogle: jest.fn() }));
jest.mock('@/firebase', () => ({ auth: jest.fn() }));
jest.mock('@react-native-firebase/auth', () => ({ AppleAuthProvider: {}, signInWithCredential: jest.fn(), reauthenticateWithCredential: jest.fn() }));
jest.mock('@/features/auth/emailLink', () => ({ sendEmailLink: jest.fn(async () => undefined), completeEmailLink: jest.fn(), isEmailLink: () => true, pendingEmail: async () => null }));
jest.mock('expo-location', () => ({ requestForegroundPermissionsAsync: jest.fn(async () => ({ granted: true })), getCurrentPositionAsync: jest.fn(), Accuracy: { Lowest: 1 } }));
jest.mock('@/features/session/SessionProvider', () => ({ useSession: () => ({ refreshClaims: async () => undefined }) }));
let mockDeleted = false;
jest.mock('@/features/account/account', () => ({ signOut: async () => undefined, consumeAccountDeleted: () => mockDeleted }));
const mockCall = jest.fn();
jest.mock('@/firebase/callables', () => ({ callFunction: (...args: unknown[]) => mockCall(...args), toAppError: (e: unknown) => e }));

const VEJLE = getLaunchArea('vejle')!;
let mockDraft: Record<string, unknown> = {};
const mockUpdate = jest.fn((patch: Record<string, unknown>) => {
  mockDraft = { ...mockDraft, ...patch };
});
jest.mock('@/features/onboarding/draft', () => ({ useOnboardingDraft: () => ({ draft: mockDraft, update: mockUpdate, reset: jest.fn() }) }));

let client: QueryClient;
async function renderWith(node: React.ReactElement) {
  client = new QueryClient({ defaultOptions: { mutations: { retry: false, gcTime: Infinity } } });
  const r = await render(<QueryClientProvider client={client}>{node}</QueryClientProvider>);
  await act(async () => {
    await Promise.resolve();
  });
  return r;
}
beforeEach(() => {
  jest.clearAllMocks();
  mockDraft = { legalAccepted: false, dob: null, firstName: null, gh5: null };
});
afterEach(() => client?.clear());

describe('welcome 1.1', () => {
  it('shows sign-in on the welcome screen; Apple only on iOS; links to legal docs', async () => {
    Object.defineProperty(Platform, 'OS', { value: 'ios', configurable: true });
    mockDeleted = true;
    await renderWith(<Welcome />);
    expect(screen.getByText('Your account has been deleted. Thanks for trying Grouper.')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Continue with Apple' })).toBeOnTheScreen();
    expect(screen.getByRole('switch', { name: 'English' })).toBeChecked();
    await fireEvent.press(screen.getByRole('button', { name: 'Continue with email' }));
    expect(mockRouter.push).toHaveBeenCalledWith('/email');
    // One caption with the Terms and the privacy notice as inline links (storyboard 1.1); they are accepted in the next step.
    expect(screen.getByText(/^Next, we'll ask you to accept the Terms\. Read how we handle your data in the privacy notice\.$/)).toBeOnTheScreen();
    expect(screen.getByRole('link', { name: 'Terms' })).toHaveStyle({ textDecorationLine: 'underline' });
    expect(screen.queryByText('Privacy notice')).toBeNull();
    await fireEvent.press(screen.getByRole('link', { name: 'Terms' }));
    expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/info/legal/[doc]', params: { doc: 'terms' } });
    await fireEvent.press(screen.getByRole('link', { name: 'privacy notice' }));
    expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/info/legal/[doc]', params: { doc: 'privacy' } });
    expect(screen.getByRole('image', { name: 'Grouper' })).toBeOnTheScreen();
    mockDeleted = false;
  });
});

describe('email', () => {
  it('sends a link only for a valid address', async () => {
    await renderWith(<EmailSignIn />);
    expect(screen.getByRole('button', { name: 'Send me a sign-in link' })).toBeDisabled();
    await fireEvent.changeText(screen.getByLabelText('Email address'), 'a@b.dk');
    await act(async () => await fireEvent.press(screen.getByRole('button', { name: 'Send me a sign-in link' })));
    expect(screen.getByText('Check your inbox and open the link on this phone.')).toBeOnTheScreen();
  });
});

describe('complete', () => {
  it('renders the header and body', async () => {
    await renderWith(<CompleteEmailLink />);
    expect(screen.getByRole('header', { name: 'Signing in' })).toBeOnTheScreen();
  });
});

describe('terms', () => {
  it('needs the unticked box before continuing to About you', async () => {
    await renderWith(<Terms />);
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();
    expect(screen.getByRole('checkbox', { name: 'I accept the Terms' })).not.toBeChecked();
    await fireEvent.press(screen.getByRole('checkbox', { name: 'I accept the Terms' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
    expect(mockUpdate).toHaveBeenCalledWith({ legalAccepted: true });
    expect(mockRouter.push).toHaveBeenCalledWith('/name');
  });
});

describe('about you 1.2', () => {
  it('validates the name and date, lets an under-18 date through to the server, and fills the draft', async () => {
    await renderWith(<AboutYou />);
    const cont = () => screen.getByRole('button', { name: 'Continue' });
    expect(cont()).toBeDisabled();
    await fireEvent.changeText(screen.getByLabelText('First name'), 'Ea');
    await fireEvent.changeText(screen.getByLabelText('Day'), '31');
    await fireEvent.changeText(screen.getByLabelText('Month'), '02');
    await fireEvent.changeText(screen.getByLabelText('Year'), '1990');
    expect(screen.getByText('That is not a valid date.')).toBeOnTheScreen();
    expect(cont()).toBeDisabled();
    await fireEvent.changeText(screen.getByLabelText('Day'), '14');
    await fireEvent.changeText(screen.getByLabelText('Year'), String(new Date().getFullYear() - 10));
    expect(screen.getByText('Grouper is only for people aged 18 and over.')).toBeOnTheScreen();
    expect(cont()).toBeEnabled();
    await fireEvent.changeText(screen.getByLabelText('Year'), '1991');
    await fireEvent.press(cont());
    expect(mockUpdate).toHaveBeenCalledWith({ firstName: 'Ea', dob: '1991-02-14' });
    expect(mockRouter.push).toHaveBeenCalledWith('/area');
  });

  it('shows what the draft holds when coming back', async () => {
    mockDraft = { legalAccepted: true, dob: '1991-03-14', firstName: 'Mathias', gh5: null };
    await renderWith(<AboutYou />);
    expect(screen.getByLabelText('First name').props.value).toBe('Mathias');
    expect(screen.getByLabelText('Day').props.value).toBe('14');
    expect(screen.getByLabelText('Month').props.value).toBe('03');
    expect(screen.getByLabelText('Year').props.value).toBe('1991');
  });

  it('rejects contact details in the name', async () => {
    await renderWith(<AboutYou />);
    await fireEvent.changeText(screen.getByLabelText('First name'), 'ea@x.dk');
    expect(screen.getByText('Use 1–30 letters. No contact details.')).toBeOnTheScreen();
  });
});

describe('area 1.3', () => {
  it('turns a known postcode into the cell at once, clears it for an unknown one, and completes onboarding', async () => {
    mockDraft = { legalAccepted: true, dob: '1990-01-01', firstName: 'Ea', gh5: null };
    mockCall.mockResolvedValue({ areaStatus: 'waitlist' });
    const r = await renderWith(<Area />);
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();
    await fireEvent.changeText(screen.getByLabelText('Postcode'), '7100');
    expect(mockUpdate).toHaveBeenLastCalledWith({ gh5: expect.any(String) });
    expect(VEJLE.cells).toContain(mockDraft.gh5);
    await r.rerender(
      <QueryClientProvider client={client}>
        <Area />
      </QueryClientProvider>,
    );
    expect(screen.getByText('Vejle')).toBeOnTheScreen();
    // The pill is a sentence about the city, not a list the user is already on.
    expect(screen.getByText('Vejle opens soon')).toBeOnTheScreen();
    expect(screen.queryByText('On the waitlist')).toBeNull();
    await fireEvent.changeText(screen.getByLabelText('Postcode'), '0001');
    expect(mockUpdate).toHaveBeenLastCalledWith({ gh5: null });
    expect(screen.getByText("We don't know that postcode.")).toBeOnTheScreen();
    await fireEvent.changeText(screen.getByLabelText('Postcode'), '7100');
    await r.rerender(
      <QueryClientProvider client={client}>
        <Area />
      </QueryClientProvider>,
    );
    await act(async () => await fireEvent.press(screen.getByRole('button', { name: 'Continue' })));
    expect(mockCall).toHaveBeenCalledWith(
      'completeOnboarding',
      expect.objectContaining({ firstName: 'Ea', dob: '1990-01-01', area: { gh5: mockDraft.gh5 }, legal: expect.any(Object) }),
    );
    expect(mockCall.mock.calls[0]![1]).not.toHaveProperty('postcode');
    expect(mockRouter.replace).toHaveBeenCalledWith('/sensitive-consent');
  });

  it('shows the underage answer with only the sign-out path', async () => {
    mockDraft = { legalAccepted: true, dob: '2015-01-01', firstName: 'Ea', gh5: VEJLE.cells[0] };
    mockCall.mockRejectedValue({ code: 'UNDERAGE' });
    await renderWith(<Area />);
    await act(async () => await fireEvent.press(screen.getByRole('button', { name: 'Continue' })));
    expect(screen.getByText(/We have deleted your sign-in/)).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'OK' })).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Back' })).toBeNull();
  });
});
