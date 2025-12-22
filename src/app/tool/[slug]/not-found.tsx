import Link from "next/link";

import { AppLayout } from "@/components/AppLayout";
import { GlassCard } from "@/components/GlassCard";

export default function ToolNotFound() {
  return (
    <AppLayout>
      <div className="mt-12">
        <GlassCard className="mx-auto max-w-xl p-8 text-center">
          <p className="text-sm uppercase tracking-[0.2em] text-[color:var(--text-secondary)]">
            Zenith
          </p>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight">
            Tool not found
          </h1>
          <p className="mt-2 text-sm text-[color:var(--text-secondary)]">
            The tool you requested may have moved or is not registered yet.
          </p>
          <Link
            href="/"
            className="mt-6 inline-flex items-center justify-center rounded-full bg-[color:var(--accent-blue)] px-5 py-2 text-sm font-semibold text-white shadow-[0_12px_24px_-14px_rgba(0,122,255,0.6)]"
          >
            Back to dashboard
          </Link>
        </GlassCard>
      </div>
    </AppLayout>
  );
}
