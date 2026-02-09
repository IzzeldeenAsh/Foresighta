import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { BehaviorSubject, Observable, catchError, finalize, map, tap, throwError } from 'rxjs';
import { TranslationService } from 'src/app/modules/i18n/translation.service';

@Injectable({
  providedIn: 'root'
})
export class UpdateProfileService {
  private postProfileUrl = 'https://api.insightabusiness.com/api/account/profile';
  private insighterSocialUrl = 'https://api.insightabusiness.com/api/insighter/social';
  private companySocialUrl = 'https://api.insightabusiness.com/api/company/social';
  private deleteCertificateUrl = 'https://api.insightabusiness.com/api/account/profile/certification';
  private updateCompanyInfoUrl = 'https://api.insightabusiness.com/api/account/profile/company/info';
  private deleteCompanyCertificateUrl = 'https://api.insightabusiness.com/api/account/profile/company/certification';
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

  addInsighterSocial(social: {type: string, link: string}[]): Observable<any> {
    const headers = new HttpHeaders({
      'Accept': 'application/json',
      'Accept-Language': this.currentLang
    });

    this.setLoading(true);
    return this.http.post<any>(this.insighterSocialUrl, { social }, { headers }).pipe(
      map((res) => res),
      catchError((error) => this.handleError(error)),
      finalize(() => this.setLoading(false))
    );
  }

  addCompanySocial(social: {type: string, link: string}[]): Observable<any> {
    const headers = new HttpHeaders({
      'Accept': 'application/json', 
      'Accept-Language': this.currentLang
    });

    this.setLoading(true);
    return this.http.post<any>(this.companySocialUrl, { social }, { headers }).pipe(
      map((res) => res),
      catchError((error) => this.handleError(error)),
      finalize(() => this.setLoading(false))
    );
  }

  updateCompanyInfo(formData:any): Observable<any> {
    const headers = new HttpHeaders({
      'Accept-Language': this.currentLang
    });

    this.setLoading(true);
    return this.http.post<any>(this.updateCompanyInfoUrl, formData, { headers }).pipe(
      map((res) => res),
      catchError((error) => this.handleError(error)), 
      finalize(() => this.setLoading(false))
    );
  }

  deleteCertificate(id: number): Observable<any> {
    const headers = new HttpHeaders({
      'Accept': 'application/json',
      'Accept-Language': this.currentLang
    });

    this.setLoading(true);
    return this.http.delete<any>(`${this.deleteCertificateUrl}/${id}`, { headers }).pipe(
      map((res) => res),
      catchError((error) => this.handleError(error)),
      finalize(() => this.setLoading(false))
    );
  }

  deleteCompanyCertificate(id: number): Observable<any> {
    const headers = new HttpHeaders({
      'Accept': 'application/json',
      'Accept-Language': this.currentLang
    });

    this.setLoading(true);
    return this.http.delete<any>(`${this.deleteCompanyCertificateUrl}/${id}`, { headers }).pipe(
      map((res) => res),
      catchError((error) => this.handleError(error)),
      finalize(() => this.setLoading(false))
    );
  }

  uploadCertificate(certificationType: string, file: File): Observable<any> {
    const formData = new FormData();
    formData.append('certification[0][type]', certificationType);
    formData.append('certification[0][file]', file);

    const headers = new HttpHeaders({
      'Accept': 'application/json',
      'Accept-Language': this.currentLang
    });

    this.setLoading(true);
    return this.http.post<any>('https://api.insightabusiness.com/api/account/profile/certification', formData, { headers }).pipe(
      map((res) => res),
      catchError((error) => this.handleError(error)),
      finalize(() => this.setLoading(false))
    );
  }

  updateCompanyCertification(certificationType: string, file: File): Observable<any> {
    const formData = new FormData();
    formData.append('certification[0][type]', certificationType);
    formData.append('certification[0][file]', file);

    const headers = new HttpHeaders({
      'Accept': 'application/json',
      'Accept-Language': this.currentLang
    });

    this.setLoading(true);
    return this.http.post<any>('https://api.insightabusiness.com/api/account/profile/company/certification', formData, { headers }).pipe(
      map((res) => res),
      catchError((error) => this.handleError(error)),
      finalize(() => this.setLoading(false))
    );
  }
}