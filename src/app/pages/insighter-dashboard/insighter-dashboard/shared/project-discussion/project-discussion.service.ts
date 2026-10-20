import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, Subject, forkJoin, of, throwError } from 'rxjs';
import { catchError, map, switchMap, tap } from 'rxjs/operators';
import { flatMapList } from 'src/app/_fake/services/project-phase2/project-phase2.model';
import { TranslationService } from 'src/app/modules/i18n';
import { environment } from 'src/environments/environment';

export type ProjectDiscussionContext = 'client' | 'insighter';

/** `private_offer` = Client ↔ one Insighter thread on a submitted offer (proposal stage only). */
export type ProjectDiscussionVisibility = 'public' | 'private_offer';

/** Messages are paginated oldest-first; read every page so the newest ones are never cut off. */
const DISCUSSION_PAGE_SIZE = 100;

export interface ProjectDiscussionMessage {
  id: string;
  stage: string | null;
  visibility: ProjectDiscussionVisibility;
  project_proposal_offer_id: number | null;
  body: string;
  sender: string;
  date: string | null;
  uuid: string | null;
  profile_photo_url: string | null;
  is_current_user?: boolean | null;
  /** Viewer's read state; own messages are always read. `null` when the API does not say. */
  is_read: boolean | null;
}

@Injectable({
  providedIn: 'root',
})
export class ProjectDiscussionService {
  currentLang = 'en';
  /** Emits after an offer thread was marked read — the API also marks its bell notifications read. */
  readonly offerThreadRead$ = new Subject<void>();

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
    return this.listAllPages(this.getDiscussionUrl(context, projectUuid));
  }

  sendMessage(context: ProjectDiscussionContext, projectUuid: string, body: string): Observable<ProjectDiscussionMessage | null> {
    return this.postMessage(this.getMessagesUrl(context, projectUuid), body);
  }

  /** Private thread of one submitted offer — `offerUuid` is the project_proposal_offer UUID, never the project/service id. */
  listOfferMessages(
    context: ProjectDiscussionContext,
    projectUuid: string,
    offerUuid: string
  ): Observable<ProjectDiscussionMessage[]> {
    return this.listAllPages(`${this.getBaseUrl(context)}/offer/${projectUuid}/${offerUuid}`);
  }

  sendOfferMessage(
    context: ProjectDiscussionContext,
    projectUuid: string,
    offerUuid: string,
    body: string
  ): Observable<ProjectDiscussionMessage | null> {
    return this.postMessage(`${this.getBaseUrl(context)}/messages/offer/${projectUuid}/${offerUuid}`, body);
  }

  /** Marks every incoming message of the offer thread (and its notifications) read for the caller — 204. */
  markOfferThreadRead(context: ProjectDiscussionContext, projectUuid: string, offerUuid: string): Observable<void> {
    return this.http.put<void>(`${this.getBaseUrl(context)}/offer/read/${projectUuid}/${offerUuid}`, {}, {
      headers: this.getHeaders(),
    }).pipe(
      map(() => undefined),
      tap(() => this.offerThreadRead$.next()),
      catchError(error => throwError(() => error))
    );
  }

  private listAllPages(url: string): Observable<ProjectDiscussionMessage[]> {
    const fetchPage = (page: number) => this.http.get<any>(url, {
      headers: this.getHeaders(),
      params: { per_page: DISCUSSION_PAGE_SIZE, page },
    });

    return fetchPage(1).pipe(
      switchMap(first => {
        const lastPage = Number(first?.meta?.last_page) || 1;
        if (lastPage <= 1) return of([first]);
        const rest = Array.from({ length: lastPage - 1 }, (_, i) => fetchPage(i + 2));
        return forkJoin(rest).pipe(map(pages => [first, ...pages]));
      }),
      map(pages => flatMapList(pages.map((page, pageIndex) => ({ page, pageIndex })), ({ page, pageIndex }) =>
        this.mapMessages(page).map((message, index) =>
          message.id === `${index}` ? { ...message, id: `${pageIndex}-${index}` } : message))),
      catchError(error => throwError(() => error))
    );
  }

  /** The API answers 204 with no body, so callers reload the thread when this emits null. */
  private postMessage(url: string, body: string): Observable<ProjectDiscussionMessage | null> {
    return this.http.post<any>(url, { body }, {
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

  private getBaseUrl(context: ProjectDiscussionContext): string {
    const prefix = context === 'client' ? 'account' : 'insighter';
    return `${environment.apiBaseUrl}/${prefix}/project/discussion`;
  }

  private getDiscussionUrl(context: ProjectDiscussionContext, projectUuid: string): string {
    return `${this.getBaseUrl(context)}/${projectUuid}`;
  }

  private getMessagesUrl(context: ProjectDiscussionContext, projectUuid: string): string {
    return `${this.getBaseUrl(context)}/messages/${projectUuid}`;
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
      visibility: item?.visibility === 'private_offer' || item?.project_proposal_offer_id ? 'private_offer' : 'public',
      project_proposal_offer_id: Number(item?.project_proposal_offer_id) || null,
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
      is_read: this.toOptionalBoolean(item?.is_read),
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
