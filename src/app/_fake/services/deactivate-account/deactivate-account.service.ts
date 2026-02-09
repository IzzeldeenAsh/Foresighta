import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { BehaviorSubject, Observable, catchError, finalize, map, throwError } from 'rxjs';
import { TranslationService } from 'src/app/modules/i18n/translation.service';

@Injectable({
  providedIn: 'root'
})
export class DeactivateAccountService {
  private readonly baseUrl = 'https://api.foresighta.co/api';
  private isLoadingSubject = new BehaviorSubject<boolean>(false);
  public isLoading$: Observable<boolean> = this.isLoadingSubject.asObservable();
  currentLang: string = "en";

  constructor(
    private http: HttpClient,
  ) {
  
  }

  private setLoading(loading: boolean) {
    this.isLoadingSubject.next(loading);
  }

  private handleError(error: any) {
    // You can enhance error handling here, e.g., logging
    return throwError(() => error);
  }

  /**
   * Deactivate company account with data deletion
   * @param comments - User comments for deactivation
   * @param parentId - Parent request ID
   * @param lang - Current language
   * @returns Observable<any>
   */
  deactivateCompanyWithDelete(comments: string, parentId: string, lang: string): Observable<any> {
    const headers = new HttpHeaders({
      'Accept': 'application/json',
      'Accept-Language': lang
    });

    const formData = new FormData();
    formData.append('comments', comments);
    formData.append('parent_id', parentId);

    this.setLoading(true);
    return this.http.post<any>(`${this.baseUrl}/company/request/deactivate-delete`, formData, { headers }).pipe(
      map((res) => res),
      catchError((error) => this.handleError(error)),
      finalize(() => this.setLoading(false))
    );
  }

  /**
   * Deactivate insighter account with data deletion
   * @param comments - User comments for deactivation
   * @param parentId - Parent request ID
   * @param lang - Current language
   * @returns Observable<any>
   */
  deactivateInsighterWithDelete(comments: string, parentId: string, lang: string): Observable<any> {
    const headers = new HttpHeaders({
      'Accept': 'application/json',
      'Accept-Language': lang
    });

    const formData = new FormData();
    formData.append('comments', comments);
    formData.append('parent_id', parentId);

    this.setLoading(true);
    return this.http.post<any>(`${this.baseUrl}/insighter/request/deactivate-delete`, formData, { headers }).pipe(
      map((res) => res),
      catchError((error) => this.handleError(error)),
      finalize(() => this.setLoading(false))
    );
  }

  /**
   * Deactivate company account without data deletion
   * @param comments - User comments for deactivation
   * @param parentId - Parent request ID
   * @param lang - Current language
   * @returns Observable<any>
   */
  deactivateCompanyWithoutDelete(comments: string, parentId: string, lang: string): Observable<any> {
    const headers = new HttpHeaders({
      'Accept': 'application/json',
      'Accept-Language': lang
    });

    const formData = new FormData();
    formData.append('comments', comments);
    formData.append('parent_id', parentId);

    this.setLoading(true);
    return this.http.post<any>(`${this.baseUrl}/company/deactivate`, formData, { headers }).pipe(
      map((res) => res),
      catchError((error) => this.handleError(error)),
      finalize(() => this.setLoading(false))
    );
  }

  /**
   * Deactivate insighter account without data deletion
   * @param comments - User comments for deactivation 
   * @param parentId - Parent request ID
   * @param lang - Current language
   * @returns Observable<any>
   */
  deactivateInsighterWithoutDelete(comments: string, parentId: string, lang: string): Observable<any> {
    const headers = new HttpHeaders({
      'Accept': 'application/json',
      'Accept-Language': lang
    });

    const formData = new FormData();
    formData.append('comments', comments);
    formData.append('parent_id', parentId);

    this.setLoading(true);
    return this.http.post<any>(`${this.baseUrl}/insighter/deactivate`, formData, { headers }).pipe(
      map((res) => res),
      catchError((error) => this.handleError(error)),
      finalize(() => this.setLoading(false))
    );
  }
}
