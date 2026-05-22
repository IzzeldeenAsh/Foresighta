import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { BehaviorSubject, Observable, catchError, finalize, throwError } from 'rxjs';
import { TranslationService } from 'src/app/modules/i18n';

export interface Insighter {
  id: number;
  uuid: string;
  name: string;
  profile_photo_url: string;
}

export interface InsightersResponse {
  data: Insighter[];
}

@Injectable({
  providedIn: 'root'
})
export class InsightersService {
  private readonly API_URL = 'https://api.insightabusiness.com/api/company/insighter/list';

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
    console.error('InsightersService error:', error);
    return throwError(() => error);
  }

  getInsighters(): Observable<InsightersResponse> {
    const headers = this.getHeaders();

    this.setLoading(true);
    return this.http.get<InsightersResponse>(this.API_URL, { headers }).pipe(
      catchError(error => this.handleError(error)),
      finalize(() => this.setLoading(false))
    );
  }
}