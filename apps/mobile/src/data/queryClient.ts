import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000 },
    // Callables are not idempotent from the client's point of view; the user retries explicitly.
    mutations: { retry: false },
  },
});
