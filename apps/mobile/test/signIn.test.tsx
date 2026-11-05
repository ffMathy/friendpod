import { act, render, screen } from '@testing-library/react-native';
import { Platform } from 'react-native';
import SignIn from '../app/(auth)/sign-in';

jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock('expo-apple-authentication', () => ({ isAvailableAsync: jest.fn(async () => true), signInAsync: jest.fn() }));
jest.mock('@/features/auth/google', () => ({ signInWithGoogle: jest.fn() }));
jest.mock('@/firebase', () => ({ auth: jest.fn() }));
jest.mock('@react-native-firebase/auth', () => ({ AppleAuthProvider: {}, signInWithCredential: jest.fn(), reauthenticateWithCredential: jest.fn() }));

const original = Platform.OS;
afterEach(() => {
  Object.defineProperty(Platform, 'OS', { value: original, configurable: true });
});

async function renderOn(os: 'ios' | 'android') {
  Object.defineProperty(Platform, 'OS', { value: os, configurable: true });
  await render(<SignIn />);
  await act(async () => {
    await Promise.resolve();
  });
}

describe('sign-in (D10)', () => {
  it('offers Apple on iOS', async () => {
    await renderOn('ios');
    expect(screen.getByRole('button', { name: 'Sign in with Apple' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Sign in with Google' })).toBeOnTheScreen();
  });

  it('hides Apple on Android, leaving Google and the email link', async () => {
    await renderOn('android');
    expect(screen.queryByRole('button', { name: 'Sign in with Apple' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Sign in with Google' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Sign in with an email link' })).toBeOnTheScreen();
  });
});
