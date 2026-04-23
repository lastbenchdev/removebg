import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class WorkerService {
  private worker: Worker | null = null;
  private pendingRequests = new Map<string, { resolve: Function, reject: Function }>();

  constructor() {
    this.initWorker();
  }

  private initWorker() {
    if (typeof Worker !== 'undefined') {
      this.worker = new Worker(new URL('../workers/bg-remove.worker', import.meta.url), { type: 'module' });
      this.worker.onmessage = ({ data }) => {
        const { id, success, mask, error } = data;
        const callbacks = this.pendingRequests.get(id);
        if (callbacks) {
          if (success) callbacks.resolve(mask);
          else callbacks.reject(error);
          this.pendingRequests.delete(id);
        }
      };

      const modelSources = this.resolveModelSources();

      // Pre-warm the session loading
      this.worker.postMessage({ type: 'init', modelSources });
    } else {
      console.error('Web Workers are not supported in this environment.');
    }
  }

  private resolveModelSources(): string[] {
    const defaults = ['/assets/models/model_quantized.onnx', '/assets/models/model.onnx'];
    const unique = new Set<string>(defaults);
    const globalObject = window as Window & {
      REMOVEBG_MODEL_URL?: string;
      REMOVEBG_MODEL_URLS?: string[];
    };

    if (typeof globalObject.REMOVEBG_MODEL_URL === 'string' && globalObject.REMOVEBG_MODEL_URL.trim()) {
      unique.add(globalObject.REMOVEBG_MODEL_URL.trim());
    }

    if (Array.isArray(globalObject.REMOVEBG_MODEL_URLS)) {
      for (const url of globalObject.REMOVEBG_MODEL_URLS) {
        if (typeof url === 'string' && url.trim()) unique.add(url.trim());
      }
    }

    const localStorageUrl = localStorage.getItem('removebg.modelUrl');
    if (localStorageUrl && localStorageUrl.trim()) {
      unique.add(localStorageUrl.trim());
    }

    return Array.from(unique);
  }

  async processImage(id: string, imageData: ImageData, targetSize: number): Promise<Float32Array> {
    if (!this.worker) throw new Error('Web Worker not supported');
    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject });
      this.worker!.postMessage({ id, imageData, targetSize });
    });
  }
}
