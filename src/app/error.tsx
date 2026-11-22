"use client";
import { TriangleAlert } from "lucide-react";
import { useEffect } from "react";
import { Button, ButtonLink } from "@/components/ui/primitives";

/** Route-level error boundary: anything that throws while rendering a page lands here, inside the normal layout. */
export default function ErrorPage({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center py-16 text-center">
      <TriangleAlert className="size-10 text-warning" strokeWidth={1.5} aria-hidden />
      <h1 className="mt-4 text-[28px] leading-9">This page failed to load</h1>
      <p className="mt-2 max-w-[52ch] text-muted">
        The catalog service didn’t respond as expected. It is usually a brief database hiccup: try again in a moment.
      </p>
      {error.digest ? <p className="mt-2 font-mono text-xs text-faint">Reference: {error.digest}</p> : null}
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <Button variant="primary" onClick={retry}>
          Try again
        </Button>
        <ButtonLink href="/">Back to models</ButtonLink>
      </div>
    </div>
  );
}
