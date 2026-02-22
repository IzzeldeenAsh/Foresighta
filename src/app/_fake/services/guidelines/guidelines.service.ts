// guidelines.service.ts

import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import {
  BehaviorSubject,
  Observable,
  catchError,
  finalize,
  throwError,
  map,
} from 'rxjs';
import { TranslationService } from 'src/app/modules/i18n/translation.service';

export interface Guideline {
  id: number;
  name: string;
  names: {
    en: string;
    ar: string;
  };
  guideline: string;
  guidelines: {
    en: string;
    ar: string;
  };
  slug: string;
  version: string;
  file?: {
    en: File | null;
    ar: File | null;
  };
}

export interface GuidelineDetail {
  uuid: string;
  name: string;
  guideline: string;
  version: string;
  file: any;
  apply_at?: string;
}

export interface GuidelineDetailResponse {
  data: GuidelineDetail;
}

export interface GuidelineResponse {
  data: Guideline[];
}

export interface GuidelineType {
  value: string;
  label: string;
}

@Injectable({
  providedIn: 'root',
})
export class GuidelinesService {
  private apiUrl = 'https://api.foresighta.co/api/common/setting/guideline/list';
  private createUpdateApi = 'https://api.foresighta.co/api/admin/setting/guideline';
  private isLoadingSubject = new BehaviorSubject<boolean>(false);
  public isLoading$: Observable<boolean> = this.isLoadingSubject.asObservable();
  currentLang: string = 'en';
  constructor(private http: HttpClient,private translationService: TranslationService) {
    this.currentLang = this.translationService.getSelectedLanguage();
    this.translationService.onLanguageChange().subscribe((lang) => {
      this.currentLang = lang || 'en';
    });
  }

  private setLoading(loading: boolean): void {
    this.isLoadingSubject.next(loading);
  }

  private handleError(error: any): Observable<never> {
    console.error('An error occurred:', error);
    return throwError(() => new Error('Something went wrong; please try again later.'));
  }

  getGuidelines(): Observable<Guideline[]> {
    const headers = new HttpHeaders({
      'Accept': 'application/json',
      'Accept-Language': this.currentLang
    });
    this.setLoading(true);
    return this.http.get<GuidelineResponse>(this.apiUrl, { headers }).pipe(
      map((res) => res.data),
      catchError(this.handleError),
      finalize(() => this.setLoading(false))
    );
  }

  createOrUpdateGuideline(guidelineData: FormData, id?: number): Observable<any> {
    const headers = new HttpHeaders({
      'Accept': 'application/json',
      'Accept-Language': this.currentLang
    });
    const apiUrl = id ? `${this.createUpdateApi}/${id}` : this.createUpdateApi;
    this.setLoading(true);
    return this.http.post(apiUrl, guidelineData, { headers }).pipe(
      catchError(this.handleError),
      finalize(() => this.setLoading(false))
    );
  }

  deleteGuideline(id: number): Observable<any> {
    const headers = new HttpHeaders({
      'Accept': 'application/json',
        'Accept-Language': this.currentLang
    });
    const apiUrl = `${this.createUpdateApi}/${id}`;
    this.setLoading(true);
    return this.http.delete(apiUrl, { headers }).pipe(
      catchError(this.handleError),
      finalize(() => this.setLoading(false))
    );
  }

  getGuidelineTypes(): Observable<GuidelineType[]> {
    const headers = new HttpHeaders({
      'Accept': 'application/json',
      'Accept-Language': this.currentLang
    });
    const apiUrl = 'https://api.foresighta.co/api/common/setting/guideline/type';
    this.setLoading(true);
    return this.http.get<GuidelineType[]>(apiUrl, { headers }).pipe(
      catchError(this.handleError),
      finalize(() => this.setLoading(false))
    );
  }

  getCurrentGuidelineByType(type: string): Observable<GuidelineDetail> {
    const headers = new HttpHeaders({
      'Accept': 'application/json',
      'Accept-Language': this.currentLang
    });
    const apiUrl = `https://api.foresighta.co/api/common/setting/guideline/type/current/${type}`;
    this.setLoading(true);
    return this.http.get<GuidelineDetailResponse>(apiUrl, { headers }).pipe(
      map((res) => res.data),
      catchError(this.handleError),
      finalize(() => this.setLoading(false))
    );
  }

  getLastGuidelineByType(type: string): Observable<GuidelineDetail> {
    const headers = new HttpHeaders({
      'Accept': 'application/json',
      'Accept-Language': this.currentLang
    });
    const apiUrl = `https://api.foresighta.co/api/common/setting/guideline/type/last/${type}`;
    this.setLoading(true);
    return this.http.get<GuidelineDetailResponse>(apiUrl, { headers }).pipe(
      map((res) => res.data),
      catchError(this.handleError),
      finalize(() => this.setLoading(false))
    );
  }
}
