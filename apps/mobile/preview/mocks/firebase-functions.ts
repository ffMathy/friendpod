/** Preview fake of @react-native-firebase/functions: callables run the scenario's handlers (runtime/callables.ts). */
import { runCallable } from '../runtime/callables';

export interface Functions {
  readonly region: string;
}

export interface HttpsCallableOptions {
  readonly timeout?: number;
  readonly limitedUseAppCheckTokens?: boolean;
}

export const getFunctions = (_app?: unknown, region = 'us-central1'): Functions => ({ region });
export const connectFunctionsEmulator = (): void => undefined;

export function httpsCallable<Req = unknown, Res = unknown>(_functions: Functions, name: string, _options?: HttpsCallableOptions) {
  return async (data?: Req): Promise<{ data: Res }> => ({ data: (await runCallable(name, data ?? null)) as Res });
}

export default () => getFunctions();
