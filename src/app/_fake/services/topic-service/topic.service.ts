import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http'; 
import { BehaviorSubject, Observable, throwError } from 'rxjs';
import { TranslationService } from 'src/app/modules/i18n/translation.service';
import { map, catchError, finalize } from 'rxjs/operators';

export interface Topic {
  id: number;
  name: string;
  names: {
    en: string;
    ar: string;
  };
  industry_id: number;
}

export interface TopicResponse {
  data: Topic[];
}

@Injectable({
  providedIn: 'root'
})
export class TopicsService {
  private insightaHost = 'https://api.foresighta.co';
  private apiUrl = `${this.insightaHost}/api/common/setting/topic/list`;
  private createApi = `${this.insightaHost}/api/admin/setting/topic`;
  private updateDeleteApi = `${this.insightaHost}/api/admin/setting/topic`;

  private isLoadingSubject = new BehaviorSubject<boolean>(false);
  public isLoading$: Observable<boolean> = this.isLoadingSubject.asObservable();
  currentLang: string = 'en';

  constructor(
    private http: HttpClient,
    private translationService: TranslationService
  ) {
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

  // Fetch topic data from the API
  getTopics(): Observable<Topic[]> {
    const headers = new HttpHeaders({
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'Accept-Language': this.currentLang
    });

    this.setLoading(true);
    return this.http.get<TopicResponse>(this.apiUrl, { headers }).pipe(
      map(res => res.data),
      catchError(error => this.handleError(error)),
      finalize(() => this.setLoading(false))
    );
  }

  // Create a new topic
  createTopic(topic: { name: { en: string; ar: string }; industry_id: number }): Observable<any> {
    const headers = new HttpHeaders({
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'Accept-Language': this.currentLang
    });

    this.setLoading(true);
    return this.http.post<any>(this.createApi, topic, { headers }).pipe(
      map(res => res),
      catchError(error => this.handleError(error)),
      finalize(() => this.setLoading(false))
    );
  }

  // Update an existing topic
  updateTopic(topicId: number, topic: { name: { en: string; ar: string }; industry_id: number }): Observable<Topic> {
    const headers = new HttpHeaders({
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'Accept-Language': this.currentLang
    });

    this.setLoading(true);
    return this.http.put<Topic>(`${this.updateDeleteApi}/${topicId}`, topic, { headers }).pipe(
      map(res => res),
      catchError(error => this.handleError(error)),
      finalize(() => this.setLoading(false))
    );
  }

  // Delete a topic
  deleteTopic(topicId: number): Observable<any> {
    const headers = new HttpHeaders({
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'Accept-Language': this.currentLang
    });

    this.setLoading(true);
    return this.http.delete<any>(`${this.updateDeleteApi}/${topicId}`, { headers }).pipe(
      map(res => res),
      catchError(error => this.handleError(error)),
      finalize(() => this.setLoading(false))
    );
  }
}
