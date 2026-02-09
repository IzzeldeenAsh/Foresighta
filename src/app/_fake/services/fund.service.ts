import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { BehaviorSubject, Observable, throwError } from 'rxjs';
import { catchError, finalize, map } from 'rxjs/operators';
import { TranslationService } from 'src/app/modules/i18n/translation.service';

export interface InsighterWallet {
  id: number;
  uuid: string;
  name: string;
  email: string;
  country: string;
  phone: string;
  profile_photo_url: string | null;
  balance: string;
  payment_type: string;
  last_wired_transfer: string | null;
  company?: {
    uuid: string;
    legal_name: string;
    logo: string;
    verified: boolean;
  };
}

export interface InsighterWalletDetails {
  user_name: string;
  user_email: string;
  user_balance: number;
  account_name: string | null;
  account_country: {
    id: number;
    name: string;
    flag: string;
  } | null;
  account_address: string | null;
  account_phone_code: string | null;
  account_phone: string | null;
  bank_name: string | null;
  bank_country: {
    id: number;
    name: string;
    flag: string;
  } | null;
  bank_address: string | null;
  bank_iban: string | null;
  bank_swift_code: string | null;
  status: string;
}

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
  title: string;
  date: string;
  start_time: string;
  end_time: string;
  status: string;
  status_name: string;
}

export interface SubOrder {
  knowledge?: Knowledge[];
  knowledge_documents?: KnowledgeDocument[][];
  meeting_booking?: MeetingBooking;
}

export interface Transaction {
  transaction: 'deposit' | 'withdraw';
  amount: number;
  date: string;
  type: string;
  type_key: string;
  order: {
    uuid: string;
    user?: {
      name: string;
      first_name: string;
      last_name: string;
      email: string;
      profile_photo_url: string | null;
      country_id: number | null;
      roles: string[];
    };
    service: string;
    status: string;
    date: string;
    order_no: string;
    invoice_no: string;
    orderable: SubOrder;
  };
}

export interface PaginatedResponse<T> {
  data: T[];
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
    links: any[];
    path: string;
    per_page: number;
    to: number;
    total: number;
  };
}

@Injectable({
  providedIn: 'root'
})
export class FundService {
  private baseUrl = 'https://api.foresighta.co/api/admin/fund';
  private isLoadingSubject = new BehaviorSubject<boolean>(false);
  public isLoading$: Observable<boolean> = this.isLoadingSubject.asObservable();
  currentLang: string = 'en';

  constructor(
    private http: HttpClient,
    private translationService: TranslationService
  ) {
    this.translationService.onLanguageChange().subscribe(lang => {
      this.currentLang = lang || 'en';
    });
  }

  private setLoading(loading: boolean) {
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

  private handleError(error: any) {
    return throwError(error);
  }

  getInsighterWallets(
    page: number = 1,
    overdueWiredTransaction?: number,
    balanceStatus?: string
  ): Observable<PaginatedResponse<InsighterWallet>> {
    const headers = this.getHeaders();
    this.setLoading(true);

    let url = `${this.baseUrl}/insighter?page=${page}&per_time=yearly`;

    if (overdueWiredTransaction !== undefined) {
      url += `&overdue_wired_transaction=${overdueWiredTransaction}`;
    }

    if (balanceStatus) {
      url += `&balance_status=${balanceStatus}`;
    }

    return this.http.get<PaginatedResponse<InsighterWallet>>(url, { headers }).pipe(
      catchError(error => this.handleError(error)),
      finalize(() => this.setLoading(false))
    );
  }

  getInsighterTransactions(insighterId: number, page: number = 1): Observable<PaginatedResponse<Transaction>> {
    const headers = this.getHeaders();
    this.setLoading(true);

    return this.http.get<PaginatedResponse<Transaction>>(`${this.baseUrl}/insighter/transaction/${insighterId}?page=${page}&per_time=yearly`, { headers }).pipe(
      catchError(error => this.handleError(error)),
      finalize(() => this.setLoading(false))
    );
  }

  getInsighterWalletDetails(insighterId: number): Observable<InsighterWalletDetails> {
    const headers = this.getHeaders();
    this.setLoading(true);

    return this.http.get<{data: InsighterWalletDetails[]}>(`${this.baseUrl}/insighter/payment/manual/${insighterId}`, { headers }).pipe(
      map(response => response.data[0]),
      catchError(error => this.handleError(error)),
      finalize(() => this.setLoading(false))
    );
  }

  sendTransferFormToEmail(insighterId: number, email: string): Observable<any> {
    const headers = this.getHeaders();
    this.setLoading(true);

    const body = { email };

    return this.http.post(`${this.baseUrl}/insighter/send/transfer-form-email/${insighterId}`, body, { headers }).pipe(
      catchError(error => this.handleError(error)),
      finalize(() => this.setLoading(false))
    );
  }
}