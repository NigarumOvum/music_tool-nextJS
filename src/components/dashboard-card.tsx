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
    <Link href={href} className="group panel relative block min-h-[160px] overflow-hidden rounded-3xl p-5 transition duration-300 hover:-translate-y-1 hover:shadow-xl">
      <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-50" />
      <div className="absolute left-0 top-0 bottom-0 w-1" style={{ background: accent }} />
      <div className="relative flex h-full flex-col justify-between">
        <div className="space-y-1">
          <div className="eyebrow text-[0.6rem] opacity-60 uppercase tracking-widest">{eyebrow}</div>
          <div className="flex items-start justify-between gap-2">
            <h2 className="text-xl font-black tracking-tight text-[var(--color-foreground)]">{title}</h2>
            <div className="glass-pill p-1.5 opacity-0 group-hover:opacity-100 transition-all transform translate-y-2 group-hover:translate-y-0">
              <ArrowUpRight className="h-3.5 w-3.5" />
            </div>
          </div>
        </div>
        <p className="text-xs leading-5 text-[var(--color-sand-2)] line-clamp-2 mt-4">{description}</p>
      </div>
    </Link>
  );
}