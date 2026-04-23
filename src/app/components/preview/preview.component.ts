import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ProcessedImage } from '../../models/job.model';

@Component({
  selector: 'app-preview',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './preview.component.html',
  styleUrl: './preview.component.css'
})
export class PreviewComponent {
  @Input() job: ProcessedImage | null = null;
  @Output() close = new EventEmitter<void>();
  
  showOriginal = false;
}
