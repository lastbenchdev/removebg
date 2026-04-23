import { Routes } from '@angular/router';

export const routes: Routes = [
  { 
    path: '', 
    loadComponent: () => import('./pages/home/home.component').then(m => m.HomeComponent) 
  },
  { 
    path: 'editor/:id', 
    loadComponent: () => import('./pages/editor/editor.component').then(m => m.EditorComponent) 
  },
  { path: '**', redirectTo: '' }
];
