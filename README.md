# removebg

## Cloudflare deploy

Use the Cloudflare-specific scripts below.

- `npm run deploy:cf` deploys the top-level environment to `workers.dev`.
- `npm run deploy:cf:staging` deploys the `staging` environment.

These scripts run a cleanup step that removes generated ONNX Runtime wasm artifacts from `dist/frontend/browser/wasm` before upload. The app already loads ONNX wasm binaries from CDN in the web worker, so this prevents Wrangler's 25 MiB asset-limit error during deploy.

