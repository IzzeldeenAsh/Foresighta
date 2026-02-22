import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';

import {
  BehaviorSubject,
  Observable,
  catchError,
  finalize,
  map,
  throwError,
} from 'rxjs';
import { TranslationService } from 'src/app/modules/i18n/translation.service';

export interface HSCode {
  id: number;
  code: string;
  isic_code_id: number;
  status: string;
  name: string;
  names: {
    en: string;
    ar: string;
  };
}

export interface HSCodeResponse {
  data: HSCode[];
}

@Injectable({
  providedIn: 'root',
})
export class HSCodeService {
  private apiUrl = 'https://api.foresighta.co/api/common/setting/hs-code/list';
  private createApi = 'https://api.foresighta.co/api/admin/setting/hs-code';
  private updateDeleteApi = 'https://api.foresighta.co/api/admin/setting/hs-code';
  private isLoadingSubject = new BehaviorSubject<boolean>(false);
  public isLoading$: Observable<boolean> =
    this.isLoadingSubject.asObservable();
  currentLang: string = 'en';

  constructor(
    private http: HttpClient,
    private translationService: TranslationService
  ) {
    this.translationService.onLanguageChange().subscribe((lang) => {
      this.currentLang = lang || 'en';
    });
  }

  private setLoading(loading: boolean) {
    this.isLoadingSubject.next(loading);
  }

  // Custom handleError method
  private handleError(error: any) {
    return throwError(error);
  }

  // Fetch HSCode data from the API
  getHSCodes(): Observable<any> {
    const headers = new HttpHeaders({
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'Accept-Language': this.currentLang,
    });

    this.setLoading(true);
    return this.http.get<any>(this.apiUrl, { headers }).pipe(
      map((res) => res.data),
      catchError((error) => this.handleError(error)),
      finalize(() => this.setLoading(false))
    );
  }

  // Fetch HSCode data by ISIC code
  getHSCodeByISIC(isicCodeId: number,language:string): Observable<HSCode[]> {
    const headers = new HttpHeaders({
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'Accept-Language': language,
    });

    this.setLoading(true);
    return this.http
      .get<HSCodeResponse>(`https://api.foresighta.co/api/common/setting/hs-code/isic-code/${isicCodeId}`, { headers })
      .pipe(
        map((res) => res.data),
        catchError((error) => this.handleError(error)),
        finalize(() => this.setLoading(false))
      );
  }

  createHSCode(hscode: any): Observable<any> {
    const headers = new HttpHeaders({
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'Accept-Language': this.currentLang,
    });

    this.setLoading(true);
    return this.http.post<any>(this.createApi, hscode, { headers }).pipe(
      map((res) => res),
      catchError((error) => this.handleError(error)),
      finalize(() => this.setLoading(false))
    );
  }

  // Method to update an existing HSCode (PUT request)
  updateHSCode(
    hscodeId: number,
    updatedData: {
      name: { en: string; ar: string };
      code: string;
      isic_code_id: number;
      status: string;
    }
  ): Observable<HSCode> {
    const headers = new HttpHeaders({
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'Accept-Language': this.currentLang,
    });

    this.setLoading(true);
    return this.http
      .put<HSCode>(`${this.updateDeleteApi}/${hscodeId}`, updatedData, {
        headers,
      })
      .pipe(
        map((res) => res),
        catchError((error) => this.handleError(error)),
        finalize(() => this.setLoading(false))
      );
  }

  deleteHSCode(hscodeId: number): Observable<any> {
    const headers = new HttpHeaders({
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'Accept-Language': this.currentLang,
    });

    this.setLoading(true);
    return this.http
      .delete<any>(`${this.updateDeleteApi}/${hscodeId}`, { headers })
      .pipe(
        map((res) => res),
        catchError((error) => this.handleError(error)),
        finalize(() => this.setLoading(false))
      );
  }
}
