import fs from 'node:fs/promises';
import path from 'node:path';
import RunwayML, { TaskFailedError, toFile } from '@runwayml/sdk';

export function requireRunwayKey(): void {
  if (!process.env.RUNWAYML_API_SECRET) {
    throw new Error('RUNWAYML_API_SECRET is missing. Create a local .env file and never commit it.');
  }
}

export function generationDuration(model: string, requestedSeconds: number): number {
  // Gen-4 Turbo currently accepts 5s or 10s outputs. We generate 10s for
  // the 7-9s locked shots and trim precisely during final assembly.
  if (model === 'gen4_turbo') return requestedSeconds <= 5 ? 5 : 10;
  return Math.max(2, Math.min(10, Math.round(requestedSeconds)));
}

export function estimatedCredits(model: string, seconds: number): number | null {
  if (model === 'gen4_turbo') return 5 * seconds;
  if (model === 'gen4.5') return 12 * seconds;
  return null;
}

export async function uploadLocalAsset(client: RunwayML, filePath: string): Promise<string> {
  const bytes = await fs.readFile(filePath);
  const filename = path.basename(filePath);

  // Runway's current SDK expects createEphemeral({ file: Uploadable }).
  // Convert the Buffer explicitly to an Uploadable File first. This avoids
  // Windows/Node stream-normalisation issues and keeps the SDK call typed.
  const uploadFile = await toFile(bytes, filename);
  const { uri } = await client.uploads.createEphemeral({ file: uploadFile });
  return uri;
}

export async function downloadOutput(url: string, destination: string): Promise<void> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Could not download Runway output: HTTP ${response.status}`);
  }
  const body = Buffer.from(await response.arrayBuffer());
  await fs.mkdir(path.dirname(destination), { recursive: true });
  await fs.writeFile(destination, body);
}

export { RunwayML, TaskFailedError };
