import { describe, expect, it } from "vitest";

import {
  prepareRenderedEpubPreviewMarkup,
  sanitizeRawRenderedMarkup
} from "@modules/content-extractor/EpubPreviewSurface";

describe("sanitizeRawRenderedMarkup", () => {
  it("removes xml declarations and legacy doctypes before preview rendering", () => {
    const markup = `<?xml version="1.0" encoding="utf-8"?>
      <!DOCTYPE html>
      <html xmlns="http://www.w3.org/1999/xhtml">
        <body><h1>Chapter One</h1></body>
      </html>`;

    const normalized = sanitizeRawRenderedMarkup(markup);

    expect(normalized).not.toContain("<?xml");
    expect(normalized).not.toContain("<!DOCTYPE");
    expect(normalized).toContain("<html");
  });
});

describe("prepareRenderedEpubPreviewMarkup", () => {
  it("still strips xml-heavy headers when no browser DOMParser is available", () => {
    const originalDomParser = globalThis.DOMParser;
    (globalThis as { DOMParser?: typeof DOMParser }).DOMParser = undefined;

    try {
      const normalized = prepareRenderedEpubPreviewMarkup(`<?xml version="1.0"?><html><body><p>Hi</p></body></html>`);

      expect(normalized).not.toContain("<?xml");
      expect(normalized).toContain("<p>Hi</p>");
    } finally {
      (globalThis as { DOMParser?: typeof DOMParser }).DOMParser = originalDomParser;
    }
  });
});
