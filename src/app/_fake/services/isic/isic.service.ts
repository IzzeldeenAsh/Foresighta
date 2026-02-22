import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { BehaviorSubject, Observable, catchError, finalize, map, throwError } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class IsicService {
  private myInsighta = 'https://myinsighta.com/api/isic-code';
  private isLoadingSubject = new BehaviorSubject<boolean>(false);
  public isLoading$: Observable<boolean> = this.isLoadingSubject.asObservable();

  constructor(private http: HttpClient) {}

  private setLoading(loading: boolean) {
    this.isLoadingSubject.next(loading);
  }

  private handleError(error: any) {
    return throwError(() => new Error(error));
  }

  getIsicCodes(lang: string = 'ar'): Observable<any> {
    const headers = new HttpHeaders({
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'lang': lang
    });
  
    this.setLoading(true);
    return this.http.get<any>(this.myInsighta, { headers }).pipe(
      map(res => res ? res : []),  // Ensure that the response is always an array or fallback to an empty array
      catchError(this.handleError),
      finalize(() => this.setLoading(false))
    );
  }

  getList(): Observable<any> {
    const headers = new HttpHeaders({
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'Accept-Language': 'en'
    });
  
    return this.http.get<any>( 'https://api.insightabusiness.com/api/common/setting/department/list', { headers }).pipe(
      map(res => res),  // Ensure that the response is always an array or fallback to an empty array
      catchError(this.handleError),
      finalize(() => this.setLoading(false))
    );
  }
}