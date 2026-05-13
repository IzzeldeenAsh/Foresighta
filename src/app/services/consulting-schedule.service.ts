import { Injectable, signal } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';
import { TranslationService } from '../modules/i18n';

export interface TimeSlot {
  start_time: string;
  end_time: string;
  rate: number | string;
}

export interface DayAvailability {
  day: string;
  active: boolean;
  times: TimeSlot[];
}

export interface AvailabilityException {
  exception_date: string;
  start_time: string;
  end_time: string;
  rate: number | string;
}

export interface ScheduleAvailability {
  availability: DayAvailability[];
  availability_exceptions: AvailabilityException[];
}

export interface ScheduleResponse {
  data: ScheduleAvailability;
}

@Injectable({
  providedIn: 'root'
})
export class ConsultingScheduleService {
  private readonly baseUrl = 'https://api.foresighta.co'
  private currentLang = signal('en');

  constructor(
    private http: HttpClient,
    private translationService: TranslationService
  ) {
    this.translationService.onLanguageChange().subscribe(lang => {
      this.currentLang.set(lang || 'en');
    });
  }

  private getHeaders(): HttpHeaders {
    return new HttpHeaders({
      'Accept': 'application/json',
      'Accept-Language': this.currentLang()
    });
  }

  /**
   * Get consulting schedule availability
   */
  getScheduleAvailability(): Observable<ScheduleResponse> {
    return this.http.get<ScheduleResponse>(
      `${this.baseUrl}/api/insighter/meeting/availability/list`,
      { headers: this.getHeaders() }
    );
  }

  /**
   * Update consulting schedule availability
   */
  updateScheduleAvailability(scheduleData: ScheduleAvailability): Observable<any> {
    return this.http.put(
      `${this.baseUrl}/api/insighter/meeting/availability/sync`,
      scheduleData,
      { headers: this.getHeaders() }
    );
  }
} 