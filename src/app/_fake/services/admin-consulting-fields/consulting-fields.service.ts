// consulting-fields.service.ts
import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';

import { BehaviorSubject, Observable, catchError, finalize, map, throwError } from 'rxjs';
import { TranslationService } from 'src/app/modules/i18n/translation.service';

export interface ConsultingField {
  id: number;
  code: string;
  isic_code_id: string;
  status: string;
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
  private apiUrl = 'https://api.4sighta.com/api/common/setting/department/list';
  private createApi = 'https://api.4sighta.com/api/admin/setting/consulting-field';
  private updateDeleteApi = 'https://api.4sighta.com/api/admin/setting/consulting-field';
  private isLoadingSubject = new BehaviorSubject<boolean>(false);
  public isLoading$: Observable<boolean> = this.isLoadingSubject.asObservable();
  currentLang: string = 'en';

  constructor(
    private http: HttpClient,
    private translationService: TranslationService
  ) {
    this.translationService.onLanguageChange().subscribe((lang) => {
      this.currentLang = lang;
    });
  }

  private setLoading(loading: boolean) {
    this.isLoadingSubject.next(loading);
  }

  private handleError(error: any) {
    console.log('Error from service', error.error.errors);

    let validationErrors: any[] = [];

    if (error.error.errors) {
      const errors = error.error.errors;
      for (const field in errors) {
        if (errors.hasOwnProperty(field)) {
          const errorMsgArray = errors[field];
          errorMsgArray.forEach((msg: string) => {
            validationErrors.push({ severity: 'error', summary: 'Validation Error', detail: msg });
          });
        }
      }
    }

    return throwError(() => ({
      validationMessages: validationErrors,
    }));
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
      .put<ConsultingField>(`${this.updateDeleteApi}/${consultingFieldId}`, updatedData, { headers })
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
