import JSZip from "jszip";
import { DOMParser } from "@xmldom/xmldom";
import { describe, expect, it } from "vitest";

import { parseEpubArchive } from "@shared/extractor/epubArchive";
import { analyzeEpubArchive, extractEpubByOutline, getEpubSectionsByOutline } from "@shared/extractor/epubSelection";

async function buildFixtureEpub() {
  const zip = new JSZip();

  zip.file(
    "META-INF/container.xml",
    `<?xml version="1.0"?>
      <container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
        <rootfiles>
          <rootfile full-path="OPS/content.opf" media-type="application/oebps-package+xml"/>
        </rootfiles>
      </container>`
  );
  zip.file(
    "OPS/content.opf",
    `<?xml version="1.0" encoding="utf-8"?>
      <package version="3.0" xmlns="http://www.idpf.org/2007/opf">
        <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
          <dc:title>Fixture Book</dc:title>
          <dc:creator>Fixture Author</dc:creator>
          <dc:language>zh-CN</dc:language>
        </metadata>
        <manifest>
          <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
          <item id="c1" href="chapters/chapter-1.xhtml" media-type="application/xhtml+xml"/>
          <item id="c2" href="chapters/chapter-2.xhtml" media-type="application/xhtml+xml"/>
          <item id="c3" href="chapters/chapter-3.xhtml" media-type="application/xhtml+xml"/>
        </manifest>
        <spine>
          <itemref idref="c1"/>
          <itemref idref="c2"/>
          <itemref idref="c3"/>
        </spine>
      </package>`
  );
  zip.file(
    "OPS/nav.xhtml",
    `<!doctype html>
      <html xmlns="http://www.w3.org/1999/xhtml">
        <body>
          <nav epub:type="toc">
            <ol>
              <li>
                <a href="chapters/chapter-1.xhtml">Chapter One</a>
                <ol>
                  <li><a href="chapters/chapter-2.xhtml">Chapter Two</a></li>
                </ol>
              </li>
              <li><a href="chapters/chapter-3.xhtml">Chapter Three</a></li>
            </ol>
          </nav>
        </body>
      </html>`
  );
  zip.file(
    "OPS/chapters/chapter-1.xhtml",
    `<!doctype html><html><body><h1>Chapter One</h1><p>First</p></body></html>`
  );
  zip.file(
    "OPS/chapters/chapter-2.xhtml",
    `<!doctype html><html><body><h2>Chapter Two</h2><p>Second</p></body></html>`
  );
  zip.file(
    "OPS/chapters/chapter-3.xhtml",
    `<!doctype html><html><body><h2>Chapter Three</h2><p>Third</p></body></html>`
  );

  return zip.generateAsync({ type: "uint8array" });
}

describe("getEpubSectionsByOutline", () => {
  it("expands parent outline nodes into merged section ranges in document order", async () => {
    globalThis.DOMParser = DOMParser as typeof globalThis.DOMParser;
    const parsed = analyzeEpubArchive(await parseEpubArchive(await buildFixtureEpub()), 7);
    const selection = getEpubSectionsByOutline(parsed, ["toc.0"]);

    expect(selection.selectedNodes.map((node) => node.label)).toEqual(["Chapter One"]);
    expect(selection.sections.map((section) => section.title)).toEqual(["Chapter One", "Chapter Two"]);
    expect(selection.ranges).toEqual([{ start: 0, end: 1 }]);
  });
});

describe("extractEpubByOutline", () => {
  it("stores selected section hrefs for stable EPUB preview rendering", async () => {
    globalThis.DOMParser = DOMParser as typeof globalThis.DOMParser;
    const parsed = analyzeEpubArchive(await parseEpubArchive(await buildFixtureEpub()), 7);
    const result = extractEpubByOutline(
      parsed,
      {
        author: "Fixture Author",
        capabilities: {
          outline: true,
          pageRanges: false
        },
        createdAt: "2026-03-13T00:00:00.000Z",
        format: "epub",
        id: 7,
        language: "zh-CN",
        storageKey: "reader/fixture.epub",
        title: "Fixture Book"
      },
      ["toc.0", "toc.1"]
    );

    expect(result.sourceRefs).toEqual([
      "OPS/chapters/chapter-1.xhtml",
      "OPS/chapters/chapter-2.xhtml",
      "OPS/chapters/chapter-3.xhtml"
    ]);
  });
});
