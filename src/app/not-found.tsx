import Link from "next/link";
import { Compass, Home } from "lucide-react";
import { btn } from "@/components/ui/styles";

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center px-4 py-16 text-center">
      <p className="font-display text-[88px] leading-none font-semibold text-accent/80">404</p>
      <h1 className="mt-4 font-display text-[32px] leading-tight font-semibold">This page has slipped off the map.</h1>
      <p className="mt-3 text-muted">
        The story, chapter or page you were looking for doesn&apos;t exist, or isn&apos;t published yet.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link href="/" className={btn.primary}>
          <Home className="h-4 w-4" /> Home
        </Link>
        <Link href="/browse" className={btn.secondary}>
          <Compass className="h-4 w-4" /> Browse stories
        </Link>
      </div>
    </div>
  );
}
