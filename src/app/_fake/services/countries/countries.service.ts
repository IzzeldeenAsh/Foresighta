import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http'; 
import { BehaviorSubject, Observable, throwError } from 'rxjs';
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
  private apiUrl = 'https://api.knoldg.com/api/common/setting/country/list';
  private createApi = 'https://api.knoldg.com/api/admin/setting/country';
  private updateDeleteApi = 'https://api.knoldg.com/api/admin/setting/country';
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
    const headers = new HttpHeaders({
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'Accept-Language': this.currentLang,
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    });
  
    this.setLoading(true);
    return this.http.get<any>(this.apiUrl, { headers }).pipe(
      map(res => res.data),
      catchError(error => this.handleError(error)),
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
