"use client";

import Link from "next/link";
import { Link2 } from "lucide-react";

export default function LinkBuilderWidget({ config }: { config: Record<string, unknown> }) {
  void config;

  return (
    <div className="flex flex-col items-center justify-center gap-4 h-full text-center px-4">
      <div className="w-12 h-12 rounded-2xl flex items-center justify-center gradient-accent">
        <Link2 className="w-6 h-6 text-white" />
      </div>
      <div>
        <h3 className="text-sm font-semibold text-[var(--foreground)]">UTM Link Builder</h3>
        <p className="text-xs text-[var(--muted-foreground)] mt-1 max-w-[240px]">
          Create tracked links for your recruitment campaigns with UTM parameters.
        </p>
      </div>
      <Link href="/" className="btn-primary text-xs px-4 py-2 cursor-pointer">
        Go to Campaigns
      </Link>
    </div>
  );
}
