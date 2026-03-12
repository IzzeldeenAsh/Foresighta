import { Injectable } from '@angular/core';
import { HttpInterceptor, HttpRequest, HttpHandler, HttpEvent, HttpErrorResponse } from '@angular/common/http';
import { catchError, Observable, throwError } from 'rxjs';
import { Router } from '@angular/router';
import { ToastService } from 'src/app/_fake/services/toast-service/toast.service';
import { CookieService } from './services/cookie.service';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  private isHandlingEmailNotVerified = false;
  private hasShownEmailNotVerifiedToast = false;

  constructor(
    private router: Router,
    private toastService: ToastService,
    private cookieService: CookieService
  ) {}

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    // Get auth token from cookie using the cookie service
    const token = this.cookieService.getCookie('token');

    // Get user's timezone
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

    // Clone the request and add the token and timezone if available
    let clonedReq = req;
    
    if (token) {
      clonedReq = req.clone({
        headers: req.headers
          .set('Authorization', `Bearer ${token}`)
          .set('X-Timezone', timezone)
      });
    } else {
      // Even if no token, still add timezone header
      clonedReq = req.clone({
        headers: req.headers.set('X-Timezone', timezone)
      });
    }

    return next.handle(clonedReq).pipe(
      catchError((error: HttpErrorResponse) => {
        if (error.status === 401) {
          // Handle unauthorized - token expired or invalid
          this.handleUnauthorized(error, clonedReq.url);
        } else if (error.status === 403) {
          // Handle forbidden - check for email verification error
          this.handleForbidden(error);
        } else if (error.status === 0) {
          // Status 0 often indicates CORS issues
          console.error('Possible CORS issue:', error);
        }
        
        return throwError(() => error);
      })
    );
  }

  private handleUnauthorized(error?: HttpErrorResponse, requestUrl?: string): void {
    console.log('Unauthorized access - redirecting to login');
    
    // Clear auth data directly without making HTTP calls
    this.clearAuthData();
    
    // Navigate to login
    this.router.navigate(['/auth/login']).then(() => {
      // Determine appropriate message
      const rawError = error && (error as any).error;
      const apiMessage = typeof rawError === 'string'
        ? rawError
        : (rawError && rawError.message ? String(rawError.message) : '');
      const responseUrl = (error && (error as any).url) ? String((error as any).url) : (requestUrl || '');
      const isVerifyEmailRequest = typeof responseUrl === 'string' && responseUrl.includes('/api/account/email/verify');
      const isExplicitUnauthenticated = apiMessage.toLowerCase().includes('unauthenticated');

      if (isVerifyEmailRequest || isExplicitUnauthenticated) {
        // Show "Unauthenticated" toast instead of "Session expired"
        this.toastService.error('Unauthenticated', 'Error');
      } else {
        // Default behavior for other 401s
        this.toastService.warning('Your session has expired. Please log in again.', 'Session Expired');
      }
    });
  }

  private handleForbidden(error: HttpErrorResponse): void {
    // Check for email verification error
    const errorMessage = error?.error?.message || '';
    const isEmailNotVerified =
      error.status === 403 &&
      (errorMessage === "Your email address is not verified." ||
        errorMessage.includes("not verified") ||
        errorMessage.includes("verification") ||
        errorMessage.includes("verified"));

    if (isEmailNotVerified) {
      const currentUrl = this.router.url;
      
      // Don't redirect if user is already on auth-related routes
      if (currentUrl.startsWith('/auth') ||
          currentUrl.includes('/auth/verify-email') || 
          currentUrl.includes('/auth/email-reconfirm') || 
          currentUrl.includes('/auth/verify-login-email') ||
          currentUrl.includes('/auth/callback')) {
        console.log('User is on auth route, not redirecting for email verification error');
        // Avoid spamming the user with repeated toasts while they are already handling verification
        if (!this.hasShownEmailNotVerifiedToast) {
          this.toastService.error(errorMessage || 'Your email address is not verified.', "Account Issue");
          this.hasShownEmailNotVerifiedToast = true;
        }
        return;
      }
      
      if (!this.hasShownEmailNotVerifiedToast) {
        this.toastService.error(errorMessage || 'Your email address is not verified.', "Account Issue");
        this.hasShownEmailNotVerifiedToast = true;
      }

      if (this.isHandlingEmailNotVerified) {
        return;
      }

      this.isHandlingEmailNotVerified = true;

      // Try to read the user's email from storage for a better UX
      let email = '';
      try {
        const currentUserRaw = localStorage.getItem('currentUser') || localStorage.getItem('user') || '';
        if (currentUserRaw) {
          const parsed = JSON.parse(currentUserRaw);
          email = (parsed?.email || '').trim();
        }
      } catch {
        // ignore
      }

      // Navigate to code-based verification page so the user can verify immediately
      const returnUrl = currentUrl || '/';
      this.router.navigate(['/auth/verify-login-email'], {
        queryParams: {
          ...(email ? { email } : {}),
          returnUrl: returnUrl !== '/' ? returnUrl : ''
        }
      }).finally(() => {
        // Allow future handling attempts after navigation settles
        this.isHandlingEmailNotVerified = false;
      });
    } else {
      // For other forbidden errors, show generic message
      this.toastService.error('Access denied. You do not have permission to perform this action.', 'Access Denied');
    }
  }

  private clearAuthData(): void {
    // Clear the token cookie
    this.cookieService.deleteCookie('token');
    
    // Clear localStorage data
    localStorage.removeItem('foresighta-creds');
    localStorage.removeItem('currentUser');
    
    // Clear any other auth-related data
    sessionStorage.clear();
  }
}
