import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { AppLayout } from "@/components/AppLayout";
import { ToolDocs } from "@/components/ToolDocs";
import { ToolShell } from "@/components/ToolShell";
import { locales, type Locale } from "@/i18n/config";
import { getToolMetaBySlug, toolMetas } from "@/tools/catalog";
import { getToolDocs } from "@/tools/docs";
import { localizeToolMeta } from "@/tools/i18n";
import { getToolBySlug } from "@/tools/registry";

type ToolPageParams = {
  locale: string;
  slug: string;
};

type ToolPageProps = {
  params: Promise<ToolPageParams>;
};

export function generateStaticParams(): ToolPageParams[] {
  return locales.flatMap((locale) =>
    toolMetas.map((meta) => ({ locale, slug: meta.slug }))
  );
}

export async function generateMetadata({
  params,
}: ToolPageProps): Promise<Metadata> {
  const { slug, locale } = await params;
  const resolvedLocale = locale as Locale;
  const t = await getTranslations({ locale: resolvedLocale });
  const meta = getToolMetaBySlug(slug);
  if (!meta) {
    return { title: t("tool.notFoundTitle") };
  }
  const localizedMeta = localizeToolMeta(meta, t);
  return {
    title: `${localizedMeta.title} | ${t("brand.name")}`,
    description: localizedMeta.description,
  };
}

export default async function ToolPage({ params }: ToolPageProps) {
  const { slug, locale } = await params;
  const resolvedLocale = locale as Locale;
  setRequestLocale(resolvedLocale);
  const t = await getTranslations({ locale: resolvedLocale });
  const tool = getToolBySlug(slug);
  const docs = await getToolDocs(slug, resolvedLocale);

  if (!tool) {
    notFound();
  }

  const ToolComponent = tool.component;
  const localizedMeta = localizeToolMeta(tool.meta, t);

  return (
    <AppLayout>
      <div className="mt-4 flex flex-1 flex-col gap-4">
        <ToolShell
          title={localizedMeta.title}
          description={localizedMeta.description}
          className="flex-1"
          locale={resolvedLocale}
        >
          <ToolComponent />
        </ToolShell>
        {docs ? <ToolDocs slug={slug} content={docs} /> : null}
      </div>
    </AppLayout>
  );
}
