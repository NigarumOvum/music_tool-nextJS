import Link from "next/link";
import { Crown, Music2, ShieldCheck } from "lucide-react";

const sections: Array<{ title: string; links: Array<{ label: string; href: string }> }> = [
  {
    title: "Studio",
    links: [
      { label: "Music Toolkit", href: "/" },
      { label: "Production Studio", href: "/production-studio" },
      { label: "Prompt Library", href: "/prompt-library" },
    ],
  },
  {
    title: "Account",
    links: [
      { label: "Membership & Plans", href: "/membership" },
      { label: "Manage Account", href: "/account" },
      { label: "Lyrics Library", href: "/lyrics-library" },
    ],
  },
];

export function AppFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="panel glass-shine rounded-[1.25rem] p-5 sm:p-6 animate-fade-up">
      <div className="grid gap-6 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)]">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="glass-pill flex h-10 w-10 items-center justify-center text-[var(--color-copper)]">
              <Music2 className="h-5 w-5" />
            </div>
            <div>
              <div className="eyebrow">Studio Hub</div>
              <div className="text-base font-black tracking-tight text-[var(--color-foreground)]">Music Tool</div>
            </div>
          </div>
          <p className="max-w-sm text-xs leading-relaxed text-[var(--color-sand-2)]">
            A private, multi-user suite for songwriting, band collaboration, multitrack audio,
            music theory, and AI prompt workflows.
          </p>
          <p className="flex items-center gap-1.5 text-[11px] text-[var(--color-sand-2)]">
            <ShieldCheck className="h-3.5 w-3.5 text-[var(--color-mint)]" />
            Membership payments are processed securely by PayPal.
          </p>
        </div>

        {sections.map((section) => (
          <nav key={section.title} aria-label={section.title}>
            <div className="eyebrow mb-3 text-[0.62rem]">{section.title}</div>
            <ul className="space-y-2">
              {section.links.map((link) => (
                <li key={link.href + link.label}>
                  <Link
                    href={link.href}
                    className="text-xs font-semibold text-[var(--color-sand-2)] transition hover:text-[var(--color-foreground)]"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--color-stroke)] pt-4">
        <p className="text-[11px] text-[var(--color-sand-2)]">© {year} Music Tool. All rights reserved.</p>
        <Link
          href="/membership"
          className="glass-pill inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-[10px] font-black uppercase tracking-widest text-[var(--color-brass)] transition hover:brightness-110"
        >
          <Crown className="h-3.5 w-3.5" /> Go Pro
        </Link>
      </div>
    </footer>
  );
}
