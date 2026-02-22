import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { BehaviorSubject, Observable, catchError, finalize, map, throwError } from 'rxjs';
import { TranslationService } from 'src/app/modules/i18n';

@Injectable({
  providedIn: 'root'
})
export class CommonService {
  private apiUrl = 'https://api.foresighta.co/api/common/setting';
  private isLoadingSubject = new BehaviorSubject<boolean>(false);
  public isLoading$: Observable<boolean> = this.isLoadingSubject.asObservable();
  currentLang: string = 'en';
  private companySectionSelected = new BehaviorSubject<boolean>(false);
  companySectionSelected$ = this.companySectionSelected.asObservable();

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
    console.error('API Error:', error);
    return throwError(() => error);
  }

  // Fetch guideline by type (current active version)
  getGuidelineByTypeCurrent(type: 'client_agreement' | 'insighter_agreement' | 'company_agreement'): Observable<any> {
    const headers = new HttpHeaders({
      'Accept': 'application/json',
      'Accept-Language': this.currentLang
    });
    this.setLoading(true);
    return this.http.get<any>(`${this.apiUrl}/guideline/type/current/${type}`, { headers }).pipe(
      map(response => response),
      catchError(error => this.handleError(error)),
      finalize(() => this.setLoading(false))
    );
  }

  // Fetch client agreement guidelines by slug
  getClientAgreement(slug: string): Observable<any> {
    const headers = new HttpHeaders({
      'Accept': 'application/json',
      'Accept-Language': this.currentLang
    });

    this.setLoading(true);
    return this.http.get<any>(`${this.apiUrl}/guideline/slug/${slug}`, { headers }).pipe(
      map(response => response),
      catchError(error => this.handleError(error)),
      finalize(() => this.setLoading(false))
    );
  }
  
  // Fetch insighter agreement for personal accounts
  getInsighterAgreement(): Observable<any> {
    return this.getGuidelineByTypeCurrent('insighter_agreement');
  }
  
  // Fetch company agreement for company accounts
  getCompanyAgreement(): Observable<any> {
    return this.getGuidelineByTypeCurrent('company_agreement');
  }
  
  // Get the appropriate agreement based on account type
  getAgreementByAccountType(accountType: string): Observable<any> {
    if (accountType === 'company') {
      return this.getCompanyAgreement();
    } else {
      return this.getInsighterAgreement(); // Default to insighter/personal
    }
  }
  getCompanySection() {
    this.companySectionSelected.next(true);
  }

  resetCompanySection() {
    this.companySectionSelected.next(false);
  }
} 