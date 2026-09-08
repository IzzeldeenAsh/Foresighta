import { Component, Injector, OnInit } from "@angular/core";
import { Router, ActivatedRoute } from "@angular/router";
import { BaseComponent } from "src/app/modules/base.component";
import { ProductionCookieService } from "../production-login/production-cookie.service";
import { TranslationService } from "src/app/modules/i18n/translation.service";
import { first } from "rxjs/operators";

import { environment } from '../../../../../environments/environment';
@Component({
  selector: "app-callback",
  templateUrl: "./callback.component.html",
  styleUrls: ["./callback.component.scss"],
})
export class CallbackComponent extends BaseComponent implements OnInit {
  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private productionCookieService: ProductionCookieService,
    private translationService: TranslationService,
    injector: Injector
  ) {
    super(injector);
  }

  ngOnInit(): void {
    // Fast processing - no loaders, immediate redirect
    this.processCallback();
  }

  private processCallback(): void {
    // Get token from query parameters - use first() to complete after first emission
    this.route.queryParamMap.pipe(first()).subscribe({
      next: (params) => {
        const token = params.get("token");
        const rolesParam = params.get("roles");
        const roles = rolesParam ? rolesParam.split(",").map((role) => role.trim()) : [];
        
        console.log('[callback] Processing callback with roles:', roles);
        
        if (token) {
          try {
            // Store token in cookie with .insightabusiness.com domain
            this.productionCookieService.setAuthToken(token);
            console.log('[callback] Token stored successfully');
            
            // Store preferred language
            const currentLang = this.translationService.getSelectedLanguage() || 'en';
            this.productionCookieService.setPreferredLanguage(currentLang);
            
            // Check if this is a social signup (from sign-up page)
            const isSocialSignup = this.isSocialSignup();
            
            // Get return URL from cookie
            const returnUrl = this.getReturnUrlFromCookie();
            console.log('[callback] Return URL from cookie:', returnUrl, 'isSocialSignup:', isSocialSignup);
            
            // Clean up cookies
            if (returnUrl) {
              this.clearReturnUrlCookie();
            }
            if (isSocialSignup) {
              this.clearSignupFlag();
            }
            
            // Immediately redirect based on roles - use setTimeout to ensure it executes
            setTimeout(() => {
              this.redirectBasedOnRole(roles, returnUrl, isSocialSignup);
            }, 100);
          } catch (error) {
            console.error('[callback] Error processing callback:', error);
            setTimeout(() => {
              this.redirectToLogin();
            }, 100);
          }
        } else {
          // No token - redirect to login
          console.error('[callback] No token found in URL');
          setTimeout(() => {
            this.redirectToLogin();
          }, 100);
        }
      },
      error: (error) => {
        console.error('[callback] Error reading query params:', error);
        setTimeout(() => {
          this.redirectToLogin();
        }, 100);
      }
    });
  }

  private redirectToLogin(): void {
    const loginUrl = `${environment.subAppUrl}/auth/login`;
    console.log('[callback] Redirecting to login:', loginUrl);
    window.location.href = loginUrl;
  }

  private redirectBasedOnRole(roles: string[], returnUrl: string | null, isSocialSignup: boolean = false): void {
    const currentLang = this.translationService.getSelectedLanguage() || 'en';

    console.log('[callback] Redirecting based on roles:', roles, 'returnUrl:', returnUrl, 'isSocialSignup:', isSocialSignup);

    // Check if user is admin/staff - redirect to Next.js admin dashboard
    if (roles.includes('admin') || roles.includes('staff')) {
      const adminUrl = `${environment.mainAppUrl}/${currentLang}/dashboard`;
      console.log('[callback] Redirecting admin/staff to:', adminUrl);
      window.location.href = adminUrl;
      return;
    }

    // Everyone else goes through the Next.js /callback page, which is the single
    // place that checks the server-owned onboarding prompts before landing the
    // user on their destination. Jumping straight to the destination here used to
    // skip onboarding entirely for social (Google / LinkedIn) sign-ins, while the
    // email/password flow — which already redirects to the Next.js callback — showed it.
    const destination = this.resolveDestination(returnUrl);
    const nextCallbackUrl = this.buildNextCallbackUrl(currentLang, destination);

    console.log('[callback] Redirecting through Next.js callback:', nextCallbackUrl, 'destination:', destination);
    window.location.replace(nextCallbackUrl);

    // Fallback if replace doesn't work immediately
    setTimeout(() => {
      if (window.location.href.includes('/auth/callback')) {
        window.location.href = nextCallbackUrl;
      }
    }, 200);
  }

  /**
   * Resolves where the user should end up once the Next.js callback has finished
   * its onboarding checks. Returning null lets the Next.js callback pick the
   * role-based default (feed for clients, dashboard for insighters/companies),
   * exactly like the email/password login flow does.
   */
  private resolveDestination(returnUrl: string | null): string | null {
    if (!returnUrl || returnUrl === '/') {
      return null;
    }

    if (!this.isAllowedReturnUrl(returnUrl)) {
      console.warn('[callback] ReturnUrl not usable, falling back to role default:', returnUrl);
      return null;
    }

    return returnUrl;
  }

  private isAllowedReturnUrl(returnUrl: string): boolean {
    try {
      const returnUrlObj = new URL(returnUrl, window.location.origin);
      const allowedDomains = ['foresighta.co', 'insightabusiness.com', 'localhost', '127.0.0.1'];
      return allowedDomains.some(domain =>
        returnUrlObj.hostname === domain ||
        returnUrlObj.hostname.endsWith(`.${domain}`)
      );
    } catch (e) {
      console.error('[callback] Invalid returnUrl:', e, returnUrl);
      return false;
    }
  }

  /**
   * Builds the Next.js callback URL. On localhost the token has to travel in the
   * query string because cookies are not shared across ports (4200 -> 3000); in
   * production the token cookie is already set on the shared parent domain.
   */
  private buildNextCallbackUrl(currentLang: string, destination: string | null): string {
    const isLocalhost = window.location.hostname === 'localhost' ||
                       window.location.hostname === '127.0.0.1' ||
                       window.location.hostname.startsWith('localhost:') ||
                       window.location.hostname.startsWith('127.0.0.1:');

    const params: string[] = [];
    if (isLocalhost) {
      params.push(`token=${encodeURIComponent(this.getTokenFromCookie() || '')}`);
    }
    if (destination) {
      params.push(`returnUrl=${encodeURIComponent(destination)}`);
    }

    const query = params.length ? `?${params.join('&')}` : '';
    return `${environment.mainAppUrl}/${currentLang}/callback${query}`;
  }

  private getReturnUrlFromCookie(): string | null {
    if (typeof document === 'undefined') return null;
    
    const cookies = document.cookie.split(';');
    for (let cookie of cookies) {
      const [name, value] = cookie.trim().split('=');
      if (name === 'auth_return_url') {
        try {
          return decodeURIComponent(value);
        } catch (e) {
          return value;
        }
      }
    }
    return null;
  }

  private getTokenFromCookie(): string | null {
    if (typeof document === 'undefined') return null;
    
    const cookies = document.cookie.split(';');
    for (let cookie of cookies) {
      const [name, value] = cookie.trim().split('=');
      if (name === 'token') {
        return value;
      }
    }
    return null;
  }

  private clearReturnUrlCookie(): void {
    const isLocalhost = window.location.hostname === 'localhost' || 
                       window.location.hostname === '127.0.0.1' ||
                       window.location.hostname.startsWith('localhost:') ||
                       window.location.hostname.startsWith('127.0.0.1:');
    
    let cookieSettings;
    if (isLocalhost) {
      cookieSettings = [
        'auth_return_url=',
        'Path=/',
        'Max-Age=-1'
      ];
    } else {
      cookieSettings = [
        'auth_return_url=',
        'Path=/',
        'Max-Age=-1',
        'SameSite=None',
        `Domain=${environment.appDomain}`,
        'Secure'
      ];
    }
    
    document.cookie = cookieSettings.join('; ');
  }

  private isSocialSignup(): boolean {
    if (typeof document === 'undefined') return false;
    
    const cookies = document.cookie.split(';');
    for (let cookie of cookies) {
      const [name, value] = cookie.trim().split('=');
      if (name === 'is_social_signup' && value === 'true') {
        return true;
      }
    }
    return false;
  }

  private clearSignupFlag(): void {
    const isLocalhost = window.location.hostname === 'localhost' || 
                       window.location.hostname === '127.0.0.1' ||
                       window.location.hostname.startsWith('localhost:') ||
                       window.location.hostname.startsWith('127.0.0.1:');
    
    let cookieSettings;
    if (isLocalhost) {
      cookieSettings = [
        'is_social_signup=',
        'Path=/',
        'Max-Age=-1'
      ];
    } else {
      cookieSettings = [
        'is_social_signup=',
        'Path=/',
        'Max-Age=-1',
        'SameSite=None',
        `Domain=${environment.appDomain}`,
        'Secure'
      ];
    }
    
    document.cookie = cookieSettings.join('; ');
  }
}
