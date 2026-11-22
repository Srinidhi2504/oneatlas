"use client";
import * as Tooltip from "@radix-ui/react-tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { useState, type ReactNode } from "react";
import { ApiRequestError } from "@/lib/api";

/** Client-side context: TanStack Query cache, nuqs URL state adapter, one shared tooltip delay. */
export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 5 * 60_000, // catalog data only changes at ingest
            gcTime: 15 * 60_000,
            refetchOnWindowFocus: false,
            // retry network blips and 5xx, never a 4xx (the request itself is wrong)
            retry: (count, err) => count < 2 && !(err instanceof ApiRequestError && err.status >= 400 && err.status < 500),
          },
        },
      }),
  );
  return (
    <QueryClientProvider client={client}>
      <NuqsAdapter>
        <Tooltip.Provider delayDuration={250}>{children}</Tooltip.Provider>
      </NuqsAdapter>
    </QueryClientProvider>
  );
}
