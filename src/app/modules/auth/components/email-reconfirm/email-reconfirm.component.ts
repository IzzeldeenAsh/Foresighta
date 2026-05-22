import { Component, OnInit, OnDestroy, Injector } from '@angular/core';
import { Router } from '@angular/router';
import { BaseComponent } from 'src/app/modules/base.component';
import { AuthService } from '../../services/auth.service';
import { Subscription, timer, first } from 'rxjs';
import { TranslationService } from 'src/app/modules/i18n';
import { environment } from 'src/environments/environment';

@Component({
  selector: 'app-email-reconfirm',
  templateUrl: './email-reconfirm.component.html',
  styleUrls: ['./email-reconfirm.component.scss']
})
export class EmailReconfirmComponent extends BaseComponent implements OnInit, OnDestroy {
  isResending = false;
  resendCooldown = 0;
  canResend = true;
  successMessage = '';
  errorMessage = '';
  userEmail = '';
  isVerified = false;
  
  private cooldownTimer: Subscription | null = null;
  private readonly COOLDOWN_SECONDS = 60; // 1 minute cooldown
  
  constructor(
    private authService: AuthService,
    private router: Router,
    private translationService: TranslationService,
    injector: Injector
  ) {
    super(injector);
  }

  ngOnInit(): void {
    this.initializeComponent();
  }

  ngOnDestroy(): void {
    if (this.cooldownTimer) {
      this.cooldownTimer.unsubscribe();
    }
  }

  private initializeComponent(): void {
    console.log('Email reconfirm component initializing...');
    
    // Check if we have a token first
    const token = this.authService.getTokenFromCookie();
    if (!token) {
      console.log('No token found, redirecting to login');
      this.router.navigate(['/auth/login']);
      return;
    }
    
    // Check if token is expired
    if (this.isTokenExpired(token)) {
      console.log('Token is expired, redirecting to login');
      this.router.navigate(['/auth/login']);
      return;
    }
    
    console.log('Valid token found, staying on email reconfirm page');
    
    // Try to get user information from current user
    const currentUser = this.authService.currentUserValue;
    
    if (currentUser && currentUser.email) {
      console.log('Using current user email:', currentUser.email);
      this.userEmail = currentUser.email;
      this.checkVerificationStatus();
    } else {
      console.log('No current user, attempting to fetch profile...');
      this.fetchUserProfile();
    }
  }

  private isTokenExpired(token: string): boolean {
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      const currentTime = Math.floor(Date.now() / 1000);
      return payload.exp < currentTime;
    } catch (error) {
      console.error('Error parsing token:', error);
      return true;
    }
  }

  private fetchUserProfile(): void {
    this.authService.getProfile().subscribe({
      next: (userData) => {
        console.log('Profile fetched successfully:', userData);
        this.userEmail = userData.email;
        
        if (userData.verified) {
          this.isVerified = true;
          this.handleVerifiedUser(userData);
        } else {
          console.log('User email is not verified, staying on reconfirm page');
          this.errorMessage = this.translationService.getTranslation('AUTH.EMAIL_RECONFIRM.VERIFICATION_REQUIRED') || 
                             'Please verify your email address to continue.';
        }
      },
      error: (error) => {
        console.error('Error getting user profile:', error);
        // Show error message but DO NOT clear tokens or logout
        this.handleProfileError(error);
      }
    });
  }

  private handleProfileError(error: any): void {
    console.log('Handling profile error without clearing tokens');
    
    // Always show a generic error message and let user try to resend
    this.errorMessage =''
    // Try to extract email from error response if available
    if (error.error && error.error.email) {
      this.userEmail = error.error.email;
    }
    
    // If we still don't have an email, show a generic message
    if (!this.userEmail) {
      this.userEmail = 'your email address';
    }
  }

  private checkVerificationStatus(): void {
    console.log('Checking verification status...');
    
    this.authService.getProfile().subscribe({
      next: (userData) => {
        console.log('Verification status check result:', userData);
        
        if (userData.verified) {
          this.isVerified = true;
          this.handleVerifiedUser(userData);
        } else {
          console.log('Email still not verified');
          this.errorMessage = this.translationService.getTranslation('AUTH.EMAIL_RECONFIRM.VERIFICATION_REQUIRED') || 
                             'Please verify your email address to continue.';
        }
      },
      error: (error) => {
        console.error('Error checking verification status:', error);
        // Show error but don't clear tokens
        this.handleProfileError(error);
      }
    });
  }

  private handleVerifiedUser(userData: any): void {
    console.log('User email verified, preparing redirect...');
    
    this.successMessage = this.translationService.getTranslation('AUTH.EMAIL_RECONFIRM.VERIFIED_SUCCESS') || 
                         'Your email has been verified successfully!';
    
    // Clear any error messages
    this.errorMessage = '';
    
    // Redirect based on user role after a short delay
    setTimeout(() => {
      if (userData.roles && (userData.roles.includes('admin') || userData.roles.includes('staff'))) {
        console.log('Redirecting admin/staff to dashboard');
        const effectiveLang = this.lang || 'en';
        window.location.href = `https://insightabusiness.com/${effectiveLang}/dashboard`;
      } else {
        console.log('Redirecting regular user to main app');
        this.redirectToMainApp();
      }
    }, 2000);
  }

  private redirectToMainApp(): void {
    const token = this.authService.getTokenFromCookie();
    if (token) {
      const redirectUrl = `${environment.mainAppUrl}/${this.lang}/callback/${token}`;
      console.log('Redirecting to main app:', redirectUrl);
      window.location.href = redirectUrl;
    } else {
      // Fallback to regular callback
      const redirectUrl = `${environment.mainAppUrl}/${this.lang}/callback`;
      console.log('Redirecting to main app (no token):', redirectUrl);
      window.location.href = redirectUrl;
    }
  }

  resendVerificationEmail(): void {
    if (!this.canResend || this.isResending) {
      return;
    }

    console.log('Attempting to resend verification email...');

    this.isResending = true;
    this.errorMessage = '';
    this.successMessage = '';

    this.authService.resendVerificationEmail().subscribe({
      next: (response) => {
        console.log('Verification email sent successfully:', response);
        
        this.successMessage = this.translationService.getTranslation('AUTH.EMAIL_RECONFIRM.SUCCESS_MESSAGE') || 
                             'Verification email sent successfully. Please check your inbox.';
        this.startCooldown();
        this.isResending = false;
      },
      error: (error) => {
        console.error('Error sending verification email:', error);
        
        this.isResending = false;
        
        // Show error message but DO NOT clear tokens
        if (error.validationMessages && error.validationMessages.length > 0) {
          this.errorMessage = error.validationMessages[0].detail || 'Failed to send verification email. Please try again.';
        } else {
          this.errorMessage = this.translationService.getTranslation('AUTH.EMAIL_RECONFIRM.ERROR_MESSAGE') || 
                             'Failed to send verification email. Please try again.';
        }
        
        console.log('Resend failed but keeping user on page with valid token');
      }
    });
  }

  private startCooldown(): void {
    this.canResend = false;
    this.resendCooldown = this.COOLDOWN_SECONDS;
    
    this.cooldownTimer = timer(0, 1000).subscribe(() => {
      if (this.resendCooldown > 0) {
        this.resendCooldown--;
      } else {
        this.canResend = true;
        if (this.cooldownTimer) {
          this.cooldownTimer.unsubscribe();
          this.cooldownTimer = null;
        }
      }
    });
  }

  goToLogin(): void {
    this.router.navigate(['/auth/login']);
  }

  logout(): void {
    console.log('User manually logging out');
    
    this.authService.handleLogout().subscribe({
      next: () => {
        this.router.navigate(['/auth/login']);
      },
      error: (error) => {
        console.error('Logout error:', error);
        // Force navigation even if logout fails
        this.router.navigate(['/auth/login']);
      }
    });
  }

  // Method to check verification status manually (can be called by refresh button)
  checkVerification(): void {
    console.log('Manual verification check requested');
    this.checkVerificationStatus();
  }
}
