import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';

const sourceRoot = process.argv[2];
if (!sourceRoot) {
  console.error('Usage: npm run import:local -- "C:\\path\\to\\Ninth Atlas"');
  process.exit(1);
}

const resolvedSource = path.resolve(sourceRoot);
if (!fs.existsSync(resolvedSource) || !fs.statSync(resolvedSource).isDirectory()) {
  console.error(`Source folder not found: ${resolvedSource}`);
  process.exit(1);
}

const imageExts = new Set(['.png', '.jpg', '.jpeg', '.webp']);

type Found = {
  absolutePath: string;
  filename: string;
  base: string;
};

function walk(dir: string): Found[] {
  const out: Found[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const absolutePath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walk(absolutePath));
      continue;
    }
    const ext = path.extname(entry.name).toLowerCase();
    if (!imageExts.has(ext)) continue;
    out.push({
      absolutePath,
      filename: entry.name,
      base: path.basename(entry.name, ext),
    });
  }
  return out;
}

function sha256(filePath: string): string {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

const files = walk(resolvedSource);
const byBase = new Map(files.map((f) => [f.base.toLowerCase(), f]));

const conceptDir = path.resolve(process.cwd(), 'assets', 'source', 'concepts');
const actualDir = path.resolve(process.cwd(), 'assets', 'source', 'actual');
const runtimeDir = path.resolve(process.cwd(), '.runtime');
fs.mkdirSync(conceptDir, { recursive: true });
fs.mkdirSync(actualDir, { recursive: true });
fs.mkdirSync(runtimeDir, { recursive: true });

const expected = [
  ...Array.from({ length: 10 }, (_, i) => ({
    sourceBase: String(i + 1),
    kind: 'concept' as const,
    id: i + 1,
    destination: path.join(conceptDir, `concept-${String(i + 1).padStart(2, '0')}.png`),
  })),
  ...Array.from({ length: 15 }, (_, i) => ({
    sourceBase: `ac${i + 1}`,
    kind: 'actual' as const,
    id: i + 1,
    destination: path.join(actualDir, `ac-${String(i + 1).padStart(2, '0')}.png`),
  })),
];

const missing: string[] = [];
const report: Array<Record<string, unknown>> = [];

for (const item of expected) {
  const found = byBase.get(item.sourceBase.toLowerCase());
  if (!found) {
    missing.push(item.sourceBase);
    continue;
  }

  const originalMeta = await sharp(found.absolutePath).metadata();
  const originalHash = sha256(found.absolutePath);

  await sharp(found.absolutePath)
    .rotate()
    .png({ compressionLevel: 9 })
    .toFile(item.destination);

  const normalizedMeta = await sharp(item.destination).metadata();
  const normalizedHash = sha256(item.destination);

  report.push({
    kind: item.kind,
    id: item.id,
    sourceFile: found.filename,
    originalSha256: originalHash,
    originalWidth: originalMeta.width ?? null,
    originalHeight: originalMeta.height ?? null,
    normalizedFile: path.relative(process.cwd(), item.destination).replaceAll('\\', '/'),
    normalizedSha256: normalizedHash,
    normalizedWidth: normalizedMeta.width ?? null,
    normalizedHeight: normalizedMeta.height ?? null,
  });

  console.log(
    `✓ ${item.kind.padEnd(7)} ${String(item.id).padStart(2, '0')}  ${found.filename} -> ${path.basename(item.destination)}  ${normalizedMeta.width}x${normalizedMeta.height}`,
  );
}

const output = {
  importedAt: new Date().toISOString(),
  counts: {
    concepts: report.filter((r) => r.kind === 'concept').length,
    actual: report.filter((r) => r.kind === 'actual').length,
  },
  missing,
  files: report,
};

const reportPath = path.join(runtimeDir, 'local-asset-import.json');
fs.writeFileSync(reportPath, JSON.stringify(output, null, 2));

console.log('');
console.log(`Concept files imported: ${output.counts.concepts}/10`);
console.log(`Actual frames imported: ${output.counts.actual}/15`);
console.log(`Import report: ${reportPath}`);

if (missing.length) {
  console.error(`Missing expected files: ${missing.join(', ')}`);
  process.exit(2);
}

console.log('IMPORT PASS. All 25 source images are now normalized inside the local repo asset vault.');
