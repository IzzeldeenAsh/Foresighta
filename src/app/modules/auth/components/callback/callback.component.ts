import { Component, Injector, OnInit } from "@angular/core";
import { Router, ActivatedRoute } from "@angular/router";
import { BaseComponent } from "src/app/modules/base.component";
import { ProductionCookieService } from "../production-login/production-cookie.service";
import { TranslationService } from "src/app/modules/i18n/translation.service";
import { first } from "rxjs/operators";

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
    const loginUrl = 'https://app.insightabusiness.com/auth/login';
    console.log('[callback] Redirecting to login:', loginUrl);
    window.location.href = loginUrl;
  }

  private redirectBasedOnRole(roles: string[], returnUrl: string | null, isSocialSignup: boolean = false): void {
    const currentLang = this.translationService.getSelectedLanguage() || 'en';
    const isLocalhost = window.location.hostname === 'localhost' || 
                       window.location.hostname === '127.0.0.1' ||
                       window.location.hostname.startsWith('localhost:') ||
                       window.location.hostname.startsWith('127.0.0.1:');
    
    console.log('[callback] Redirecting based on roles:', roles, 'returnUrl:', returnUrl, 'isSocialSignup:', isSocialSignup);
    
    // Check if user is admin/staff - stay in Angular app
    if (roles.includes('admin') || roles.includes('staff')) {
      const adminUrl = `${window.location.origin}/admin-dashboard`;
      console.log('[callback] Redirecting admin/staff to:', adminUrl);
      window.location.href = adminUrl;
      return;
    }
    
    // For social signups, prefer redirecting to returnUrl (if provided)
    if (isSocialSignup && returnUrl) {
      console.log('[callback] Redirecting social signup to returnUrl:', returnUrl);
      // On localhost, cookies won't be shared across ports (4200 -> 3000),
      // so always go through Next.js callback to set token on :3000 domain.
      if (isLocalhost) {
        const nextCallbackUrl = `https://insightabusiness.com/${currentLang}/callback?token=${encodeURIComponent(this.getTokenFromCookie() || '')}&returnUrl=${encodeURIComponent(returnUrl)}`;
        window.location.replace(nextCallbackUrl);
      } else {
        window.location.replace(returnUrl);
      }
      setTimeout(() => {
        if (window.location.href.includes('/auth/callback')) {
          window.location.href = isLocalhost
            ? `https://insightabusiness.com/${currentLang}/callback?token=${encodeURIComponent(this.getTokenFromCookie() || '')}&returnUrl=${encodeURIComponent(returnUrl)}`
            : returnUrl;
        }
      }, 200);
      return;
    } else if (isSocialSignup) {
      const signupUrl = `https://insightabusiness.com/${currentLang}`;
      console.log('[callback] Redirecting social signup to:', signupUrl);
      window.location.replace(signupUrl);
      setTimeout(() => {
        if (window.location.href.includes('/auth/callback')) {
          window.location.href = signupUrl;
        }
      }, 200);
      return;
    }
    
    // Regular users (including 'client') redirect to Next.js app
    // If returnUrl exists and is valid, redirect there
    if (returnUrl) {
      try {
        const returnUrlObj = new URL(returnUrl);
        const allowedDomains = ['foresighta.co', 'www.insightabusiness.com', 'app.insightabusiness.com', 'localhost', 'insightabusiness.com', 'www.insightabusiness.com'];
        const isAllowed = allowedDomains.some(domain => 
          returnUrlObj.hostname === domain || 
          returnUrlObj.hostname.endsWith(`.${domain}`) ||
          returnUrlObj.hostname.startsWith('localhost:') ||
          returnUrlObj.hostname.startsWith('127.0.0.1:')
        );
        
        if (isAllowed) {
          console.log('[callback] Redirecting to returnUrl:', returnUrl);
          // Force redirect - try both methods
          if (isLocalhost) {
            const nextCallbackUrl = `https://insightabusiness.com/${currentLang}/callback?token=${encodeURIComponent(this.getTokenFromCookie() || '')}&returnUrl=${encodeURIComponent(returnUrl)}`;
            window.location.replace(nextCallbackUrl);
          } else {
            window.location.replace(returnUrl);
          }
          // Fallback if replace doesn't work immediately
          setTimeout(() => {
            if (window.location.href.includes('/auth/callback')) {
              window.location.href = isLocalhost
                ? `https://insightabusiness.com/${currentLang}/callback?token=${encodeURIComponent(this.getTokenFromCookie() || '')}&returnUrl=${encodeURIComponent(returnUrl)}`
                : returnUrl;
            }
          }, 200);
          return;
        } else {
          console.warn('[callback] ReturnUrl domain not allowed:', returnUrlObj.hostname);
        }
      } catch (e) {
        console.error('[callback] Invalid returnUrl:', e, returnUrl);
      }
    }
    
    // Default redirect to Next.js app home
    // Determine the correct base URL
    let baseUrl: string;
    if (isLocalhost) {
      baseUrl = `https://insightabusiness.com/${currentLang}/home`;
    } else {
      // For production, use www.insightabusiness.com (not foresighta.co:3000)
      baseUrl = `https://www.insightabusiness.com/${currentLang}/home`;
    }
    
    console.log('[callback] Redirecting to default URL:', baseUrl);
    // Force redirect - try both methods
    window.location.replace(baseUrl);
    // Fallback if replace doesn't work immediately
    setTimeout(() => {
      if (window.location.href.includes('/auth/callback')) {
        console.log('[callback] Fallback redirect to:', baseUrl);
        window.location.href = baseUrl;
      }
    }, 200);
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
        'Domain=.insightabusiness.com',
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
        'Domain=.insightabusiness.com',
        'Secure'
      ];
    }
    
    document.cookie = cookieSettings.join('; ');
  }
}
