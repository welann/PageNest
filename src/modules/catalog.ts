import { ebookReaderManifest } from "./ebook-reader/manifest";
import { paperDeskManifest } from "./paper-desk/manifest";
import { subtitleWorkbenchManifest } from "./subtitle-workbench/manifest";

export const moduleCatalog = [
  ebookReaderManifest,
  paperDeskManifest,
  subtitleWorkbenchManifest
] as const;
