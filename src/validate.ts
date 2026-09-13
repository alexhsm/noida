import fs from 'node:fs';
import sharp from 'sharp';
import { loadManifest, sourceAssetPath } from './manifest.js';

const manifest = loadManifest();
let failed = false;

console.log(`\n${manifest.project.title}`);
console.log(`Manifest scenes: ${manifest.scenes.length}`);
console.log(`Target timeline: ~${manifest.project.targetRuntimeSeconds}s\n`);

const usedAssetKeys = [...new Set(manifest.scenes.map((scene) => scene.asset))];

for (const key of usedAssetKeys) {
  const filename = manifest.assets[key];
  if (!filename) {
    console.error(`✗ Asset key '${key}' is used by a scene but missing from manifests/project.json`);
    failed = true;
    continue;
  }

  const filePath = sourceAssetPath(filename);
  if (!fs.existsSync(filePath)) {
    console.error(`✗ Missing: assets/source/${filename}`);
    failed = true;
    continue;
  }

  try {
    const metadata = await sharp(filePath).metadata();
    const width = metadata.width ?? 0;
    const height = metadata.height ?? 0;
    const ratio = height ? width / height : 0;
    const ratioStatus = ratio >= 0.5 && ratio <= 2 ? 'OK' : 'CHECK';
    const sizeStatus = width >= 640 && height >= 640 ? 'OK' : 'LOW-RES';
    console.log(`✓ ${filename}  ${width}x${height}  ratio=${ratio.toFixed(2)} [${ratioStatus}/${sizeStatus}]`);
  } catch (error) {
    console.error(`✗ Could not inspect ${filename}:`, error);
    failed = true;
  }
}

const plannedGenerationSeconds = manifest.scenes.reduce((sum, scene) => sum + scene.duration, 0);
console.log(`\nPlanned generated footage: ${plannedGenerationSeconds}s`);
console.log('Note: final runtime also includes trims, transitions, title card and end slate.');

if (failed) {
  console.error('\nVALIDATION FAILED. Fix the missing/invalid source assets before any paid API generation.\n');
  process.exit(1);
}

console.log('\nVALIDATION PASS. Assets required for the locked scene list are present.\n');
