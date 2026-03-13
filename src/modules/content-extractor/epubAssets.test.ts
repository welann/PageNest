import { describe, expect, it } from "vitest";

import { buildResolvedEpubAssetDataUrl, buildResolvedEpubAssetFile } from "@modules/content-extractor/epubAssets";

describe("buildResolvedEpubAssetDataUrl", () => {
  it("inlines nested SVG image href references as data URLs", async () => {
    const assets = {
      "epub:OPS/images/graphic.svg": {
        assetId: "epub:OPS/images/graphic.svg",
        data: new TextEncoder().encode(
          `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><image href="photo.png" width="10" height="10" /></svg>`
        ),
        fileName: "graphic.svg",
        mimeType: "image/svg+xml"
      },
      "epub:OPS/images/photo.png": {
        assetId: "epub:OPS/images/photo.png",
        data: Uint8Array.from([137, 80, 78, 71]),
        fileName: "photo.png",
        mimeType: "image/png"
      }
    };

    const dataUrl = buildResolvedEpubAssetDataUrl("epub:OPS/images/graphic.svg", assets);
    const file = buildResolvedEpubAssetFile("epub:OPS/images/graphic.svg", assets);

    expect(dataUrl).toContain("data:image/svg+xml;base64,");
    expect(file).not.toBeNull();
    expect(await file?.text()).toContain("data:image/png;base64,");
  });
});
