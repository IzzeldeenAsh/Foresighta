import { Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot } from '@angular/router';
import { AuthService } from '../../modules/auth/services/auth.service';
import { map, catchError } from 'rxjs';
import { ProfileService } from 'src/app/_fake/services/get-profile/get-profile.service';
import { of } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class authGuard  {
  constructor(
    private getProfileService: ProfileService,
    private router: Router,
    private authService: AuthService
  ) {}

  private isTokenExpired(token: string): boolean {
    if (!token) return true;
    
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      const currentTime = Math.floor(Date.now() / 1000);
      return payload.exp < currentTime;
    } catch (error) {
      return true;
    }
  }

  canActivate(route: ActivatedRouteSnapshot, state: RouterStateSnapshot) {
    // First check if user has a valid token
    const token = this.authService.getTokenFromCookie();

    if (!token) {
      // No token - redirect to login
      console.log('Auth Guard - No token found, redirecting to login');
      const url = state.url;
      return this.router.createUrlTree(['/auth/login'], {
        queryParams: { returnUrl: url }
      });
    }

    // Check if token is expired
    if (this.isTokenExpired(token)) {
      // Token expired - redirect to login
      console.log('Auth Guard - Token expired, redirecting to login');
      const url = state.url;
      return this.router.createUrlTree(['/auth/login'], {
        queryParams: { returnUrl: url }
      });
    }

    // Token exists and is valid - now check profile
    return this.getProfileService.getProfile().pipe(
      map(user => {
        if(user.roles.includes('admin') || user.roles.includes('staff')){
          if (typeof window !== 'undefined') {
            window.location.replace('https://insightabusiness.com/en/dashboard');
          }
          return false;
        }
        if (user && user.verified) {
          // User is authenticated and verified, allow access
          return true;
        } else if (user && !user.verified) {
          // User is authenticated but not verified - redirect to email-reconfirm
          console.log('Auth Guard - User not verified, redirecting to email-reconfirm');
          return this.router.createUrlTree(['/auth/email-reconfirm']);
        } else {
          // No user data - redirect to login
          console.log('Auth Guard - No user data, redirecting to login');
          const url = state.url;
          return this.router.createUrlTree(['/auth/login'], {
            queryParams: { returnUrl: url }
          });
        }
      }),
      catchError(error => {
        console.log('Auth Guard - Profile API error:', error);

        // Check if it's an email verification error (403)
        if (error.status === 403) {
          const errorMessage = error.error?.message || '';
          if (errorMessage.includes('verified') || errorMessage.includes('verification')) {
            // Email verification required - redirect to email-reconfirm
            console.log('Auth Guard - Email verification required, redirecting to email-reconfirm');
            return of(this.router.createUrlTree(['/auth/email-reconfirm']));
          }
        }

        // For other errors (401, 500, etc.) - clear auth data and redirect to login
        console.log('Auth Guard - API error, clearing auth and redirecting to login');
        localStorage.removeItem('foresighta-creds');
        localStorage.removeItem('currentUser');
        localStorage.removeItem('authToken');
        localStorage.removeItem('token');

        const url = state.url;
        return of(this.router.createUrlTree(['/auth/login'], {
          queryParams: { returnUrl: url }
        }));
      })
    );
  }
}
