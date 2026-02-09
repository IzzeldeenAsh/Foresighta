import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, throwError, map, catchError, finalize } from 'rxjs';
import { TranslationService } from 'src/app/modules/i18n';

export interface SentMeeting {
  uuid: string;
  date: string;
  start_time: string;
  client?: {
    uuid: string;
    name: string;
    profile_photo_url: string | null;
    first_name: string;
    last_name: string;
    email: string;
  };
  end_time: string;
  status: 'approved' | 'pending' | 'postponed';
  title: string;
  description: string;
  meeting_url: string;
  insighter: {
    uuid: string;
    name: string;
    profile_photo_url: string | null;
    roles: string[];
    company: any;
  };
  rate: string;
}

export interface SentMeetingResponse {
  data: SentMeeting[];
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
    links: Array<{
      url: string | null;
      label: string;
      active: boolean;
    }>;
    path: string;
    per_page: number;
    to: number;
    total: number;
  };
}

export interface AvailableTime {
  start_time: string;
  end_time: string;
}

export interface AvailableDay {
  date: string;
  day: string;
  active: boolean;
  times: AvailableTime[];
}

export interface AvailableHoursResponse {
  data: AvailableDay[];
}

export interface RescheduleRequest {
  meeting_date: string;
  start_time: string;
  end_time: string;
}

export interface MeetingStatistics {
  total: number;
  archived: number;
}

@Injectable({
  providedIn: 'root'
})
export class SentMeetingsService {
  private apiUrl = 'https://api.insightabusiness.com/api/account/meeting/client/list';
  private isLoadingSubject = new BehaviorSubject<boolean>(false);
  public isLoading$: Observable<boolean> = this.isLoadingSubject.asObservable();
  currentLang: string = 'en';

  constructor(
    private http: HttpClient,
    private translationService: TranslationService
  ) {
    this.currentLang = this.translationService.getSelectedLanguage();
    this.translationService.onLanguageChange().subscribe((lang) => {
      this.currentLang = lang || 'en';
    });
  }

  private setLoading(loading: boolean) {
    this.isLoadingSubject.next(loading);
  }

  private handleError(error: any) {
    console.error('API Error:', error);
    return throwError(error);
  }

  private getHeaders(): HttpHeaders {
    return new HttpHeaders({
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'Accept-Language': this.currentLang
    });
  }

  getSentMeetings(page: number = 1, perPage: number = 10, dateStatus?: string): Observable<SentMeetingResponse> {
    const headers = this.getHeaders();
    
    let params = new HttpParams()
      .set('page', page.toString())
      .set('per_page', perPage.toString());

    if (dateStatus) {
      params = params.set('date_status', dateStatus);
    }

    this.setLoading(true);
    return this.http.get<SentMeetingResponse>(this.apiUrl, { headers, params }).pipe(
      map(response => response),
      catchError(error => this.handleError(error)),
      finalize(() => this.setLoading(false))
    );
  }

  // Helper method to get initials from name
  getInitials(name: string): string {
    const nameParts = name.split(' ');
    if (nameParts.length >= 2) {
      return nameParts[0].charAt(0).toUpperCase() + nameParts[1].charAt(0).toUpperCase();
    }
    return name.charAt(0).toUpperCase();
  }

  // Get available hours for rescheduling
  getAvailableHours(insighterUuid: string): Observable<AvailableHoursResponse> {
    const headers = this.getHeaders();
    const url = `https://api.insightabusiness.com/api/platform/insighter/meeting/available/hours/${insighterUuid}`;
    
    // Calculate date range - from tomorrow to 3 months from tomorrow
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const endDate = new Date(tomorrow);
    endDate.setMonth(endDate.getMonth() + 3);
    
    const body = {
      start_date: tomorrow.toISOString().split('T')[0],
      end_date: endDate.toISOString().split('T')[0]
    };

    this.setLoading(true);
    return this.http.post<AvailableHoursResponse>(url, body, { headers }).pipe(
      map(response => response),
      catchError(error => this.handleError(error)),
      finalize(() => this.setLoading(false))
    );
  }

  // Reschedule meeting
  rescheduleMeeting(meetingUuid: string, rescheduleData: RescheduleRequest): Observable<any> {
    const headers = new HttpHeaders({
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'Accept-Language': this.currentLang
    });
    const url = `https://api.insightabusiness.com/api/account/meeting/reschedule/${meetingUuid}`;

    this.setLoading(true);
    return this.http.post(url, rescheduleData, { headers }).pipe(
      map(response => response),
      catchError(error => this.handleError(error)),
      finalize(() => this.setLoading(false))
    );
  }

  // Archive meeting
  archiveMeeting(meetingUuid: string): Observable<any> {
    const headers = this.getHeaders();
    const url = `https://api.insightabusiness.com/api/account/meeting/archive/${meetingUuid}`;

    this.setLoading(true);
    return this.http.post(url, {}, { headers }).pipe(
      map(response => response),
      catchError(error => this.handleError(error)),
      finalize(() => this.setLoading(false))
    );
  }

  // Get archived meetings
  getArchivedMeetings(page: number = 1, perPage: number = 10): Observable<SentMeetingResponse> {
    const headers = this.getHeaders();
    const url = 'https://api.insightabusiness.com/api/account/meeting/client/list';

    let params = new HttpParams()
      .set('page', page.toString())
      .set('per_page', perPage.toString())
      .set('archived', 'true');

    this.setLoading(true);
    return this.http.get<SentMeetingResponse>(url, { headers, params }).pipe(
      map(response => response),
      catchError(error => this.handleError(error)),
      finalize(() => this.setLoading(false))
    );
  }

  // Get meeting statistics
  getMeetingStatistics(): Observable<{ data: MeetingStatistics }> {
    const headers = this.getHeaders();
    const url = 'https://api.insightabusiness.com/api/account/meeting/statistics';

    return this.http.get<{ data: MeetingStatistics }>(url, { headers }).pipe(
      map(response => response),
      catchError(error => this.handleError(error))
    );
  }
} 