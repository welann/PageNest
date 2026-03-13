import JSZip from "jszip";
import { DOMParser } from "@xmldom/xmldom";
import { describe, expect, it } from "vitest";

import { parseEpubArchive } from "@shared/extractor/epubArchive";

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
          <item id="img1" href="images/fruit.svg" media-type="image/svg+xml"/>
        </manifest>
        <spine>
          <itemref idref="c1"/>
          <itemref idref="c2"/>
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
            </ol>
          </nav>
        </body>
      </html>`
  );
  zip.file(
    "OPS/images/fruit.svg",
    `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="80" viewBox="0 0 120 80">
      <rect width="120" height="80" rx="16" fill="#f4d7aa"/>
      <circle cx="40" cy="40" r="18" fill="#db7c3f"/>
      <circle cx="76" cy="34" r="14" fill="#6c8c54"/>
    </svg>`
  );
  zip.file(
    "OPS/chapters/chapter-1.xhtml",
    `<!doctype html>
      <html>
        <head><title>Chapter One</title></head>
        <body>
          <h1>Chapter One</h1>
          <figure>
            <img src="../images/fruit.svg" alt="Fruit plate" />
            <figcaption>Fruit plate</figcaption>
          </figure>
          <p>First paragraph.</p>
        </body>
      </html>`
  );
  zip.file(
    "OPS/chapters/chapter-2.xhtml",
    `<!doctype html>
      <html>
        <head><title>Chapter Two</title></head>
        <body>
          <h2>Chapter Two</h2>
          <blockquote>Quoted text.</blockquote>
        </body>
      </html>`
  );

  return zip.generateAsync({ type: "uint8array" });
}

describe("parseEpubArchive", () => {
  it("parses metadata, nested outline items, and structured blocks", async () => {
    globalThis.DOMParser = DOMParser as typeof globalThis.DOMParser;
    const archive = await parseEpubArchive(await buildFixtureEpub());

    expect(archive.metadata).toEqual({
      title: "Fixture Book",
      author: "Fixture Author",
      language: "zh-CN"
    });
    expect(archive.outline[0].label).toBe("Chapter One");
    expect(archive.outline[0].children[0].label).toBe("Chapter Two");
    expect(archive.sections).toHaveLength(2);
    expect(archive.sections[0].blocks[0]).toEqual({
      type: "heading",
      level: 1,
      text: "Chapter One"
    });
    expect(archive.sections[0].blocks[1]).toEqual({
      type: "image",
      assetId: "epub:OPS/images/fruit.svg",
      alt: "Fruit plate",
      caption: "Fruit plate",
      mimeType: "image/svg+xml"
    });
    expect(archive.assets["epub:OPS/images/fruit.svg"]).toEqual(
      expect.objectContaining({
        assetId: "epub:OPS/images/fruit.svg",
        fileName: "fruit.svg",
        mimeType: "image/svg+xml"
      })
    );
    expect(archive.sections[1].blocks[1]).toEqual({
      type: "quote",
      text: "Quoted text."
    });
  });
});
