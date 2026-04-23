export type JobStatus = 'Pending' | 'Processing' | 'Completed' | 'Failed';

export interface ProcessedImage {
  id: string;
  originalFile: File;
  originalUrl: string;       // blob URL
  processedUrl?: string;     // blob URL after processing
  status: JobStatus;
  progress?: number;
  error?: string;
}
