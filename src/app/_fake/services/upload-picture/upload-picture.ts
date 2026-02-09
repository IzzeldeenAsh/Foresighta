import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { MessageService } from 'primeng/api';
import { catchError } from 'rxjs/operators';
import { Observable, throwError } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class FileUploadService {
  private uploadUrl = 'https://api.foresighta.co/api/account/profile/photo';

  constructor(private http: HttpClient) {}

  uploadProfilePhoto(file: File) :Observable<any> {

    // Prepare FormData
    const formData = new FormData();
    formData.append('profile_photo', file);

    // Send POST request
   return this.http
      .post(this.uploadUrl, formData)
      .pipe(
        catchError((error: HttpErrorResponse) => {
          return throwError(() => error);
        })
      )
      
  }
}
