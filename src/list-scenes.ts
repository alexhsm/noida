import { loadManifest } from './manifest.js';

const manifest = loadManifest();

console.log(`\n${manifest.project.title}`);
console.log(manifest.project.subtitle);
console.log('');

for (const scene of manifest.scenes) {
  const filename = manifest.assets[scene.asset];
  console.log(`${scene.id}. ${scene.name}`);
  console.log(`   asset: ${filename}`);
  console.log(`   duration: ${scene.duration}s${scene.hero ? '  HERO' : ''}`);
}

console.log('');
