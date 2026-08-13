"use client";

import Link from "next/link";
import { motion } from "framer-motion";

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
    <motion.div whileHover={{ y: -4 }} transition={{ type: "spring", stiffness: 320, damping: 22 }}>
      <Link href={href} className="group panel panel-interactive glass-shine relative block min-h-[160px] overflow-hidden rounded-3xl p-5">
        <div className="absolute inset-0 bg-gradient-to-br from-white/8 to-transparent opacity-60" />
        <div className="absolute left-0 top-0 bottom-0 w-1" style={{ background: accent }} />
        <div className="relative flex h-full flex-col justify-between">
          <div className="space-y-1">
            <div className="eyebrow text-[0.6rem] opacity-60 uppercase tracking-widest">{eyebrow}</div>
            <div className="flex items-start justify-between gap-2">
              <h2 className="text-xl font-black tracking-tight text-[var(--color-foreground)]">{title}</h2>
              <div className="glass-pill p-1.5 opacity-0 transition-all group-hover:opacity-100">
                <ArrowUpRight className="h-3.5 w-3.5" />
              </div>
            </div>
          </div>
          <p className="mt-4 line-clamp-2 text-xs leading-5 text-[var(--color-sand-2)]">{description}</p>
        </div>
      </Link>
    </motion.div>
  );
}