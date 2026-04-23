# removebg

## Cloudflare deploy

Use the Cloudflare-specific scripts below.

- `npm run deploy:cf` deploys the top-level environment to `workers.dev`.
- `npm run deploy:cf:staging` deploys the `staging` environment.

These scripts run a cleanup step that removes generated ONNX Runtime wasm artifacts from `dist/frontend/browser/wasm` before upload. The app already loads ONNX wasm binaries from CDN in the web worker, so this prevents Wrangler's 25 MiB asset-limit error during deploy.

## Model files

The worker tries model URLs in this order:

1. `/assets/models/model_quantized.onnx`
2. `/assets/models/model.onnx`
3. Optional fallback URL(s) from runtime config

### Generate a quantized model

Place the original ONNX model at:

- `public/assets/models/model.onnx`

Run:

```bash
python quantize.py
```

This generates:

- `public/assets/models/model_quantized.onnx`

Verify size before deploy:

```bash
ls -lh public/assets/models/model*.onnx
```

### Optional external fallback model URL

You can provide one or more fallback model URLs when the local asset is not available.

Set in `src/index.html` before the Angular bundle:

```html
<script>
	window.REMOVEBG_MODEL_URL = 'https://your-cdn.example.com/model_quantized.onnx';
	// or:
	// window.REMOVEBG_MODEL_URLS = [
	//   'https://primary-cdn.example.com/model_quantized.onnx',
	//   'https://backup-cdn.example.com/model_quantized.onnx'
	// ];
</script>
```

Or set at runtime from DevTools/local scripts:

```js
localStorage.setItem('removebg.modelUrl', 'https://your-cdn.example.com/model_quantized.onnx');
```

### Build size check

```bash
npm run build:cf
du -sh dist/frontend/browser
```

If your model still pushes assets above Cloudflare free-tier limits, host the model externally and keep only app code in the deployed asset bundle.

