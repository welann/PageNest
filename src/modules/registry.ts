import type { PageModule } from "@modules/contracts";
import { ebookReaderManifest } from "@modules/ebook-reader/manifest";
import { paperDeskManifest } from "@modules/paper-desk/manifest";
import { subtitleWorkbenchManifest } from "@modules/subtitle-workbench/manifest";

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
  defineModule(paperDeskManifest, () => import("@modules/paper-desk/view")),
  defineModule(subtitleWorkbenchManifest, () =>
    import("@modules/subtitle-workbench/view")
  )
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

