import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';
import { TranslationService } from 'src/app/modules/i18n';

export interface OrderStatistics {
  orders_total: number;
  orders_amount: number;
  company_orders_amount?: number;
  insighter_orders_amount?: number;
  platform_orders_amount?: number;
}

export interface KnowledgeOrderStatistics extends OrderStatistics {
  company_insighter_orders_statistics?: InsighterOrderStatistics[];
}

export interface MeetingOrderStatistics extends OrderStatistics {
  company_insighter_orders_statistics?: InsighterOrderStatistics[];
}

export interface InsighterOrderStatistics {
  uuid: string;
  insighter_name: string;
  total_orders: number;
  total_amount: number;
  total_insighter_amount: number;
}

export interface PeriodStatisticsData {
  order_statistics: { [key: string]: OrderStatistics };
  knowledge_order_statistics: { [key: string]: OrderStatistics };
  meeting_booking_order_statistics: { [key: string]: OrderStatistics };
  project_order_statistics: { [key: string]: OrderStatistics };
}

export interface TotalStatisticsData {
  order_statistics: OrderStatistics;
  knowledge_order_statistics: KnowledgeOrderStatistics;
  meeting_booking_order_statistics: MeetingOrderStatistics;
}

export interface PeriodStatisticsResponse {
  data: PeriodStatisticsData;
}

export interface TotalStatisticsResponse {
  data: TotalStatisticsData;
}

export type PeriodType = 'weekly' | 'monthly' | 'yearly';

@Injectable({
  providedIn: 'root'
})
export class SalesService {
  private currentLang = 'en';

  constructor(
    private http: HttpClient,
    private translationService: TranslationService
  ) {
    this.translationService.onLanguageChange().subscribe(lang => {
      this.currentLang = lang || 'en';
    });
  }

  private getHeaders(): HttpHeaders {
    return new HttpHeaders({
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Accept-Language': this.currentLang,
      'X-Timezone': Intl.DateTimeFormat().resolvedOptions().timeZone,
    });
  }

  getCompanyPeriodStatistics(perTime: PeriodType): Observable<PeriodStatisticsResponse> {
    const url = `${environment.apiBaseUrl}/company/dashboard/sales/revenue/period/statistics?per_time=${perTime}`;
    return this.http.get<PeriodStatisticsResponse>(url, { headers: this.getHeaders() });
  }

  getInsighterPeriodStatistics(perTime: PeriodType): Observable<PeriodStatisticsResponse> {
    const url = `${environment.apiBaseUrl}/insighter/dashboard/sales/revenue/period/statistics?per_time=${perTime}`;
    return this.http.get<PeriodStatisticsResponse>(url, { headers: this.getHeaders() });
  }

  getCompanyTotalStatistics(): Observable<TotalStatisticsResponse> {
    const url = `${environment.apiBaseUrl}/company/dashboard/sales/revenue/statistics`;
    return this.http.get<TotalStatisticsResponse>(url, { headers: this.getHeaders() });
  }

  getInsighterTotalStatistics(): Observable<TotalStatisticsResponse> {
    const url = `${environment.apiBaseUrl}/insighter/dashboard/sales/revenue/statistics`;
    return this.http.get<TotalStatisticsResponse>(url, { headers: this.getHeaders() });
  }

  getAdminTotalStatistics(): Observable<TotalStatisticsResponse> {
    const url = `${environment.apiBaseUrl}/admin/dashboard/sales/revenue/statistics`;
    return this.http.get<TotalStatisticsResponse>(url, { headers: this.getHeaders() });
  }

  getAdminPeriodStatistics(perTime: PeriodType): Observable<PeriodStatisticsResponse> {
    const url = `${environment.apiBaseUrl}/admin/dashboard/sales/revenue/period/statistics?per_time=${perTime}`;
    return this.http.get<PeriodStatisticsResponse>(url, { headers: this.getHeaders() });
  }
}