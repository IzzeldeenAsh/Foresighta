import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpErrorResponse } from '@angular/common/http';
import { BehaviorSubject, Observable, throwError } from 'rxjs';
import { catchError, finalize, map } from 'rxjs/operators';
import { TranslationService } from 'src/app/modules/i18n';
import { DocumentListResponse, DocumentUrlResponse, RawDocumentListResponse, Chapter } from '../add-insight-steps/add-insight-steps.service';

export interface Tag {
  id: number;
  name: string;
}

export interface Topic {
  id: number;
  name: string;
}

export interface Industry {
  id: number;
  name: string;
}

export interface IsicCode {
  id: number;
  key: number;
  name: string;
}

export interface Knowledge {
  id: number;
  type: "data" | "insight" | "report" | "manual" | "course" | "media"  | "statistic";
  title: string;
  slug: string;
  description: string;
  cover_start?: number | null;
  cover_end?: number | null;
  keywords: string[];
  tags: Tag[];
  topic: Topic;
  industry: Industry;
  isic_code: IsicCode;
  hs_code: any;
  language: string;
  total_price: string;
  package?:any[];
  status: string;
  regions: any[];
  countries: any[];
  economic_blocs: any[];
  published_at?: string;
  publish_as?: 'both' | 'package' | 'standalone';
  need_to_review?:boolean;
  account_manager_process: {
  need_to_review: boolean;
  action: string | null;
  request_id: number | null;
  request_status: string | null;
}
}

export interface KnowledgeResponse {
  data: Knowledge;
}

export interface PaginatedKnowledgeResponse {
  data: Knowledge[];
  links: {
    first: string;
    last: string;
    prev: string | null;
    next: string | null;
  };
  meta: {
    current_page: number;
    from: number;
    last_page: number;
    links: {
      url: string | null;
      label: string;
      active: boolean;
    }[];
    path: string;
    per_page: number;
    to: number;
    total: number;
  };
}

export interface ListKnowledgeResponse {
  data: Knowledge[];
}

export interface KnowledgeStatistics {
  published: number;
  scheduled: number;
  draft: number;
  total: number;
}

export interface KnowledgeTypeStatistic {
  type: "data" | "insight" | "report" | "manual" | "course" | "media" | "statistic";
  count: number;
}

export interface KnowledgeTypeStatisticsResponse {
  data: KnowledgeTypeStatistic[];
}

export interface KnowledgeStatusStatistic {
  status: string;
  count: number;
}

export interface KnowledgeStatusStatisticsResponse {
  data: KnowledgeStatusStatistic[];
}

@Injectable({
  providedIn: 'root'
})
export class KnowledgeService {
  private baseUrl = 'https://api.insightabusiness.com';
  private apiUrl = `${this.baseUrl}/api/insighter/library/knowledge`;
  private isLoadingSubject = new BehaviorSubject<boolean>(false);
  public isLoading$: Observable<boolean> = this.isLoadingSubject.asObservable();
  currentLang: string = 'en';

  constructor(
    private http: HttpClient,
    private translationService: TranslationService
  ) {
    this.currentLang = this.translationService.getSelectedLanguage();
    this.translationService.onLanguageChange().subscribe((lang) => {
      this.currentLang = lang || 'en';
    });
  }

  private setLoading(loading: boolean) {
    this.isLoadingSubject.next(loading);
  }

  private handleError(error: any) {
    return throwError(error);
  }

  getKnowledgeById(id: number): Observable<KnowledgeResponse> {
    const headers = new HttpHeaders({
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'Accept-Language': this.currentLang,
    });

    this.setLoading(true);
    return this.http.get<KnowledgeResponse>(
      `${this.baseUrl}/api/insighter/library/knowledge/${id}`,
      { headers }
    ).pipe(
      map((res) => res),
      catchError((error) => this.handleError(error)),
      finalize(() => this.setLoading(false))
    );
  }

  getPaginatedKnowledges(page: number = 1, status?: string, keyword?: string, type?: string): Observable<PaginatedKnowledgeResponse> {
    const headers = new HttpHeaders({
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'Accept-Language': this.currentLang,
    });

    let url = `${this.baseUrl}/api/insighter/library/knowledge?page=${page}`;
    if (status) {
      url += `&status=${status}`;
    }
    if (keyword) {
      url += `&keyword=${encodeURIComponent(keyword)}`;
    }
    if (type) {
      url += `&type=${encodeURIComponent(type)}`;
    }

    this.setLoading(true);
    return this.http.get<PaginatedKnowledgeResponse>(
      url,
      { headers }
    ).pipe(
      map((res) => res),
      catchError((error) => this.handleError(error)),
      finalize(() => this.setLoading(false))
    );
  }

  getListKnowledge(): Observable<ListKnowledgeResponse> {
    const headers = new HttpHeaders({
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'Accept-Language': this.currentLang,
    });

    this.setLoading(true);
    return this.http.get<ListKnowledgeResponse>(
      `${this.baseUrl}/api/insighter/library/knowledge/list`,
      { headers }
    ).pipe(
      map((res) => res),
      catchError((error) => this.handleError(error)),
      finalize(() => this.setLoading(false))
    );
  }

  getKnowledgeStatistics(): Observable<KnowledgeStatistics> {
    return this.getListKnowledge().pipe(
      map(response => {
        const knowledgeList = response.data;
        return {
          published: knowledgeList.filter(k => k.status === 'published').length,
          scheduled: knowledgeList.filter(k => k.status === 'scheduled').length,
          draft: knowledgeList.filter(k => k.status === 'unpublished').length,
          total: knowledgeList.length
        };
      })
    );
  }

  getKnowledgeTypeStatistics(): Observable<KnowledgeTypeStatisticsResponse> {
    const headers = new HttpHeaders({
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'Accept-Language': this.currentLang,
    });

    this.setLoading(true);
    return this.http.get<KnowledgeTypeStatisticsResponse>(
      `${this.baseUrl}/api/insighter/library/knowledge/statistics`,
      { headers }
    ).pipe(
      map((res) => res),
      catchError((error) => this.handleError(error)),
      finalize(() => this.setLoading(false))
    );
  }

  getKnowledgeStatusStatistics(): Observable<KnowledgeStatusStatisticsResponse> {
    const headers = new HttpHeaders({
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'Accept-Language': this.currentLang,
    });

    return this.http
      .get<KnowledgeStatusStatisticsResponse>(
        `${this.baseUrl}/api/insighter/library/knowledge/status/statistics`,
        { headers }
      )
      .pipe(
        map((res) => res),
        catchError((error) => this.handleError(error))
      );
  }

  deleteKnowledge(id: number): Observable<any> {
    const headers = new HttpHeaders({
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'Accept-Language': this.currentLang,
    });

    this.setLoading(true);
    return this.http.delete(
      `${this.baseUrl}/api/insighter/library/knowledge/${id}`,
      { headers }
    ).pipe(
      map((res) => res),
      catchError((error) => this.handleError(error)),
      finalize(() => this.setLoading(false))
    );
  }

  setKnowledgeStatus(id: number, status: string, publishedAt: string): Observable<any> {
    const headers = new HttpHeaders({
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'Accept-Language': this.currentLang,
    });

    const body = {
      status: status,
      published_at: publishedAt
    };

    this.setLoading(true);
    return this.http.put(
      `${this.baseUrl}/api/insighter/library/knowledge/status/${id}`,
      body,
      { headers }
    ).pipe(
      map((res) => res),
      catchError((error) => this.handleError(error)),
      finalize(() => this.setLoading(false))
    );
  }

  publishAs(id: number, publishAs: 'both' | 'package'): Observable<any> {
    const headers = new HttpHeaders({
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'Accept-Language': this.currentLang,
    });

    const body = {
      publish_as: publishAs
    };

    this.setLoading(true);
    return this.http.put(
      `${this.baseUrl}/api/insighter/library/knowledge/publish-as/${id}`,
      body,
      { headers }
    ).pipe(
      map((res) => res),
      catchError((error) => this.handleError(error)),
      finalize(() => this.setLoading(false))
    );
  }

  getListDocumentsInfo(knowledgeId: number): Observable<DocumentListResponse> {
    const headers = new HttpHeaders({
      Accept: "application/json",
      "Accept-Language": this.currentLang,
    });

    this.setLoading(true);
    return this.http
      .get<RawDocumentListResponse>(`${this.apiUrl}/document/list/${knowledgeId}`, {
        headers,
      })
      .pipe(
        map((res) => ({
          data: res.data.map(doc => ({
            ...doc,
            table_of_content: this.parseTableOfContent(doc.table_of_content)
          }))
        })),
        catchError((error) => this.handleError(error)),
        finalize(() => this.setLoading(false))
      );
  }

  private parseTableOfContent(toc: any): Chapter[] {
    try {
      // If it's already an array of chapters, return it
      if (Array.isArray(toc) && toc.every(item => item.chapter?.title)) {
        return toc;
      }

      // If it's a string, try to parse it
      if (typeof toc === 'string') {
        const parsed = JSON.parse(toc);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      }

      // If we get here, either the parse failed or the data isn't in the right format
      console.warn('Invalid table of content format:', toc);
      return [];
    } catch (e) {
      console.error('Error parsing table of content:', e);
      return [];
    }
  }

  getDocumentUrl(documentId: number): Observable<DocumentUrlResponse> {
    const headers = new HttpHeaders({
      Accept: "application/json",
      "Accept-Language": this.currentLang,
    });

    this.setLoading(true);
    return this.http
      .get<DocumentUrlResponse>(`${this.apiUrl}/document/download/${documentId}`, {
        headers,
      })
      .pipe(
        map((res) => res),
        catchError((error) => this.handleError(error)),
        finalize(() => this.setLoading(false))
      );
  }

  getReviewDocumentsList(knowledgeId: number): Observable<DocumentListResponse> {
    const headers = new HttpHeaders({
      Accept: "application/json",
      "Accept-Language": this.currentLang,
    });

    this.setLoading(true);
    return this.http
      .get<RawDocumentListResponse>(`${this.baseUrl}/api/company/library/knowledge/documents/${knowledgeId}`, {
        headers,
      })
      .pipe(
        map((res) => ({
          data: res.data.map(doc => ({
            ...doc,
            table_of_content: this.parseTableOfContent(doc.table_of_content)
          }))
        })),
        catchError((error) => this.handleError(error)),
        finalize(() => this.setLoading(false))
      );
  }
}
