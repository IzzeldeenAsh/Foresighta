import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';

export interface ContactMessage {
  id: number;
  first_name: string;
  last_name: string;
  phone: string;
  email: string;
  message: string;
  status: string;
  created_at: string;
}

export interface ContactMessagesResponse {
  data: ContactMessage[];
  links: {
    first: string;
    last: string;
    prev: string | null;
    next: string | null;
  };
  meta: {
    current_page: number;
    from: number;
    last_page: number;
    links: {
      url: string | null;
      label: string;
      active: boolean;
    }[];
    path: string;
    per_page: number;
    to: number;
    total: number;
  };
}

@Injectable({
  providedIn: 'root'
})
export class ContactMessageService {
  private apiUrl = 'https://api.foresighta.co/api/admin/setting/contact-us';
  private headers = new HttpHeaders({
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'Accept-Language': 'en'
  });

  constructor(private http: HttpClient) { }

  getContactMessages(page: number = 1): Observable<ContactMessagesResponse> {
    return this.http.get<ContactMessagesResponse>(`${this.apiUrl}?page=${page}`, { headers: this.headers });
  }

  updateStatus(id: number, status: string): Observable<any> {
    return this.http.put(`${this.apiUrl}/${id}`, { status }, { headers: this.headers });
  }
}
