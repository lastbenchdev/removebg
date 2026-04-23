/// <reference lib="webworker" />
import * as ort from 'onnxruntime-web';

// Load WASM from CDN to bypass Cloudflare's 25MB asset size limit
ort.env.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.24.3/dist/';
ort.env.wasm.numThreads = 1;

let session: ort.InferenceSession | null = null;
let configuredModelSources: string[] = [];

const DEFAULT_MODEL_SOURCES = [
  '/assets/models/model_quantized.onnx',
  '/assets/models/model.onnx'
];

function normalizeModelSources(sources: unknown): string[] {
  if (!Array.isArray(sources)) return [...DEFAULT_MODEL_SOURCES];
  const unique = new Set<string>();

  for (const source of sources) {
    if (typeof source === 'string' && source.trim()) {
      unique.add(source.trim());
    }
  }

  if (unique.size === 0) return [...DEFAULT_MODEL_SOURCES];
  for (const defaultSource of DEFAULT_MODEL_SOURCES) unique.add(defaultSource);
  return Array.from(unique);
}

function inferExternalDataPath(modelPath: string): string {
  return modelPath.endsWith('.onnx') ? `${modelPath}.data` : `${modelPath}.data`;
}

async function tryCreateSession(modelPath: string): Promise<ort.InferenceSession> {
  const baseOptions = { executionProviders: ['wasm'] } as any;

  try {
    return await ort.InferenceSession.create(modelPath as any, baseOptions);
  } catch (error: any) {
    const message = String(error?.message || error || 'unknown');
    const shouldRetryWithExternalData =
      message.toLowerCase().includes('external data') || message.toLowerCase().includes('external_data');

    if (!shouldRetryWithExternalData) throw error;

    const externalDataPath = inferExternalDataPath(modelPath);
    const withExternalData = {
      ...baseOptions,
      externalData: [{ path: externalDataPath }]
    } as any;

    return ort.InferenceSession.create(modelPath as any, withExternalData);
  }
}

async function ensureSession(): Promise<ort.InferenceSession> {
  if (session) return session;

  const modelSources = configuredModelSources.length > 0 ? configuredModelSources : DEFAULT_MODEL_SOURCES;
  const failures: string[] = [];

  for (const source of modelSources) {
    try {
      session = await tryCreateSession(source);
      return session;
    } catch (error: any) {
      failures.push(`${source}: ${String(error?.message || error || 'unknown error')}`);
    }
  }

  throw new Error(`Model load failed for all sources. ${failures.join(' | ')}`);
}

addEventListener('message', async ({ data }) => {
  if (data.type === 'init') {
    configuredModelSources = normalizeModelSources(data.modelSources);
    if (!session) {
      try {
        await ensureSession();
      } catch (e) {
        console.warn('Pre-warm failed. Model sources may be unavailable.', e);
      }
    }
    return;
  }

  const { id, imageData, targetSize } = data;

  try {
    session = await ensureSession();

    const floatArray = new Float32Array(3 * targetSize * targetSize);
    
    // Normalization for U2Net (ImageNet distribution)
    const mean = [0.485, 0.456, 0.406];
    const std = [0.229, 0.224, 0.225];
    
    const pixels = imageData.data;
    let i = 0;
    for (let y = 0; y < targetSize; y++) {
      for (let x = 0; x < targetSize; x++) {
        const offset = (y * targetSize + x) * 4;
        
        floatArray[i] = ((pixels[offset] / 255.0) - mean[0]) / std[0]; // R
        floatArray[i + targetSize * targetSize] = ((pixels[offset + 1] / 255.0) - mean[1]) / std[1]; // G
        floatArray[i + 2 * targetSize * targetSize] = ((pixels[offset + 2] / 255.0) - mean[2]) / std[2]; // B
        
        i++;
      }
    }

    const tensor = new ort.Tensor('float32', floatArray, [1, 3, targetSize, targetSize]);
    const feeds: Record<string, ort.Tensor> = {};
    feeds[session.inputNames[0]] = tensor;

    const results = await session.run(feeds);
    // U2Net returns multiple masks; the first one ([0]) is the primary salient output
    const outputTensor = Object.values(results)[0];
    const outputData = outputTensor.data as Float32Array;
    
    postMessage({ id, success: true, mask: outputData });
  } catch (error: any) {
    postMessage({ id, success: false, error: 'Inference failed: ' + error?.message });
  }
});
