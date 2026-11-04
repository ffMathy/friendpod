import type { CallableName, CallableOutput } from '@grouper/core';
import { useMutation, type UseMutationOptions } from '@tanstack/react-query';
import { callFunction, type AppError, type CallableRequest } from '@/firebase/callables';

/** A TanStack mutation over one callable, typed and validated by the core schemas. */
export function useCallable<N extends CallableName>(
  name: N,
  options?: Omit<UseMutationOptions<CallableOutput<N>, AppError, CallableRequest<N>>, 'mutationFn'>,
) {
  return useMutation<CallableOutput<N>, AppError, CallableRequest<N>>({
    ...options,
    mutationKey: ['callable', name],
    mutationFn: (request) => callFunction(name, request),
  });
}
