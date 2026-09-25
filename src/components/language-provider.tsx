"use client";

import { createContext, useCallback, useContext, useMemo, type ReactNode } from "react";
import { Globe } from "lucide-react";

import { usePersistentState, useCurrentUserId } from "@/lib/persist";
import { DEFAULT_LOCALE, LOCALES, LOCALE_LABELS, isLocale, type Locale } from "@/lib/i18n/locales";
import { translate, type DictKey } from "@/lib/i18n/dictionaries";

type I18nContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: DictKey) => string;
};

const I18nContext = createContext<I18nContextValue>({
  locale: DEFAULT_LOCALE,
  setLocale: () => undefined,
  t: (key) => translate(DEFAULT_LOCALE, key),
});

export function LanguageProvider({ children }: { children: ReactNode }) {
  const userId = useCurrentUserId();
  const [stored, setStored] = usePersistentState<string>("app_locale", DEFAULT_LOCALE, { userId });
  const locale: Locale = isLocale(stored) ? stored : DEFAULT_LOCALE;

  const setLocale = useCallback(
    (next: Locale) => {
      document.documentElement.lang = next;
      setStored(next);
    },
    [setStored],
  );

  const t = useCallback((key: DictKey) => translate(locale, key), [locale]);

  const value = useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  return useContext(I18nContext);
}

export function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const { locale, setLocale, t } = useI18n();

  return (
    <label
      className={`glass-pill inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-semibold text-[var(--color-sand-2)] transition hover:text-[var(--color-foreground)] ${compact ? "" : ""}`}
      title={t("nav.language")}
    >
      <Globe className="h-3.5 w-3.5" />
      <select
        value={locale}
        onChange={(event) => {
          const next = event.target.value;
          if (isLocale(next)) setLocale(next);
        }}
        aria-label={t("nav.language")}
        className="cursor-pointer bg-transparent text-xs font-semibold uppercase tracking-[0.14em] outline-none"
      >
        {LOCALES.map((code) => (
          <option key={code} value={code} className="bg-[var(--color-surface)]">
            {compact ? code.toUpperCase() : LOCALE_LABELS[code]}
          </option>
        ))}
      </select>
    </label>
  );
}
