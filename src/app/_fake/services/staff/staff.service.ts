import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http'; 
import { BehaviorSubject, Observable, throwError } from 'rxjs';
import { catchError, finalize, map } from 'rxjs/operators';
import { TranslationService } from 'src/app/modules/i18n/translation.service';

export interface Department {
  id: number;
  code: string;
  isic_code_id: string;
  status: string;
  name: string;
  names: {
    en: string;
    ar: string;
  };
}

export interface Position {
  id: number;
  name: string;
  names: {
    en: string;
    ar: string;
  };
}

export interface Staff {
  id: number;
  name: string;
  email: string;
  roles: string[];
  department: Department;
  position: Position;
  profile_photo_url: string | null;
  status: string;
}

@Injectable({
  providedIn: 'root'
})
export class StaffService {
  private apiUrl = 'https://api.insightabusiness.com/api/admin/account/staff/list';
  private createApi = 'https://api.insightabusiness.com/api/admin/account/staff';
  private updateDeleteApi = 'https://api.insightabusiness.com/api/admin/account/staff';
  private isLoadingSubject = new BehaviorSubject<boolean>(false);
  public isLoading$: Observable<boolean> = this.isLoadingSubject.asObservable();
  currentLang: string = 'en';

  constructor(
    private http: HttpClient,
    private translationService: TranslationService
  ) {
    this.translationService.onLanguageChange().subscribe(lang => {
      this.currentLang = lang || 'en';
    });
  }

  private setLoading(loading: boolean) {
    this.isLoadingSubject.next(loading);
  }

  private handleError(error: any) {

    let validationErrors: any[] = [];

    if (error.error.errors) {
      const errors = error.error.errors;
      for (const field in errors) {
        if (errors.hasOwnProperty(field)) {
          const errorMsgArray = errors[field];
          errorMsgArray.forEach((msg: string) => {
            validationErrors.push({
              severity: 'error',
              summary: 'Validation Error',
              detail: msg
            });
          });
        }
      }
    }

    return throwError(() => ({
      validationMessages: validationErrors
    }));
  }

  getStaffList(): Observable<Staff[]> {
    const headers = new HttpHeaders({
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'Accept-Language': this.currentLang
    });

    this.setLoading(true);
    return this.http.get<any>(this.apiUrl, { headers }).pipe(
      map(res => res.data as Staff[]),
      catchError(error => this.handleError(error)),
      finalize(() => this.setLoading(false))
    );
  }

  createStaff(staff: any): Observable<any> {
    const headers = new HttpHeaders({
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'Accept-Language': this.currentLang
    });

    this.setLoading(true);
    return this.http.post<any>(this.createApi, staff, { headers }).pipe(
      map(res => res),
      catchError(error => this.handleError(error)),
      finalize(() => this.setLoading(false))
    );
  }

  updateStaff(staffId: number, updatedData: any): Observable<Staff> {
    const headers = new HttpHeaders({
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'Accept-Language': this.currentLang
    });

    this.setLoading(true);
    return this.http.put<Staff>(`${this.updateDeleteApi}/${staffId}`, updatedData, { headers }).pipe(
      map(res => res),
      catchError(error => this.handleError(error)),
      finalize(() => this.setLoading(false))
    );
  }

  deleteStaff(staffId: number): Observable<any> {
    const headers = new HttpHeaders({
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'Accept-Language': this.currentLang
    });

    this.setLoading(true);
    return this.http.delete<any>(`${this.updateDeleteApi}/${staffId}`, { headers }).pipe(
      map(res => res),
      catchError(error => this.handleError(error)),
      finalize(() => this.setLoading(false))
    );
  }
}
