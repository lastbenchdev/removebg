import { ComponentFixture, TestBed } from '@angular/core/testing';
import { EditorToolbarComponent } from './editor-toolbar.component';
import { FormsModule } from '@angular/forms';

describe('EditorToolbarComponent', () => {
  let component: EditorToolbarComponent;
  let fixture: ComponentFixture<EditorToolbarComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EditorToolbarComponent, FormsModule]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(EditorToolbarComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
