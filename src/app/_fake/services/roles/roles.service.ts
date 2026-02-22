// roles.service.ts
import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http'; 
import { BehaviorSubject, Observable, throwError } from 'rxjs';
import { catchError, finalize, map } from 'rxjs/operators';
import { TranslationService } from 'src/app/modules/i18n/translation.service';
import { Permission } from '../permissions/permissions.service';

export interface Role {
  id: number;
  name: string;
  display_name: string;
  description: string;
}

@Injectable({
  providedIn: 'root'
})
export class RolesService {
  private apiUrl = 'https://api.foresighta.co/api/admin/account/role/list';
  private userRoleUrl = 'https://api.foresighta.co/api/admin/account/role/user';
  private rolePermissionsApi = 'https://api.foresighta.co/api/admin/account/permission/role';
  private syncRolePermissionsApi = 'https://api.foresighta.co/api/admin/account/permission/role/sync';
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
    console.error('Error from service', error);
    return throwError(() => error);
  }

  getRoles(): Observable<Role[]> {
    const headers = new HttpHeaders({
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'Accept-Language': this.currentLang
    });

    this.setLoading(true);
    return this.http.get<any>(this.apiUrl, { headers }).pipe(
      map(res => res.data),
      catchError(error => this.handleError(error)),
      finalize(() => this.setLoading(false))
    );
  }

  getRolePermissions(roleId: number): Observable<Permission[]> {
    const headers = new HttpHeaders({
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'Accept-Language': this.currentLang,
    });

    this.setLoading(true);
    return this.http
      .get<any>(`${this.rolePermissionsApi}/${roleId}`, { headers })
      .pipe(
        map((res) => res.data),
        catchError((error) => this.handleError(error)),
        finalize(() => this.setLoading(false))
      );
  }

  // Update permissions for a role
  updateRolePermissions(roleId: number, payload: { permissions: number[] }): Observable<any> {
    const headers = new HttpHeaders({
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'Accept-Language': this.currentLang,
    });

    this.setLoading(true);
    return this.http
      .put<any>(`${this.syncRolePermissionsApi}/${roleId}`, payload, { headers })
      .pipe(
        map((res) => res),
        catchError((error) => this.handleError(error)),
        finalize(() => this.setLoading(false))
      );
  }

  getRolesByUserId(userId: number): Observable<Role[]> {
    const headers = new HttpHeaders({
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'Accept-Language': this.currentLang
    });

    this.setLoading(true);
    return this.http.get<any>(`${this.userRoleUrl}/${userId}`, { headers }).pipe(
      map(res => res.data),
      catchError(error => this.handleError(error)),
      finalize(() => this.setLoading(false))
    );
  }

  // New method to sync roles for a user
  syncRolesForUser(userId: number, roles: number[]): Observable<any> {
    const headers = new HttpHeaders({
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'Accept-Language': this.currentLang
    });

    this.setLoading(true);
    const url = `https://api.foresighta.co/api/admin/account/role/user/sync/${userId}`;
    return this.http.put<any>(url, { roles }, { headers }).pipe(
      catchError(error => this.handleError(error)),
      finalize(() => this.setLoading(false))
    );
  }
}
