import type { ModuleManifest } from "@modules/contracts";

export const contentExtractorManifest: ModuleManifest = {
  slug: "content-extractor",
  title: "Content Extractor",
  subtitle: "按目录或页码提取 EPUB / PDF 内容",
  description: "从共享书库或新上传文档中提取指定章节、书签目录或页码范围，并直接复制正文结果。",
  category: "reader",
  status: "draft",
  icon: "🧾",
  accent: "#4F6F99",
  keywords: ["extractor", "epub", "pdf", "outline", "page range", "content"]
};
