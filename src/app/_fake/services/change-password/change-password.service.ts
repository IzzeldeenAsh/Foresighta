import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, catchError, finalize, map, throwError } from 'rxjs';
import { TranslationService } from 'src/app/modules/i18n';

@Injectable({
  providedIn: 'root'
})
export class ChangePasswordService {
  private apiUrl = 'https://api.insightabusiness.com/api/account/password/change';
  private isLoadingSubject = new BehaviorSubject<boolean>(false);
  public isLoading$: Observable<boolean> = this.isLoadingSubject.asObservable();
  currentLang:string ='en'
  constructor(private http: HttpClient, private translationService: TranslationService) {
    this.currentLang=this.translationService.getSelectedLanguage();
    this.translationService.onLanguageChange().subscribe(lang=>{
      this.currentLang = lang || 'en';
     })
  }

  private setLoading(loading: boolean) {
    this.isLoadingSubject.next(loading);
  }

  // Your custom handleError method
  private handleError(error: any) {
    return throwError(error);
  }

  changePassword(payload:any): Observable<any> {
    this.setLoading(true);
    const headers = new HttpHeaders({
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'Accept-Language': this.currentLang
    });
    return this.http.post(this.apiUrl,payload, { headers })
    .pipe(
      map((res) => res), // Adjust this based on the API response structure
      catchError((error) => this.handleError(error)), // Use the custom error handler
      finalize(() => this.setLoading(false))
    );
  }
}

