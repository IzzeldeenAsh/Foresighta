import { Injectable } from '@angular/core';
import { HttpClient, HttpParams, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../../environments/environment';
import { TranslationService } from '../../../modules/i18n';

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
}

export interface Suborder {
  knowledge?: Knowledge[];
  knowledge_documents?: KnowledgeDocument[][];
  meeting_booking?: MeetingBooking;
}

export interface User {
  name: string;
  first_name: string;
  last_name: string;
  email: string;
  profile_photo_url: string | null;
  country_id: number;
  roles: string[];
}

export interface Order {
  uuid: string;
  user: User;
  service: string;
  status: string;
  date: string;
  order_no: string;
  invoice_no: string;
  orderable: Suborder;
}

export interface Company {
  uuid: string;
  legal_name: string;
  logo: string;
  verified: boolean;
}

export interface Insighter {
  uuid: string;
  name: string;
  profile_photo_url: string | null;
  roles: string[];
  company: Company | null;
}

export interface Transaction {
  transaction: string;
  amount: number;
  date: string;
  type: string;
  type_key: string;
  provider_fee: string;
  net_amount: string;
  order: Order;
  insighter?: Insighter;
}

export interface TransactionLink {
  url: string | null;
  label: string;
  active: boolean;
}

export interface TransactionMeta {
  current_page: number;
  from: number;
  last_page: number;
  links: TransactionLink[];
  path: string;
  per_page: number;
  to: number;
  total: number;
}

export interface TransactionResponse {
  data: Transaction[];
  links: {
    first: string;
    last: string;
    prev: string | null;
    next: string | null;
  };
  meta: TransactionMeta;
}

export interface PlatformBalanceResponse {
  data: {
    balance: number;
    provider_fee: number;
    net_amount: number;
  };
}

export interface PlatformTransactionListResponse {
  data: Transaction[];
}

export interface ChartDataPoint {
  date: string;
  deposits: number;
  withdrawals: number;
  balance: number;
}

export interface StatisticsData {
  deposit: number;
  withdraw: number;
}

export interface StatisticsResponse {
  data: {
    weekly?: { [key: string]: StatisticsData };
    monthly?: { [key: string]: StatisticsData };
    yearly?: { [key: string]: StatisticsData };
  };
}

export interface ChartDataResponse {
  data: ChartDataPoint[];
}

@Injectable({
  providedIn: 'root'
})
export class TransactionsService {
  private apiUrl = `${environment.apiBaseUrl}/admin/fund/platform/transaction`;
  private balanceApiUrl = `${environment.apiBaseUrl}/admin/fund/platform/balance`;
  private listApiUrl = `${environment.apiBaseUrl}/admin/fund/platform/transaction/list`;
  private statisticsApiUrl = `${environment.apiBaseUrl}/admin/fund/platform/statistics`;
  private authLocalStorageKey = 'foresighta-creds';
  private currentLang = 'en';

  constructor(
    private http: HttpClient,
    private translationService: TranslationService
  ) {
    this.currentLang = this.translationService.getSelectedLanguage() || 'en';
    this.translationService.onLanguageChange().subscribe((lang: string) => {
      this.currentLang = lang || 'en';
    });
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

  private getHeaders(): HttpHeaders {
    const token = this.getAuthToken();
    return new HttpHeaders({
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Accept-Language': this.currentLang,
      'X-Timezone': Intl.DateTimeFormat().resolvedOptions().timeZone,
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    });
  }

  getTransactions(page: number = 1, perPage: number = 10, perTime?: 'weekly' | 'monthly' | 'yearly'): Observable<TransactionResponse> {
    let params = new HttpParams()
      .set('page', page.toString())
      .set('per_page', perPage.toString());

    if (perTime) {
      params = params.set('per_time', perTime);
    }

    const headers = this.getHeaders();

    return this.http.get<TransactionResponse>(this.apiUrl, { params, headers });
  }

  getPlatformBalance(): Observable<PlatformBalanceResponse> {
    const headers = this.getHeaders();
    return this.http.get<PlatformBalanceResponse>(this.balanceApiUrl, { headers });
  }

  getAllPlatformTransactions(perTime?: 'weekly' | 'monthly' | 'yearly'): Observable<PlatformTransactionListResponse> {
    let params = new HttpParams();

    if (perTime) {
      params = params.set('per_time', perTime);
    }

    const headers = this.getHeaders();
    return this.http.get<PlatformTransactionListResponse>(this.listApiUrl, { params, headers });
  }

  getStatistics(period: 'weekly' | 'monthly' | 'yearly' = 'monthly'): Observable<StatisticsResponse> {
    const params = new HttpParams().set('per_time', period);
    const headers = this.getHeaders();
    return this.http.get<StatisticsResponse>(this.statisticsApiUrl, { params, headers });
  }

  getChartData(period: 'weekly' | 'monthly' | 'yearly' = 'monthly'): Observable<ChartDataResponse> {
    return this.getStatistics(period).pipe(
      map((response: StatisticsResponse) => {
        return this.convertStatisticsToChartData(response, period);
      })
    );
  }

  private convertStatisticsToChartData(response: StatisticsResponse, period: 'weekly' | 'monthly' | 'yearly'): ChartDataResponse {
    const chartData: ChartDataPoint[] = [];
    const data = response.data;

    if (period === 'weekly' && data.weekly) {
      const weekOrder = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
      weekOrder.forEach(day => {
        const dayData = data.weekly![day];
        if (dayData) {
          chartData.push({
            date: day,
            deposits: Math.abs(dayData.deposit),
            withdrawals: Math.abs(dayData.withdraw),
            balance: 0 // Not used in current chart implementation
          });
        }
      });
    } else if (period === 'monthly' && data.monthly) {
      const monthOrder = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      monthOrder.forEach(month => {
        const monthData = data.monthly![month];
        if (monthData) {
          chartData.push({
            date: month,
            deposits: Math.abs(monthData.deposit),
            withdrawals: Math.abs(monthData.withdraw),
            balance: 0 // Not used in current chart implementation
          });
        }
      });
    } else if (period === 'yearly' && data.yearly) {
      Object.keys(data.yearly).forEach(year => {
        const yearData = data.yearly![year];
        chartData.push({
          date: year,
          deposits: Math.abs(yearData.deposit),
          withdrawals: Math.abs(yearData.withdraw),
          balance: 0 // Not used in current chart implementation
        });
      });
    }

    return { data: chartData };
  }
}