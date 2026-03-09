import { ebookReaderManifest } from "@modules/ebook-reader/manifest";
import { paperDeskManifest } from "@modules/paper-desk/manifest";
import { subtitleWorkbenchManifest } from "@modules/subtitle-workbench/manifest";

export const moduleCatalog = [
  ebookReaderManifest,
  paperDeskManifest,
  subtitleWorkbenchManifest
] as const;

