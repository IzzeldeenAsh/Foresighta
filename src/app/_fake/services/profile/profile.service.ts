import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { BehaviorSubject, Observable, catchError, finalize, map, tap, throwError } from 'rxjs';
import { TranslationService } from 'src/app/modules/i18n/translation.service';

@Injectable({
  providedIn: 'root'
})
export class UpdateProfileService {
  private postProfileUrl = 'https://api.foresighta.co/api/account/profile'; 
  private isLoadingSubject = new BehaviorSubject<boolean>(false);
  public isLoading$: Observable<boolean> = this.isLoadingSubject.asObservable();
  currentLang:string = "en"
  constructor(
    private http: HttpClient,
    private translationService: TranslationService,
  ) {
    this.currentLang = this.translationService.getSelectedLanguage();
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

 
  postProfile(profile: FormData): Observable<any> {
    const headers = new HttpHeaders({
      'Accept': 'application/json',
      'Accept-Language': this.currentLang
    });

    this.setLoading(true);
    return this.http.post<any>(this.postProfileUrl, profile, { headers }).pipe(
      map((res) => res),
      catchError((error) => this.handleError(error)),
      finalize(() => this.setLoading(false))
    );
  }
}