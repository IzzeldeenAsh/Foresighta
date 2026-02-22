import { Injectable } from "@angular/core";
import { HttpClient, HttpHeaders } from "@angular/common/http";
import { BehaviorSubject, Observable, Subject, throwError } from "rxjs";
import { map, catchError, finalize, tap, shareReplay } from "rxjs/operators";
import { TranslationService } from "src/app/modules/i18n";
import { Router } from "@angular/router";

interface UserType {
  id: string;
  name: string;
  email: string;
  countryId: string | null;
  country: string | null;
  roles: string[];
}

@Injectable({
  providedIn: "root",
})
export class ProfileService {
  private readonly API_URL = "https://api.insightabusiness.com/api/account/profile";
  private profileCache$: Observable<any> | null = null;
  private isLoadingSubject = new BehaviorSubject<boolean>(false);
  private userSubject = new BehaviorSubject<UserType | null>(null);
  private profileUpdateSubject = new Subject<void>();
  currentLang: string = "";
  isLoading$ = this.isLoadingSubject.asObservable();
  currentUser$ = this.userSubject.asObservable();
  profileUpdate$ = this.profileUpdateSubject.asObservable();

  constructor(
    private http: HttpClient,
    private translateService: TranslationService,
    private router: Router
  ) {
    // Initialize from localStorage if available
    const savedUser = this.getUserFromLocalStorage();
    if (savedUser) {
      this.userSubject.next(savedUser);
    }
    this.currentLang = this.translateService.getSelectedLanguage()
      ? this.translateService.getSelectedLanguage()
      : "en";
  }

  getProfile(isPass: boolean = false): Observable<any> {
    // Return cached observable if it exists
    if (this.profileCache$) {
      return this.profileCache$;
    }

    this.isLoadingSubject.next(true);
    const headers = new HttpHeaders({
      Accept: "application/json",
      "Accept-Language": this.currentLang,
    });

    // Create and cache the new observable
    this.profileCache$ = this.http.get(this.API_URL, { headers }).pipe(
      map((response: any) => {
        const user: UserType = {
          id: response.data.id,
          name: response.data.name,
          email: response.data.email,
          countryId: response.data.country_id,
          country: response.data.country,
          roles: response.data.roles || []
        };
        this.setUserInLocalStorage(user);
        this.userSubject.next(user);
        this.profileUpdateSubject.next(); // Notify subscribers of update
        return response.data;
      }),
      catchError((err) => {
        this.profileCache$ = null; // Clear cache on error
        
        if (err.status === 401) {
          localStorage.removeItem("foresighta-creds");
          localStorage.removeItem("user");
          this.clearProfile();
          
          // Save current URL before redirecting
          const currentUrl = window.location.pathname;
          console.log('401 error - Saving return URL:', currentUrl);
          
          // Navigate to auth with returnUrl parameter
          this.router.navigate(['/auth/login'], { 
            queryParams: { returnUrl: currentUrl } 
          });
        } else if (err.status === 403) {
          // Handle email verification errors
          const errorMessage = err.error?.message || '';
          if (errorMessage.includes('verified') || errorMessage.includes('verification')) {
            console.log('403 error - Email verification required, letting guard handle redirect');
            // Don't redirect here - let the auth guard handle it
            // Just clear the cache so it doesn't retry indefinitely
          } else {
            // Other 403 errors should clear auth and redirect
            localStorage.removeItem("foresighta-creds");
            localStorage.removeItem("user");
            this.clearProfile();
            
            const currentUrl = window.location.pathname;
            console.log('403 error - Access denied, redirecting to login');
            
            this.router.navigate(['/auth/login'], { 
              queryParams: { returnUrl: currentUrl } 
            });
          }
        }
        
        return throwError(err);
      }),
      finalize(() => this.isLoadingSubject.next(false)),
      shareReplay(1) // Cache the result
    );

    return this.profileCache$;
  }

  hasRole(roles: string[]): Observable<boolean> {
    return this.getProfile().pipe(
      map(profile => {
        const userRoles = profile.roles || [];
        return roles.some(role => userRoles.includes(role));
      })
    );
  }

  // Force refresh the profile
  refreshProfile(): Observable<any> {
    this.profileCache$ = null;
    return this.getProfile();
  }

  // Get current user synchronously
  getCurrentUser(): UserType | null {
    return this.userSubject.value;
  }

  // Clear profile (useful for logout)
  clearProfile(): void {
    this.profileCache$ = null;
    this.userSubject.next(null);
    this.profileUpdateSubject.next(); // Notify subscribers of clear
    localStorage.removeItem("user"); // Adjust key as needed
  }

  private setUserInLocalStorage(user: UserType): void {
    localStorage.setItem("user", JSON.stringify(user));
  }

  private getUserFromLocalStorage(): UserType | null {
    const userStr = localStorage.getItem("user");
    return userStr ? JSON.parse(userStr) : null;
  }

  isClient():Observable<any>{
    return this.getProfile().pipe(
      map(profile => {
        const userRoles = profile.roles || [];
        return userRoles.includes("client") && userRoles.length ==1;
      })
    );
  }

  isInsighter():Observable<any>{
    return this.getProfile().pipe(
      map(profile => {
        const userRoles = profile.roles || [];
        return userRoles.includes("insighter") 
      })
    );
  }

  isCompanyInsighter():Observable<any>{
    return this.getProfile().pipe(
      map(profile => {
        const userRoles = profile.roles || [];
        return userRoles.includes("company-insighter") 
      })
    );
  }

  isCompany():Observable<any>{
    return this.getProfile().pipe(
      map(profile => {
        const userRoles = profile.roles || [];
        return userRoles.includes("company")
      })
    );
  }

  updateCountry(countryId: string): Observable<any> {
    const headers = new HttpHeaders({
      Accept: "application/json",
      "Content-Type": "application/json",
      "Accept-Language": this.currentLang,
    });

    const payload = { country_id: countryId };

    this.isLoadingSubject.next(true);
    return this.http.post(`${this.API_URL}/country`, payload, { headers }).pipe(
      tap(() => {
        // Clear the cache so next getProfile() call fetches fresh data
        this.profileCache$ = null;
      }),
      catchError((err) => {
        return throwError(err);
      }),
      finalize(() => this.isLoadingSubject.next(false))
    );
  }
}
