import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http'; 
import { BehaviorSubject, Observable, throwError } from 'rxjs';
import { TranslationService } from 'src/app/modules/i18n/translation.service';
import { map, catchError, finalize } from 'rxjs/operators';

export interface IsicCode {
  key: number;
  code: string;
  label: string;
  names: any;
  parent_id: number | null;
  status: string;
  children: IsicCode[];
}

@Injectable({
  providedIn: 'root'
})
export class IsicCodesService {
  private apiUrl = 'https://api.knoldg.com/api/common/setting/isic-code/tree-list'; 
  private apiList = 'https://api.knoldg.com/api/common/setting/isic-code/list'
  private isLoadingSubject = new BehaviorSubject<boolean>(false);
  public isLoading$: Observable<boolean> = this.isLoadingSubject.asObservable();
  currentLang: any = 'en';

  constructor(
    private http: HttpClient,
    private translationService: TranslationService
  ) {
    this.translationService.onLanguageChange().subscribe(lang => {
      this.currentLang = lang || 'en';;
    });
  }

  private setLoading(loading: boolean) {
    this.isLoadingSubject.next(loading);
  }

  private handleError(error: any) {
    return throwError(error);
  }

  private transformToTreeNode(isicData: IsicCode[]): any[] {
    return isicData.map(node => ({
      key: node.key,
      label: node.names[this.currentLang],
      data: {
        key: node.key,
        code: node.code,
        label: node.label,
        status: node.status,
        nameEn: node.names['en'],
        nameAr: node.names['ar'],
      },
      children: node.children ? this.transformToTreeNode(node.children) : []
    }));
  }

  private transformToTreeNodeParent(isicData: any[]): any[] {
    return isicData.map(node => ({
      key: node.key,
      label: node.label,
      data: {
        key: node.key,
        code: node.code,
        label: node.label,
      },
      children: node.children ? this.transformToTreeNodeParent(node.children) : []
    }));
  }

  // Fetch ISIC Codes data from the API
  getIsicCodesTree(lang: string): Observable<any[]> {
    const headers = new HttpHeaders({
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'Accept-Language': lang
    });

    this.setLoading(true);
    return this.http.get<any>(this.apiUrl, { headers }).pipe(
      map((res) => this.transformToTreeNode(res)),
      catchError((error) => this.handleError(error)),
      finalize(() => this.setLoading(false))
    );
  }

    // Fetch ISIC Codes data from the API
    getIsicCodesTreeParent(): Observable<any[]> {
      const headers = new HttpHeaders({
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Accept-Language': this.currentLang
      });
  
      this.setLoading(true);
      return this.http.get<any>('https://api.knoldg.com/api/common/setting/isic-code/tree/parent', { headers }).pipe(
        map((res) => this.transformToTreeNodeParent(res)),
        catchError((error) => this.handleError(error)),
        finalize(() => this.setLoading(false))
      );
    }

     // Fetch ISIC Codes data from the API
  getIndustryList(): Observable<any[]> {
    const headers = new HttpHeaders({
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'Accept-Language': this.currentLang
    });

    this.setLoading(true);
    return this.http.get<any>(this.apiList, { headers }).pipe(
      map((res) => res.data),
      catchError((error) => this.handleError(error)),
      finalize(() => this.setLoading(false))
    );
  }


  // Create a new ISIC code
  createIsicCode(isicCode: any): Observable<IsicCode> {
    const headers = new HttpHeaders({
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'Accept-Language': this.currentLang
    });
    this.setLoading(true);
    return this.http.post<IsicCode>('https://api.knoldg.com/api/admin/setting/isic-code', isicCode, { headers }).pipe(
      catchError(this.handleError),
      finalize(() => this.setLoading(false))
    );
  }

  // Update an existing ISIC code
  updateIsicCode(id: number, isicCode: any): Observable<IsicCode> {
    const headers = new HttpHeaders({
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'Accept-Language': this.currentLang
    });
    this.setLoading(true);
    return this.http.put<IsicCode>(`https://api.knoldg.com/api/admin/setting/isic-code/${id}`, isicCode, { headers }).pipe(
      catchError(this.handleError),
      finalize(() => this.setLoading(false))
    );
  }

  // Delete an ISIC code
  deleteIsicCode(id: number): Observable<any> {
    const headers = new HttpHeaders({
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'Accept-Language': this.currentLang
    });
    this.setLoading(true);
    return this.http.delete<any>(`https://api.knoldg.com/api/admin/setting/isic-code/${id}`, { headers }).pipe(
      catchError(this.handleError),
      finalize(() => this.setLoading(false))
    );
  }
}