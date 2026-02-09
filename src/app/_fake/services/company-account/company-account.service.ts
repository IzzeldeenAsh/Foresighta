import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { BehaviorSubject, Observable, throwError } from 'rxjs';
import { TranslationService } from 'src/app/modules/i18n/translation.service';
import { map, catchError, finalize } from 'rxjs/operators';

export interface AccountExistResponse {
  data?: {
    name: string;
    first_name: string;
    last_name: string;
    email: string;
  };
  message?: string;
  errors?: {
    common?: string[];
  };
}

export interface InsighterResponse {
  data: any[];
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

export interface CompanyInsighterStatistics {
  uuid: string;
  insighter_name: string;
  total_orders: number;
  total_amount: number;
  insighter_profit: number;
}

export interface CompanyOrderKnowledgeStatisticsResponse {
  data: {
    total_orders: number;
    total_amount: number;
    total_company_profit: number;
    insighters: CompanyInsighterStatistics[];
  };
}

export interface CompanyOrderMeetingStatisticsResponse {
  data: {
    total_orders: number;
    total_amount: number;
    total_company_profit: number;
    insighters: CompanyInsighterStatistics[];
  };
}

export interface DashboardStatisticsResponse {
  data: {
    knowledge_published_statistics: {
      total: number;
      type: {
        insight?: number;
        report?: number;
        manual?: number;
        data?: number;
        course?: number;
      };
      insighters: Array<{
        uuid: string;
        insighter_name: string;
        total_published: number;
        types: {
          insight?: number;
          report?: number;
          manual?: number;
          data?: number;
          course?: number;
        };
      }>;
    };
    meeting_booking_statistics: {
      total: number;
      insighters: Array<{
        uuid: string;
        insighter_name: string;
        meeting_booking_total: number;
      }>;
    };
  };
}

@Injectable({
  providedIn: 'root'
})
export class CompanyAccountService {
  private insightaHost = 'https://api.insightabusiness.com';
  private accountExistApi = `${this.insightaHost}/api/company/account/exist`;
  private inviteInsighterApi = `${this.insightaHost}/api/company/insighter`;
  private companyOrderKnowledgeStatisticsApi = `${this.insightaHost}/api/company/order/knowledge/statistics`;
  private companyOrderMeetingStatisticsApi = `${this.insightaHost}/api/company/order/meeting/statistics`;
  private dashboardStatisticsApi = `${this.insightaHost}/api/company/insighter/statistics`;

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

  private handleError(error: any) {
    return throwError(error);
  }

  // Check if an account exists
  checkAccountExist(email: string): Observable<AccountExistResponse> {
    const headers = new HttpHeaders({
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'Accept-Language': this.currentLang
    });

    this.setLoading(true);
    return this.http.post<AccountExistResponse>(this.accountExistApi, { email }, { headers }).pipe(
      map(res => res),
      catchError(error => this.handleError(error)),
      finalize(() => this.setLoading(false))
    );
  }

  // Get insighters with pagination
  getInsighters(page: number = 1, perPage: number = 10): Observable<InsighterResponse> {
    const headers = new HttpHeaders({
      'Accept': 'application/json',
      'Accept-Language': this.currentLang
    });

    let params = new HttpParams()
      .set('page', page.toString())
      .set('per_page', perPage.toString());

    this.setLoading(true);
    return this.http.get<InsighterResponse>(this.inviteInsighterApi, { headers, params }).pipe(
      map(res => res),
      catchError(error => this.handleError(error)),
      finalize(() => this.setLoading(false))
    );
  }

  // Invite insighter
  inviteInsighter(data: {
    email: string;
    first_name: string;
    last_name: string;
    country_id?: number;
    industries: string[];
    consulting_field: string[];
  }): Observable<any> {
    const headers = new HttpHeaders({
      'Accept': 'application/json',
      'Accept-Language': this.currentLang
    });

    const formData = new FormData();
    formData.append('email', data.email);
    formData.append('first_name', data.first_name);
    formData.append('last_name', data.last_name);
    
    // Add country_id if provided
    if (data.country_id) {
      formData.append('country_id', data.country_id.toString());
    }
    
    // Add industries as array
    if (data.industries && data.industries.length > 0) {
      data.industries.forEach(industry => {
        formData.append('industries[]', industry);
      });
    }
    
    // Add consulting fields as array
    if (data.consulting_field && data.consulting_field.length > 0) {
      data.consulting_field.forEach(field => {
        formData.append('consulting_field[]', field);
      });
    }

    this.setLoading(true);
    return this.http.post(this.inviteInsighterApi, formData, { headers }).pipe(
      map(res => res),
      catchError(error => this.handleError(error)),
      finalize(() => this.setLoading(false))
    );
  }

  // Activate insighter
  activateInsighter(id: number): Observable<any> {
    const headers = new HttpHeaders({
      'Accept': 'application/json',
      'Accept-Language': this.currentLang
    });

    this.setLoading(true);
    return this.http.put(`${this.inviteInsighterApi}/activate/${id}`, {}, { headers }).pipe(
      map(res => res),
      catchError(error => this.handleError(error)),
      finalize(() => this.setLoading(false))
    );
  }

  // Deactivate insighter
  deactivateInsighter(id: number): Observable<any> {
    const headers = new HttpHeaders({
      'Accept': 'application/json',
      'Accept-Language': this.currentLang
    });

    this.setLoading(true);
    return this.http.put(`${this.inviteInsighterApi}/deactivate/${id}`, {}, { headers }).pipe(
      map(res => res),
      catchError(error => this.handleError(error)),
      finalize(() => this.setLoading(false))
    );
  }

  // Delete insighter
  deleteInsighter(id: number): Observable<any> {
    const headers = new HttpHeaders({
      'Accept': 'application/json',
      'Accept-Language': this.currentLang
    });

    this.setLoading(true);
    return this.http.delete(`${this.inviteInsighterApi}/${id}`, { headers }).pipe(
      map(res => res),
      catchError(error => this.handleError(error)),
      finalize(() => this.setLoading(false))
    );
  }

  // Get insighter statistics by status
  getEmployeeStatusStatistics(): Observable<any> {
    this.setLoading(true);
    const headers = new HttpHeaders({
      'Accept': 'application/json',
      'Accept-Language': this.currentLang
    });

    return this.http.get<InsighterResponse>(this.inviteInsighterApi, { headers }).pipe(
      map(response => {
        // Aggregate insighters by status
        const statusCounts: { [key: string]: number } = {
          active: 0,
          pending: 0,
          inactive: 0
        };
        
        response.data.forEach(insighter => {
          const status = insighter.insighter_status as string;
          if (status in statusCounts) {
            statusCounts[status]++;
          }
        });
        
        // Format for chart
        return {
          data: [
            { type: 'active', count: statusCounts.active },
            { type: 'pending', count: statusCounts.pending },
            { type: 'inactive', count: statusCounts.inactive }
          ]
        };
      }),
      catchError(error => this.handleError(error)),
      finalize(() => this.setLoading(false))
    );
  }

  // Get employee knowledge statistics
  getEmployeeKnowledgeStatistics(): Observable<any> {
    this.setLoading(true);
    const headers = new HttpHeaders({
      'Accept': 'application/json',
      'Accept-Language': this.currentLang
    });

    return this.http.get<InsighterResponse>(this.inviteInsighterApi, { headers }).pipe(
      map(response => {
        // Extract insighters with their knowledge statistics
        const insightersWithKnowledge = response.data
          .filter(insighter => insighter.knowledge_type_statistics)
          .map(insighter => {
            const stats = insighter.knowledge_type_statistics || {};
            
            // Calculate total knowledge items
            const totalKnowledge = Object.values(stats).reduce(
              (sum: number, count: any) => sum + (typeof count === 'number' ? count : 0), 
              0
            );
            
            return {
              id: insighter.id,
              name: insighter.name,
              profile_photo_url: insighter.profile_photo_url,
              statistics: {
                report: stats.report || 0,
                data: stats.data || 0,
                insight: stats.insight || 0,
                manual: stats.manual || 0,
                course: stats.course || 0
              },
              totalKnowledge: totalKnowledge as number
            };
          })
          // Sort by total knowledge count in descending order
          .sort((a, b) => (b.totalKnowledge as number) - (a.totalKnowledge as number))
          // Take top contributors (limit to 10)
          .slice(0, 10);
        
        return {
          data: insightersWithKnowledge
        };
      }),
      catchError(error => this.handleError(error)),
      finalize(() => this.setLoading(false))
    );
  }

  getCompanyOrderKnowledgeStatistics(): Observable<CompanyOrderKnowledgeStatisticsResponse['data']> {
    this.setLoading(true);
    const headers = new HttpHeaders({
      'Accept': 'application/json',
      'Accept-Language': this.currentLang
    });

    return this.http.get<CompanyOrderKnowledgeStatisticsResponse>(this.companyOrderKnowledgeStatisticsApi, { headers }).pipe(
      map(response => {
        const insighters = (response?.data?.insighters ?? []).map((insighter): CompanyInsighterStatistics => ({
          uuid: insighter?.uuid ?? '',
          insighter_name: insighter?.insighter_name ?? '',
          total_orders: insighter?.total_orders ?? 0,
          total_amount: insighter?.total_amount ?? 0,
          insighter_profit: insighter?.insighter_profit ?? 0
        }));

        return {
          total_orders: response?.data?.total_orders ?? 0,
          total_amount: response?.data?.total_amount ?? 0,
          total_company_profit: response?.data?.total_company_profit ?? 0,
          insighters
        };
      }),
      catchError(error => this.handleError(error)),
      finalize(() => this.setLoading(false))
    );
  }

  getCompanyOrderMeetingStatistics(): Observable<CompanyOrderMeetingStatisticsResponse['data']> {
    this.setLoading(true);
    const headers = new HttpHeaders({
      'Accept': 'application/json',
      'Accept-Language': this.currentLang
    });

    return this.http.get<CompanyOrderMeetingStatisticsResponse>(this.companyOrderMeetingStatisticsApi, { headers }).pipe(
      map(response => {
        const insighters = (response?.data?.insighters ?? []).map((insighter): CompanyInsighterStatistics => ({
          uuid: insighter?.uuid ?? '',
          insighter_name: insighter?.insighter_name ?? '',
          total_orders: insighter?.total_orders ?? 0,
          total_amount: insighter?.total_amount ?? 0,
          insighter_profit: insighter?.insighter_profit ?? 0
        }));

        return {
          total_orders: response?.data?.total_orders ?? 0,
          total_amount: response?.data?.total_amount ?? 0,
          total_company_profit: response?.data?.total_company_profit ?? 0,
          insighters
        };
      }),
      catchError(error => this.handleError(error)),
      finalize(() => this.setLoading(false))
    );
  }

  getDashboardStatistics(): Observable<DashboardStatisticsResponse['data']> {
    this.setLoading(true);
    const headers = new HttpHeaders({
      'Accept': 'application/json',
      'Accept-Language': this.currentLang
    });

    return this.http.get<DashboardStatisticsResponse>(this.dashboardStatisticsApi, { headers }).pipe(
      map(response => response.data),
      catchError(error => this.handleError(error)),
      finalize(() => this.setLoading(false))
    );
  }
}
