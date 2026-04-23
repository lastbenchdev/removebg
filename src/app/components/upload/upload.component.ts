import { Component, EventEmitter, Output } from '@angular/core';


@Component({
    selector: 'app-upload',
    imports: [],
    templateUrl: './upload.component.html',
    styleUrls: ['./upload.component.css']
})
export class UploadComponent {
  @Output() filesAdded = new EventEmitter<File[]>();
  isDragOver = false;

  onDragOver(event: DragEvent) {
    event.preventDefault();
    this.isDragOver = true;
  }

  onDragLeave(event: DragEvent) {
    event.preventDefault();
    this.isDragOver = false;
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    this.isDragOver = false;
    
    if (event.dataTransfer?.files) {
      this.handleFiles(Array.from(event.dataTransfer.files));
    }
  }

  onFilesSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files) {
      this.handleFiles(Array.from(input.files));
    }
    input.value = ''; // Reset
  }

  private handleFiles(files: File[]) {
    const validFiles = files.filter(f => f.type.startsWith('image/'));
    if (validFiles.length > 0) {
      this.filesAdded.emit(validFiles);
    }
  }
}
