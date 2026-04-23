import { Component, Output, EventEmitter, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
    selector: 'app-editor-toolbar',
    imports: [CommonModule, FormsModule],
    templateUrl: './editor-toolbar.component.html',
    styleUrls: ['./editor-toolbar.component.css']
})
export class EditorToolbarComponent {
  @Input() bgColor = 'transparent';
  @Input() brushSize = 30;
  @Input() brushMode: 'erase' | 'restore' = 'erase';
  @Input() hasCustomBg = false;

  @Output() bgColorChange = new EventEmitter<string>();
  @Output() bgImageChange = new EventEmitter<File | null>();
  @Output() brushModeChange = new EventEmitter<'erase' | 'restore'>();
  @Output() brushSizeChange = new EventEmitter<number>();
  @Output() download = new EventEmitter<void>();

  onBgImageUpload(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      this.bgImageChange.emit(input.files[0]);
    }
    input.value = '';
  }

  removeCustomColor() {
    this.bgColor = 'transparent';
    this.bgColorChange.emit('transparent');
  }

  removeCustomBg() {
    this.bgImageChange.emit(null);
  }

  onModeChange(mode: 'erase' | 'restore') {
    this.brushModeChange.emit(mode);
  }
}
