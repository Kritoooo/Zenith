import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { AppLayout } from "@/components/AppLayout";
import { ToolShell } from "@/components/ToolShell";
import { getToolMetaBySlug, toolMetas } from "@/tools/catalog";
import { getToolBySlug } from "@/tools/registry";

type ToolPageParams = {
  slug: string;
};

type ToolPageProps = {
  params: Promise<ToolPageParams>;
};

export function generateStaticParams(): ToolPageParams[] {
  return toolMetas.map((meta) => ({ slug: meta.slug }));
}

export async function generateMetadata({
  params,
}: ToolPageProps): Promise<Metadata> {
  const { slug } = await params;
  const meta = getToolMetaBySlug(slug);
  if (!meta) {
    return { title: "Tool not found | Zenith" };
  }
  return {
    title: `${meta.title} | Zenith`,
    description: meta.description,
  };
}

export default async function ToolPage({ params }: ToolPageProps) {
  const { slug } = await params;
  const tool = getToolBySlug(slug);

  if (!tool) {
    notFound();
  }

  const ToolComponent = tool.component;

  return (
    <AppLayout>
      <div className="mt-4 flex flex-1 flex-col">
        <ToolShell
          title={tool.meta.title}
          description={tool.meta.description}
          className="flex-1"
        >
          <ToolComponent />
        </ToolShell>
      </div>
    </AppLayout>
  );
}
