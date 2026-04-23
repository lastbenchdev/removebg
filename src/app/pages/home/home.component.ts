import { Component, computed, inject } from '@angular/core';

import { Router } from '@angular/router';
import { UploadComponent } from '../../components/upload/upload.component';
import { QueueComponent } from '../../components/queue/queue.component';
import { QueueService } from '../../services/queue.service';
import { ProcessedImage } from '../../models/job.model';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

@Component({
    selector: 'app-home',
    imports: [UploadComponent, QueueComponent],
    templateUrl: './home.component.html',
    styleUrls: ['./home.component.css']
})
export class HomeComponent {
  queueService = inject(QueueService);
  router = inject(Router);
  
  jobs = this.queueService.queue;
  
  completedCount = computed(() => this.jobs().filter(j => j.status === 'Completed').length);
  totalCount = computed(() => this.jobs().length);
  isProcessing = computed(() => this.jobs().some(j => j.status === 'Pending' || j.status === 'Processing'));

  onFilesAdded(files: File[]) {
    this.queueService.addJobs(files);
  }

  onClearCompleted() {
    this.queueService.clearCompleted();
  }

  onRetryJob(id: string) {
    this.queueService.retryJob(id);
  }

  onPreviewJob(job: ProcessedImage) {
    // Navigate to Editor Route
    this.router.navigate(['/editor', job.id]);
  }

  async downloadAllZip() {
    const completedJobs = this.jobs().filter(j => j.status === 'Completed' && j.processedUrl);
    if (completedJobs.length === 0) return;

    const zip = new JSZip();
    
    await Promise.all(completedJobs.map(async (job) => {
      try {
        const response = await fetch(job.processedUrl!);
        const blob = await response.blob();
        
        let filename = job.originalFile.name;
        const lastDot = filename.lastIndexOf('.');
        if (lastDot > -1) filename = filename.substring(0, lastDot);
        filename += '_rmbg.png';
        
        zip.file(filename, blob);
      } catch (e) {
        console.error('Failed to zip file:', job.originalFile.name, e);
      }
    }));

    const content = await zip.generateAsync({ type: 'blob' });
    saveAs(content, 'processed_images.zip');
  }
}
