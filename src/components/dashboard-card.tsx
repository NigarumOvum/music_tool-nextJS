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
    <Link href={href} className="group panel relative block min-h-[240px] overflow-hidden rounded-[2rem] p-6 transition duration-300 hover:-translate-y-1.5 hover:shadow-[0_30px_80px_rgba(15,23,42,0.16)]">
      <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.22),transparent_45%)]" />
      <div className="absolute inset-x-5 top-0 h-1 rounded-full" style={{ background: accent }} />
      <div className="relative flex h-full flex-col justify-between gap-8">
        <div className="eyebrow">{eyebrow}</div>
        <div className="flex items-start justify-between gap-3">
          <h2 className="max-w-[12ch] text-3xl font-black tracking-[-0.05em] text-[var(--color-ink)]">{title}</h2>
          <div className="glass-pill p-2.5 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5">
            <ArrowUpRight className="h-4 w-4 text-[var(--color-ink)]" />
          </div>
        </div>
        <p className="max-w-[28ch] text-sm leading-7 text-[var(--color-ink-soft)]">{description}</p>
      </div>
    </Link>
  );
}