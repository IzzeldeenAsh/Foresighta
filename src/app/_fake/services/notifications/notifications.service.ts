import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { BehaviorSubject, Observable, catchError, finalize, map, throwError } from 'rxjs';
import { TranslationService } from 'src/app/modules/i18n';

interface NotificationData {
  message: string;
  type: string;
  notifiable_group_id: string;
  notifiable_id: number;
  request_id: number;
}

export interface Notification {
  id: string;
  type: string;
  notifiable_type: string;
  notifiable_id: number;
  data: NotificationData;
  read_at: string | null;
  created_at: string;
  updated_at: string;
}



@Injectable({
  providedIn: 'root'
})
export class NotificationsService {
  private apiUrl = 'https://api.insightabusiness.com/api/account/notification';
  private isLoadingSubject = new BehaviorSubject<boolean>(false);
  public isLoading$: Observable<boolean> = this.isLoadingSubject.asObservable();
  currentLang: string = 'en';

  private notificationInterval: any;
  private notificationsSubject = new BehaviorSubject<Notification[]>([]);
  public notifications$ = this.notificationsSubject.asObservable();

  constructor(
    private http: HttpClient,
    private translationService: TranslationService
  ) {
    this.currentLang = this.translationService.getSelectedLanguage();
    this.translationService.onLanguageChange().subscribe(lang => {
      this.currentLang = lang || 'en';
    });
    
  }

  private setLoading(loading: boolean) {
    this.isLoadingSubject.next(loading);
  }

  private handleError(error: any) {
    return throwError(error);
  }

  // Get all notifications
  getNotifications(lang:string): Observable<Notification[]> {
    const headers = new HttpHeaders({
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'Accept-Language': lang
    });

    this.setLoading(true);
    return this.http.get<any>(this.apiUrl, { headers }).pipe(
      map(res => res.data),
      catchError(error => this.handleError(error)),
      finalize(() => this.setLoading(false))
    );
  }

  // Mark a notification as read
  markAsRead(notificationId: string,lang:string): Observable<any> {
    const headers = new HttpHeaders({
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'Accept-Language': lang
    });

    const url = `${this.apiUrl}/read/${notificationId}`;

    this.setLoading(true);
    return this.http.put<any>(url, {}, { headers }).pipe(
      map(res => res),
      catchError(error => this.handleError(error)),
      finalize(() => this.setLoading(false))
    );
  }

  // Add method to start polling
  startPolling() {
    // Initial fetch
    this.fetchNotifications();
    
    // Set up interval (60000 ms = 1 minute)
    this.notificationInterval = setInterval(() => {
      this.fetchNotifications();
    }, 30000);
  }

  // Add method to stop polling
  stopPolling() {
    if (this.notificationInterval) {
      clearInterval(this.notificationInterval);
    }
  }

  // Private method to fetch notifications
  private fetchNotifications() {
    this.getNotifications(this.currentLang).subscribe({
      next: (notifications) => {
        this.notificationsSubject.next(notifications);
      },
      error: (error) => {
        console.error('Error fetching notifications:', error);
      }
    });
  }
}
