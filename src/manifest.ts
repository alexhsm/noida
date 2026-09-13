import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';

const SceneSchema = z.object({
  id: z.string(),
  name: z.string(),
  asset: z.string(),
  duration: z.number().min(2).max(10),
  hero: z.boolean(),
  prompt: z.string().min(20),
});

const ManifestSchema = z.object({
  project: z.object({
    id: z.string(),
    title: z.string(),
    subtitle: z.string(),
    ratio: z.string(),
    defaultModel: z.string(),
    targetRuntimeSeconds: z.number().positive(),
    styleLock: z.string().min(20),
  }),
  assets: z.record(z.string(), z.string()),
  scenes: z.array(SceneSchema).min(1),
});

export type ProjectManifest = z.infer<typeof ManifestSchema>;
export type Scene = z.infer<typeof SceneSchema>;

export function loadManifest(): ProjectManifest {
  const manifestPath = path.resolve(process.cwd(), 'manifests', 'project.json');
  const raw = fs.readFileSync(manifestPath, 'utf8');
  return ManifestSchema.parse(JSON.parse(raw));
}

export function sourceAssetPath(filename: string): string {
  return path.resolve(process.cwd(), 'assets', 'source', filename);
}

export function preparedAssetPath(filename: string): string {
  return path.resolve(process.cwd(), 'assets', 'prepared', filename);
}
