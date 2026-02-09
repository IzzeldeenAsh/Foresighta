import { Injectable } from "@angular/core";
import { HttpClient, HttpHeaders, HttpParams } from "@angular/common/http";
import { Observable, throwError } from "rxjs";
import { map, catchError } from "rxjs/operators";
import { TranslationService } from "src/app/modules/i18n";
import { Company } from "src/app/modules/admin-dashboard/services/transactions.service";

export interface WalletBalanceResponse {
  data: {
    balance: number;
  };
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
  date: string;
  start_time: string;
  end_time: string;
  status: string;
  status_name: string;
  title: string;
  description?: string;
}

export interface SubOrder {
  knowledge?: Knowledge[];
  knowledge_documents?: KnowledgeDocument[][];
  meeting_booking?: MeetingBooking;
}

export interface User {
  uuid: string;
  name: string;
  first_name: string;
  last_name: string;
  email?: string;
  profile_photo_url?: string | null;
  country_id?: number;
  roles: string[];
  company?: Company;
}

export interface Order {
  uuid: string;
  user?: User;
  service: string;
  status: string;
  date: string;
  order_no: string;
  invoice_no: string;
  amount?: number;
  insighter_profit_rate?: string;
  orderable?: SubOrder;
}

export interface Transaction {
  transaction: 'deposit' | 'withdraw';
  amount: number;
  date: string;
  type: string;
  type_key: string;
  order: Order;
}

export interface TransactionMeta {
  current_page: number;
  from: number;
  last_page: number;
  path: string;
  per_page: number;
  to: number;
  total: number;
  links: Array<{
    url: string | null;
    label: string;
    active: boolean;
  }>;
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

export interface TransactionListResponse {
  data: Transaction[];
}

export interface ChartDataPoint {
  date: string;
  deposits: number;
  balance: number;
  withdrawals: number;
}

export interface ChartDataResponse {
  data: ChartDataPoint[];
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

@Injectable({
  providedIn: "root",
})
export class WalletService {
  private readonly BASE_URL = "https://api.foresighta.co/api/account/wallet";
  currentLang: string = "";

  constructor(
    private http: HttpClient,
    private translateService: TranslationService
  ) {
    this.currentLang = this.translateService.getSelectedLanguage()
      ? this.translateService.getSelectedLanguage()
      : "en";
  }

  getWalletBalance(): Observable<WalletBalanceResponse> {
    const headers = new HttpHeaders({
      Accept: "application/json",
      "Accept-Language": this.currentLang,
      "X-Timezone": Intl.DateTimeFormat().resolvedOptions().timeZone,
    });

    return this.http.get<WalletBalanceResponse>(`${this.BASE_URL}/balance`, { headers }).pipe(
      catchError((err) => {
        console.error("Error fetching wallet balance:", err);
        return throwError(() => err);
      })
    );
  }

  getBalance(): Observable<number> {
    return this.getWalletBalance().pipe(
      map((response) => response.data.balance)
    );
  }

  getTransactions(page: number = 1, perPage: number = 10, period?: 'weekly' | 'monthly' | 'yearly'): Observable<TransactionResponse> {
    const headers = new HttpHeaders({
      Accept: "application/json",
      "Accept-Language": this.currentLang,
      "X-Timezone": Intl.DateTimeFormat().resolvedOptions().timeZone,
    });

    let params = new HttpParams()
      .set('page', page.toString())
      .set('per_page', perPage.toString());

    if (period) {
      params = params.set('per_time', period);
    }

    return this.http.get<TransactionResponse>(`${this.BASE_URL}/transaction`, { headers, params }).pipe(
      catchError((err) => {
        console.error("Error fetching transactions:", err);
        return throwError(() => err);
      })
    );
  }

  getStatistics(period: 'weekly' | 'monthly' | 'yearly' = 'monthly'): Observable<StatisticsResponse> {
    const headers = new HttpHeaders({
      Accept: "application/json",
      "Accept-Language": this.currentLang,
      "X-Timezone": Intl.DateTimeFormat().resolvedOptions().timeZone,
    });

    const params = new HttpParams()
      .set('per_time', period);

    return this.http.get<StatisticsResponse>(`${this.BASE_URL}/statistics`, { headers, params }).pipe(
      catchError((err) => {
        console.error("Error fetching statistics:", err);
        return throwError(() => err);
      })
    );
  }

  getChartData(period: 'weekly' | 'monthly' | 'yearly' = 'monthly'): Observable<ChartDataResponse> {
    return this.getStatistics(period).pipe(
      map((response) => {
        return this.convertStatisticsToChartData(response, period);
      }),
      catchError((err) => {
        console.error("Error fetching chart data:", err);
        return throwError(() => err);
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