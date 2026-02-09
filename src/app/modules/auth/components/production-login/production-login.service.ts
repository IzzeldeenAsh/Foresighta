import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

export interface ProductionLoginRequest {
  email: string;
  password: string;
}

export interface ProductionLoginResponse {
  data: {
    id: number;
    uuid: string;
    name: string;
    first_name: string;
    last_name: string;
    email: string;
    roles: string[];
    profile_photo_url: string | null;
    country_id: number;
    country: string;
    client_status: string;
    bio: string;
    phone_code: string | null;
    phone: string | null;
    insighter_status: string;
    certifications: Array<{
      id: number;
      name: string;
      type: string;
      url: string;
    }>;
    industries: Array<{
      id: number;
      name: string;
      slug: string;
      weight: number;
      image: string | null;
    }>;
    consulting_field: Array<{
      id: number;
      name: string;
      names: {
        en: string;
        ar: string;
      };
    }>;
    social: Array<{
      id: number;
      link: string;
      type: string;
    }>;
    token: string;
    verified: boolean;
    login_social: boolean;
  };
}

@Injectable({
  providedIn: 'root'
})
export class ProductionLoginService {
  private readonly API_BASE_URL = 'https://api.foresighta.co/api';
  private readonly LOGIN_ENDPOINT = `${this.API_BASE_URL}/auth/login`;

  constructor(private http: HttpClient) {}

  login(email: string, password: string, locale: string = 'en'): Observable<ProductionLoginResponse> {
    const headers = new HttpHeaders({
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Accept-Language': locale,
      'X-Timezone': Intl.DateTimeFormat().resolvedOptions().timeZone,
    });

    const body: ProductionLoginRequest = {
      email,
      password,
    };

    return this.http.post<ProductionLoginResponse>(this.LOGIN_ENDPOINT, body, { headers })
      .pipe(
        map(response => response),
        catchError(this.handleError)
      );
  }

  private handleError(error: HttpErrorResponse): Observable<never> {
    let errorMessage = 'An unexpected error occurred';
    
    if (error.error) {
      if (error.error.message) {
        errorMessage = error.error.message;
      } else if (error.error.errors) {
        // Handle validation errors
        const errors = error.error.errors;
        const errorMessages: string[] = [];
        for (const key in errors) {
          if (errors.hasOwnProperty(key)) {
            errorMessages.push(...errors[key]);
          }
        }
        errorMessage = errorMessages.join(', ');
      }
    }

    return throwError(() => ({
      message: errorMessage,
      status: error.status,
      error: error.error
    }));
  }

  /**
   * Get Google authentication redirect URL
   */
  getGoogleAuthRedirectUrl(locale: string = 'en'): Observable<string> {
    const headers = new HttpHeaders({
      'Accept': 'application/json',
      'Accept-Language': locale
    });
    
    return this.http.get('https://api.foresighta.co/api/auth/provider/google', { 
      headers,
      responseType: 'text'
    });
  }

  /**
   * Get LinkedIn authentication redirect URL
   */
  getLinkedInAuthRedirectUrl(locale: string = 'en'): Observable<string> {
    const headers = new HttpHeaders({
      'Accept': 'application/json', 
      'Accept-Language': locale
    });
    
    return this.http.get('https://api.foresighta.co/api/auth/provider/linkedin-openid', {
      headers,
      responseType: 'text'
    });
  }
}