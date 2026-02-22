import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, throwError, map, catchError, finalize } from 'rxjs';
import { TranslationService } from 'src/app/modules/i18n';

@Injectable({
  providedIn: 'root'
})
export class KnowldegePackegesService {
  currentLang: string = 'en';
  private isLoadingSubject = new BehaviorSubject<boolean>(false);
  public isLoading$: Observable<boolean> = this.isLoadingSubject.asObservable();
  private baseUrl = 'https://api.foresighta.co/api/insighter/library';
  
  constructor(
    private http: HttpClient,
    private translationService: TranslationService
  ) {
    this.currentLang = this.translationService.getSelectedLanguage();
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

  // Get list of packages
  getPackages(): Observable<PackageListResponse> {
    const headers = new HttpHeaders({
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'Accept-Language': this.currentLang
    });

    this.setLoading(true);
    return this.http.get<PackageListResponse>(`${this.baseUrl}/package/list`, { headers }).pipe(
      map(res => res),
      catchError(error => this.handleError(error)),
      finalize(() => this.setLoading(false))
    );
  }

  // Create a new package
  createPackage(name: string): Observable<any> {
    const headers = new HttpHeaders({
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'Accept-Language': this.currentLang
    });

    this.setLoading(true);
    return this.http.post(`${this.baseUrl}/package`, { name }, { headers }).pipe(
      map(res => res),
      catchError(error => this.handleError(error)),
      finalize(() => this.setLoading(false))
    );
  }

  // Sync package knowledge
  syncPackageKnowledge(packageId: number, knowledge_ids: number[], discount: number): Observable<any> {
    const headers = new HttpHeaders({
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'Accept-Language': this.currentLang
    });

    const body = {
      knowledge_ids,
      discount
    };

    this.setLoading(true);
    return this.http.put(`${this.baseUrl}/package/knowledge/sync/${packageId}`, body, { headers }).pipe(
      map(res => res),
      catchError(error => this.handleError(error)),
      finalize(() => this.setLoading(false))
    );
  }

  // Delete a package
  deletePackage(packageId: number): Observable<any> {
    const headers = new HttpHeaders({
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'Accept-Language': this.currentLang
    });

    this.setLoading(true);
    return this.http.delete(`${this.baseUrl}/package/${packageId}`, { headers }).pipe(
      map(res => res),
      catchError(error => this.handleError(error)),
      finalize(() => this.setLoading(false))
    );
  }

  // Download package folders
  downloadPackage(packageId: number): Observable<any> {
    const headers = new HttpHeaders({
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'Accept-Language': this.currentLang
    });

    this.setLoading(true);
    return this.http.get(`${this.baseUrl}/package/download/${packageId}`, { headers }).pipe(
      map(res => res),
      catchError(error => this.handleError(error)),
      finalize(() => this.setLoading(false))
    );
  }

  // Get list of package knowledge
  getPackageKnowledge(packageId: number): Observable<PackageKnowledgeResponse> {
    const headers = new HttpHeaders({
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'Accept-Language': this.currentLang
    });

    this.setLoading(true);
    return this.http.get<PackageKnowledgeResponse>(`${this.baseUrl}/package/knowledge/list/${packageId}`, { headers }).pipe(
      map(res => res),
      catchError(error => this.handleError(error)),
      finalize(() => this.setLoading(false))
    );
  }

  // Update package status
  updatePackageStatus(packageId: number, status: 'scheduled' | 'published' | 'unpublished', publishedAt?: string): Observable<any> {
    const headers = new HttpHeaders({
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'Accept-Language': this.currentLang
    });

    const body = {
      status,
      published_at: publishedAt
    };

    this.setLoading(true);
    return this.http.put(`${this.baseUrl}/package/status/${packageId}`, body, { headers }).pipe(
      map(res => res),
      catchError(error => this.handleError(error)),
      finalize(() => this.setLoading(false))
    );
  }

  // Get package by id
  getPackageById(packageId: number): Observable<PackageResponse> {
    const headers = new HttpHeaders({
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'Accept-Language': this.currentLang
    });

    this.setLoading(true);
    return this.http.get<PackageResponse>(`${this.baseUrl}/package/${packageId}`, { headers }).pipe(
      map(res => res),
      catchError(error => this.handleError(error)),
      finalize(() => this.setLoading(false))
    );
  }

  // Update package name
  updatePackageName(packageId: number, name: string): Observable<any> {
    const headers = new HttpHeaders({
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'Accept-Language': this.currentLang
    });

    const body = { name };

    this.setLoading(true);
    return this.http.put(`${this.baseUrl}/package/${packageId}`, body, { headers }).pipe(
      map(res => res),
      catchError(error => this.handleError(error)),
      finalize(() => this.setLoading(false))
    );
  }
}

export interface Package {
  id: number;
  name: string;
  price: number;
  discount: number;
  final_price: number;
  status: string;
  knowledge_ids?: number[];
}

export interface PackageListResponse {
  data: Package[];
}

export interface PackageResponse {
  data: Package;
}

export interface PackageKnowledge {
  id: number;
  type: string;
  title: string;
  slug: string;
  description: string;
  keywords: string[];
  tags: {
    id: number;
    name: string;
  }[];
  topic: {
    id: number;
    name: string;
  };
  industry: {
    id: number;
    name: string;
  };
  isic_code: {
    id: number;
    key: number;
    name: string;
  };
  hs_code: any;
  language: string;
  total_price: string;
  status: string;
}

export interface PackageKnowledgeResponse {
  data: PackageKnowledge[];
}
