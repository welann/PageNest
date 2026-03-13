import type { PageModule } from "@modules/contracts";
import { contentExtractorManifest } from "@modules/content-extractor/manifest";
import { ebookReaderManifest } from "@modules/ebook-reader/manifest";

function defineModule(
  manifest: PageModule["manifest"],
  load: PageModule["load"]
): PageModule {
  return {
    manifest,
    load
  };
}

export const moduleRegistry = [
  defineModule(ebookReaderManifest, () => import("@modules/ebook-reader/view")),
  defineModule(contentExtractorManifest, () => import("@modules/content-extractor/view"))
] as const;

const moduleMap = new Map(
  moduleRegistry.map((moduleEntry) => [moduleEntry.manifest.slug, moduleEntry])
);

export function getModuleBySlug(slug: string) {
  return moduleMap.get(slug);
}

export function preloadModule(slug: string) {
  return moduleMap.get(slug)?.load();
}
