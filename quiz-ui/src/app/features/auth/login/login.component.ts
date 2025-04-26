import { Component, inject } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';

import { MatButtonModule } from '@angular/material/button';
import { FormBuilder, FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';


@Component({
  selector: 'app-login',
  standalone: true,

  imports: [
    MatCardModule,
    CommonModule,
    FormsModule,
    MatIconModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
  ],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss'
})
export class LoginComponent {
  public errorMessage: string = '';
  public hidePassword: boolean = true;
  public email: FormControl = new FormControl('', [Validators.required, Validators.email]);
  public password: FormControl = new FormControl('', [Validators.required, Validators.minLength(6)]);
  public loginForm: FormGroup = new FormGroup({
    email: this.email,
    password: this.password
  });

  private authService = inject(AuthService);

  public togglePasswordVisibility(event: MouseEvent) {
    event.stopPropagation();
    this.hidePassword = !this.hidePassword;
  }


  private fb = inject(FormBuilder);
  private router = inject(Router);

    public ngOnInit(): void {
      console.log('test')
    }

    public login(): void {
      console.log('login', this.loginForm);
      if (this.loginForm.valid) {
        this.authService.login(this.email.value, this.password.value).subscribe({
          next: (user) => {
            console.log('User logged in:', user);
            this.router.navigate(['/quizes']);
          },
          error: (error) => {
            console.error('Login error:', error);
            this.errorMessage = 'Invalid email or password';
          }
        });
      } else {
        this.updateErrorMessage();
      }
    }


  public updateErrorMessage(): void {
    this.errorMessage = this.loginForm.get('email')?.hasError('required') ? 'Email is required' : ''
  };
}
