import { Injectable } from '@angular/core';
import { CanActivate, ActivatedRouteSnapshot, RouterStateSnapshot, Router, UrlTree } from '@angular/router';
import { Observable, of } from 'rxjs';
import { map, catchError, switchMap } from 'rxjs/operators';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { AuthService } from '../../modules/auth/services/auth.service';
import { ProfileService } from 'src/app/_fake/services/get-profile/get-profile.service';

@Injectable({ providedIn: 'root' })
export class SetupPaymentGuard implements CanActivate {
  constructor(
    private http: HttpClient,
    private router: Router,
    private authService: AuthService,
    private profileService: ProfileService
  ) {}

  canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): Observable<boolean | UrlTree> {
    // First get user profile to check roles
    return this.profileService.getProfile().pipe(
      switchMap(user => {
        // Check if user has 'insighter' or 'company' role
        if (user && user.roles && (user.roles.includes('insighter') || user.roles.includes('company'))) {
          // User has required role, allow access to payment setup
          // Optionally check if they already have complete payment info and redirect
          return this.checkIfPaymentSetupNeeded(state.url);
        }
        
        // User doesn't have required roles, redirect to dashboard
        console.log('Setup Payment Guard - User lacks required roles, redirecting to dashboard');
        return of(this.router.createUrlTree(['/app/insighter-dashboard']));
      }),
      catchError(error => {
        console.log('Setup Payment Guard - Profile API error:', error);
        // If profile check fails, redirect to dashboard
        return of(this.router.createUrlTree(['/app/insighter-dashboard']));
      })
    );
  }

  private checkIfPaymentSetupNeeded(currentUrl: string): Observable<boolean | UrlTree> {
    const token = this.authService.getTokenFromCookie();
    
    if (!token) {
      // No token, allow access (auth guard will handle this)
      return of(true);
    }

    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
        'Accept-Language':'en'
    });

    return this.http.get<any>('https://api.foresighta.co/api/insighter/payment/account/details', { headers }).pipe(
      map(response => {
        if (response && response.data && response.data.primary) {
          const primaryData = response.data.primary;
          const secondaryData = response.data.secondary;
          
          // Check if payment setup is complete
          const isManualComplete = primaryData.type === 'manual' && primaryData.iban && primaryData.status === 'active';
          const isStripeComplete = primaryData.type === 'provider' && ((secondaryData.details_submitted_at) || (primaryData.status === 'active' && secondaryData.charges_enable_at));
          
          if (isManualComplete || isStripeComplete) {
            // Payment is already complete
            // If user is trying to access the main setup page, redirect to dashboard
            if (currentUrl === '/app/setup-payment-info' || currentUrl === '/app/setup-payment-info/') {
              console.log('Setup Payment Guard - Payment already complete, redirecting to dashboard');
              return this.router.createUrlTree(['/app/insighter-dashboard']);
            }
            // Allow access to sub-pages (success, etc.)
            return true;
          }
          
          // Payment setup is incomplete, allow access
          return true;
        }
        
        // No payment data (403 or empty response), allow access to setup
        return true;
      }),
      catchError(error => {
        console.log('Setup Payment Guard - Payment API error:', error);
        
        // For 403 or other errors, allow access to setup payment
        return of(true);
      })
    );
  }
}
