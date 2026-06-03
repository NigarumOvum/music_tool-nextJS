import Link from "next/link";

import { ArrowUpRight } from "lucide-react";

type DashboardCardProps = {
  href: string;
  title: string;
  eyebrow: string;
  description: string;
  accent: string;
};

export function DashboardCard({ href, title, eyebrow, description, accent }: DashboardCardProps) {
  return (
    <Link href={href} className="group panel relative overflow-hidden rounded-[1.75rem] p-5 transition duration-200 hover:-translate-y-1">
      <div className="absolute inset-x-0 top-0 h-1" style={{ background: accent }} />
      <div className="space-y-4">
        <div className="eyebrow">{eyebrow}</div>
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-2xl font-black tracking-tight text-[var(--color-sand-1)]">{title}</h2>
          <div className="rounded-full border border-white/10 bg-white/5 p-2 transition group-hover:border-white/20 group-hover:bg-white/10">
            <ArrowUpRight className="h-4 w-4 text-[var(--color-sand-1)]" />
          </div>
        </div>
        <p className="text-sm leading-7 text-[var(--color-sand-2)]">{description}</p>
      </div>
    </Link>
  );
}