import { Injectable, OnDestroy } from "@angular/core";
import {
  Observable,
  BehaviorSubject,
  of,
  Subscription,
  throwError,
} from "rxjs";
import { map, catchError, switchMap, finalize, first, tap, mapTo } from "rxjs/operators";
import { ForesightaGeneralUserModel, UserModel } from "../models/user.model";
import { AuthModel } from "../models/auth.model";
import { Router } from "@angular/router";
import { AuthHTTPService } from "./auth-http/auth-http.service";
import { InsightaUserModel } from "../models/insighta-user.model";
import { HttpClient, HttpHeaders } from "@angular/common/http";
import { TranslationService } from "../../i18n";
import { environment } from "src/environments/environment";

export type UserType = InsightaUserModel | undefined;

@Injectable({
  providedIn: "root",
})
export class AuthService implements OnDestroy {
  private unsubscribe: Subscription[] = []; 
  private userLocalStorageKey = `currentUser`;
  
  // public fields
  currentUser$: Observable<UserType>;
  isLoading$: Observable<boolean>;
  currentUserSubject: BehaviorSubject<UserType>;
  isLoadingSubject: BehaviorSubject<boolean>;
  currentLang: string = 'en';

  constructor(
    private authHttpService: AuthHTTPService,
    private router: Router,
    private http: HttpClient,
    private translationService: TranslationService
  ) {
    this.isLoadingSubject = new BehaviorSubject<boolean>(false);
    this.currentUserSubject = new BehaviorSubject<UserType>(undefined);
    this.currentUser$ = this.currentUserSubject.asObservable();
    this.isLoading$ = this.isLoadingSubject.asObservable();
    
    const subscr = this.getUserByToken().subscribe();
    this.unsubscribe.push(subscr);
    
    this.translationService.onLanguageChange().subscribe((lang) => {
      this.currentLang = lang || 'en';
    });
  }

  // Current User Getter Setter
  get currentUserValue(): UserType {
    return this.currentUserSubject.value;
  }

  set currentUserValue(user: UserType) {
    this.currentUserSubject.next(user);
  }

  // Cookie management methods
  private setTokenCookie(token: string): void {
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    
    let cookieSettings;
    if (isLocalhost) {
      cookieSettings = [
        `token=${token}`,
        `Path=/`,
        `Max-Age=${60 * 60 * 24 * 7}`, // 7 days
        `SameSite=Lax`
      ];
    } else {
      cookieSettings = [
        `token=${token}`,
        `Path=/`,
        `Max-Age=${60 * 60 * 24 * 7}`, // 7 days
        `SameSite=None`,
        `Domain=.foresighta.co`,
        `Secure`
      ];
    }
    
    document.cookie = cookieSettings.join('; ');
  }

  getTokenFromCookie(): string | null {
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

  private removeTokenCookie(): void {
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    
    let cookieSettings;
    if (isLocalhost) {
      cookieSettings = [
        'token=',
        'Path=/',
        'Max-Age=-1'
      ];
    } else {
      cookieSettings = [
        'token=',
        'Path=/',
        'Max-Age=-1',
        'SameSite=None',
        'Domain=.foresighta.co',
        'Secure'
      ];
    }
    
    document.cookie = cookieSettings.join('; ');
  }

  private setReturnUrlCookie(url: string): void {
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    
    let cookieSettings;
    if (isLocalhost) {
      cookieSettings = [
        `auth_return_url=${encodeURIComponent(url)}`,
        `Path=/`,
        `Max-Age=${60 * 60}`, // 1 hour
        `SameSite=Lax`
      ];
    } else {
      cookieSettings = [
        `auth_return_url=${encodeURIComponent(url)}`,
        `Path=/`,
        `Max-Age=${60 * 60}`, // 1 hour
        `SameSite=None`,
        `Domain=.foresighta.co`,
        `Secure`
      ];
    }
    
    document.cookie = cookieSettings.join('; ');
  }

  // Token validation
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

  // Error handling
  private handleError(error: any) {
    let validationErrors: any[] = [];

    if (error.error?.errors) {
      const errors = error.error.errors;
      for (const field in errors) {
        if (errors.hasOwnProperty(field)) {
          const errorMsgArray = errors[field];
          errorMsgArray.forEach((msg: string) => {
            validationErrors.push({
              severity: "error",
              summary: "Validation Error",
              detail: msg,
            });
          });
        }
      }
    } else if (error.error?.message) {
      validationErrors.push({
        severity: "error",
        summary: "Error",
        detail: error.error.message,
      });
    } else {
      validationErrors.push({
        severity: "error",
        summary: "Error",
        detail: "An unexpected error occurred.",
      });
    }

    return throwError(() => ({
      validationMessages: validationErrors,
    }));
  }

  // User management
  private setUserInLocalStorage(user: UserType): void {
    if (user) {
      localStorage.setItem(this.userLocalStorageKey, JSON.stringify(user));
    }
  }

  private getUserFromLocalStorage(): UserType | undefined {
    const userJson = localStorage.getItem(this.userLocalStorageKey);
    if (userJson) {
      try {
        return JSON.parse(userJson) as UserType;
      } catch (error) {
        localStorage.removeItem(this.userLocalStorageKey);
        return undefined;
      }
    }
    return undefined;
  }

  private clearUserFromLocalStorage(): void {
    localStorage.removeItem(this.userLocalStorageKey);
  }

  // Public methods
  login(email: string, password: string, lang: string, returnUrl?: string): Observable<{userData: any, token: string}> {
    this.isLoadingSubject.next(true);
    
    // Store return URL in cookie if provided
    if (returnUrl && returnUrl !== '/') {
      this.setReturnUrlCookie(returnUrl);
    }

    return this.authHttpService.login(email, password, lang).pipe(
      switchMap((response: any) => {
        const token = response.data.token;
        
        // Store token in cookie
        this.setTokenCookie(token);
        
        // Get profile with the token
        const headers = new HttpHeaders({
          Accept: "application/json",
          "Accept-Language": this.currentLang,
          "Authorization": `Bearer ${token}`,
        });

        return this.http.get('https://api.insightabusiness.com/api/account/profile', { headers }).pipe(
          map((profileResponse: any) => {
            const userData: UserType = {
              id: profileResponse.data.id,
              name: profileResponse.data.name,
              email: profileResponse.data.email,
              countryId: profileResponse.data.country_id,
              country: profileResponse.data.country,
            };

            this.setUserInLocalStorage(userData);
            this.currentUserSubject.next(userData);
            
            // Return both user data and token
            return {
              userData: profileResponse.data,
              token: token
            };
          })
        );
      }),
      catchError((error) => this.handleError(error)),
      finalize(() => this.isLoadingSubject.next(false))
    );
  }

  registration(user: ForesightaGeneralUserModel): Observable<any> {
    this.isLoadingSubject.next(true);
    
    return this.authHttpService.createUser(user).pipe(
      map((response: any) => {
        // Store token in cookie
        this.setTokenCookie(response.data.token);
        
        const userData: UserType = {
          id: response.data.id,
          name: response.data.name,
          email: response.data.email,
          countryId: response.data.country_id,
          country: response.data.country,
        };

        this.setUserInLocalStorage(userData);
        this.currentUserSubject.next(userData);
        
        return response.data;
      }),
      catchError((error) => this.handleError(error)),
      finalize(() => this.isLoadingSubject.next(false))
    );
  }

  getProfile(): Observable<any> {
    this.isLoadingSubject.next(true);
    const token = this.getTokenFromCookie();
    
    if (!token) {
      this.isLoadingSubject.next(false);
      return throwError(() => new Error('No authentication token'));
    }

    const headers = new HttpHeaders({
      Accept: "application/json",
      "Accept-Language": this.currentLang,
      "Authorization": `Bearer ${token}`,
    });

    return this.http.get('https://api.insightabusiness.com/api/account/profile', { headers }).pipe(
      map((response: any) => {
        const userData: UserType = {
          id: response.data.id,
          name: response.data.name,
          email: response.data.email,
          countryId: response.data.country_id,
          country: response.data.country,
        };

        this.setUserInLocalStorage(userData);
        this.currentUserSubject.next(userData);
        
        return response.data;
      }),
      catchError((error) => {
        // Only logout on 401 (unauthorized) or 403 errors that are NOT about email verification
        if (error.status === 401) {
          this.handleLogout().subscribe();
        } else if (error.status === 403) {
          const errorMessage = error.error?.message || '';
          // Don't logout if it's an email verification error
          if (!errorMessage.includes('verified') && !errorMessage.includes('verification')) {
            this.handleLogout().subscribe();
          }
        }
        return this.handleError(error);
      }),
      finalize(() => this.isLoadingSubject.next(false))
    );
  }

  getUserByToken(): Observable<any> {
    const token = this.getTokenFromCookie();
    
    if (!token || this.isTokenExpired(token)) {
      if (token) {
        this.handleLogout().subscribe();
      }
      return of(undefined);
    }

    const user = this.getUserFromLocalStorage();
    if (user) {
      this.currentUserSubject.next(user);
      return of(user);
    }

    return this.getProfile();
  }

  logout(): Observable<any> {
    const token = this.getTokenFromCookie();
    
    if (!token) {
      return of(null);
    }

    const headers = new HttpHeaders({
      'Accept': 'application/json',
      'Accept-Language': 'en',
      'Authorization': `Bearer ${token}`,
    });

    return this.http.post<any>(
      'https://api.insightabusiness.com/api/account/logout',
      {},
      { headers }
    ).pipe(
      catchError(() => of(null)) // Continue with cleanup even if logout fails
    );
  }

  handleLogout(): Observable<void> {
    return this.logout().pipe(
      first(),
      tap({
        next: () => this.clearAuthData(),
        error: () => this.clearAuthData()
      }),
      mapTo(undefined)
    );
  }

  private clearAuthData(): void {
    this.removeTokenCookie();
    this.clearUserFromLocalStorage();
    localStorage.removeItem("user");
    localStorage.removeItem("authToken");
    localStorage.removeItem("foresighta-creds");
    this.currentUserSubject.next(undefined);
  }

  resendVerificationEmail(): Observable<any> {
    const token = this.getTokenFromCookie();
    
    if (!token) {
      return throwError(() => new Error('No authentication token'));
    }

    const headers = new HttpHeaders({
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'Accept-Language': this.currentLang,
      'Authorization': `Bearer ${token}`,
    });

    return this.http.post('https://api.insightabusiness.com/api/account/email/resend', {}, { headers }).pipe(
      catchError((error) => this.handleError(error))
    );
  }

  // Social authentication methods
  getGoogleAuthRedirectUrl(): Observable<string> {
    const headers = new HttpHeaders({
      'Accept': 'application/json',
      'Accept-Language': this.currentLang
    });
    
    return this.http.get('https://api.insightabusiness.com/api/auth/provider/google', { 
      headers,
      responseType: 'text'
    });
  }

  getLinkedInAuthRedirectUrl(): Observable<string> {
    const headers = new HttpHeaders({
      'Accept': 'application/json', 
      'Accept-Language': this.currentLang
    });
    
    return this.http.get('https://api.insightabusiness.com/api/auth/provider/linkedin-openid', {
      headers,
      responseType: 'text'
    });
  }

  // Utility methods
  getCurrentUserId(): number | undefined {
    const currentUser = this.currentUserValue; 
    return currentUser?.id;
  }

  forgotPassword(email: string): Observable<boolean> {
    this.isLoadingSubject.next(true);
    return this.authHttpService
      .forgotPassword(email)
      .pipe(finalize(() => this.isLoadingSubject.next(false)));
  }

  ngOnDestroy() {
    this.unsubscribe.forEach((sb) => sb.unsubscribe());
  }
}