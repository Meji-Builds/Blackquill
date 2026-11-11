"use client";

import { useEffect } from "react";
import Link from "next/link";
import { RotateCw } from "lucide-react";
import { btn } from "@/components/ui/styles";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center px-4 py-16 text-center">
      <h1 className="font-display text-[34px] leading-tight font-semibold">Something went wrong.</h1>
      <p className="mt-3 text-muted">
        We couldn&apos;t load this page. It&apos;s probably temporary: try again, and if it keeps happening, check your
        connection.
      </p>
      {error.digest && <p className="mt-2 text-xs text-muted/70">Reference: {error.digest}</p>}
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <button onClick={reset} className={btn.primary}>
          <RotateCw className="h-4 w-4" /> Try again
        </button>
        <Link href="/" className={btn.secondary}>
          Home
        </Link>
      </div>
    </div>
  );
}
