import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { BehaviorSubject, Observable, throwError } from 'rxjs';
import { catchError, finalize, map } from 'rxjs/operators';
import { TranslationService } from 'src/app/modules/i18n/translation.service';
import { IKnoldgProfile } from 'src/app/_fake/models/profile.interface';

@Injectable({
  providedIn: 'root'
})
export class UsersListService {
  private apiUrl = 'https://api.insightabusiness.com/api/admin/account';

  private isLoadingSubject = new BehaviorSubject<boolean>(false);
  public isLoading$ = this.isLoadingSubject.asObservable();

  private currentLang = 'en';

  constructor(
    private http: HttpClient,
    private translationService: TranslationService
  ) {
    this.currentLang = this.translationService.getSelectedLanguage() || 'en';
    this.translationService.onLanguageChange().subscribe((lang) => {
      this.currentLang = lang || 'en';
    });
  }

  private setLoading(loading: boolean) {
    this.isLoadingSubject.next(loading);
  }

  private handleError(error: any) {
    console.error('An error occurred:', error);
    return throwError(() => error);
  }

  private getHeaders(): HttpHeaders {
    return new HttpHeaders({
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'Accept-Language': this.currentLang,
    });
  }

  // Clients
  getClients(): Observable<IKnoldgProfile[]> {
    this.setLoading(true);
    const url = `${this.apiUrl}/client/list`;
    return this.http.get<any>(url, { headers: this.getHeaders() }).pipe(
      map(response => response.data),
      catchError((error) => this.handleError(error)),
      finalize(() => this.setLoading(false))
    );
  }

  deactivateAndDeleteClient(clientId: number, staffNotes: string): Observable<any> {
    this.setLoading(true);
    const url = `${this.apiUrl}/client/deactivate-delete/${clientId}`;
    const body = { staff_notes: staffNotes };
    return this.http.post(url, body, { headers: this.getHeaders() }).pipe(
      map(response => response),
      catchError((error) => this.handleError(error)),
      finalize(() => this.setLoading(false))
    );
  }

  // Insighters
  getInsighters(): Observable<IKnoldgProfile[]> {
    this.setLoading(true);
    const url = `${this.apiUrl}/insighter/list`;
    return this.http.get<any>(url, { headers: this.getHeaders() }).pipe(
      map(response => response.data),
      catchError((error) => this.handleError(error)),
      finalize(() => this.setLoading(false))
    );
  }

  activateInsighter(insighterId: number, staffNotes: string): Observable<any> {
    this.setLoading(true);
    const url = `${this.apiUrl}/insighter/activate/${insighterId}`;
    const body = { staff_notes: staffNotes };
    return this.http.post(url, body, { headers: this.getHeaders() }).pipe(
      map(response => response),
      catchError((error) => this.handleError(error)),
      finalize(() => this.setLoading(false))
    );
  }

  deactivateInsighter(insighterId: number, staffNotes: string): Observable<any> {
    this.setLoading(true);
    const url = `${this.apiUrl}/insighter/deactivate/${insighterId}`;
    const body = { staff_notes: staffNotes };
    return this.http.post(url, body, { headers: this.getHeaders() }).pipe(
      map(response => response),
      catchError((error) => this.handleError(error)),
      finalize(() => this.setLoading(false))
    );
  }

  deactivateInsighterWithDataDelete(insighterId: number, staffNotes: string): Observable<any> {
    this.setLoading(true);
    const url = `${this.apiUrl}/insighter/deactivate-delete/${insighterId}`;
    const body = { staff_notes: staffNotes };
    return this.http.post(url, body, { headers: this.getHeaders() }).pipe(
      map(response => response),
      catchError((error) => this.handleError(error)),
      finalize(() => this.setLoading(false))
    );
  }

  // Company Insighters
  getCompanyInsighters(): Observable<IKnoldgProfile[]> {
    this.setLoading(true);
    const url = `${this.apiUrl}/company/list`;
    return this.http.get<any>(url, { headers: this.getHeaders() }).pipe(
      map(response => response.data),
      catchError((error) => this.handleError(error)),
      finalize(() => this.setLoading(false))
    );
  }

  activateCompanyInsighter(companyId: number, staffNotes: string): Observable<any> {
    this.setLoading(true);
    const url = `${this.apiUrl}/company/activate/${companyId}`;
    const body = { staff_notes: staffNotes };
    return this.http.post(url, body, { headers: this.getHeaders() }).pipe(
      map(response => response),
      catchError((error) => this.handleError(error)),
      finalize(() => this.setLoading(false))
    );
  }

  deactivateCompanyInsighter(companyId: number, staffNotes: string): Observable<any> {
    this.setLoading(true);
    const url = `${this.apiUrl}/company/deactivate/${companyId}`;
    const body = { staff_notes: staffNotes };
    return this.http.post(url, body, { headers: this.getHeaders() }).pipe(
      map(response => response),
      catchError((error) => this.handleError(error)),
      finalize(() => this.setLoading(false))
    );
  }

  deactivateCompanyWithDataDelete(companyId: number, staffNotes: string): Observable<any> {
    this.setLoading(true);
    const url = `${this.apiUrl}/company/deactivate-delete/${companyId}`;
    const body = { staff_notes: staffNotes };
    return this.http.post(url, body, { headers: this.getHeaders() }).pipe(
      map(response => response),
      catchError((error) => this.handleError(error)),
      finalize(() => this.setLoading(false))
    );
  }

  verifyCompany(companyId: number, status: 'verified'): Observable<any> {
    this.setLoading(true);
    const url = `${this.apiUrl}/company/verify/${companyId}`;
    const body = { status };
    return this.http.put(url, body, { headers: this.getHeaders() }).pipe(
      map(response => response),
      catchError((error) => this.handleError(error)),
      finalize(() => this.setLoading(false))
    );
  }
}
