import { Routes } from '@angular/router';
import { LoginComponent } from './features/auth/login/login.component';

export const routes: Routes = [
  { path: 'login', loadComponent: () => import('./features/auth/login/login.component').then(m => m.LoginComponent) },
  { path: 'quizes', loadComponent: () => import('./features/quizes/quizes.component').then(m => m.QuizesComponent) },
  { path: '', redirectTo: 'quizes', pathMatch: 'full' }

];
