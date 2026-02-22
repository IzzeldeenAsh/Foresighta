import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class ProfileService {
  private uploadUrl = 'https://api.insightabusiness.com/api/account/profile/photo';
  private removeUrl = 'https://api.insightabusiness.com/api/account/profile/photo/remove';
  private updateLogo = 'https://api.insightabusiness.com/api/account/profile/company/logo';

  constructor(private http: HttpClient) {}

  updateProfilePhoto(file: File): Observable<any> {
    const formData = new FormData();
    formData.append('profile_photo', file);

    const headers = new HttpHeaders({
      'Accept': 'application/json',
      'Accept-Language': 'en'
    });

    return this.http.post<any>(this.uploadUrl, formData, { headers });
  }

  updateCompanyLogo(file: File): Observable<any> {
    const formData = new FormData();
    formData.append('logo', file);

    const headers = new HttpHeaders({
      'Accept': 'application/json',
      'Accept-Language': 'en'
    });

    return this.http.post<any>(this.updateLogo, formData, { headers });
  }


  removeProfilePhoto(): Observable<any> {
    const headers = new HttpHeaders({
      'Accept': 'application/json',
      'Accept-Language': 'en'
    });
    return this.http.delete<any>(this.removeUrl, { headers });
  }
}
