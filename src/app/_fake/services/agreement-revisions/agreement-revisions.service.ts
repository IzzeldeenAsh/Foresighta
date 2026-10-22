import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Subject } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from 'src/environments/environment';
import { TranslationService } from 'src/app/modules/i18n';
import { AgreementPatch, AgreementRevision, AgreementRevisionList, AgreementRole, MarketOption, agreementFormData, payloadHasFiles } from './agreement-revisions.model';

@Injectable({ providedIn: 'root' })
export class AgreementRevisionsService {
  readonly changed$ = new Subject<{ projectUuid: string; revisionId?: number }>();
  /** A revision was marked seen; the backend also marks its bell notification read. */
  readonly seen$ = new Subject<{ projectUuid: string; revisionId: number }>();
  constructor(private http: HttpClient, private translation: TranslationService) {}
  private headers() {
    return new HttpHeaders({ Accept: 'application/json', 'Accept-Language': this.translation.getSelectedLanguage(), 'X-Timezone': Intl.DateTimeFormat().resolvedOptions().timeZone });
  }
  private base(role: AgreementRole) { return `${environment.apiBaseUrl}/${role === 'client' ? 'account' : 'insighter'}/project`; }
  /** One Client ↔ Insighter negotiation: every Client revision plus that match's own. Stable before and after the offer. */
  list(role: AgreementRole, matchUuid: string, page = 1) {
    return this.http.get<AgreementRevisionList>(`${this.base(role)}/agreement-revisions/match/${encodeURIComponent(matchUuid)}`, { headers: this.headers(), params: { page, per_page: 25 } });
  }
  show(role: AgreementRole, matchUuid: string, revisionId: number) {
    return this.http.get<{ data: AgreementRevision }>(`${this.base(role)}/agreement-revisions/match/${encodeURIComponent(matchUuid)}/${revisionId}`, { headers: this.headers() }).pipe(map(res => res.data));
  }
  markSeen(role: AgreementRole, matchUuid: string, revisionId: number) {
    return this.http.post<unknown>(`${this.base(role)}/agreement-revisions/match/${encodeURIComponent(matchUuid)}/${revisionId}/seen`, {}, { headers: this.headers() });
  }
  /** The Client's own project-wide revisions; works before any offer exists. */
  listForProject(projectUuid: string, page = 1) {
    return this.http.get<AgreementRevisionList>(`${this.base('client')}/${encodeURIComponent(projectUuid)}/agreement-revisions`, { headers: this.headers(), params: { page, per_page: 25 } });
  }
  showForProject(projectUuid: string, revisionId: number) {
    return this.http.get<{ data: AgreementRevision }>(`${this.base('client')}/${encodeURIComponent(projectUuid)}/agreement-revisions/${revisionId}`, { headers: this.headers() }).pipe(map(res => res.data));
  }
  /** Market options for the target-market component (country / region / economic bloc lists). */
  markets(type: string) {
    const endpoint: Record<string, string> = { country: 'country/list', region: 'region/list', economic: 'economic-bloc/list' };
    return this.http.get<{ data: MarketOption[] }>(`${environment.apiBaseUrl}/common/setting/${endpoint[type] ?? endpoint['country']}`, { headers: this.headers() })
      .pipe(map(res => res?.data ?? []));
  }
  /** New offer or sub-scope files switch the request to multipart; everything else stays JSON.
   * `contextUuid` is the project for the Client and the offer for the Insighter. */
  update(role: AgreementRole, contextUuid: string, payload: AgreementPatch, files: File[] = []) {
    // Sent as POST with Laravel's method override: a real PATCH fails the CORS preflight.
    const body = files.length || payloadHasFiles(payload) ? agreementFormData(payload, files) : { ...payload, _method: 'PATCH' };
    return this.http.post<{ data: AgreementRevision }>(`${this.base(role)}/agreement/${role}-requirements/${encodeURIComponent(contextUuid)}`, body, { headers: this.headers() }).pipe(map(res => res.data));
  }
}
