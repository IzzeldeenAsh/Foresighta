import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { BehaviorSubject, Observable, throwError } from 'rxjs';
import { catchError, finalize, map } from 'rxjs/operators';
import { TranslationService } from 'src/app/modules/i18n/translation.service';
import { environment } from 'src/environments/environment';

export type CreatedProjectType = 'ad_hoc' | 'frame_work_agreement' | 'urgent_request' | string;

export interface CreatedProjectService {
  id: number;
  name: string;
  slug: string;
}

export interface CreatedProjectBlock {
  [key: string]: any;
}

export interface CreatedProjectFile {
  uuid: string;
  url?: string | null;
  [key: string]: any;
}

export interface CreatedProjectContract {
  uuid: string | null;
  user_sign_at: boolean;
  insighter_sign_at: boolean;
  is_attach_type: boolean;
  status?: string | null;
  file?: CreatedProjectFile | null;
  guideline?: string | null;
  name?: string | null;
  [key: string]: any;
}

export interface CreatedProjectProposalFiles {
  general: CreatedProjectFile[];
  scopes: CreatedProjectFile[];
  offer: CreatedProjectFile[];
  [key: string]: CreatedProjectFile[];
}

export interface CreatedProjectFiles {
  proposal: CreatedProjectProposalFiles;
  [key: string]: any;
}

export interface CreatedProjectScope {
  scope: string | null;
  description?: string | null;
  files?: CreatedProjectFile[];
  children?: CreatedProjectScope[];
  [key: string]: any;
}

export interface CreatedProject {
  uuid: string;
  title: string;
  type: CreatedProjectType;
  language: string | null;
  service: CreatedProjectService | null;
  service_prompt: string | null;
  country_base: any;
  phase: string | null;
  business_type: string | null;
  insighter_preferred_type: string | null;
  industry: any;
  description: string | null;
  budget_min: number | null;
  budget_max: number | null;
  deadline: string | null;
  components: CreatedProjectBlock[];
  addons: CreatedProjectBlock[];
  scopes: CreatedProjectScope[];
  request_files: CreatedProjectFile[];
  file: CreatedProjectFiles | null;
  invited: CreatedProjectProposalInvite[];
  status?: string | null;
  contract_uuid?: string | null;
  contract?: CreatedProjectContract | null;
}

export interface CreatedProjectInvitedInsighterCountry {
  id?: number | null;
  name?: string | null;
  flag?: string | null;
}

export interface CreatedProjectInvitedInsighterCompany {
  id?: number | null;
  legal_name?: string | null;
  logo?: string | null;
}

export interface CreatedProjectInvitedInsighter {
  uuid: string;
  name: string | null;
  profile_photo_url: string | null;
  roles?: string[];
  country?: CreatedProjectInvitedInsighterCountry | null;
  company?: CreatedProjectInvitedInsighterCompany | null;
}

export interface CreatedProjectSubmittedOffer {
  uuid: string;
  proposed_price: string | number | null;
  payment_plan?: string | null;
  down_payment: string | number | null;
  final_payment: string | number | null;
  estimated_hours: string | number | null;
  cover_letter: string | null;
  status: string | null;
  files: CreatedProjectFile[];
  contract_uuid?: string | null;
}

export interface CreatedProjectProposalInvite {
  uuid: string;
  action_status: string | null;
  submission_status: string | null;
  deadline_offer: string | null;
  total_matches: number | null;
  match_score: number;
  matches: Record<string, boolean | undefined>;
  is_match_all: boolean;
  is_match_before: boolean;
  is_invited_before: boolean;
  status: string | null;
  insighter: CreatedProjectInvitedInsighter | null;
  offer: CreatedProjectSubmittedOffer | null;
}

export interface CreatedProjectProposalMatchCountry {
  id?: number | null;
  name?: string | { en?: string; ar?: string } | null;
  names?: { en?: string; ar?: string } | null;
  flag?: string | null;
}

export interface CreatedProjectProposalMatchCompany {
  uuid?: string | null;
  id?: number | null;
  legal_name?: string | null;
  logo?: string | null;
  verified?: boolean | null;
}

export interface CreatedProjectProposalMatchInsighter {
  uuid: string;
  name: string;
  profile_photo_url: string | null;
  roles: string[];
  country?: CreatedProjectProposalMatchCountry | null;
  company?: CreatedProjectProposalMatchCompany | null;
}

export interface CreatedProjectProposalMatch {
  uuid: string;
  insighter: CreatedProjectProposalMatchInsighter;
  match_score: number;
  matches: Record<string, boolean | undefined>;
  is_match_all: boolean;
  is_match_before: boolean;
  status: string | null;
}

export interface SubmitRematchProposalPayload {
  deadline_offer: string;
  matches: string[];
}

export interface CreatedProjectsFilters {
  project_status?: string | null;
}

interface PaginationLinks {
  first: string;
  last: string;
  prev: string | null;
  next: string | null;
}

interface PaginationMeta {
  current_page: number;
  from: number;
  last_page: number;
  links: any[];
  path: string;
  per_page: number;
  to: number;
  total: number;
}

export interface CreatedProjectsPaginatedResponse {
  data: CreatedProject[];
  links: PaginationLinks;
  meta: PaginationMeta;
}

@Injectable({
  providedIn: 'root'
})
export class ProjectsCreatedService {
  private readonly baseUrl = `${environment.apiBaseUrl}/account/project`;
  private isLoadingSubject = new BehaviorSubject<boolean>(false);
  public isLoading$: Observable<boolean> = this.isLoadingSubject.asObservable();
  currentLang: string = 'en';

  constructor(
    private http: HttpClient,
    private translationService: TranslationService
  ) {
    this.currentLang = this.normalizeLanguage(this.translationService.getSelectedLanguage() || 'en');
    this.translationService.onLanguageChange().subscribe(lang => {
      this.currentLang = this.normalizeLanguage(lang || 'en');
    });
  }

  private normalizeLanguage(lang: string): string {
    if (!lang) return 'en';
    return lang.toLowerCase().startsWith('ar') ? 'ar' : 'en';
  }

  private setLoading(loading: boolean): void {
    this.isLoadingSubject.next(loading);
  }

  private getHeaders(): HttpHeaders {
    return new HttpHeaders({
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Accept-Language': this.currentLang,
      'X-Timezone': Intl.DateTimeFormat().resolvedOptions().timeZone,
    });
  }

  private getFormDataHeaders(): HttpHeaders {
    return new HttpHeaders({
      'Accept': 'application/json',
      'Accept-Language': this.currentLang,
      'X-Timezone': Intl.DateTimeFormat().resolvedOptions().timeZone,
    });
  }

  getProjects(
    page: number = 1,
    filters: CreatedProjectsFilters = {}
  ): Observable<CreatedProjectsPaginatedResponse> {
    this.setLoading(true);

    let params = new HttpParams().set('page', `${page}`);
    if (filters.project_status) {
      params = params.set('project_status', filters.project_status);
    }

    return this.http.get<any>(this.baseUrl, {
      headers: this.getHeaders(),
      params,
    }).pipe(
      map(response => this.mapPaginatedResponse(response)),
      catchError(error => throwError(() => error)),
      finalize(() => this.setLoading(false))
    );
  }

  getProject(uuid: string): Observable<CreatedProject> {
    this.setLoading(true);

    return this.http.get<any>(`${this.baseUrl}/show/${uuid}`, {
      headers: this.getHeaders(),
    }).pipe(
      map(response => this.mapProject(response?.data ?? response)),
      catchError(error => throwError(() => error)),
      finalize(() => this.setLoading(false))
    );
  }

  getProjectFileUrl(fileUuid: string): Observable<string> {
    return this.http.get<any>(`${environment.apiBaseUrl}/account/project/file/download/${fileUuid}`, {
      headers: this.getHeaders(),
    }).pipe(
      map(response => response?.file ?? response?.data?.url ?? response?.url ?? response?.data ?? ''),
      catchError(error => throwError(() => error))
    );
  }

  createProjectProposal(projectUuid: string): Observable<string> {
    this.setLoading(true);

    return this.http.post<any>(`${this.baseUrl}/proposal/new/${projectUuid}`, {}, {
      headers: this.getHeaders(),
    }).pipe(
      map(response => {
        const proposalUuid = this.extractUuidFromResponse(response);
        if (!proposalUuid) {
          throw new Error('proposal_uuid_missing');
        }

        return proposalUuid;
      }),
      catchError(error => throwError(() => error)),
      finalize(() => this.setLoading(false))
    );
  }

  getProjectProposalMatches(proposalUuid: string): Observable<CreatedProjectProposalMatch[]> {
    this.setLoading(true);

    return this.http.get<any>(`${this.baseUrl}/proposal/match/${proposalUuid}`, {
      headers: this.getHeaders(),
    }).pipe(
      map(response => this.mapProposalMatches(response)),
      catchError(error => throwError(() => error)),
      finalize(() => this.setLoading(false))
    );
  }

  submitRematchProposal(
    proposalUuid: string,
    payload: SubmitRematchProposalPayload
  ): Observable<any> {
    this.setLoading(true);

    return this.http.post<any>(`${this.baseUrl}/proposal/submit/${proposalUuid}`, payload, {
      headers: this.getHeaders(),
    }).pipe(
      catchError(error => throwError(() => error)),
      finalize(() => this.setLoading(false))
    );
  }

  acceptProposalOffer(offerUuid: string): Observable<any> {
    this.setLoading(true);

    return this.http.post<any>(`${this.baseUrl}/proposal/offer/accept/${offerUuid}`, {}, {
      headers: this.getHeaders(),
    }).pipe(
      catchError(error => throwError(() => error)),
      finalize(() => this.setLoading(false))
    );
  }

  signProjectContract(contractUuid: string, payload: FormData): Observable<any> {
    this.setLoading(true);

    return this.http.post<any>(`${this.baseUrl}/contract/sign/${contractUuid}`, payload, {
      headers: this.getFormDataHeaders(),
    }).pipe(
      catchError(error => throwError(() => error)),
      finalize(() => this.setLoading(false))
    );
  }

  getProjectContract(contractUuid: string): Observable<CreatedProjectContract> {
    this.setLoading(true);

    return this.http.get<any>(`${this.baseUrl}/contract/${contractUuid}`, {
      headers: this.getHeaders(),
    }).pipe(
      map(response => this.mapProjectContract(response?.data ?? response)),
      catchError(error => throwError(() => error)),
      finalize(() => this.setLoading(false))
    );
  }

  private mapPaginatedResponse(response: any): CreatedProjectsPaginatedResponse {
    return {
      data: Array.isArray(response?.data) ? response.data.map((p: any) => this.mapProject(p)) : [],
      links: response?.links ?? { first: '', last: '', prev: null, next: null },
      meta: response?.meta ?? {
        current_page: 1, from: 0, last_page: 1, links: [],
        path: this.baseUrl, per_page: 10, to: 0, total: 0,
      },
    };
  }

  private mapProject(p: any): CreatedProject {
    return {
      uuid: p?.uuid ?? '',
      title: p?.title ?? '',
      type: p?.type ?? '',
      language: p?.language ?? null,
      service: p?.service ?? null,
      service_prompt: p?.service_prompt ?? null,
      country_base: p?.country_base ?? null,
      phase: p?.phase ?? null,
      business_type: p?.business_type ?? null,
      insighter_preferred_type: p?.insighter_preferred_type ?? null,
      industry: p?.industry ?? null,
      description: p?.description ?? null,
      budget_min: p?.budget_min ?? null,
      budget_max: p?.budget_max ?? null,
      deadline: p?.deadline ?? null,
      components: this.sanitizeBlocks(p?.components),
      addons: this.sanitizeBlocks(p?.addons),
      scopes: this.sanitizeScopes(p?.scopes),
      request_files: this.sanitizeFiles(p?.request_files),
      file: this.sanitizeProjectFiles(p?.file),
      invited: this.mapProjectInvites(p?.invited),
      status: p?.status ?? null,
      contract_uuid: p?.contract_uuid ?? p?.contract?.uuid ?? null,
      contract: p?.contract && typeof p.contract === 'object' ? this.mapProjectContract(p.contract) : null,
    };
  }

  private mapProjectContract(contract: any): CreatedProjectContract {
    return {
      ...(contract || {}),
      uuid: contract?.uuid ?? contract?.contract_uuid ?? null,
      user_sign_at: this.toBoolean(contract?.user_sign_at),
      insighter_sign_at: this.toBoolean(contract?.insighter_sign_at),
      is_attach_type: this.toBoolean(contract?.is_attach_type),
      status: contract?.status ?? null,
      file: contract?.file && typeof contract.file === 'object' ? contract.file : null,
      guideline: contract?.guideline ?? contract?.contract?.guideline ?? null,
      name: contract?.name ?? contract?.contract?.name ?? null,
    };
  }

  private mapProjectInvites(invited: any[] | null | undefined): CreatedProjectProposalInvite[] {
    if (!Array.isArray(invited)) return [];

    return invited
      .map((item: any) => ({
        uuid: this.stringifyValue(item?.uuid ?? item?.id ?? item?.insighter?.uuid),
        action_status: item?.action_status ?? item?.status ?? null,
        submission_status: item?.submission_status ?? null,
        deadline_offer: item?.deadline_offer ?? null,
        total_matches: item?.total_matches ?? null,
        match_score: this.normalizeMatchScore(item?.match_score),
        matches: item?.matches && typeof item.matches === 'object' && !Array.isArray(item.matches)
          ? item.matches
          : {},
        is_match_all: Boolean(item?.is_match_all ?? item?.is_match_all_properties),
        is_match_before: Boolean(item?.is_match_before),
        is_invited_before: Boolean(item?.is_invited_before),
        status: item?.status ?? null,
        insighter: item?.insighter ? {
          uuid: this.stringifyValue(item.insighter?.uuid),
          name: item.insighter?.name ?? null,
          profile_photo_url: item.insighter?.profile_photo_url ?? null,
          roles: Array.isArray(item.insighter?.roles) ? item.insighter.roles : [],
          country: item.insighter?.country ?? null,
          company: item.insighter?.company ?? null,
        } : null,
        offer: item?.offer ? {
          uuid: this.stringifyValue(item.offer?.uuid),
          proposed_price: item.offer?.proposed_price ?? null,
          payment_plan: item.offer?.payment_plan ?? null,
          down_payment: item.offer?.down_payment ?? null,
          final_payment: item.offer?.final_payment ?? null,
          estimated_hours: item.offer?.estimated_hours ?? null,
          cover_letter: item.offer?.cover_letter ?? null,
          status: item.offer?.status ?? null,
          files: this.sanitizeFiles(item.offer?.files),
          contract_uuid: item.offer?.contract_uuid ?? item?.contract_uuid ?? item?.contract?.uuid ?? null,
        } : null,
      }))
      .filter((invite: CreatedProjectProposalInvite) => !!invite.uuid || !!invite.insighter?.uuid);
  }

  private mapProposalMatches(response: any): CreatedProjectProposalMatch[] {
    const data = response?.data;
    const matches = Array.isArray(data)
      ? data
      : Array.isArray(data?.matches)
        ? data.matches
        : [];

    return matches
      .map((item: any) => this.mapProposalMatch(item))
      .filter((match: CreatedProjectProposalMatch) => !!match.uuid && !!match.insighter.uuid);
  }

  private mapProposalMatch(item: any): CreatedProjectProposalMatch {
    const insighter = item?.insighter && typeof item.insighter === 'object'
      ? item.insighter
      : {};
    const matchUuid = this.stringifyValue(item?.uuid ?? item?.match_uuid ?? item?.id ?? insighter?.uuid);

    return {
      uuid: matchUuid,
      insighter: {
        uuid: this.stringifyValue(insighter?.uuid),
        name: this.stringifyValue(insighter?.name),
        profile_photo_url: insighter?.profile_photo_url ?? null,
        roles: Array.isArray(insighter?.roles) ? insighter.roles : [],
        country: insighter?.country ?? null,
        company: insighter?.company ?? null,
      },
      match_score: this.normalizeMatchScore(item?.match_score),
      matches: item?.matches && typeof item.matches === 'object' && !Array.isArray(item.matches)
        ? item.matches
        : {},
      is_match_all: Boolean(item?.is_match_all ?? item?.is_match_all_properties),
      is_match_before: Boolean(item?.is_match_before),
      status: item?.status ?? null,
    };
  }

  private extractUuidFromResponse(response: any): string {
    const candidates = [
      response?.data?.uuid,
      response?.data?.proposal_uuid,
      response?.data?.project_proposal_uuid,
      response?.data?.id,
      response?.uuid,
      response?.proposal_uuid,
      response?.project_proposal_uuid,
      response?.id,
      response?.data,
    ];

    for (const candidate of candidates) {
      if (candidate !== null && typeof candidate === 'object') continue;
      const value = this.stringifyValue(candidate);
      if (value) return value;
    }

    return '';
  }

  private normalizeMatchScore(value: any): number {
    const score = Number(value);
    if (!Number.isFinite(score)) return 0;
    return Math.min(Math.max(score, 0), 1);
  }

  private stringifyValue(value: any): string {
    if (value === null || value === undefined) return '';
    return String(value).trim();
  }

  private toBoolean(value: any): boolean {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value === 1;
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      return ['1', 'true', 'yes'].includes(normalized);
    }

    return false;
  }

  private sanitizeBlocks(blocks: any[] | null | undefined): CreatedProjectBlock[] {
    if (!Array.isArray(blocks)) return [];
    return blocks.filter(block => {
      if (!block || typeof block !== 'object' || Array.isArray(block)) return false;
      return Object.keys(block).length > 0;
    });
  }

  private sanitizeScopes(scopes: CreatedProjectScope[] | null | undefined): CreatedProjectScope[] {
    if (!Array.isArray(scopes)) return [];

    return scopes
      .filter(scope => scope && typeof scope === 'object' && !Array.isArray(scope))
      .map(scope => ({
        ...scope,
        scope: scope.scope ?? null,
        description: scope.description ?? null,
        files: this.sanitizeFiles(scope.files),
        children: this.sanitizeScopes(scope.children),
      }))
      .filter(scope => !!scope.scope || !!scope.description || !!scope.files?.length || !!scope.children?.length);
  }

  private sanitizeFiles(files: CreatedProjectFile[] | null | undefined): CreatedProjectFile[] {
    if (!Array.isArray(files)) return [];

    return files
      .filter(file => file && typeof file === 'object' && !Array.isArray(file))
      .map(file => ({
        ...file,
        uuid: file.uuid ?? '',
        url: file.url ?? null,
      }))
      .filter(file => !!file.uuid);
  }

  private sanitizeProjectFiles(file: any): CreatedProjectFiles | null {
    if (!file || typeof file !== 'object' || Array.isArray(file)) return null;

    const proposal = file.proposal && typeof file.proposal === 'object' && !Array.isArray(file.proposal)
      ? file.proposal
      : {};

    return {
      ...file,
      proposal: {
        general: this.sanitizeFiles(proposal.general),
        scopes: this.sanitizeFiles(proposal.scopes),
        offer: this.sanitizeFiles(proposal.offer),
      },
    };
  }
}
