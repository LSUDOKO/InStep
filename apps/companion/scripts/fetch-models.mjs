// Downloads MediaPipe models and copies the tasks-vision WASM into public/models/ at build time,
// so the companion never loads code or models from a third-party CDN at runtime.
import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'public', 'models');
mkdirSync(join(out, 'wasm'), { recursive: true });

const MODELS = {
  'pose_landmarker_lite.task':
    'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task',
  'hand_landmarker.task':
    'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/latest/hand_landmarker.task',
  'efficientdet_lite0.tflite':
    'https://storage.googleapis.com/mediapipe-models/object_detector/efficientdet_lite0/int8/latest/efficientdet_lite0.tflite',
};

for (const [file, url] of Object.entries(MODELS)) {
  const dest = join(out, file);
  if (existsSync(dest)) continue;
  process.stdout.write(`downloading ${file}… `);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
  console.log('done');
}
cpSync(join(root, 'node_modules', '@mediapipe', 'tasks-vision', 'wasm'), join(out, 'wasm'), {
  recursive: true,
});
console.log('models ready in public/models/');
