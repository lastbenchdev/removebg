import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ImageService {
  constructor() {}

  revokeUrl(url: string | undefined) {
    if (url) {
      URL.revokeObjectURL(url);
    }
  }

  async getImageData(file: File, targetSize: number = 512): Promise<{ image: ImageData, originalWidth: number, originalHeight: number }> {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        const originalWidth = img.width;
        const originalHeight = img.height;
        
        const canvas = document.createElement('canvas');
        canvas.width = targetSize;
        canvas.height = targetSize;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject('No 2d context');
        
        ctx.drawImage(img, 0, 0, targetSize, targetSize);
        const imageData = ctx.getImageData(0, 0, targetSize, targetSize);
        URL.revokeObjectURL(url);
        resolve({ image: imageData, originalWidth, originalHeight });
      };
      img.onerror = (e) => {
        URL.revokeObjectURL(url);
        reject(e);
      };
      img.src = url;
    });
  }

  async applyMask(originalFile: File, maskDataMap: Float32Array, maskWidth: number, maskHeight: number): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(originalFile);
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject('No 2d context');
        
        // 1. Draw original HD image
        ctx.drawImage(img, 0, 0);
        
        // 2. Build the Raw Output Mask
        const maskCanvas = document.createElement('canvas');
        maskCanvas.width = maskWidth;
        maskCanvas.height = maskHeight;
        const maskCtx = maskCanvas.getContext('2d');
        if (!maskCtx) return reject('No 2d context');

        const maskImageData = maskCtx.createImageData(maskWidth, maskHeight);
        
        for(let i=0; i<maskDataMap.length; i++) {
            let val = maskDataMap[i];
            
            // Hard clamp thresholding to prevent soft edge bleeding (halos) 
            // ModNet usually has excellent distinction around 0.5.
            // We use a slight gradient between 0.3 and 0.7 for anti-aliasing.
            let alpha = val;
            if (val < 0.3) alpha = 0;
            else if (val > 0.7) alpha = 1;

            const pixelVal = alpha * 255;
            
            maskImageData.data[i*4] = 0;     // R (Doesn't matter, destination-in uses Alpha)
            maskImageData.data[i*4+1] = 0;   // G
            maskImageData.data[i*4+2] = 0;   // B
            maskImageData.data[i*4+3] = pixelVal; // A
        }
        maskCtx.putImageData(maskImageData, 0, 0);
        
        // 3. Hardware Accelerated Compositing
        // Replaces the millions of byte iterations with GPU-level compositing
        ctx.globalCompositeOperation = 'destination-in';
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(maskCanvas, 0, 0, canvas.width, canvas.height);
        
        canvas.toBlob((blob) => {
            URL.revokeObjectURL(url);
            if (blob) {
                resolve(blob);
            } else {
                reject('Blob generation failed');
            }
        }, 'image/png');
      };
      img.onerror = (e) => {
          URL.revokeObjectURL(url);
          reject(e);
      }
      img.src = url;
    });
  }
}
