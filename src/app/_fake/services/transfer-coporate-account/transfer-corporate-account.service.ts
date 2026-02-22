import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { BehaviorSubject, Observable, catchError, finalize, map, throwError } from 'rxjs';
import { TranslationService } from 'src/app/modules/i18n/translation.service';

@Injectable({
  providedIn: 'root'
})
export class TransferCorporateAccountService {
  private apiUrl = 'https://api.foresighta.co/api/company/transfer/account/invitation';
  private isLoadingSubject = new BehaviorSubject<boolean>(false);
  private searchInsighterUrl = 'https://api.foresighta.co/api/insighter/search/insighter';
  public isLoading$: Observable<boolean> = this.isLoadingSubject.asObservable();
  currentLang: string = "en";

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

  sendTransferInvitation(email: string,lang:string): Observable<any> {
    const headers = new HttpHeaders({
      'Accept': 'application/json',
      'Accept-Language': lang
    });

    const formData = new FormData();
    formData.append('email', email);

    this.setLoading(true);
    return this.http.post<any>(this.apiUrl, formData, { headers }).pipe(
      map((res) => res),
      catchError((error) => this.handleError(error)),
      finalize(() => this.setLoading(false))
    );
  }
  verifyTransferInvitation(email: string, code: string, lang: string): Observable<any> {
    const headers = new HttpHeaders({
      'Accept': 'application/json',
      'Accept-Language': lang
    });
  
    const formData = new FormData();
    formData.append('email', email);
    formData.append('code', code);
  
    this.setLoading(true);
    return this.http.post<any>('https://api.foresighta.co/api/company/transfer/account/verification', formData, { headers }).pipe(
      map((res) => res),
      catchError((error) => this.handleError(error)), 
      finalize(() => this.setLoading(false))
    );
  }

  searchInsighters(keyword: string, lang: string = 'en'): Observable<any[]> {
    
    const headers = new HttpHeaders({
      'Accept-Language': lang
    });
    const params = { keyword };
    return this.http.get<any[]>(this.searchInsighterUrl, { headers, params });
  }
  
}
