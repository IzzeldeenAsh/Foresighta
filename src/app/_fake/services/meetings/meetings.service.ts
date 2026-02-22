import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, throwError, map, catchError, finalize } from 'rxjs';
import { TranslationService } from 'src/app/modules/i18n';

export interface Meeting {
  uuid: string;
  date: string;
  start_time: string;
  end_time: string;
  status: 'approved' | 'pending' | 'postponed';
  title: string;
  description: string;
  meeting_url: string;
  client: {
    name: string;
    first_name: string;
    uuid: string;
    last_name: string;
    email: string;
    profile_photo_url: string | null;
    country: string | null;
  };
  rate: string;
}

export interface MeetingResponse {
  data: Meeting[];
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

export interface ClientMeetingStatistics {
  total: number;
  archived: number;
  today: number;
}

@Injectable({
  providedIn: 'root'
})
export class MeetingsService {
  private apiUrl = 'https://api.insightabusiness.com/api/insighter/meeting/list';
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

  getMeetings(page: number = 1, perPage: number = 10, dateStatus?: string): Observable<MeetingResponse> {
    const headers = this.getHeaders();
    
    let params = new HttpParams()
      .set('page', page.toString())
      .set('per_page', perPage.toString());

    if (dateStatus) {
      params = params.set('date_status', dateStatus);
    }

    this.setLoading(true);
    return this.http.get<MeetingResponse>(this.apiUrl, { headers, params }).pipe(
      map(response => response),
      catchError(error => this.handleError(error)),
      finalize(() => this.setLoading(false))
    );
  }

  // Update meeting status (approve/postpone)
  updateMeetingStatus(meetingUuid: string, status: 'approved' | 'postponed', notes: string): Observable<any> {
    console.log('MeetingsService.updateMeetingStatus called with meetingUuid:', meetingUuid, 'status:', status, 'notes:', notes);
    const url = `https://api.insightabusiness.com/api/insighter/meeting/action/${meetingUuid}`;
    console.log('API URL being called:', url);
    const headers = this.getHeaders();
    
    const body = {
      status: status,
      notes: notes
    };

    this.setLoading(true);
    return this.http.put(url, body, { headers }).pipe(
      map(response => response),
      catchError(error => this.handleError(error)),
      finalize(() => this.setLoading(false))
    );
  }

  // Get available hours for reschedule (for current authenticated user)
  getAvailableHours(): Observable<AvailableHoursResponse> {
    const headers = this.getHeaders();
    const url = `https://api.insightabusiness.com/api/insighter/meeting/available/hours`;

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
    const headers = this.getHeaders();
    const url = `https://api.insightabusiness.com/api/insighter/meeting/reschedule/${meetingUuid}`;

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
    const url = `https://api.insightabusiness.com/api/insighter/meeting/archive/${meetingUuid}`;

    this.setLoading(true);
    return this.http.post(url, {}, { headers }).pipe(
      map(response => response),
      catchError(error => this.handleError(error)),
      finalize(() => this.setLoading(false))
    );
  }

  // Get archived meetings
  getArchivedMeetings(page: number = 1, perPage: number = 10): Observable<MeetingResponse> {
    const headers = this.getHeaders();
    const url = 'https://api.insightabusiness.com/api/insighter/meeting/list';

    let params = new HttpParams()
      .set('page', page.toString())
      .set('per_page', perPage.toString())
      .set('archived', 'true');

    this.setLoading(true);
    return this.http.get<MeetingResponse>(url, { headers, params }).pipe(
      map(response => response),
      catchError(error => this.handleError(error)),
      finalize(() => this.setLoading(false))
    );
  }

  // Get client meeting statistics
  getClientMeetingStatistics(): Observable<{ data: ClientMeetingStatistics }> {
    const headers = this.getHeaders();
    const url = 'https://api.insightabusiness.com/api/insighter/meeting/statistics';

    return this.http.get<{ data: ClientMeetingStatistics }>(url, { headers }).pipe(
      map(response => response),
      catchError(error => this.handleError(error))
    );
  }

  // Helper method to get initials from name
  getInitials(firstName: string, lastName: string): string {
    const first = firstName ? firstName.charAt(0).toUpperCase() : '';
    const last = lastName ? lastName.charAt(0).toUpperCase() : '';
    return first + last;
  }
} 