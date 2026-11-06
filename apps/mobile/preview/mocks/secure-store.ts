/** Preview fake of expo-secure-store: an in-memory map seeded by the scenario (runtime/install.ts). */
import { preview } from '../runtime/state';

export const AFTER_FIRST_UNLOCK = 0;
export const AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY = 1;
export const ALWAYS = 2;
export const WHEN_PASSCODE_SET_THIS_DEVICE_ONLY = 3;
export const ALWAYS_THIS_DEVICE_ONLY = 4;
export const WHEN_UNLOCKED = 5;
export const WHEN_UNLOCKED_THIS_DEVICE_ONLY = 6;

const map = () => preview().secureStore;

export const getItemAsync = async (key: string, _options?: unknown): Promise<string | null> => map().get(key) ?? null;
export const getItem = (key: string, _options?: unknown): string | null => map().get(key) ?? null;
export const setItemAsync = async (key: string, value: string, _options?: unknown): Promise<void> => {
  map().set(key, value);
};
export const setItem = (key: string, value: string, _options?: unknown): void => {
  map().set(key, value);
};
export const deleteItemAsync = async (key: string, _options?: unknown): Promise<void> => {
  map().delete(key);
};
export const isAvailableAsync = async (): Promise<boolean> => true;
export const canUseBiometricAuthentication = (): boolean => false;
