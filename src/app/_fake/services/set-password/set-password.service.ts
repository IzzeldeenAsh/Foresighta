import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, catchError, finalize, map, throwError } from 'rxjs';
import { TranslationService } from 'src/app/modules/i18n';

export interface SetPasswordPayload {
  password: string;
  password_confirmation: string;
  code: number;
}

@Injectable({
  providedIn: 'root',
})
export class SetPasswordService {
  private readonly sendCodeUrl = 'https://api.insightabusiness.com/api/account/password/code/send';
  private readonly setPasswordUrl = 'https://api.insightabusiness.com/api/account/password/set';

  private isLoadingSubject = new BehaviorSubject<boolean>(false);
  public isLoading$: Observable<boolean> = this.isLoadingSubject.asObservable();

  currentLang: string = 'en';

  constructor(private http: HttpClient, private translationService: TranslationService) {
    this.currentLang = this.translationService.getSelectedLanguage() || 'en';
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

  private getHeaders(): HttpHeaders {
    return new HttpHeaders({
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'Accept-Language': this.currentLang,
    });
  }

  sendSetPasswordCode(): Observable<any> {
    this.setLoading(true);
    const headers = this.getHeaders();
    return this.http.post(this.sendCodeUrl, {}, { headers }).pipe(
      map((res) => res),
      catchError((error) => this.handleError(error)),
      finalize(() => this.setLoading(false))
    );
  }

  setPassword(payload: SetPasswordPayload): Observable<any> {
    this.setLoading(true);
    const headers = this.getHeaders();
    return this.http.post(this.setPasswordUrl, payload, { headers }).pipe(
      map((res) => res),
      catchError((error) => this.handleError(error)),
      finalize(() => this.setLoading(false))
    );
  }
}

