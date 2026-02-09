import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { environment } from 'src/environments/environment';
import { catchError, finalize, map } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class WebsiteSettingsService {
  private baseUrl = 'https://api.foresighta.co/api/admin/setting';
  private authLocalStorageKey = 'foresighta-creds';
  private currentLang = 'en';

  constructor(private http: HttpClient) { }

  private getAuthToken(): string | null {
    try {
      const authData = localStorage.getItem(this.authLocalStorageKey);
      if (authData) {
        const parsedData = JSON.parse(authData);
        return parsedData.authToken || null;
      }
    } catch (error) {
      console.error('Error parsing auth data from localStorage:', error);
    }
    return null;
  }

  private handleError(error: any) {
    return throwError(error);
  }

  // Get all social media links and other settings
  getConfiguration(): Observable<any> {
    const token = this.getAuthToken();
    const headers = new HttpHeaders({
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'Accept-Language': this.currentLang,
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    });

    return this.http.get(`${this.baseUrl}/configuration`, { headers }).pipe(
      catchError(error => this.handleError(error))
    );
  }

  // Update a social media link
  updateConfiguration(id: number, data: any): Observable<any> {
    const token = this.getAuthToken();
    const headers = new HttpHeaders({
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'Accept-Language': this.currentLang,
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    });

    return this.http.put(`${this.baseUrl}/configuration/${id}`, data, { headers }).pipe(
      catchError(error => this.handleError(error))
    );
  }
} 