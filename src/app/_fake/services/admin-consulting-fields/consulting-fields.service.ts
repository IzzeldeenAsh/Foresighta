// conulting-fields.service.ts
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

export interface ConsultingField {
  id: number;
  name: string;
  names: {
    en: string;
    ar: string;
  };
}

@Injectable({
  providedIn: 'root',
})
export class ConsultingFieldsService {
  private apiUrl = 'https://api.insightabusiness.com/api/common/setting/consulting-field/list';
  private createApi = 'https://api.insightabusiness.com/api/admin/setting/consulting-field';
  private updateDeleteApi = 'https://api.insightabusiness.com/api/admin/setting/consulting-field';
  private isLoadingSubject = new BehaviorSubject<boolean>(false);
  public isLoading$: Observable<boolean> = this.isLoadingSubject.asObservable();
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

  private handleError(error: any) {
    return throwError(error);
  }

  // Fetch consulting fields data from the API
  getConsultingFields(): Observable<ConsultingField[]> {
    const headers = new HttpHeaders({
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'Accept-Language': this.currentLang,
    });

    this.setLoading(true);
    return this.http.get<any>(this.apiUrl, { headers }).pipe(
      map((res) => res.data as ConsultingField[]),
      catchError((error) => this.handleError(error)),
      finalize(() => this.setLoading(false))
    );
  }

  createConsultingField(consultingField: any): Observable<any> {
    const headers = new HttpHeaders({
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'Accept-Language': this.currentLang,
    });

    this.setLoading(true);
    return this.http.post<any>(this.createApi, consultingField, { headers }).pipe(
      map((res) => res),
      catchError((error) => this.handleError(error)),
      finalize(() => this.setLoading(false))
    );
  }

  updateConsultingField(
    consultingFieldId: number,
    updatedData: any
  ): Observable<ConsultingField> {
    const headers = new HttpHeaders({
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'Accept-Language': this.currentLang,
    });

    this.setLoading(true);
    return this.http
      .put<ConsultingField>(`${this.updateDeleteApi}/${consultingFieldId}`, updatedData, {
        headers,
      })
      .pipe(
        map((res) => res),
        catchError((error) => this.handleError(error)),
        finalize(() => this.setLoading(false))
      );
  }

  deleteConsultingField(consultingFieldId: number): Observable<any> {
    const headers = new HttpHeaders({
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'Accept-Language': this.currentLang,
    });

    this.setLoading(true);
    return this.http
      .delete<any>(`${this.updateDeleteApi}/${consultingFieldId}`, { headers })
      .pipe(
        map((res) => res),
        catchError((error) => this.handleError(error)),
        finalize(() => this.setLoading(false))
      );
  }
}
