import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { BehaviorSubject, Observable, catchError, finalize, throwError, switchMap } from 'rxjs';
import { environment } from 'src/environments/environment';
import { TranslationService } from 'src/app/modules/i18n';
import { ProfileService } from 'src/app/_fake/services/get-profile/get-profile.service';

export interface OrderStatistics {
  orders_sold_amount: number;
  orders_purchased_amount: number;
  knowledge_sold_amount: number;
  meeting_sold_amount: number;
  knowledge_purchased_amount: number;
  meeting_purchased_amount: number;
}

export interface OrderStatisticsResponse {
  data: OrderStatistics;
}

@Injectable({
  providedIn: 'root'
})
export class OrderStatisticsService {
  private readonly API_URL = 'https://api.insightabusiness.com/api';
  private currentLang = 'en';
  private isLoadingSubject = new BehaviorSubject<boolean>(false);
  private statisticsSubject = new BehaviorSubject<OrderStatistics | null>(null);
  private hasLoadedStatistics = false;

  constructor(
    private http: HttpClient,
    private translationService: TranslationService,
    private profileService: ProfileService
  ) {
    this.translationService.onLanguageChange().subscribe(lang => {
      this.currentLang = lang || 'en';
    });
  }

  get isLoading$(): Observable<boolean> {
    return this.isLoadingSubject.asObservable();
  }

  get statistics$(): Observable<OrderStatistics | null> {
    if (!this.hasLoadedStatistics && !this.isLoadingSubject.value) {
      this.loadStatistics();
    }
    return this.statisticsSubject.asObservable();
  }

  private getHeaders(): HttpHeaders {
    return new HttpHeaders({
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Accept-Language': this.currentLang,
      'X-Timezone': Intl.DateTimeFormat().resolvedOptions().timeZone,
    });
  }

  getOrderStatistics(): Observable<OrderStatisticsResponse> {
    this.isLoadingSubject.next(true);

    return this.profileService.getProfile().pipe(
      switchMap(profile => {
        const roles = profile.roles || [];
        let endpoint = `${this.API_URL}/insighter/order/statistics`;

        if (roles.includes('company') ) {
          endpoint = `${this.API_URL}/company/order/statistics`;
        } else if (roles.includes('insighter') || roles.includes('company-insighter')) {
          endpoint = `${this.API_URL}/insighter/order/statistics`;
        }

        return this.http.get<OrderStatisticsResponse>(endpoint, {
          headers: this.getHeaders()
        }).pipe(
          catchError((error) => {
            this.isLoadingSubject.next(false);
            return throwError(() => error);
          }),
          finalize(() => {
            this.isLoadingSubject.next(false);
          })
        );
      })
    );
  }

  loadStatistics(): void {
    if (this.hasLoadedStatistics || this.isLoadingSubject.value) {
      return;
    }

    this.hasLoadedStatistics = true;
    this.getOrderStatistics().subscribe({
      next: (response) => {
        this.statisticsSubject.next(response.data);
      },
      error: (error) => {
        this.hasLoadedStatistics = false;
        console.error('Error loading order statistics:', error);
      }
    });
  }

  getCurrentStatistics(): OrderStatistics | null {
    return this.statisticsSubject.value;
  }
}