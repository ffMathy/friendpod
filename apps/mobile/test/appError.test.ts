import { APP_ERRORS, type AppErrorCode } from '@grouper/core';
import { toAppError } from '@/firebase/callables';

jest.mock('@react-native-firebase/functions', () => ({ httpsCallable: jest.fn() }));
jest.mock('@/firebase/index', () => ({ functions: jest.fn() }));

/** The shape RNFirebase gives a callable's HttpsError: `functions/<canonical>` plus the server's details. */
const serverError = (canonical: string, details?: unknown) => Object.assign(new Error(canonical), { code: `functions/${canonical}`, details });

describe('toAppError', () => {
  it('keeps every app code both codebases send in details.code, including the wrapper and stub codes', () => {
    for (const [code, canonical] of Object.entries(APP_ERRORS) as [AppErrorCode, string][]) {
      expect(toAppError(serverError(canonical, { code }))).toMatchObject({ code, canonical });
    }
    expect(toAppError(serverError('unauthenticated', { code: 'APP_CHECK' })).code).toBe('APP_CHECK');
    expect(toAppError(serverError('unimplemented', { code: 'NOT_IMPLEMENTED', design: '§3.7' })).code).toBe('NOT_IMPLEMENTED');
  });

  it('maps codes it does not know to UNKNOWN and transport failures to NETWORK', () => {
    expect(toAppError(serverError('internal', { code: 'SOMETHING_NEW' })).code).toBe('UNKNOWN');
    expect(toAppError(serverError('unavailable')).code).toBe('NETWORK');
    expect(toAppError('not an error object').code).toBe('UNKNOWN');
  });
});
