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
      // Pre-warm the session loading
      this.worker.postMessage({ type: 'init' });
    } else {
      console.error('Web Workers are not supported in this environment.');
    }
  }

  async processImage(id: string, imageData: ImageData, targetSize: number): Promise<Float32Array> {
    if (!this.worker) throw new Error('Web Worker not supported');
    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject });
      this.worker!.postMessage({ id, imageData, targetSize });
    });
  }
}
