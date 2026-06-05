import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { TranslationService } from 'src/app/modules/i18n';
import { environment } from 'src/environments/environment';

export type ProjectDiscussionContext = 'client' | 'insighter';

export interface ProjectDiscussionMessage {
  id: string;
  stage: string | null;
  body: string;
  sender: string;
  date: string | null;
  uuid: string | null;
  profile_photo_url: string | null;
  is_current_user?: boolean | null;
}

@Injectable({
  providedIn: 'root',
})
export class ProjectDiscussionService {
  currentLang = 'en';

  constructor(
    private http: HttpClient,
    private translationService: TranslationService,
  ) {
    this.currentLang = this.normalizeLanguage(this.translationService.getSelectedLanguage() || 'en');
    this.translationService.onLanguageChange().subscribe(lang => {
      this.currentLang = this.normalizeLanguage(lang || 'en');
    });
  }

  listMessages(context: ProjectDiscussionContext, projectUuid: string): Observable<ProjectDiscussionMessage[]> {
    return this.http.get<any>(this.getDiscussionUrl(context, projectUuid), {
      headers: this.getHeaders(),
    }).pipe(
      map(response => this.mapMessages(response)),
      catchError(error => throwError(() => error))
    );
  }

  sendMessage(
    context: ProjectDiscussionContext,
    projectUuid: string,
    body: string
  ): Observable<ProjectDiscussionMessage | null> {
    return this.http.post<any>(this.getMessagesUrl(context, projectUuid), { body }, {
      headers: this.getHeaders(),
    }).pipe(
      map(response => {
        const root = response?.data ?? response ?? null;
        if (!root || Array.isArray(root)) return null;
        return this.mapMessage(root, 0);
      }),
      catchError(error => throwError(() => error))
    );
  }

  private getDiscussionUrl(context: ProjectDiscussionContext, projectUuid: string): string {
    const prefix = context === 'client' ? 'account' : 'insighter';
    return `${environment.apiBaseUrl}/${prefix}/project/discussion/${projectUuid}`;
  }

  private getMessagesUrl(context: ProjectDiscussionContext, projectUuid: string): string {
    const prefix = context === 'client' ? 'account' : 'insighter';
    return `${environment.apiBaseUrl}/${prefix}/project/discussion/messages/${projectUuid}`;
  }

  private getHeaders(): HttpHeaders {
    return new HttpHeaders({
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Accept-Language': this.currentLang,
      'X-Timezone': Intl.DateTimeFormat().resolvedOptions().timeZone,
    });
  }

  private mapMessages(response: any): ProjectDiscussionMessage[] {
    const data = response?.data ?? response;
    const messages = Array.isArray(data) ? data : [];
    return messages.map((item, index) => this.mapMessage(item, index));
  }

  private mapMessage(item: any, index: number): ProjectDiscussionMessage {
    const sender = item?.sender && typeof item.sender === 'object'
      ? item.sender
      : null;

    return {
      id: this.stringifyValue(item?.id ?? item?.message_uuid ?? item?.discussion_uuid ?? `${index}`),
      stage: this.stringifyNullable(item?.stage),
      body: this.stringifyValue(item?.body ?? item?.message),
      sender: this.stringifyValue(sender?.name ?? item?.sender ?? item?.name ?? item?.user?.name),
      date: this.stringifyNullable(item?.date ?? item?.created_at ?? item?.sent_at),
      uuid: this.stringifyNullable(
        item?.uuid ?? item?.sender_uuid ?? item?.profile_uuid ?? sender?.uuid ?? item?.user?.uuid
      ),
      profile_photo_url: this.stringifyNullable(
        item?.profile_photo_url
          ?? item?.sender_profile_photo_url
          ?? sender?.profile_photo_url
          ?? item?.user?.profile_photo_url
      ),
      is_current_user: this.toOptionalBoolean(
        item?.is_current_user ?? item?.is_mine ?? item?.mine ?? item?.me
      ),
    };
  }

  private normalizeLanguage(lang: string): string {
    if (!lang) return 'en';
    return lang.toLowerCase().startsWith('ar') ? 'ar' : 'en';
  }

  private stringifyValue(value: any): string {
    if (value === null || value === undefined) return '';
    return String(value).trim();
  }

  private stringifyNullable(value: any): string | null {
    const stringValue = this.stringifyValue(value);
    return stringValue || null;
  }

  private toOptionalBoolean(value: any): boolean | null {
    if (value === null || value === undefined) return null;
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value === 1;
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      if (['1', 'true', 'yes'].includes(normalized)) return true;
      if (['0', 'false', 'no'].includes(normalized)) return false;
    }
    return null;
  }
}
