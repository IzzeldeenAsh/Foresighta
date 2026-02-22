// src/app/services/documents.service.ts

import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { BehaviorSubject, Observable, throwError, of } from 'rxjs';
import { catchError, finalize, map } from 'rxjs/operators';
import { TranslationService } from 'src/app/modules/i18n/translation.service';

export interface Document {
  id: string;
  name: string;
}

export interface DocumentResponse {
  data: Document[];
}

@Injectable({
  providedIn: 'root'
})
export class DocumentsService {
  private apiUrl = 'https://api.foresighta.co/api/common/setting/insighter/document-type/list';
  private isLoadingSubject = new BehaviorSubject<boolean>(false);
  public isLoading$: Observable<boolean> = this.isLoadingSubject.asObservable();
  currentLang: string = "en";
  private documentTypes$: Observable<Document[]>;

  constructor(
    private http: HttpClient,
    private translationService: TranslationService,
  ) {
    this.translationService.onLanguageChange().subscribe(lang => {
      this.currentLang = lang || 'en';
      // Optionally, you can refetch document types on language change if they are localized
      this.documentTypes$ = this.getDocumentsTypesFromApi();
    });
    // Initialize document types
    this.documentTypes$ = this.getDocumentsTypesFromApi();
  }

  private setLoading(loading: boolean) {
    this.isLoadingSubject.next(loading);
  }

  private handleError(error: any) {
    console.error('Error fetching document types:', error);
    return throwError(error);
  }

  private getDocumentsTypesFromApi(): Observable<Document[]> {
    const headers = new HttpHeaders({
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'Accept-Language': this.currentLang
    });

    this.setLoading(true);
    return this.http.get<DocumentResponse>(this.apiUrl, { headers }).pipe(
      map(res => res.data),
      catchError(error => this.handleError(error)),
      finalize(() => this.setLoading(false))
    );
  }

  // Public method to get document types
  getDocumentsTypes(): Observable<Document[]> {
    return this.documentTypes$;
  }
}
