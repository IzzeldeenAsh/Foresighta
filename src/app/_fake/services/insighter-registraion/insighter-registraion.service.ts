import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, catchError, finalize, map, throwError } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class InsighterRegistraionService {
  private individuial_insighter = 'https://api.4sighta.com/api/account/insighter/individual/register'
  private company_insighter = 'https://api.4sighta.com//api/account/insighter/company/register'
  private isLoadingSubject = new BehaviorSubject<boolean>(false);
  public isLoading$: Observable<boolean> =
    this.isLoadingSubject.asObservable();
  currentLang: string = 'en';
  constructor(private http: HttpClient) {}
  private setLoading(loading: boolean) {
    this.isLoadingSubject.next(loading);
  }

  // Custom handleError method
  private handleError(error: any) {
    return throwError(error);
  }

  personalInsighterRegister(insighterData:FormData){
    const headers = new HttpHeaders({
      'Accept-Language': this.currentLang,
    });
     this.setLoading(true);
    return this.http.post(this.individuial_insighter, insighterData, { headers }).pipe(
      map((res)=>res),
      catchError((error)=>this.handleError(error)),
      finalize(()=>this.setLoading(false))
    );
  }


  corporateInsighterRegister(insighterData:FormData){
    const headers = new HttpHeaders({
      'Accept-Language': this.currentLang,
    });
     this.setLoading(true);
    return this.http.post(this.company_insighter, insighterData, { headers }).pipe(
      map((res)=>res),
      catchError((error)=>this.handleError(error)),
      finalize(()=>this.setLoading(false))
    );
  }

}
