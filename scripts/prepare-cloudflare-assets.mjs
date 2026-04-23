import { existsSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');
const wasmDir = join(projectRoot, 'dist', 'frontend', 'browser', 'wasm');

if (existsSync(wasmDir)) {
  rmSync(wasmDir, { recursive: true, force: true });
  console.log('Removed dist/frontend/browser/wasm for Cloudflare asset size limits.');
} else {
  console.log('No local wasm directory found in dist output.');
}
