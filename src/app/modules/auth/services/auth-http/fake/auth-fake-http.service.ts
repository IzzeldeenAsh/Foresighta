import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

import { UserModel } from '../../../models/user.model';
import { AuthModel } from '../../../models/auth.model';
import { environment } from '../../../../../../environments/environment';
import { InsightaUserModel } from '../../../models/insighta-user.model';

const API_USERS_URL = `test`;

@Injectable({
  providedIn: 'root',
})
export class AuthHTTPService {
  constructor(private http: HttpClient) {}
  private apiUrlLogin = ' https://api.insightabusiness.com/api/common/user/login'; // Define your API URL
  // public methods
  // login(email: string, password: string , lang:string): Observable<AuthModel | Error> {
  //   if (!email || !password) {
  //     return throwError(() => new Error('Email and password are required'));
  //   }
  
  //   const body = { email, password }; // Request body
  
  //   // Define custom headers
  //   const headers = new HttpHeaders({
  //     'Accept': 'application/json',
  //     'Accept-Language': lang // As per your example
  //   });
  
  //   return this.http.post<any>(this.apiUrlLogin, body, { headers }).pipe(
  //     map((response) => {
  //       const data = response?.data;
  
  //       if (!data || !data.token) {
  //         throw new Error('Invalid login response');
  //       }
  
  //       // Map the response data to UserModel or AuthModel as required
  //       const user = new InsightaUserModel();
  //       user.id = data.id;
  //       user.name = data.name;
  //       user.email = data.email;
  //       user.countryId = data.countryId;
  //       user.country = data.country;
  //       user.roles = data.roles;
  
  //       // Create AuthModel
  //       const auth = new AuthModel();
  //       auth.authToken = data.token;
  //       auth.expiresIn = new Date(Date.now() + 100 * 24 * 60 * 60 * 1000); // Token expiration logic
  
  //       return auth;
  //     }),
  //     catchError((error) => {
  //       return throwError(() => new Error(error.message || 'Login failed'));
  //     })
  //   );
  // }
  getUserByToken(token: string): Observable<UserModel | undefined> {
    // const user = UsersTable.users.find((u: UserModel) => {
    //   return u.authToken === token;
    // });

    // if (!user) {
    //   return of(undefined);
    // }

    // return of(user);
    return of(undefined);
  }

  // createUser(user: UserModel): Observable<any> {
  //   user.roles = [2]; // Manager
  //   user.authToken = 'auth-token-' + Math.random();
  //   user.refreshToken = 'auth-token-' + Math.random();
  //   user.expiresIn = new Date(Date.now() + 100 * 24 * 60 * 60 * 1000);
  //   user.pic = './assets/media/avatars/300-1.jpg';

  //   return this.http.post<UserModel>(API_USERS_URL, user);
  // }

  forgotPassword(email: string): Observable<boolean> {
    return this.getAllUsers().pipe(
      map((result: UserModel[]) => {
        const user = result.find(
          (u) => u.email.toLowerCase() === email.toLowerCase()
        );
        return user !== undefined;
      })
    );
  }

  // getUserByToken(token: string): Observable<UserModel | undefined> {
   
  // }

  getAllUsers(): Observable<UserModel[]> {
    return this.http.get<UserModel[]>(API_USERS_URL);
  }
}
