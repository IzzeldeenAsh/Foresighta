
import { BehaviorSubject, Observable, catchError, finalize, map, throwError } from 'rxjs';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { TranslationService } from 'src/app/modules/i18n';
import { Injectable } from '@angular/core';

// Types & Interfaces
export interface Document {
  uuid: string;
  file_name: string;
  price: number;
  file_extension: string;
  file_size: number;
  download_at?: string | null;
}

export interface Company {
  uuid: string;
  legal_name: string;
  logo: string;
  verified: boolean;
}

export interface KnowledgeItem {
  uuid: string;
  knowledge_slug: string;
  title: string;
  type: string;
  insighter: string;
  insighter_uuid: string;
  insighter_photo: string | null;
  purchase_date: string;
  documents: Document[];
  company: Company | null;
  download_at?: string | null;
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

export interface MyDownloadsResponse {
  data: KnowledgeItem[];
  links: PaginationLinks;
  meta: PaginationMeta;
}

export interface LibraryStatistics {
  total: number;
  archived: number;
}

@Injectable({
  providedIn: 'root'
})
export class MyDownloadsService {
  private readonly API_URL = 'https://api.insightabusiness.com/api/account/library/my-knowledge';
  private readonly STATISTICS_URL = 'https://api.insightabusiness.com/api/account/library/my-knowledge/statistics';
  private readonly DOWNLOAD_KNOWLEDGE_URL = 'https://api.insightabusiness.com/api/account/library/my-knowledge/download';
  private readonly DOWNLOAD_DOCUMENT_URL = 'https://api.insightabusiness.com/api/account/library/my-knowledge/document/download';
  
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

  /**
   * Normalize language to only 'ar' or 'en'
   * This prevents sending browser locale formats like 'en_US' or 'ar_EG'
   */
  private normalizeLanguage(lang: string): string {
    if (!lang) return 'en';
    
    // Convert to lowercase and extract language code
    const normalizedLang = lang.toLowerCase().split(/[-_,;]/)[0];
    
    // Only allow 'ar' or 'en', default to 'en' for anything else
    return normalizedLang === 'ar' ? 'ar' : 'en';
  }

  private setLoading(loading: boolean): void {
    this.isLoadingSubject.next(loading);
  }

  private getHeaders(): HttpHeaders {
    return new HttpHeaders({
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'Accept-Language': this.currentLang,
    });
  }

  private handleError(error: any): Observable<never> {
    console.error('MyDownloadsService error:', error);
    return throwError(() => error);
  }

  getMyDownloads(page: number = 1, title?: string, uuids?: string[]): Observable<MyDownloadsResponse> {
    let url = `${this.API_URL}?page=${page}&per_page=10`;
    
    // Add title query parameter if provided
    if (title && title.trim()) {
      url += `&title=${encodeURIComponent(title.trim())}`;
    }
    
    const headers = this.getHeaders();
    
    // Create request body if UUIDs are provided
    const body = uuids && uuids.length > 0 ? { uuids } : null;
    
    this.setLoading(true);
    
    // Use POST if body exists, otherwise GET
    return this.http.post<MyDownloadsResponse>(url, body, { headers }).pipe(
      map((response) => response),
      catchError(error => this.handleError(error)),
      finalize(() => this.setLoading(false))
    );
  }

  downloadKnowledge(knowledgeUUID: string): Observable<Blob> {
    const url = `${this.DOWNLOAD_KNOWLEDGE_URL}/${knowledgeUUID}`;
    const headers = this.getHeaders();
    
    return this.http.post(url, {}, {
      headers,
      responseType: 'blob' as 'json'
    }).pipe(
      map(response => response as Blob),
      catchError(error => this.handleError(error)),
    );
  }

  downloadDocument(documentUuid: string): Observable<{url: string}> {
    const url = `${this.DOWNLOAD_DOCUMENT_URL}/${documentUuid}`;
    const headers = this.getHeaders();

    return this.http.post<{data: {url: string}}>(url, {}, { headers }).pipe(
      map(response => ({ url: response.data.url })),
      catchError(error => this.handleError(error)),
    );
  }

  // Archive knowledge item
  archiveKnowledge(knowledgeUuid: string): Observable<any> {
    const url = `${this.API_URL}/archive/${knowledgeUuid}`;
    const headers = this.getHeaders();

    this.setLoading(true);
    return this.http.post(url, {}, { headers }).pipe(
      map(response => response),
      catchError(error => this.handleError(error)),
      finalize(() => this.setLoading(false))
    );
  }

  // Get archived downloads
  getArchivedDownloads(page: number = 1, title?: string, uuids?: string[]): Observable<MyDownloadsResponse> {
    let url = `${this.API_URL}?page=${page}&per_page=10&archived=true`;

    // Add title query parameter if provided
    if (title && title.trim()) {
      url += `&title=${encodeURIComponent(title.trim())}`;
    }

    const headers = this.getHeaders();

    // Create request body if UUIDs are provided
    const body = uuids && uuids.length > 0 ? { uuids } : null;

    this.setLoading(true);

    // Use POST if body exists, otherwise GET
    return this.http.post<MyDownloadsResponse>(url, body, { headers }).pipe(
      map((response) => response),
      catchError(error => this.handleError(error)),
      finalize(() => this.setLoading(false))
    );
  }

  // Get library statistics
  getLibraryStatistics(): Observable<LibraryStatistics> {
    const headers = this.getHeaders();

    return this.http.get<{data: LibraryStatistics}>(this.STATISTICS_URL, { headers }).pipe(
      map((response) => response.data),
      catchError(error => this.handleError(error))
    );
  }
}
