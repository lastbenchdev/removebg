import {
  Component, ElementRef, ViewChild,
  inject, OnInit, OnDestroy, AfterViewInit, NgZone
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { QueueService } from '../../services/queue.service';
import { ProcessedImage } from '../../models/job.model';
import { EditorToolbarComponent } from '../../components/editor-toolbar/editor-toolbar.component';

@Component({
    selector: 'app-editor',
    imports: [CommonModule, EditorToolbarComponent],
    templateUrl: './editor.component.html',
    styleUrls: ['./editor.component.css']
})
export class EditorComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('mainCanvas') canvasRef!: ElementRef<HTMLCanvasElement>;

  route = inject(ActivatedRoute);
  router = inject(Router);
  queueService = inject(QueueService);
  ngZone = inject(NgZone);

  job: ProcessedImage | null = null;

  // Editor State (all public for template binding)
  bgColor = 'transparent';
  bgImage: HTMLImageElement | null = null;
  brushSize = 30;
  brushMode: 'erase' | 'restore' = 'erase';
  isReady = false;

  // Interaction State
  isDrawing = false;
  lastPos = { x: 0, y: 0 };

  // Canvas Instances
  private subjectCanvas!: HTMLCanvasElement;
  private subjectCtx!: CanvasRenderingContext2D;
  private mainCtx!: CanvasRenderingContext2D;
  private originalImg!: HTMLImageElement;

  private viewInitialized = false;
  private pendingInit = false;

  // ─── Lifecycle ────────────────────────────────────────────────────────────

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    const jobs = this.queueService.queue();
    this.job = jobs.find(j => j.id === id) || null;

    if (!this.job?.processedUrl) {
      this.router.navigate(['/']);
      return;
    }

    // If the view is already initialized, start. Otherwise flag for AfterViewInit.
    if (this.viewInitialized) {
      this.initEditor();
    } else {
      this.pendingInit = true;
    }
  }

  ngAfterViewInit() {
    this.viewInitialized = true;
    if (this.pendingInit) {
      this.pendingInit = false;
      // Delay one microtask so Angular finishes its CD cycle
      Promise.resolve().then(() => this.initEditor());
    }
    window.addEventListener('resize', this.onResize);
  }

  ngOnDestroy() {
    window.removeEventListener('resize', this.onResize);
  }

  // ─── Editor Initialization ─────────────────────────────────────────────────

  private loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      // Set src AFTER handlers are attached (crucial for cached images)
      img.src = src;
    });
  }

  private async initEditor() {
    if (!this.canvasRef?.nativeElement) {
      console.error('[Editor] Canvas not available yet.');
      return;
    }

    try {
      const canvas = this.canvasRef.nativeElement;
      this.mainCtx = canvas.getContext('2d', { willReadFrequently: true })!;

      // Load both images properly
      [this.originalImg] = await Promise.all([
        this.loadImage(this.job!.originalUrl),
      ]);
      const subjectImg = await this.loadImage(this.job!.processedUrl!);

      // Size the main canvas to match the source image
      canvas.width = this.originalImg.width;
      canvas.height = this.originalImg.height;

      // Build the offscreen working (editable) subject canvas
      this.subjectCanvas = document.createElement('canvas');
      this.subjectCanvas.width = this.originalImg.width;
      this.subjectCanvas.height = this.originalImg.height;
      this.subjectCtx = this.subjectCanvas.getContext('2d', { willReadFrequently: true })!;
      this.subjectCtx.drawImage(subjectImg, 0, 0);

      this.isReady = true;
      this.render();
    } catch (err) {
      console.error('[Editor] initEditor failed:', err);
    }
  }

  // ─── Rendering ─────────────────────────────────────────────────────────────

  render() {
    if (!this.isReady || !this.mainCtx) return;
    const canvas = this.canvasRef.nativeElement;

    // Clear
    this.mainCtx.clearRect(0, 0, canvas.width, canvas.height);

    // 1. Background layer
    if (this.bgImage) {
      this.mainCtx.drawImage(this.bgImage, 0, 0, canvas.width, canvas.height);
    } else {
      // Draw checkerboard for transparent, solid color otherwise
      this.drawCheckerboard(canvas);
      if (this.bgColor !== 'transparent') {
        this.mainCtx.fillStyle = this.bgColor;
        this.mainCtx.fillRect(0, 0, canvas.width, canvas.height);
      }
    }

    // 2. Subject (cutout) layer
    this.mainCtx.drawImage(this.subjectCanvas, 0, 0);
  }

  private drawCheckerboard(canvas: HTMLCanvasElement) {
    const size = 20;
    const light = '#334155';
    const dark = '#1e293b';
    for (let y = 0; y < canvas.height; y += size) {
      for (let x = 0; x < canvas.width; x += size) {
        this.mainCtx.fillStyle = ((x / size + y / size) % 2 === 0) ? light : dark;
        this.mainCtx.fillRect(x, y, size, size);
      }
    }
  }

  // ─── Pointer Events ────────────────────────────────────────────────────────

  private getPointerPos(e: PointerEvent): { x: number; y: number } {
    const canvas = this.canvasRef.nativeElement;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  }

  onPointerDown(e: PointerEvent) {
    if (!this.isReady) return;
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    this.isDrawing = true;
    this.lastPos = this.getPointerPos(e);
    this.applyBrushStroke(this.lastPos);
    this.render();
  }

  onPointerMove(e: PointerEvent) {
    if (!this.isDrawing || !this.isReady) return;
    e.preventDefault();

    const pos = this.getPointerPos(e);
    const dx = pos.x - this.lastPos.x;
    const dy = pos.y - this.lastPos.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const steps = Math.max(Math.ceil(dist / (this.brushSize / 4)), 1);

    for (let i = 1; i <= steps; i++) {
      this.applyBrushStroke({
        x: this.lastPos.x + (dx * i) / steps,
        y: this.lastPos.y + (dy * i) / steps
      });
    }

    this.lastPos = pos;
    this.render();
  }

  onPointerUp() {
    this.isDrawing = false;
  }

  private applyBrushStroke(pos: { x: number; y: number }) {
    if (!this.subjectCtx) return;
    if (this.brushMode === 'erase') {
      this.subjectCtx.save();
      this.subjectCtx.globalCompositeOperation = 'destination-out';
      this.subjectCtx.beginPath();
      this.subjectCtx.arc(pos.x, pos.y, this.brushSize, 0, Math.PI * 2);
      this.subjectCtx.fill();
      this.subjectCtx.restore();
    } else {
      // Restore – paint original pixels back inside brush circle
      this.subjectCtx.save();
      this.subjectCtx.beginPath();
      this.subjectCtx.arc(pos.x, pos.y, this.brushSize, 0, Math.PI * 2);
      this.subjectCtx.clip();
      this.subjectCtx.globalCompositeOperation = 'source-over';
      this.subjectCtx.drawImage(this.originalImg, 0, 0);
      this.subjectCtx.restore();
    }
  }

  // ─── Toolbar Callbacks ─────────────────────────────────────────────────────

  onBgColorChange(color: string) {
    this.bgColor = color;
    this.bgImage = null; // Clear image when a color is chosen
    this.render();
  }

  onBgImageUpload(file: File | null) {
    if (!file) {
      this.bgImage = null;
      this.render();
      return;
    }
    const url = URL.createObjectURL(file);
    this.loadImage(url).then(img => {
      this.bgImage = img;
      URL.revokeObjectURL(url);
      this.render();
    });
  }

  onBrushModeChange(mode: 'erase' | 'restore') {
    this.brushMode = mode;
  }

  onDownload() {
    if (!this.isReady) return;
    this.canvasRef.nativeElement.toBlob(blob => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `zerobg_${this.job!.originalFile.name.replace(/\.[^.]+$/, '')}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 'image/png');
  }

  closeEditor() {
    this.router.navigate(['/']);
  }

  onResize = () => {
    this.render();
  };
}
