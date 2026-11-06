import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Platform } from 'react-native';
import EmailSignIn from '../app/(auth)/email';
import Welcome from '../app/(auth)/index';
import CompleteEmailLink from '../app/auth/complete';
import { AuthCancelled } from '@/features/auth/errors';
import { i18n } from '@/i18n';

const mockRouter = { push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: () => true };
let mockParams: { link?: string } = {};
jest.mock('expo-router', () => ({ useRouter: () => mockRouter, useLocalSearchParams: () => mockParams, Stack: { Screen: () => null } }));
jest.mock('expo-apple-authentication', () => ({ isAvailableAsync: jest.fn(async () => true), signInAsync: jest.fn() }));
const mockGoogle = jest.fn();
jest.mock('@/features/auth/google', () => ({ signInWithGoogle: () => mockGoogle() }));
jest.mock('@/features/account/account', () => ({ consumeAccountDeleted: () => false }));
const mockSendLink = jest.fn();
const mockCompleteLink = jest.fn();
const mockPendingEmail = jest.fn(async (): Promise<string | null> => null);
jest.mock('@/features/auth/emailLink', () => ({
  sendEmailLink: (email: string) => mockSendLink(email),
  isEmailLink: (link: string) => link.includes('oobCode='),
  completeEmailLink: (link: string, email: string) => mockCompleteLink(link, email),
  pendingEmail: () => mockPendingEmail(),
}));
jest.mock('@/lib/env', () => ({ useEmulators: false }));
jest.mock('@/firebase', () => ({ auth: jest.fn() }));
jest.mock('@react-native-firebase/auth', () => ({ AppleAuthProvider: {}, signInWithCredential: jest.fn(), reauthenticateWithCredential: jest.fn() }));

const original = Platform.OS;
afterEach(() => {
  Object.defineProperty(Platform, 'OS', { value: original, configurable: true });
  jest.clearAllMocks();
  void i18n.changeLanguage('en');
});

async function renderOn(os: 'ios' | 'android') {
  Object.defineProperty(Platform, 'OS', { value: os, configurable: true });
  await render(<Welcome />);
  await act(async () => {
    await Promise.resolve();
  });
}

describe('welcome and sign-in (§3.1, D10)', () => {
  it('shows the storyboard content: headline, what a pod is, 18+ and the legal links', async () => {
    await renderOn('ios');
    expect(screen.getByRole('header', { name: 'Small groups.\nReal meetups.' })).toBeOnTheScreen();
    expect(screen.getByText(/Every Thursday we put together a pod of 4–6 people/)).toBeOnTheScreen();
    expect(screen.getByText('18+ only')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('link', { name: 'Terms' }));
    expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/info/legal/[doc]', params: { doc: 'terms' } });
    await fireEvent.press(screen.getByRole('link', { name: 'privacy notice' }));
    expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/info/legal/[doc]', params: { doc: 'privacy' } });
  });

  it('offers Apple on iOS', async () => {
    await renderOn('ios');
    expect(screen.getByRole('button', { name: 'Continue with Apple' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Continue with Google' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Continue with email' })).toBeOnTheScreen();
  });

  it('hides Apple on Android, leaving Google and the email link', async () => {
    await renderOn('android');
    expect(screen.queryByRole('button', { name: 'Continue with Apple' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Continue with Google' })).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Continue with email' }));
    expect(mockRouter.push).toHaveBeenCalledWith('/email');
  });

  it('says so when a sign-in fails, and nothing when the person cancels', async () => {
    await renderOn('android');
    mockGoogle.mockRejectedValueOnce(new AuthCancelled());
    await fireEvent.press(screen.getByRole('button', { name: 'Continue with Google' }));
    expect(screen.queryByRole('alert')).toBeNull();
    mockGoogle.mockRejectedValueOnce(new Error('network'));
    await fireEvent.press(screen.getByRole('button', { name: 'Continue with Google' }));
    expect(screen.getByText("Sign-in didn't work. Please try again.")).toBeOnTheScreen();
  });

  it('switches the UI language with the Dansk / English control', async () => {
    await renderOn('android');
    expect(screen.getByRole('radio', { name: 'English' })).toBeSelected();
    await fireEvent.press(screen.getByRole('radio', { name: 'Dansk' }));
    expect(i18n.language).toBe('da');
    expect(screen.getByRole('button', { name: 'Fortsæt med Google' })).toBeOnTheScreen();
    expect(screen.getByRole('radio', { name: 'Dansk' })).toBeSelected();
  });
});

describe('email link (F10)', () => {
  it('sends the link once the address looks valid, then says where it went', async () => {
    mockSendLink.mockResolvedValueOnce(undefined);
    await render(<EmailSignIn />);
    const send = screen.getByRole('button', { name: 'Send me a sign-in link' });
    expect(send).toBeDisabled();
    await fireEvent.changeText(screen.getByLabelText('Email address'), ' emil@example.com ');
    await fireEvent.press(send);
    expect(mockSendLink).toHaveBeenCalledWith(' emil@example.com ');
    expect(screen.getByText('We sent a link to emil@example.com. Open it on this phone to sign in.')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Send a new link' })).toBeOnTheScreen();
  });

  it('says when the link could not be sent', async () => {
    mockSendLink.mockRejectedValueOnce(new Error('auth/invalid-email'));
    await render(<EmailSignIn />);
    await fireEvent.changeText(screen.getByLabelText('Email address'), 'emil@example.com');
    await fireEvent.press(screen.getByRole('button', { name: 'Send me a sign-in link' }));
    expect(screen.getByText("We couldn't send the link. Check the address and try again.")).toBeOnTheScreen();
  });
});

describe('email link landing (§11)', () => {
  const link = 'https://grouper.example/__/auth/action?mode=signIn&oobCode=abc';
  afterEach(() => {
    mockParams = {};
  });

  it('asks for the address when the link was opened on another phone, signs in with it, and offers a way back', async () => {
    mockParams = { link };
    mockCompleteLink.mockResolvedValueOnce(undefined);
    await render(<CompleteEmailLink />);
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getByRole('header', { name: 'Finish signing in' })).toBeOnTheScreen();
    const signIn = screen.getByRole('button', { name: 'Sign in' });
    expect(signIn).toBeDisabled();
    await fireEvent.press(screen.getByRole('link', { name: 'Back to the start' }));
    expect(mockRouter.replace).toHaveBeenCalledWith('/');
    mockRouter.replace.mockClear();
    await fireEvent.changeText(screen.getByLabelText('Email address'), ' emil@example.com ');
    await fireEvent.press(signIn);
    expect(mockCompleteLink).toHaveBeenCalledWith(link, 'emil@example.com');
    expect(mockRouter.replace).toHaveBeenCalledWith('/');
  });

  it('signs in at once with the stored address, and ends with a way back when the link does not work', async () => {
    mockParams = { link };
    mockPendingEmail.mockResolvedValueOnce('emil@example.com');
    mockCompleteLink.mockRejectedValueOnce(new Error('auth/invalid-action-code'));
    await render(<CompleteEmailLink />);
    await act(async () => {
      await Promise.resolve();
    });
    expect(mockCompleteLink).toHaveBeenCalledWith(link, 'emil@example.com');
    expect(screen.getByRole('alert')).toHaveTextContent('The link has expired or was already used. Ask for a new one.');
    await fireEvent.press(screen.getByRole('button', { name: 'Back to the start' }));
    expect(mockRouter.replace).toHaveBeenCalledWith('/');
  });
});
