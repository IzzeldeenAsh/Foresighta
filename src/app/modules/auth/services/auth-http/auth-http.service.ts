import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { ForesightaGeneralUserModel, UserModel } from '../../models/user.model';
import { environment } from '../../../../../environments/environment';
import { AuthModel } from '../../models/auth.model';

const API_USERS_URL = `auth`;
const API_GENERALREGISTER= 'https://api.insightabusiness.com/api/auth/register';

@Injectable({
  providedIn: 'root',
})
export class AuthHTTPService {
  private authLocalStorageKey = 'foresighta-creds';
  
  constructor(
    private http: HttpClient
  ) {}
  
  private apiUrlLogin = 'https://api.insightabusiness.com/api/auth/login';
  
  // public methods
  login(email: string, password: string, lang: string): Observable<any> {
    const headers = new HttpHeaders({
      'Accept': 'application/json',
      'Accept-Language': lang,
    });
    
    return this.http.post<any>(
      this.apiUrlLogin, 
      { email, password },
      { headers }
    );
  }

  // CREATE =>  POST: add a new user to the server
  createUser(user: ForesightaGeneralUserModel): Observable<any> {
    const headers = new HttpHeaders({
      'Accept': 'application/json',
      'Accept-Language': 'en_us'
    });

    return this.http.post<ForesightaGeneralUserModel>(
      API_GENERALREGISTER, 
      user,
      { headers }
    );
  }

  // Your server should check email => If email exists send link to the user and return true | If email doesn't exist return false
  forgotPassword(email: string): Observable<boolean> {
    return this.http.post<boolean>(
      `${API_USERS_URL}/forgot-password`, 
      { email }
    );
  }

  // Get authentication token from localStorage
  getAuthToken(): string | null {
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

  // Create headers with authentication token
  getAuthHeaders(lang: string = 'en'): HttpHeaders {
    const token = this.getAuthToken();
    let headers = new HttpHeaders({
      'Accept': 'application/json',
      'Accept-Language': lang
    });
    
    if (token) {
      headers = headers.set('Authorization', `Bearer ${token}`);
    }
    
    return headers;
  }

  getUserByToken(): Observable<any> {
    const headers = this.getAuthHeaders();
    return this.http.get<UserModel>(
      `${environment.apiBaseUrl}/account/profile`, 
      { headers }
    );
  }
}
