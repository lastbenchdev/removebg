import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ProcessedImage } from '../../models/job.model';

@Component({
    selector: 'app-queue',
    imports: [CommonModule],
    templateUrl: './queue.component.html',
    styleUrls: ['./queue.component.css']
})
export class QueueComponent {
  @Input() jobs: ProcessedImage[] = [];
  @Output() clearCompleted = new EventEmitter<void>();
  @Output() retryJob = new EventEmitter<string>();
  @Output() previewJob = new EventEmitter<ProcessedImage>();
}
