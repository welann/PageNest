import fs from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import readline from "node:readline";

const inputPath = process.argv[2];
const outputPath = process.argv[3];

if (!inputPath || !outputPath) {
  throw new Error("Usage: node scripts/build_default_ecdict.mjs <input.csv> <output.json>");
}

function parseCsvLine(line) {
  const columns = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    const nextCharacter = line[index + 1];

    if (character === '"') {
      if (inQuotes && nextCharacter === '"') {
        current += '"';
        index += 1;
        continue;
      }

      inQuotes = !inQuotes;
      continue;
    }

    if (character === "," && !inQuotes) {
      columns.push(current);
      current = "";
      continue;
    }

    current += character;
  }

  columns.push(current);
  return columns;
}

function normalizeText(value) {
  return value.replace(/\\n/g, " / ").replace(/\s+/g, " ").trim();
}

function toPositiveNumber(value) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : Number.POSITIVE_INFINITY;
}

function shouldIncludeEntry(entry) {
  return (
    entry.rank <= 10000 ||
    Boolean(entry.oxford) ||
    entry.collins >= 2
  );
}

const entries = [];
const reader = readline.createInterface({
  input: fs.createReadStream(inputPath, {
    encoding: "utf-8"
  })
});

let lineIndex = 0;

for await (const line of reader) {
  if (!line) {
    continue;
  }

  const columns = parseCsvLine(line);

  if (lineIndex === 0) {
    lineIndex += 1;
    continue;
  }

  lineIndex += 1;

  const [
    word,
    phonetic,
    definition,
    translation,
    pos,
    collins,
    oxford,
    ,
    bnc,
    frq,
    exchange
  ] = columns;

  if (!/^[A-Za-z]+(?:'[A-Za-z]+)?$/.test(word)) {
    continue;
  }

  const normalizedTranslation = normalizeText(translation || "");

  if (!normalizedTranslation) {
    continue;
  }

  const entry = {
    collins: Number(collins || 0),
    definition: normalizedTranslation,
    exchange: normalizeText(exchange || "") || null,
    lemma: word.toLowerCase(),
    note: normalizeText(definition || "") || null,
    oxford: normalizeText(oxford || ""),
    partOfSpeech: normalizeText(pos || "") || null,
    phonetic: normalizeText(phonetic || "") || null,
    rank: Math.min(toPositiveNumber(bnc), toPositiveNumber(frq)),
    source: "ecdict-default"
  };

  if (!shouldIncludeEntry(entry)) {
    continue;
  }

    entries.push({
      lemma: entry.lemma,
      definition: entry.definition,
      partOfSpeech: entry.partOfSpeech,
      note: entry.note,
      phonetic: entry.phonetic,
      exchange: entry.exchange,
      source: entry.source,
      updatedAt: "1970-01-01T00:00:00.000Z"
    });
  }

entries.sort((left, right) => left.lemma.localeCompare(right.lemma));

await mkdir(path.dirname(outputPath), {
  recursive: true
});
await writeFile(outputPath, JSON.stringify(entries));

console.log(`wrote ${entries.length} default dictionary entries to ${outputPath}`);
