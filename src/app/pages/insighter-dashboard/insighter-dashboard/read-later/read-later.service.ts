import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { BehaviorSubject, Observable, catchError, finalize, map, throwError } from 'rxjs';
import { TranslationService } from 'src/app/modules/i18n';

export interface Insighter {
  uuid: string;
  name: string;
  profile_photo_url: string | null;
  roles: string[];
  company?: Company;
}

export interface Company {
  uuid: string;
  legal_name: string;
  logo: string | null;
  verified: boolean;
}

export interface ReadLaterItem {
  slug: string;
  title: string;
  type: string;
  total_price: string;
  published_at: string;
  insighter: Insighter;
  company?: Company;
}

export interface PaginationLinks {
  first: string;
  last: string;
  prev: string | null;
  next: string | null;
}

export interface PaginationMeta {
  current_page: number;
  from: number;
  last_page: number;
  links: Array<{
    url: string | null;
    label: string;
    active: boolean;
  }>;
  path: string;
  per_page: number;
  to: number;
  total: number;
}

export interface ReadLaterResponse {
  data: ReadLaterItem[];
  links: PaginationLinks;
  meta: PaginationMeta;
}

@Injectable({
  providedIn: 'root'
})
export class ReadLaterService {
  private readonly API_URL = 'https://api.foresighta.co/api/account/favorite/knowledge';
  
  private isLoadingSubject = new BehaviorSubject<boolean>(false);
  public isLoading$ = this.isLoadingSubject.asObservable();
  private currentLang: string = 'en';

  constructor(
    private http: HttpClient,
    private translationService: TranslationService
  ) {
    this.currentLang = this.normalizeLanguage(this.translationService.getSelectedLanguage() || 'en');
    this.translationService.onLanguageChange().subscribe((lang) => {
      this.currentLang = this.normalizeLanguage(lang || 'en');
    });
  }

  private normalizeLanguage(lang: string): string {
    if (!lang) return 'en';
    
    const normalizedLang = lang.toLowerCase().split(/[-_,;]/)[0];
    return normalizedLang === 'ar' ? 'ar' : 'en';
  }

  private setLoading(loading: boolean): void {
    this.isLoadingSubject.next(loading);
  }

  private getHeaders(): HttpHeaders {
    return new HttpHeaders({
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Accept-Language': this.currentLang,
      'X-Timezone': Intl.DateTimeFormat().resolvedOptions().timeZone,
    });
  }

  private handleError(error: any): Observable<never> {
    console.error('ReadLaterService error:', error);
    return throwError(() => error);
  }

  getReadLaterItems(page: number = 1, filters?: { title?: string; type?: string }): Observable<ReadLaterResponse> {
    let url = `${this.API_URL}?page=${page}&per_page=10`;
    
    // Add filter parameters if provided
    if (filters) {
      if (filters.title && filters.title.trim()) {
        url += `&title=${encodeURIComponent(filters.title.trim())}`;
      }
      if (filters.type && filters.type.trim()) {
        url += `&type=${encodeURIComponent(filters.type.trim())}`;
      }
    }
    
    const headers = this.getHeaders();
    
    this.setLoading(true);
    return this.http.get<ReadLaterResponse>(url, { headers }).pipe(
      map((response) => response),
      catchError(error => this.handleError(error)),
      finalize(() => this.setLoading(false))
    );
  }

  deleteReadLaterItem(knowledgeSlug: string): Observable<any> {
    const url = `${this.API_URL}/${knowledgeSlug}`;
    const headers = this.getHeaders();
    
    this.setLoading(true);
    return this.http.delete(url, { headers }).pipe(
      catchError(error => this.handleError(error)),
      finalize(() => this.setLoading(false))
    );
  }
}