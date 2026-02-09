import { Injectable } from '@angular/core';
import { CanActivate, ActivatedRouteSnapshot, RouterStateSnapshot, Router, UrlTree } from '@angular/router';
import { Observable, of } from 'rxjs';
import { map, catchError, switchMap } from 'rxjs/operators';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { AuthService } from '../../modules/auth/services/auth.service';
import { ProfileService } from 'src/app/_fake/services/get-profile/get-profile.service';

@Injectable({ providedIn: 'root' })
export class PaymentGuard implements CanActivate {
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
          // User has required role, check payment info
          return this.checkPaymentInfo();
        }
        // User doesn't have required roles, allow access
        return of(true);
      }),
      catchError(error => {
        console.log('Payment Guard - Profile API error:', error);
        // If profile check fails, allow access (other guards will handle auth)
        return of(true);
      })
    );
  }

  private checkPaymentInfo(): Observable<boolean | UrlTree> {
    const token = this.authService.getTokenFromCookie();
    
    if (!token) {
      // No token, allow access (auth guard will handle this)
      return of(true);
    }

    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Accept-Language': 'en'
    });

    return this.http.get<any>('https://api.insightabusiness.com/api/insighter/payment/account/details', { headers }).pipe(
      map(response => {
        if (response && response.data && response.data.primary) {
          const primaryData = response.data.primary;
          const secondaryData = response.data.secondary;
          
          // Check if manual account is incomplete (missing IBAN)
          if (primaryData.type === 'manual' && (primaryData.status === 'inactive' || !primaryData.iban)) {
            console.log('Payment Guard - Manual account incomplete, redirecting to manual-account setup');
            return this.router.createUrlTree(['/app/setup-payment-info/manual-account']);
          }
          
          // Check if stripe account is incomplete (status inactive and no charges_enable_at)
          if (primaryData.type === 'provider' && 
              !secondaryData.details_submitted_at) {
            console.log('Payment Guard - Stripe account incomplete, redirecting to stripe-callback');
            return this.router.createUrlTree(['/app/setup-payment-info/stripe-callback/refresh']);
          }
          
          // Payment info is complete, allow access
          return true;
        }
        
        // No payment data, redirect to setup
        console.log('Payment Guard - No payment data, redirecting to setup-payment-info');
        return this.router.createUrlTree(['/app/setup-payment-info']);
      }),
      catchError(error => {
        console.log('Payment Guard - Payment API error:', error);
        
        // Check if it's 403 Forbidden (no payment info configured)
        if (error.status === 403) {
          console.log('Payment Guard - 403 Forbidden, redirecting to setup-payment-info');
          return of(this.router.createUrlTree(['/app/setup-payment-info']));
        }
        
        // For any other API errors (including 500), block access by redirecting to setup-payment-info
        // This ensures users cannot access add-knowledge unless payment API returns valid data
        console.log('Payment Guard - API error (status: ' + error.status + '), blocking access and redirecting to setup-payment-info');
        return of(this.router.createUrlTree(['/app/setup-payment-info']));
      })
    );
  }
}
