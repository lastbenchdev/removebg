/// <reference lib="webworker" />
import * as ort from 'onnxruntime-web';

// Load WASM from CDN to bypass Cloudflare's 25MB asset size limit
ort.env.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.24.3/dist/';
ort.env.wasm.numThreads = 1;

let session: ort.InferenceSession | null = null;

addEventListener('message', async ({ data }) => {
  if (data.type === 'init') {
    if (!session) {
       try {
        session = await ort.InferenceSession.create('/assets/models/model_quantized.onnx' as any, {
          executionProviders: ['wasm']
        });
       } catch (e) {
         console.warn('Pre-warm failed. Might lack network or path is wrong.', e);
       }
    }
    return;
  }

  const { id, imageData, targetSize } = data;

  try {
    if (!session) {
      session = await ort.InferenceSession.create('/assets/models/model_quantized.onnx' as any, {
        executionProviders: ['wasm']
      });
    }

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
