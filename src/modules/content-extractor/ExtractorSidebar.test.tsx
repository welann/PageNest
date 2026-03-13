import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { ExtractorSidebarPanel } from "@modules/content-extractor/ExtractorSidebar";

describe("ExtractorSidebarPanel", () => {
  it("renders current document, mode, and warnings into the markup", () => {
    const markup = renderToStaticMarkup(
      <ExtractorSidebarPanel
        currentDocumentTitle="Sample Book"
        modeLabel="按目录"
        pageCountLabel="总页数: EPUB 无稳定页码"
        pendingAction={null}
        resultAvailable={false}
        resultCharCount={0}
        resultGeneratedLabel="尚未生成结果"
        selectionCountLabel="已选目录: 0"
        statusLabel="可提取"
        telegraphConfigured={true}
        telegraphPublishLabel="尚未发布到 Telegraph"
        telegraphPublishUrl={null}
        warnings={["测试提示"]}
        onClearResult={vi.fn()}
        onCopyResult={vi.fn()}
        onOpenTelegraphSettings={vi.fn()}
        onPublishToTelegraph={vi.fn()}
        onUpload={vi.fn()}
      />
    );

    expect(markup).toContain("Sample Book");
    expect(markup).toContain("按目录");
    expect(markup).toContain("测试提示");
    expect(markup).toContain("复制结果");
    expect(markup).toContain("Telegraph 设置");
  });
});
