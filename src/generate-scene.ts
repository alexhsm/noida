import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { loadManifest, sourceAssetPath } from './manifest.js';
import {
  RunwayML,
  TaskFailedError,
  downloadOutput,
  estimatedCredits,
  generationDuration,
  requireRunwayKey,
  uploadLocalAsset,
} from './runway.js';

const sceneId = process.argv[2] ?? '01';
const model = process.env.RUNWAY_MODEL ?? 'gen4_turbo';
const productionTrack = 'story-v2';

function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function main(): Promise<void> {
  requireRunwayKey();

  const manifest = loadManifest();
  const scene = manifest.scenes.find((item) => item.id === sceneId);
  if (!scene) {
    throw new Error(`Unknown scene '${sceneId}'. Run npm run scene:list to see valid IDs.`);
  }

  const filename = manifest.assets[scene.asset];
  if (!filename) throw new Error(`No asset mapping for scene asset key '${scene.asset}'.`);

  const inputPath = sourceAssetPath(filename);
  const outputSeconds = generationDuration(model, scene.duration);
  const credits = estimatedCredits(model, outputSeconds);

  console.log(`\n${manifest.project.title}`);
  console.log(`Production track: ${productionTrack}`);
  console.log(`Scene ${scene.id}: ${scene.name}`);
  console.log(`Input: ${filename}`);
  console.log(`Model: ${model}`);
  console.log(`Locked edit duration: ${scene.duration}s`);
  console.log(`Generation duration: ${outputSeconds}s`);
  if (credits !== null) console.log(`Estimated generation cost: ${credits} credits (~$${(credits * 0.01).toFixed(2)})`);
  console.log('');

  const client = new RunwayML();

  console.log('1/3 Uploading reference image...');
  const uri = await uploadLocalAsset(client, inputPath);
  console.log(`    Uploaded: ${uri}`);

  console.log('2/3 Generating video...');
  try {
    const task = await client.imageToVideo.create({
      model: model as never,
      promptImage: uri,
      promptText: scene.prompt,
      ratio: manifest.project.ratio as never,
      duration: outputSeconds as never,
    }).waitForTaskOutput();

    const outputUrl = task.output?.[0];
    if (!outputUrl) throw new Error('Runway completed the task but returned no output URL.');

    const outputDir = path.resolve(process.cwd(), 'outputs', productionTrack, 'clips');
    fs.mkdirSync(outputDir, { recursive: true });
    const safeModel = model.replace(/[^a-zA-Z0-9._-]/g, '_');
    const outputName = `scene-${scene.id}-${slug(scene.name)}-${safeModel}-draft.mp4`;
    const outputPath = path.join(outputDir, outputName);

    console.log('3/3 Downloading output...');
    await downloadOutput(outputUrl, outputPath);

    const sidecarPath = outputPath.replace(/\.mp4$/i, '.json');
    fs.writeFileSync(
      sidecarPath,
      JSON.stringify(
        {
          productionTrack,
          generatedAt: new Date().toISOString(),
          sceneId: scene.id,
          sceneName: scene.name,
          input: filename,
          model,
          editDurationSeconds: scene.duration,
          generationDurationSeconds: outputSeconds,
          runwayTaskId: task.id,
          outputFile: path.relative(process.cwd(), outputPath).replaceAll('\\', '/'),
        },
        null,
        2,
      ),
    );

    console.log('');
    console.log('GENERATION PASS');
    console.log(`Saved: ${outputPath}`);
    console.log(`Metadata: ${sidecarPath}`);
    console.log(`Runway task: ${task.id}`);
    console.log('');
  } catch (error) {
    if (error instanceof TaskFailedError) {
      console.error('RUNWAY TASK FAILED');
      console.error(error.taskDetails);
      process.exitCode = 1;
      return;
    }
    throw error;
  }
}

main().catch((error) => {
  console.error('\nGENERATION FAILED');
  console.error(error);
  process.exit(1);
});
