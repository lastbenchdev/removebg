import { Injectable, signal, computed } from '@angular/core';
import { JobStatus, ProcessedImage } from '../models/job.model';
import { WorkerService } from './worker.service';
import { ImageService } from './image.service';

@Injectable({ providedIn: 'root' })
export class QueueService {
  private queueSignal = signal<ProcessedImage[]>([]);
  public queue = computed(() => this.queueSignal());
  
  private isProcessing = false;
  // Use a constant targetSize of 320 for U2Net
  private TARGET_SIZE = 320; 

  constructor(
    private workerService: WorkerService,
    private imageService: ImageService
  ) {}

  addJobs(files: File[]) {
    const newJobs: ProcessedImage[] = files.map(file => ({
      id: Math.random().toString(36).substring(2, 15),
      originalFile: file,
      originalUrl: URL.createObjectURL(file),
      status: 'Pending'
    }));
    this.queueSignal.update(q => [...q, ...newJobs]);
    this.processNext();
  }

  retryJob(id: string) {
    this.queueSignal.update(q => q.map(job => 
      job.id === id ? { ...job, status: 'Pending', error: undefined } : job
    ));
    this.processNext();
  }

  clearCompleted() {
    this.queueSignal.update(q => q.filter(job => {
        if (job.status === 'Completed' || job.status === 'Failed') {
            this.imageService.revokeUrl(job.originalUrl);
            this.imageService.revokeUrl(job.processedUrl);
            return false;
        }
        return true;
    }));
  }

  private updateJob(id: string, updates: Partial<ProcessedImage>) {
    this.queueSignal.update(q => q.map(job => 
      job.id === id ? { ...job, ...updates } : job
    ));
  }

  private async processNext() {
    if (this.isProcessing) return;

    const pendingJobs = this.queueSignal().filter(j => j.status === 'Pending');
    if (pendingJobs.length === 0) return;

    this.isProcessing = true;
    const job = pendingJobs[0];

    try {
      this.updateJob(job.id, { status: 'Processing', progress: 10 });
      
      // Step 1: Extract tensor via ImageService canvas resize
      const { image: imageData, originalWidth, originalHeight } = await this.imageService.getImageData(job.originalFile, this.TARGET_SIZE);
      this.updateJob(job.id, { progress: 40 });

      // Step 2: Web Worker inference
      const maskData = await this.workerService.processImage(job.id, imageData, this.TARGET_SIZE);
      this.updateJob(job.id, { progress: 80 });

      // Step 3: Apply mask to original image via Canvas
      const finalBlob = await this.imageService.applyMask(job.originalFile, maskData, this.TARGET_SIZE, this.TARGET_SIZE);
      
      const processedUrl = URL.createObjectURL(finalBlob);
      this.updateJob(job.id, { 
          status: 'Completed', 
          processedUrl,
          progress: 100 
      });

    } catch (error: any) {
      this.updateJob(job.id, { status: 'Failed', error: error.toString() });
    } finally {
      this.isProcessing = false;
      // Add a small 50ms delay between jobs to let UI breathe
      setTimeout(() => this.processNext(), 50);
    }
  }
}
