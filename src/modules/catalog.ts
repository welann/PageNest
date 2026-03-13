import { ebookReaderManifest } from "./ebook-reader/manifest";
import { contentExtractorManifest } from "./content-extractor/manifest";

export const moduleCatalog = [ebookReaderManifest, contentExtractorManifest] as const;
