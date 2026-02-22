import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { BehaviorSubject, Observable, throwError } from 'rxjs';
import { catchError, finalize, map } from 'rxjs/operators';
import { TranslationService } from 'src/app/modules/i18n';

export interface EconomicBloc {
  id: number;
  name: string;
  countries: {
    id: number;
    name: string;
    flag: string;
  }[];
}

export interface AdminEconomicBloc {
  id: number;
  name: string;
  names: {
    en: string;
    ar: string;
  };
}

export interface AdminEconomicBlocResponse {
  data: AdminEconomicBloc[];
  path: string;
  per_page: number;
  to: number;
  total: number;
}

@Injectable({
  providedIn: 'root'
})
export class EconomicBlockService {
  private apiUrl = 'https://api.insightabusiness.com/api/common/setting/economic-bloc/list';
  private adminApiUrl = 'https://api.insightabusiness.com/api/admin/setting/economic-bloc';
  private createApi = 'https://api.insightabusiness.com/api/admin/setting/economic-bloc';
  private updateDeleteApi = 'https://api.insightabusiness.com/api/admin/setting/economic-bloc';
  private isLoadingSubject = new BehaviorSubject<boolean>(false);
  public isLoading$: Observable<boolean> = this.isLoadingSubject.asObservable();
  currentLang: string = 'en';

  constructor(
    private http: HttpClient,
    private translationService: TranslationService
  ) {
    this.currentLang = this.translationService.getSelectedLanguage();
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

  getEconomicBlocs(): Observable<EconomicBloc[]> {
    const headers = new HttpHeaders({
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'Accept-Language': this.currentLang
    });

    this.setLoading(true);
    return this.http.get<any>(this.apiUrl, { headers }).pipe(
      map(res => res.data),
      catchError(error => this.handleError(error)),
      finalize(() => this.setLoading(false))
    );
  }

  getAdminEconomicBlocs(): Observable<AdminEconomicBlocResponse> {
    const headers = new HttpHeaders({
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'Accept-Language': this.currentLang
    });

    this.setLoading(true);
    return this.http.get<AdminEconomicBlocResponse>(this.adminApiUrl, { headers }).pipe(
      catchError(error => this.handleError(error)),
      finalize(() => this.setLoading(false))
    );
  }

  createEconomicBloc(bloc: { name: { en: string; ar: string } }): Observable<any> {
    const headers = new HttpHeaders({
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'Accept-Language': this.currentLang
    });

    this.setLoading(true);
    return this.http.post<any>(this.createApi, bloc, { headers }).pipe(
      map(res => res),
      catchError(error => this.handleError(error)),
      finalize(() => this.setLoading(false))
    );
  }

  updateEconomicBloc(blocId: number, bloc: { name: { en: string; ar: string } }): Observable<any> {
    const headers = new HttpHeaders({
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'Accept-Language': this.currentLang
    });

    this.setLoading(true);
    return this.http.put<any>(`${this.updateDeleteApi}/${blocId}`, bloc, { headers }).pipe(
      map(res => res),
      catchError(error => this.handleError(error)),
      finalize(() => this.setLoading(false))
    );
  }

  deleteEconomicBloc(blocId: number): Observable<any> {
    const headers = new HttpHeaders({
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'Accept-Language': this.currentLang
    });

    this.setLoading(true);
    return this.http.delete<any>(`${this.updateDeleteApi}/${blocId}`, { headers }).pipe(
      map(res => res),
      catchError(error => this.handleError(error)),
      finalize(() => this.setLoading(false))
    );
  }
}
