// src/app/services/certification.service.ts

import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, throwError, BehaviorSubject } from 'rxjs';
import { catchError, finalize, map } from 'rxjs/operators';
import { TranslationService } from 'src/app/modules/i18n/translation.service';

export interface Certification {
  id: number;
  name: string;
  url: string;
  type?: string;
}

@Injectable({
  providedIn: 'root'
})
export class InsighterAsCompany {
  private apiUrl = 'https://api.insightabusiness.com/api/account/insighter/individual/register-as-company'; // Base URL
  private isLoadingSubject = new BehaviorSubject<boolean>(false);
  public isLoading$ = this.isLoadingSubject.asObservable();
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
    // You can customize this method to handle different error scenarios
    return throwError(error);
  }

  // Delete Certification by ID
  postInsighterToCompany(formData: FormData): Observable<any> {
    const headers = new HttpHeaders({
      'Accept': 'application/json',
      'Accept-Language': this.currentLang
    });

    this.setLoading(true);
    return this.http
    .post(this.apiUrl, formData,{headers})
    .pipe(
        map(res => res),
        catchError(error => this.handleError(error)),
        finalize(() => this.setLoading(false))
    )
  }

  // Optionally, you can add methods to fetch, create, or update certifications
}
