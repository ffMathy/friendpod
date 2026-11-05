import type { AppError } from '@/firebase/callables';

/** i18n key for a callable error; every app code (core APP_ERRORS) has a message in both languages. */
export function errorMessageKey(error: AppError) {
  return `errors.${error.code}` as const;
}
