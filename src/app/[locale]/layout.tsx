import type { ReactNode } from "react";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";

import { HtmlLang } from "@/components/HtmlLang";
import { buildLocales } from "@/i18n/build-locales";
import { type Locale } from "@/i18n/config";

export function generateStaticParams() {
  return buildLocales.map((locale) => ({ locale }));
}

type LocaleLayoutProps = {
  children: ReactNode;
  params: Promise<{
    locale: string;
  }>;
};

export default async function LocaleLayout({ children, params }: LocaleLayoutProps) {
  const { locale } = await params;
  const resolvedLocale = locale as Locale;
  setRequestLocale(resolvedLocale);
  const messages = await getMessages({ locale: resolvedLocale });

  return (
    <NextIntlClientProvider key={locale} locale={locale} messages={messages}>
      <HtmlLang />
      {children}
    </NextIntlClientProvider>
  );
}
