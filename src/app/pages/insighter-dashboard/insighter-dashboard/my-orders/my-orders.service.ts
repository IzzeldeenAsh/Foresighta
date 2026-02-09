import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { BehaviorSubject, Observable, catchError, finalize, map, throwError } from 'rxjs';
import { TranslationService } from 'src/app/modules/i18n';

export interface KnowledgeDocument {
  file_name: string;
  file_extension: string;
  price: number;
}

export interface Knowledge {
  type: string;
  title: string;
}

export interface MeetingBooking {
  date: string;
  start_time: string;
  end_time: string;
  status: string;
  status_name: string;
  title: string;
  description: string;
  insighter?: User;
}

export interface Orderable {
  knowledge: Knowledge[];
  knowledge_documents: KnowledgeDocument[][];
  knowledge_download_id: string;
  meeting_booking?: MeetingBooking;
  insighter?: User;
}

export interface PaymentInfo {
  method: string;
  provider: string | null;
  amount: number;
  currency: string;
  status: string;
  provider_payment_method_type: string | null;
  provider_card_last_number: string | null;
  provider_card_brand: string | null;
  provide_receipt_url: string | null;
  billing_address: string | {
    city?: string;
    country?: string;
    line1?: string;
    line2?: string;
    postal_code?: string;
    state?: string;
  };
  confirmed_at: string;
}

export interface Company {
  uuid: string;
  legal_name: string;
  logo: string;
  verified: boolean;
}

export interface User {
  name: string;
  email: string;
  first_name: string;
  last_name: string;
  /**
   * Added by API: e.g. "guest"
   */
  type?: string;
  profile_photo_url: string;
  roles: string[];
  uuid: string;
  country?: string;
  company?: Company;
}

export interface Order {
  uuid: string;
  service: string;
  status: string;
  amount: number;
  currency: string;
  date: string;
  order_no: string;
  user?: User;
  invoice_no: string;
  payment: PaymentInfo;
  knowledge_download_id: string;
  orderable: Orderable;
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

export interface OrdersResponse {
  data: Order[];
  links: PaginationLinks;
  meta: PaginationMeta;
}

export interface InsighterStatistics {
  orders_sold_amount: number;
  orders_purchased_amount: number;
  knowledge_sold_amount: number;
  meeting_sold_amount: number;
  knowledge_purchased_amount: number;
  meeting_purchased_amount: number;
}

export interface InsighterStatisticsResponse {
  data: InsighterStatistics;
}

@Injectable({
  providedIn: 'root'
})
export class MyOrdersService {
  private readonly API_URL = 'https://api.foresighta.co/api/account/order/knowledge';
  private readonly MEETING_API_URL = 'https://api.foresighta.co/api/account/order/meeting';
  private readonly COMPANY_KNOWLEDGE_API_URL = 'https://api.foresighta.co/api/company/order/knowledge';
  private readonly INSIGHTER_KNOWLEDGE_API_URL = 'https://api.foresighta.co/api/insighter/order/knowledge';
  private readonly COMPANY_MEETING_API_URL = 'https://api.foresighta.co/api/company/order/meeting';
  private readonly INSIGHTER_MEETING_API_URL = 'https://api.foresighta.co/api/insighter/order/meeting';
  private readonly INSIGHTER_STATISTICS_API_URL = 'https://api.foresighta.co/api/insighter/order/statistics';

  private isLoadingSubject = new BehaviorSubject<boolean>(false);
  public isLoading$ = this.isLoadingSubject.asObservable();
  
  private isMeetingLoadingSubject = new BehaviorSubject<boolean>(false);
  public isMeetingLoading$ = this.isMeetingLoadingSubject.asObservable();

  private isSalesLoadingSubject = new BehaviorSubject<boolean>(false);
  public isSalesLoading$ = this.isSalesLoadingSubject.asObservable();

  private isMeetingSalesLoadingSubject = new BehaviorSubject<boolean>(false);
  public isMeetingSalesLoading$ = this.isMeetingSalesLoadingSubject.asObservable();
  
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

  private setMeetingLoading(loading: boolean): void {
    this.isMeetingLoadingSubject.next(loading);
  }

  private setSalesLoading(loading: boolean): void {
    this.isSalesLoadingSubject.next(loading);
  }

  private setMeetingSalesLoading(loading: boolean): void {
    this.isMeetingSalesLoadingSubject.next(loading);
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
    console.error('MyOrdersService error:', error);
    return throwError(() => error);
  }

  getOrders(page: number = 1): Observable<OrdersResponse> {
    const url = `${this.API_URL}?page=${page}&per_page=5`;
    const headers = this.getHeaders();
    
    this.setLoading(true);
    return this.http.get<OrdersResponse>(url, { headers }).pipe(
      map((response) => response),
      catchError(error => this.handleError(error)),
      finalize(() => this.setLoading(false))
    );
  }

  getMeetingOrders(page: number = 1): Observable<OrdersResponse> {
    const url = `${this.MEETING_API_URL}?page=${page}&per_page=5`;
    const headers = this.getHeaders();
    
    this.setMeetingLoading(true);
    return this.http.get<OrdersResponse>(url, { headers }).pipe(
      map((response) => response),
      catchError(error => this.handleError(error)),
      finalize(() => this.setMeetingLoading(false))
    );
  }

  getSalesKnowledgeOrders(page: number = 1, role: 'company' | 'insighter', insighterUuid?: string): Observable<OrdersResponse> {
    const baseUrl = role === 'company' ? this.COMPANY_KNOWLEDGE_API_URL : this.INSIGHTER_KNOWLEDGE_API_URL;
    let url = `${baseUrl}?page=${page}&per_page=5`;

    if (insighterUuid) {
      url += `&insighter_uuid=${insighterUuid}`;
    }

    const headers = this.getHeaders();

    this.setSalesLoading(true);
    return this.http.get<OrdersResponse>(url, { headers }).pipe(
      map((response) => response),
      catchError(error => this.handleError(error)),
      finalize(() => this.setSalesLoading(false))
    );
  }

  getSalesMeetingOrders(page: number = 1, role: 'company' | 'insighter', insighterUuid?: string): Observable<OrdersResponse> {
    const baseUrl = role === 'company' ? this.COMPANY_MEETING_API_URL : this.INSIGHTER_MEETING_API_URL;
    let url = `${baseUrl}?page=${page}&per_page=5`;

    if (insighterUuid) {
      url += `&insighter_uuid=${insighterUuid}`;
    }

    const headers = this.getHeaders();

    this.setMeetingSalesLoading(true);
    return this.http.get<OrdersResponse>(url, { headers }).pipe(
      map((response) => response),
      catchError(error => this.handleError(error)),
      finalize(() => this.setMeetingSalesLoading(false))
    );
  }

  getInsighterStatistics(): Observable<InsighterStatisticsResponse> {
    const headers = this.getHeaders();

    return this.http.get<InsighterStatisticsResponse>(this.INSIGHTER_STATISTICS_API_URL, { headers }).pipe(
      map((response) => response),
      catchError(error => this.handleError(error))
    );
  }
}
