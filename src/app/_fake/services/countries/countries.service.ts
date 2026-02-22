import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http'; 
import { BehaviorSubject, Observable, throwError, of } from 'rxjs';
import { catchError, finalize, map } from 'rxjs/operators';
import { TranslationService } from 'src/app/modules/i18n/translation.service';

export interface Country {
  id: number;
  region_id: number;
  iso2: string;
  iso3: string;
  nationality: string;
  nationalities: {
    en: string;
    ar: string;
  };
  international_code: string;
  flag: string;
  name: string;
  names: {
    en: string;
    ar: string;
  };
  status: string;
}

@Injectable({
  providedIn: 'root'
})
export class CountriesService {
  private apiUrl = 'https://api.insightabusiness.com/api/common/setting/country/list';
  private createApi = 'https://api.insightabusiness.com/api/admin/setting/country';
  private updateDeleteApi = 'https://api.insightabusiness.com/api/admin/setting/country';
  private isLoadingSubject = new BehaviorSubject<boolean>(false);
  public isLoading$: Observable<boolean> = this.isLoadingSubject.asObservable();
  currentLang: string = 'en';
  private authLocalStorageKey = 'foresighta-creds';

  constructor(
    private http: HttpClient,
    private translationService: TranslationService
  ) {
    this.translationService.onLanguageChange().subscribe(lang => {
      this.currentLang = lang || 'en';;
    });
  }

  private setLoading(loading: boolean) {
    this.isLoadingSubject.next(loading);
  }

  private handleError(error: any) {
    return throwError(error);
  }

  private getAuthToken(): string | null {
    try {
      // First try to get token from cookie (preferred method)
      if (typeof document !== 'undefined') {
        const cookies = document.cookie.split(';');
        for (let cookie of cookies) {
          const [name, value] = cookie.trim().split('=');
          if (name === 'token') {
            return value;
          }
        }
      }

      // Fallback to localStorage
      const authData = localStorage.getItem(this.authLocalStorageKey);
      if (authData) {
        const parsedData = JSON.parse(authData);
        return parsedData.authToken || null;
      }
    } catch (error) {
      console.error('Error parsing auth data from localStorage:', error);
    }
    return null;
  }

  getCountries(): Observable<Country[]> {
    const token = this.getAuthToken();

    console.log('[CountriesService] Starting getCountries call');
    console.log('[CountriesService] API URL:', this.apiUrl);
    console.log('[CountriesService] Token available:', !!token);
    console.log('[CountriesService] Token (first 20 chars):', token?.substring(0, 20));

    // Skip API call if we're on logout/auth pages
    if (typeof window !== 'undefined') {
      const currentPath = window.location.pathname;
      console.log('[CountriesService] Current path:', currentPath);
      if (currentPath.includes('/auth/logout') || currentPath.includes('/logout') || currentPath.includes('/auth/login')) {
        console.log('[CountriesService] Skipping countries fetch on auth/logout page');
        return of([]);
      }
    }

    // Check if we have authentication data
    if (!token) {
      console.error('[CountriesService] No token available - this might be the issue!');
      // Let's try without token first to see if the API requires it
    }

    const headers = new HttpHeaders({
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'Accept-Language': this.currentLang,
      'X-Timezone': Intl.DateTimeFormat().resolvedOptions().timeZone,
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    });

    console.log('[CountriesService] Headers:', headers.keys());

    this.setLoading(true);
    return this.http.get<any>(this.apiUrl, { headers }).pipe(
      map(res => {
        console.log('[CountriesService] Raw API response:', res);
        return res.data || res;
      }),
      catchError(error => {
        console.error('[CountriesService] API Error:', error);
        console.error('[CountriesService] Error status:', error.status);
        console.error('[CountriesService] Error message:', error.message);
        console.error('[CountriesService] Error body:', error.error);

        // Handle specific CORS/Network errors more gracefully
        if (error.status === 0) {
          console.error('[CountriesService] Network/CORS error detected');
        }
        return this.handleError(error);
      }),
      finalize(() => this.setLoading(false))
    );
  }

  createCountry(country: any): Observable<any> {
    const token = this.getAuthToken();
    const headers = new HttpHeaders({
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'Accept-Language': this.currentLang,
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    });

    this.setLoading(true);
    return this.http.post<any>(this.createApi, country, { headers }).pipe(
      map(res => res),
      catchError(error => this.handleError(error)),
      finalize(() => this.setLoading(false))
    );
  }

  updateCountry(countryId: number, updatedData: any): Observable<Country> {
    const token = this.getAuthToken();
    const headers = new HttpHeaders({
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'Accept-Language': this.currentLang,
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    });

    this.setLoading(true);
    return this.http.put<Country>(`${this.updateDeleteApi}/${countryId}`, updatedData, { headers }).pipe(
      map(res => res),
      catchError(error => this.handleError(error)),
      finalize(() => this.setLoading(false))
    );
  }

  deleteCountry(countryId: number): Observable<any> {
    const token = this.getAuthToken();
    const headers = new HttpHeaders({
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'Accept-Language': this.currentLang,
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    });

    this.setLoading(true);
    return this.http.delete<any>(`${this.updateDeleteApi}/${countryId}`, { headers }).pipe(
      map(res => res),
      catchError(error => this.handleError(error)),
      finalize(() => this.setLoading(false))
    );
  }
}
