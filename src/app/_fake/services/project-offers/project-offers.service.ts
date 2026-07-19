import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { BehaviorSubject, Observable, throwError } from 'rxjs';
import { catchError, finalize, map } from 'rxjs/operators';
import { TranslationService } from 'src/app/modules/i18n/translation.service';
import { environment } from 'src/environments/environment';
import { ProjectTimeline } from '../project-timeline/project-timeline.model';

export type ProjectOfferType = 'ad_hoc' | 'frame_work_agreement' | 'urgent_request' | string;
export type ProjectOfferProjectStatus = 'invited' | 'cancelled' | 'submitted' | 'closed' | string;
export type ProjectOfferActionStatus = 'pending' | 'viewed' | 'interested' | 'offered' | 'not_interested' | 'expired' | string;
export type ProjectOfferStage = 'proposal' | 'project' | string;
export type ProjectFileUploadType = 'first_draft' | 'final_draft' | 'samples' | 'document' | 'other' | string;
export type ProjectReviewSubmissionType = 'first_draft' | 'final_draft' | 'session_completed' | string;
export type ProjectReviewSubmissionStatus = 'pending' | 'approved' | 'changes_requested' | string;
export type ProjectReviewSubmissionPriorityValue = 'normal' | 'medium' | 'critical' | string;

export interface ProjectReviewSubmissionPriority {
  value: ProjectReviewSubmissionPriorityValue | null;
  label: string | null;
  color: string | null;
}

export interface ProjectOffersFilters {
  action_status?: ProjectOfferActionStatus | null;
  stage?: ProjectOfferStage | null;
  per_page?: number | null;
}

export interface ProjectOfferStatusStatistic {
  status: ProjectOfferActionStatus;
  label: string;
  total: number;
}

export interface ProjectOfferStatistics {
  total: number;
  statuses: ProjectOfferStatusStatistic[];
  active_projects_total?: number;
}

export interface ProjectOfferService {
  id: number;
  name: string;
  slug: string;
}

export interface ProjectOfferTargetMarketObject {
  id: number;
  name: string;
  flag?: string | null;
}

export interface ProjectOfferBlock {
  [key: string]: any;
}

export interface ProjectOfferFile {
  uuid: string;
  name?: string | null;
  url?: string | null;
  identifier?: string | null;
  second_identifier?: string | null;
  uploadBy?: string | null;
  uploadByAvatarProfile?: string | null;
  uploaded_by?: string | null;
  uploaded_by_avatar_profile?: string | null;
  upload_date?: string | null;
  scope?: string | null;
  is_read?: boolean | null;
  read_at?: string | null;
  [key: string]: any;
}

export interface ProjectOfferProposalFiles {
  general: ProjectOfferFile[];
  scopes: ProjectOfferFile[];
  offer: ProjectOfferFile[];
}

export interface ProjectOfferFiles {
  proposal: ProjectOfferProposalFiles;
  project: ProjectOfferFile[];
  [key: string]: any;
}

export interface ProjectContractFile {
  name?: string | null;
  url?: string | null;
  uuid?: string | null;
  [key: string]: any;
}

export interface ProjectContract {
  uuid?: string | null;
  user_sign_at: boolean;
  insighter_sign_at: boolean;
  is_attach_type: boolean;
  status: string | null;
  file: ProjectContractFile | null;
  guideline?: string | null;
  rendered_guideline?: string | null;
  language?: string | null;
  court_country?: any;
  name?: string | null;
  [key: string]: any;
}

export interface ProjectOfferScope {
  scope: string | null;
  description?: string | null;
  files?: ProjectOfferFile[];
  children?: ProjectOfferScope[];
  [key: string]: any;
}

export interface ProjectOfferProposalSummary {
  uuid: string;
  status: string | null;
  action_status: ProjectOfferActionStatus | null;
  deadline: string | null;
  proposal_no?: string | null;
  match_uuid?: string | null;
}

export interface ProjectOfferDetails {
  uuid: string;
  proposed_price: string | number | null;
  payment_plan: string | null;
  down_payment_percentage: string | number | null;
  down_payment: string | number | null;
  final_payment_percentage: string | number | null;
  final_payment: string | number | null;
  estimated_hours: string | number | null;
  cover_letter: string | null;
  status: string | null;
  contract_uuid?: string | null;
  contract?: ProjectContract | null;
  files?: ProjectOfferFile[] | null;
}

export interface ProjectOffer {
  /** Project UUID — routing/details identifier (GET /insighter/project/show/{uuid}). */
  uuid: string;
  /** Backward-compatible status. Prefer proposal_status/project_status in new UI. */
  status: ProjectOfferProjectStatus | null;
  /** Proposal match action status: pending/viewed/interested/offered/etc. */
  action_status: ProjectOfferActionStatus | null;
  /** Project workflow status: contracting/payment/in_progress/in_review/closed/etc. */
  project_status?: ProjectOfferProjectStatus | null;
  /** Project proposal submission status. */
  proposal_status?: string | null;
  /** ProjectProposalMatch UUID — required for proposal actions (interest/decline/add-offer/mark-as-viewd). */
  match_uuid?: string | null;
  /** 'project' when the project was awarded to this insighter, otherwise 'proposal'. */
  stage?: ProjectOfferStage | null;
  created_at?: string | null;
  updated_at?: string | null;
  invited_at?: string | null;
  proposal_no?: string | null;
  project_proposal_uuid?: string | null;
  /** All proposals the insighter was invited to for this project (newest first). */
  proposals?: ProjectOfferProposalSummary[];
  contract_uuid?: string | null;
  contract?: ProjectContract | null;
  offer?: ProjectOfferDetails | null;
  project: {
    uuid?: string | null;
    title: string;
    type: ProjectOfferType;
    language: string | null;
    service: ProjectOfferService | null;
    service_prompt: string | null;
    phase: string | null;
    business_type: string | null;
    industry: any;
    description: string | null;
    deadline_offer: string | null;
    deadline: string | null;
    created_at?: string | null;
    updated_at?: string | null;
    is_read?: boolean | null;
    read_at?: string | null;
    components: ProjectOfferBlock[];
    addons: ProjectOfferBlock[];
    scopes: ProjectOfferScope[];
    request_files: ProjectOfferFile[];
    file?: ProjectOfferFiles;
    status?: ProjectOfferProjectStatus | null;
    cancelled_at?: string | null;
    contract_uuid?: string | null;
    contract?: ProjectContract | null;
  };
}

interface ProjectOffersPaginationLinks {
  first: string;
  last: string;
  prev: string | null;
  next: string | null;
}

interface ProjectOffersPaginationMeta {
  current_page: number;
  from: number;
  last_page: number;
  links: any[];
  path: string;
  per_page: number;
  to: number;
  total: number;
}

export interface ProjectOffersPaginatedResponse {
  data: ProjectOffer[];
  links: ProjectOffersPaginationLinks;
  meta: ProjectOffersPaginationMeta;
}

export interface ProjectOfferActionResponse {
  message?: string;
}

export interface ProjectReviewSubmission {
  uuid: string;
  type?: ProjectReviewSubmissionType | null;
  status: ProjectReviewSubmissionStatus | null;
  priority: ProjectReviewSubmissionPriority;
  note: string | null;
  request_at: string | null;
  review_note: string | null;
  reviewed_at: string | null;
  files?: ProjectOfferFile[];
  is_read?: boolean | null;
  read_at?: string | null;
  [key: string]: any;
}

export interface InsighterProjectAccountSettingsService {
  id: number;
  name: string;
  slug?: string;
}

export interface InsighterProjectAccountSettings {
  status: string | null;
  languages: string | null;
  hourly_rate: string | number | null;
  service_match_ai?: boolean;
  services?: InsighterProjectAccountSettingsService[];
  [key: string]: any;
}

export type ProposalEstimateUnit = 'hours' | 'days';

export interface ProjectProposalOfferPayload {
  cover_letter: string;
  hourly_rate: string | number;
  estimated_hours: string | number;
  payment_plan: 'full_at_start' | 'full_at_end' | 'partial';
  down_payment_percentage?: string | number;
  final_payment_percentage?: string | number;
}

/**
 * Raw item returned by GET /insighter/project (list) and
 * GET /insighter/project/show/{project} (details). Project-shaped payload with
 * embedded proposal summaries; details additionally nest the insighter match
 * (match uuid + offer) inside each proposal.
 */
interface ApiInsighterProject {
  uuid: string;
  title: string;
  type: ProjectOfferType;
  language: string | null;
  service: ProjectOfferService | null;
  prompt_ai?: string | null;
  phase?: string | null;
  status?: string | null;
  stage?: ProjectOfferStage | null;
  is_read?: any;
  read_at?: string | null;
  business_type?: string | null;
  description?: string | null;
  deadline?: string | null;
  components?: ProjectOfferBlock[];
  addons?: ProjectOfferBlock[];
  scopes?: ProjectOfferScope[] | null;
  request_files?: ProjectOfferFile[] | null;
  file?: any;
  contract?: any;
  proposals?: ApiInsighterProjectProposal[];
  [key: string]: any;
}

interface ApiInsighterProjectProposal {
  uuid: string;
  status?: string | null;
  proposal_no?: string | null;
  created_at?: string | null;
  deadline?: string | null;
  deadline_offer?: string | null;
  action_status?: ProjectOfferActionStatus | null;
  match?: {
    uuid: string;
    action_status?: ProjectOfferActionStatus | null;
    project_proposal?: any;
    offer?: any;
  } | null;
  [key: string]: any;
}

@Injectable({
  providedIn: 'root'
})
export class ProjectOffersService {
  /** Proposal action endpoints (mark-as-viewd / interest / decline / add-offer) — take the match UUID. */
  private readonly baseUrl = `${environment.apiBaseUrl}/insighter/project/proposal`;
  /** Unified projects endpoint — proposal-stage and awarded (active) projects together. */
  private readonly projectsUrl = `${environment.apiBaseUrl}/insighter/project`;
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
    if (!lang) {
      return 'en';
    }

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

  getProjectOffers(
    page: number = 1,
    filters: ProjectOffersFilters = {}
  ): Observable<ProjectOffersPaginatedResponse> {
    this.setLoading(true);

    return this.http.get<any>(this.projectsUrl, {
      headers: this.getHeaders(),
      params: this.buildHttpParams(page, filters),
    }).pipe(
      map(response => this.mapProjectsResponse(response)),
      catchError(error => throwError(() => error)),
      finalize(() => this.setLoading(false))
    );
  }

  getProjectStatistics(): Observable<ProjectOfferStatistics> {
    return this.http.get<any>(`${this.projectsUrl}/statistics`, {
      headers: this.getHeaders(),
    }).pipe(
      map(response => this.mapProjectStatistics(response)),
      catchError(error => throwError(() => error))
    );
  }

  getOnWorkProjects(page: number = 1): Observable<ProjectOffersPaginatedResponse> {
    return this.getProjectOffers(page, { stage: 'project' });
  }

  getInsighterProjectDetails(projectUuid: string): Observable<ProjectOffer> {
    this.setLoading(true);

    return this.http.get<any>(`${this.projectsUrl}/show/${projectUuid}`, {
      headers: this.getHeaders(),
    }).pipe(
      map(response => this.mapInsighterProject(response?.data ?? response)),
      catchError(error => throwError(() => error)),
      finalize(() => this.setLoading(false))
    );
  }

  uploadInsighterProjectFile(projectUuid: string, payload: FormData): Observable<any> {
    this.setLoading(true);

    return this.http.post<any>(
      `${environment.apiBaseUrl}/insighter/project/file/upload/${projectUuid}`,
      payload,
      { headers: this.getFormDataHeaders() }
    ).pipe(
      catchError(error => throwError(() => error)),
      finalize(() => this.setLoading(false))
    );
  }

  requestProjectReview(
    projectUuid: string,
    payload: FormData
  ): Observable<any> {
    this.setLoading(true);

    return this.http.post<any>(
      `${environment.apiBaseUrl}/insighter/project/review-submission/${projectUuid}`,
      payload,
      { headers: this.getFormDataHeaders() }
    ).pipe(
      catchError(error => throwError(() => error)),
      finalize(() => this.setLoading(false))
    );
  }

  getProjectReviewSubmissions(projectUuid: string): Observable<ProjectReviewSubmission[]> {
    return this.http.get<any>(`${environment.apiBaseUrl}/insighter/project/review-submission/${projectUuid}`, {
      headers: this.getHeaders(),
    }).pipe(
      map(response => this.mapReviewSubmissions(response)),
      catchError(error => throwError(() => error))
    );
  }

  getProjectTimeline(projectUuid: string): Observable<ProjectTimeline> {
    return this.http.get<any>(`${this.projectsUrl}/timeline/${projectUuid}`, {
      headers: this.getHeaders(),
    }).pipe(
      map(response => response?.data ?? response),
      catchError(error => throwError(() => error))
    );
  }

  declineOffer(offerUuid: string): Observable<ProjectOfferActionResponse> {
    this.setLoading(true);

    return this.http.post<ProjectOfferActionResponse>(
      `${this.baseUrl}/decline/${offerUuid}`,
      {},
      { headers: this.getHeaders() }
    ).pipe(
      catchError(error => throwError(() => error)),
      finalize(() => this.setLoading(false))
    );
  }

  markProposalAsInterested(proposalUuid: string): Observable<ProjectOfferActionResponse> {
    this.setLoading(true);

    return this.http.post<ProjectOfferActionResponse>(
      `${this.baseUrl}/interest/${proposalUuid}`,
      {},
      { headers: this.getHeaders() }
    ).pipe(
      catchError(error => throwError(() => error)),
      finalize(() => this.setLoading(false))
    );
  }

  markProjectAsViewed(offerUuid: string): Observable<ProjectOfferActionResponse> {
    return this.http.post<ProjectOfferActionResponse>(
      `${this.baseUrl}/mark-as-viewd/${offerUuid}`,
      {},
      { headers: this.getHeaders() }
    ).pipe(
      catchError(error => throwError(() => error))
    );
  }

  markInsighterProjectAsRead(projectUuid: string): Observable<any> {
    return this.http.put<any>(
      `${environment.apiBaseUrl}/insighter/project/read/${projectUuid}`,
      {},
      { headers: this.getHeaders() }
    ).pipe(
      catchError(error => throwError(() => error))
    );
  }

  markProjectFileAsRead(fileUuid: string): Observable<any> {
    return this.http.put<any>(
      `${environment.apiBaseUrl}/insighter/project/file/read/${fileUuid}`,
      {},
      { headers: this.getHeaders() }
    ).pipe(
      catchError(error => throwError(() => error))
    );
  }

  markReviewSubmissionAsRead(reviewUuid: string): Observable<any> {
    return this.http.put<any>(
      `${environment.apiBaseUrl}/insighter/project/review-submission/read/${reviewUuid}`,
      {},
      { headers: this.getHeaders() }
    ).pipe(
      catchError(error => throwError(() => error))
    );
  }

  /**
   * Loads full details (project + insighter proposal match + offer) by project UUID.
   * The dedicated proposal show endpoint was removed; details now come from
   * GET /insighter/project/show/{project}.
   */
  getProposalDetails(projectUuid: string): Observable<ProjectOffer> {
    return this.getInsighterProjectDetails(projectUuid);
  }

  /**
   * Fetches the insighter's project account settings (hourly rate, languages, services...).
   * GET /insighter/project/account/settings
   */
  getAccountSettings(): Observable<InsighterProjectAccountSettings> {
    this.setLoading(true);

    return this.http.get<any>(`${environment.apiBaseUrl}/insighter/project/account/settings`, {
      headers: this.getHeaders(),
    }).pipe(
      map(response => (response?.data ?? response) as InsighterProjectAccountSettings),
      catchError(error => throwError(() => error)),
      finalize(() => this.setLoading(false))
    );
  }

  /**
   * Submits a proposal offer for a given proposal UUID.
   * POST /insighter/project/proposal/add-offer/{uuid}
   */
  submitProposalOffer(
    proposalUuid: string,
    payload: FormData
  ): Observable<ProjectOfferActionResponse> {
    this.setLoading(true);

    return this.http.post<ProjectOfferActionResponse>(
      `${this.baseUrl}/add-offer/${proposalUuid}`,
      payload,
      { headers: this.getFormDataHeaders() }
    ).pipe(
      catchError(error => throwError(() => error)),
      finalize(() => this.setLoading(false))
    );
  }

  getProjectContract(contractUuid: string): Observable<ProjectContract> {
    this.setLoading(true);

    return this.http.get<any>(`${environment.apiBaseUrl}/insighter/project/contract/${contractUuid}`, {
      headers: this.getHeaders(),
    }).pipe(
      map(response => this.mapProjectContract(response?.data ?? response)),
      catchError(error => throwError(() => error)),
      finalize(() => this.setLoading(false))
    );
  }

  signProjectContract(contractUuid: string): Observable<ProjectOfferActionResponse> {
    this.setLoading(true);

    return this.http.post<ProjectOfferActionResponse>(
      `${environment.apiBaseUrl}/insighter/project/contract/sign/${contractUuid}`,
      { accept_contract: 'true' },
      { headers: this.getHeaders() }
    ).pipe(
      catchError(error => throwError(() => error)),
      finalize(() => this.setLoading(false))
    );
  }

  getProjectFileUrl(fileUuid: string): Observable<string> {
    return this.http.get<any>(`${environment.apiBaseUrl}/insighter/project/file/download/${fileUuid}`, {
      headers: this.getHeaders(),
    }).pipe(
      map(response => response?.file ?? response?.data?.file ?? response?.data?.url ?? response?.url ?? ''),
      catchError(error => throwError(() => error)),
    );
  }

  private buildHttpParams(page: number, filters: ProjectOffersFilters): HttpParams {
    let params = new HttpParams().set('page', `${page}`);

    // Backend only accepts a single `status` param (pending|viewed|offered|
    // not_interested|interested|expired|award) — there is no separate
    // action_status/stage filter. Awarded/active projects are `status=award`.
    const status = filters.stage === 'project' ? 'award' : filters.action_status;
    if (status) {
      params = params.set('status', status);
    }
    if (filters.per_page) {
      params = params.set('per_page', `${filters.per_page}`);
    }

    return params;
  }

  private mapProjectStatistics(response: any): ProjectOfferStatistics {
    const data = response?.data && typeof response.data === 'object' ? response.data : response;
    const statuses = Array.isArray(data?.action_statuses)
      ? data.action_statuses
      : Array.isArray(data?.statuses) ? data.statuses : [];

    const mappedStatuses = statuses
      .filter((item: any) => item && typeof item === 'object' && !Array.isArray(item))
      .map((item: any) => ({
        status: `${item?.status ?? ''}`.trim(),
        label: `${item?.label ?? ''}`.trim(),
        total: this.toNumber(item?.total),
      }))
      .filter((item: ProjectOfferStatusStatistic) => !!item.status);

    // The API has no dedicated active-projects total; awarded/active projects
    // are surfaced as an "award" entry inside action_statuses instead.
    const awardEntry = mappedStatuses.find((item: ProjectOfferStatusStatistic) => item.status === 'award');

    return {
      total: this.toNumber(data?.total),
      active_projects_total: data?.active_projects_total !== undefined
        ? this.toNumber(data?.active_projects_total)
        : (awardEntry?.total ?? 0),
      statuses: mappedStatuses,
    };
  }

  private toNumber(value: any): number {
    const numberValue = Number(value);
    return Number.isFinite(numberValue) ? numberValue : 0;
  }

  private mapProjectsResponse(response: any): ProjectOffersPaginatedResponse {
    return {
      data: Array.isArray(response?.data)
        ? response.data.map((project: ApiInsighterProject) => this.mapInsighterProject(project))
        : [],
      links: response?.links ?? {
        first: '',
        last: '',
        prev: null,
        next: null,
      },
      meta: response?.meta ?? {
        current_page: 1,
        from: 0,
        last_page: 1,
        links: [],
        path: this.projectsUrl,
        per_page: 10,
        to: 0,
        total: 0,
      },
    };
  }

  private mapInsighterProject(project: ApiInsighterProject): ProjectOffer {
    const proposal = this.pickInsighterProposal(project?.proposals);
    const match = proposal?.match ?? null;
    const projectStatus = project?.status ?? null;
    const proposalStatus = proposal?.status ?? null;
    const contract = project?.contract && typeof project.contract === 'object'
      ? this.mapProjectContract(project.contract)
      : null;
    const contractUuid = contract?.uuid ?? project?.contract_uuid ?? null;

    return {
      uuid: project?.uuid ?? '',
      status: projectStatus ?? proposalStatus,
      action_status: match?.action_status ?? proposal?.action_status ?? null,
      project_status: projectStatus,
      proposal_status: proposalStatus,
      match_uuid: match?.uuid ?? null,
      stage: project?.stage ?? 'proposal',
      created_at: project?.created_at ?? proposal?.created_at ?? null,
      updated_at: project?.updated_at ?? null,
      invited_at: proposal?.created_at ?? null,
      proposal_no: proposal?.proposal_no ?? null,
      project_proposal_uuid: proposal?.uuid ?? null,
      proposals: this.mapProposalSummaries(project?.proposals),
      contract_uuid: contractUuid,
      contract,
      offer: match?.offer ?? project?.offer ?? null,
      project: {
        uuid: project?.uuid ?? '',
        title: project?.title ?? '',
        type: project?.type ?? '',
        language: project?.language ?? null,
        service: project?.service ?? null,
        service_prompt: project?.prompt_ai ?? project?.service_prompt ?? null,
        phase: project?.phase ?? null,
        business_type: project?.business_type ?? null,
        industry: project?.industry ?? null,
        description: project?.description ?? null,
        deadline_offer: proposal?.deadline_offer ?? proposal?.deadline ?? null,
        deadline: project?.deadline ?? null,
        created_at: project?.created_at ?? null,
        updated_at: project?.updated_at ?? null,
        status: projectStatus,
        cancelled_at: project?.cancelled_at ?? null,
        is_read: this.toReadState(project?.is_read),
        read_at: project?.read_at ?? null,
        components: this.sanitizeBlocks(project?.components),
        addons: this.sanitizeBlocks(project?.addons),
        scopes: this.sanitizeScopes(project?.scopes),
        request_files: this.sanitizeFiles(project?.request_files),
        file: this.sanitizeProjectFile(project?.file),
        contract_uuid: contractUuid,
        contract,
      },
    };
  }

  private mapProposalSummaries(
    proposals: ApiInsighterProjectProposal[] | null | undefined
  ): ProjectOfferProposalSummary[] {
    if (!Array.isArray(proposals)) {
      return [];
    }

    return proposals
      .filter(proposal => proposal && typeof proposal === 'object')
      .map(proposal => ({
        uuid: proposal?.uuid ?? '',
        status: proposal?.status ?? null,
        action_status: proposal?.match?.action_status ?? proposal?.action_status ?? null,
        deadline: proposal?.deadline_offer ?? proposal?.deadline ?? null,
        proposal_no: proposal?.proposal_no ?? null,
        match_uuid: proposal?.match?.uuid ?? proposal?.match_uuid ?? null,
      }));
  }

  /**
   * The payload carries every proposal the insighter was invited to; the
   * newest one drives the row state. Prefer a proposal that includes the
   * insighter match (details payload) over bare summaries.
   */
  private pickInsighterProposal(
    proposals: ApiInsighterProjectProposal[] | null | undefined
  ): ApiInsighterProjectProposal | null {
    if (!Array.isArray(proposals) || !proposals.length) {
      return null;
    }

    return proposals.find(proposal => !!proposal?.match) ?? proposals[0];
  }

  private mapProjectContract(contract: any): ProjectContract {
    const nestedContract = contract?.contract && typeof contract.contract === 'object'
      ? contract.contract
      : null;
    const renderedGuideline = contract?.rendered_guideline
      ?? nestedContract?.rendered_guideline
      ?? null;
    const file = contract?.file && typeof contract.file === 'object'
      ? contract.file
      : nestedContract?.file && typeof nestedContract.file === 'object'
        ? nestedContract.file
        : null;

    return {
      ...(contract || {}),
      uuid: nestedContract?.uuid ?? contract?.contract_uuid ?? contract?.uuid ?? null,
      user_sign_at: this.toBoolean(contract?.user_sign_at ?? nestedContract?.user_sign_at),
      insighter_sign_at: this.toBoolean(contract?.insighter_sign_at ?? nestedContract?.insighter_sign_at),
      is_attach_type: this.toBoolean(contract?.is_attach_type ?? nestedContract?.is_attach_type),
      status: contract?.status ?? nestedContract?.status ?? null,
      file,
      guideline: contract?.guideline ?? renderedGuideline ?? nestedContract?.guideline ?? null,
      rendered_guideline: renderedGuideline,
      language: contract?.language ?? contract?.contract_language ?? nestedContract?.language ?? null,
      court_country: contract?.court_country ?? nestedContract?.court_country ?? null,
      name: contract?.name ?? nestedContract?.name ?? null,
    };
  }

  private sanitizeBlocks(blocks: ProjectOfferBlock[] | null | undefined): ProjectOfferBlock[] {
    if (!Array.isArray(blocks)) {
      return [];
    }

    return blocks.filter(block => {
      if (!block || typeof block !== 'object' || Array.isArray(block)) {
        return false;
      }

      return Object.keys(block).length > 0;
    });
  }

  private sanitizeScopes(scopes: ProjectOfferScope[] | null | undefined): ProjectOfferScope[] {
    if (!Array.isArray(scopes)) {
      return [];
    }

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

  private sanitizeFiles(files: ProjectOfferFile[] | null | undefined): ProjectOfferFile[] {
    if (!Array.isArray(files)) {
      return [];
    }

    return files
      .filter(file => file && typeof file === 'object' && !Array.isArray(file))
      .map(file => ({
        ...file,
        uuid: file.uuid ?? '',
        name: file.name ?? null,
        url: file.url ?? null,
        identifier: file.identifier ?? null,
        second_identifier: file.second_identifier ?? null,
        uploadBy: file.uploadBy ?? null,
        uploadByAvatarProfile: file.uploadByAvatarProfile
          ?? (file as any).uploadedByAvatarProfile
          ?? (file as any).upload_by_avatar_profile
          ?? (file as any).uploaded_by_avatar_profile
          ?? null,
        uploaded_by: file.uploaded_by ?? null,
        uploaded_by_avatar_profile: file.uploaded_by_avatar_profile
          ?? (file as any).upload_by_avatar_profile
          ?? (file as any).uploadByAvatarProfile
          ?? (file as any).uploadedByAvatarProfile
          ?? null,
        upload_date: file.upload_date ?? null,
        scope: file.scope ?? null,
        is_read: this.toReadState(file.is_read),
        read_at: file.read_at ?? null,
      }))
      .filter(file => !!file.uuid);
  }

  private sanitizeProjectFile(file: any): ProjectOfferFiles {
    const proposal = file?.proposal ?? {};

    return {
      ...(file || {}),
      proposal: {
        general: this.sanitizeFiles(proposal.general),
        scopes: this.sanitizeFiles(proposal.scopes),
        offer: this.sanitizeFiles(proposal.offer),
      },
      project: this.sanitizeFiles(file?.project),
    };
  }

  private mapReviewSubmissions(response: any): ProjectReviewSubmission[] {
    const data = response?.data;
    const reviews = Array.isArray(data)
      ? data
      : Array.isArray(data?.reviews)
        ? data.reviews
        : Array.isArray(data?.review_submissions)
          ? data.review_submissions
          : [];

    return reviews
      .filter((review: any) => review && typeof review === 'object' && !Array.isArray(review))
      .map((review: any) => ({
        ...(review || {}),
        uuid: review?.uuid ?? '',
        type: review?.type ?? review?.second_identifier ?? review?.identifier ?? null,
        status: review?.status ?? null,
        priority: this.normalizeReviewPriority(review?.priority),
        note: review?.note ?? null,
        request_at: review?.request_at ?? review?.requested_at ?? review?.created_at ?? null,
        review_note: review?.review_note ?? null,
        reviewed_at: review?.reviewed_at ?? null,
        files: this.sanitizeFiles(review?.files),
        is_read: this.toReadState(review?.is_read),
        read_at: review?.read_at ?? null,
      }))
      .filter((review: ProjectReviewSubmission) => !!review.uuid);
  }

  private normalizeReviewPriority(priority: any): ProjectReviewSubmissionPriority {
    if (priority && typeof priority === 'object' && !Array.isArray(priority)) {
      return {
        value: priority.value ?? null,
        label: priority.label ?? null,
        color: priority.color ?? null,
      };
    }

    return {
      value: priority ?? null,
      label: priority ? this.humanizeValue(priority) : null,
      color: null,
    };
  }

  private humanizeValue(value: any): string {
    return `${value || ''}`
      .replace(/_/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/\b\w/g, char => char.toUpperCase());
  }

  private toBoolean(value: any): boolean {
    if (value === true || value === 1) return true;
    if (value === false || value === 0 || value === null || value === undefined) return false;
    const normalized = String(value).trim().toLowerCase();
    if (!normalized || normalized === 'false' || normalized === '0' || normalized === 'null') return false;
    return true;
  }

  private toReadState(value: any): boolean | null {
    if (value === null || value === undefined) return null;
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value === 1;
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      if (!normalized || ['0', 'false', 'no', 'null'].includes(normalized)) return false;
      return true;
    }

    return !!value;
  }
}
