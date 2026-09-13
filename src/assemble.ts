import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

type EditScene = {
  id: string;
  start: number;
  duration: number;
};

type EditManifest = {
  version: string;
  title: string;
  transitionSeconds: number;
  output: string;
  scenes: EditScene[];
};

const root = process.cwd();
const editPath = path.resolve(root, 'manifests', 'edit-v1.json');
if (!fs.existsSync(editPath)) throw new Error(`Missing edit manifest: ${editPath}`);

const edit = JSON.parse(fs.readFileSync(editPath, 'utf8')) as EditManifest;
const storyDir = path.resolve(root, 'outputs', 'story-v2', 'clips');

function newestMatching(dir: string, prefix: string): string | null {
  if (!fs.existsSync(dir)) return null;
  const matches = fs
    .readdirSync(dir)
    .filter((name) => name.toLowerCase().endsWith('.mp4') && name.startsWith(prefix))
    .map((name) => {
      const absolute = path.join(dir, name);
      return { absolute, mtime: fs.statSync(absolute).mtimeMs };
    })
    .sort((a, b) => b.mtime - a.mtime);
  return matches[0]?.absolute ?? null;
}

function resolveSceneClip(scene: EditScene): string | null {
  return newestMatching(storyDir, `scene-${scene.id}-`);
}

const resolvedCandidates = edit.scenes.map((scene) => ({ scene, file: resolveSceneClip(scene) }));
const missing = resolvedCandidates.filter((item) => !item.file).map((item) => item.scene.id);

if (missing.length > 0) {
  console.error('\nASSEMBLY PREFLIGHT FAILED');
  console.error(`Missing Story V2 MP4(s): ${missing.join(', ')}`);
  console.error(`Only this folder is allowed: ${storyDir}`);
  console.error('No selected, legacy, or fallback output paths will be used.');
  console.error('');
  process.exit(2);
}

const resolved = resolvedCandidates as Array<{ scene: EditScene; file: string }>;

console.log(`\n${edit.title}`);
console.log(`Edit manifest: ${edit.version}`);
console.log(`Source folder ONLY: ${storyDir}`);
console.log(`Transition: ${edit.transitionSeconds.toFixed(2)}s crossfade\n`);
for (const { scene, file } of resolved) {
  console.log(`✓ ${scene.id}  ${path.basename(file)}  trim=${scene.start.toFixed(2)}s + ${scene.duration.toFixed(2)}s`);
}

const ffmpeg = process.env.FFMPEG_PATH || 'ffmpeg';
const probe = spawnSync(ffmpeg, ['-version'], { encoding: 'utf8' });
if (probe.status !== 0) {
  throw new Error(`FFmpeg is not available as '${ffmpeg}'. Set FFMPEG_PATH or add ffmpeg to PATH.`);
}

const args: string[] = ['-hide_banner', '-y'];
for (const item of resolved) {
  args.push('-i', item.file);
}

const filters: string[] = [];
for (let i = 0; i < resolved.length; i += 1) {
  const { scene } = resolved[i];
  filters.push(
    `[${i}:v]trim=start=${scene.start}:duration=${scene.duration},` +
      `setpts=PTS-STARTPTS,fps=30,` +
      `scale=1280:720:force_original_aspect_ratio=decrease,` +
      `pad=1280:720:(ow-iw)/2:(oh-ih)/2,setsar=1,format=yuv420p[v${i}]`,
  );
}

let current = 'v0';
let cumulativeDuration = resolved[0].scene.duration;
for (let i = 1; i < resolved.length; i += 1) {
  const next = `v${i}`;
  const out = `x${i}`;
  const offset = cumulativeDuration - edit.transitionSeconds;
  filters.push(
    `[${current}][${next}]xfade=transition=fade:duration=${edit.transitionSeconds}:offset=${offset.toFixed(3)}[${out}]`,
  );
  current = out;
  cumulativeDuration += resolved[i].scene.duration - edit.transitionSeconds;
}

const outputPath = path.resolve(root, edit.output);
fs.mkdirSync(path.dirname(outputPath), { recursive: true });

args.push(
  '-filter_complex',
  filters.join(';'),
  '-map',
  `[${current}]`,
  '-an',
  '-c:v',
  'libx264',
  '-preset',
  'slow',
  '-crf',
  '17',
  '-pix_fmt',
  'yuv420p',
  '-movflags',
  '+faststart',
  outputPath,
);

console.log(`\nAssembling picture lock (~${cumulativeDuration.toFixed(1)}s)...\n`);
const result = spawnSync(ffmpeg, args, { stdio: 'inherit' });
if (result.status !== 0) {
  throw new Error(`FFmpeg assembly failed with exit code ${result.status ?? 'unknown'}.`);
}

const selectionPath = path.join(path.dirname(outputPath), 'edit-v1-selection.json');
fs.writeFileSync(
  selectionPath,
  JSON.stringify(
    {
      assembledAt: new Date().toISOString(),
      editVersion: edit.version,
      sourceFolder: path.relative(root, storyDir).replaceAll('\\', '/'),
      transitionSeconds: edit.transitionSeconds,
      estimatedRuntimeSeconds: cumulativeDuration,
      output: path.relative(root, outputPath).replaceAll('\\', '/'),
      scenes: resolved.map(({ scene, file }) => ({
        id: scene.id,
        source: path.relative(root, file).replaceAll('\\', '/'),
        start: scene.start,
        duration: scene.duration,
      })),
    },
    null,
    2,
  ),
);

console.log('\nASSEMBLY PASS');
console.log(`Picture lock: ${outputPath}`);
console.log(`Selection record: ${selectionPath}`);
console.log(`Estimated runtime: ${cumulativeDuration.toFixed(1)}s\n`);
