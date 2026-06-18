import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { BehaviorSubject, Observable, throwError } from 'rxjs';
import { catchError, finalize, map } from 'rxjs/operators';
import { TranslationService } from 'src/app/modules/i18n/translation.service';
import { environment } from 'src/environments/environment';

export type ProjectOfferType = 'ad_hoc' | 'frame_work_agreement' | 'urgent_request' | string;
export type ProjectOfferProjectStatus = 'invited' | 'cancelled' | 'submitted' | 'closed' | string;
export type ProjectOfferActionStatus = 'pending' | 'viewed' | 'offered' | 'declined' | 'expired' | string;
export type ProjectOfferReadStatus = 'read' | 'not_read';
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
  read_status?: ProjectOfferReadStatus | null;
}

export interface ProjectOfferStatusStatistic {
  status: ProjectOfferActionStatus;
  label: string;
  total: number;
}

export interface ProjectOfferStatistics {
  total: number;
  statuses: ProjectOfferStatusStatistic[];
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

export interface ProjectOffer {
  uuid: string;
  status: ProjectOfferProjectStatus | null;
  action_status: ProjectOfferActionStatus | null;
  created_at?: string | null;
  updated_at?: string | null;
  invited_at?: string | null;
  proposal_no?: string | null;
  project_proposal_uuid?: string | null;
  contract_uuid?: string | null;
  contract?: ProjectContract | null;
  offer?: any;
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

interface ApiProjectOffer {
  uuid: string;
  action_status: ProjectOfferActionStatus | null;
  created_at?: string | null;
  updated_at?: string | null;
  invited_at?: string | null;
  contract_uuid?: string | null;
  project_proposal: {
    uuid: string;
    proposal_no: string | null;
    status?: ProjectOfferProjectStatus | null;
    deadline_offer: string | null;
    created_at?: string | null;
    updated_at?: string | null;
    contract_uuid?: string | null;
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
      deadline: string | null;
      created_at?: string | null;
      updated_at?: string | null;
      is_read?: any;
      read_at?: string | null;
      components: ProjectOfferBlock[];
      addons: ProjectOfferBlock[];
        scopes?: ProjectOfferScope[] | null;
        request_files?: ProjectOfferFile[] | null;
        file?: any;
        contract_uuid?: string | null;
      } | null;
  } | null;
  offer: any;
}

interface ApiProjectOffersPaginatedResponse {
  data: ApiProjectOffer[];
  links: ProjectOffersPaginationLinks;
  meta: ProjectOffersPaginationMeta;
}

const MOCK_PROJECT_OFFERS: ProjectOffer[] = [
  {
    uuid: 'mock-offer-001',
    status: 'invited',
    action_status: 'pending',
    project: {
      title: 'Market Entry Research for GCC Wellness Brand',
      type: 'ad_hoc',
      language: 'arabic',
      service: { id: 1, name: 'Market Research', slug: 'market-research' },
      service_prompt: 'We need a market-entry research plan to validate demand across Saudi Arabia, UAE, and Kuwait.',
      phase: 'idea_stage',
      business_type: 'entrepreneur',
      industry: 'healthcare',
      description: 'Assess market size, competitor positioning, and customer demand indicators for a new wellness concept.',
      deadline_offer: '2026-05-10T00:00:00.000000Z',
      deadline: '2026-05-24T00:00:00.000000Z',
      components: [
        {
          'deliverable-stage': {
            first_draft: {
              date: '2026-05-12',
              way: { selected: 'online_meeting' },
              report_type: ['pdf', 'pptx']
            },
            final_version: {
              date: '2026-05-24',
              way: { selected: 'on_platform' },
              report_type: ['pdf', 'xlsx']
            }
          }
        },
        {
          'target-market': {
            type: 'country',
            objects: [
              { id: 1, name: 'Saudi Arabia', flag: 'saudi-arabia' },
              { id: 2, name: 'United Arab Emirates', flag: 'united-arab-emirates' },
              { id: 3, name: 'Kuwait', flag: 'kuwait' }
            ]
          }
        },
        {
          'data-sources-expected': 'mixed_data'
        }
      ],
      scopes: [
        {
          scope: 'Market Definition',
          description: null,
          children: [
            {
              scope: 'Alternative Products',
              description: null,
              files: [
                {
                  uuid: 'mock-scope-file-001',
                  url: '/project/11/scopes/market-definition.pdf',
                }
              ]
            }
          ]
        },
        {
          scope: 'Customers Analysis',
          description: null,
          children: [
            { scope: 'Customers Analysis', description: null }
          ]
        }
      ],
      request_files: [],
      addons: [
        {
          'kickoff-meeting': {
            date: '2026-05-03'
          }
        },
        {
          'consulting-sessions': [
            { date: '2026-05-15' },
            { date: '2026-05-21' }
          ]
        }
      ]
    }
  },
  {
    uuid: 'mock-offer-002',
    status: 'invited',
    action_status: 'accepted',
    project: {
      title: 'Framework Agreement for Export Readiness Advisory',
      type: 'frame_work_agreement',
      language: 'english',
      service: { id: 2, name: 'Export Advisory', slug: 'export-advisory' },
      service_prompt: 'Looking for a recurring advisor to support SMEs preparing for export readiness assessments.',
      phase: 'validation_stage',
      business_type: 'sme',
      industry: 'manufacturing',
      description: 'This engagement covers recurring assessments, roadmap reviews, and advisory sessions over multiple months.',
      deadline_offer: '2026-05-05T00:00:00.000000Z',
      deadline: '2026-06-01T00:00:00.000000Z',
      components: [
        {
          'deliverable-stage': {
            first_draft: {
              date: '2026-05-14',
              way: { selected: 'physical_workshop', address: 'Amman Business Park' },
              report_type: ['pdf']
            },
            final_version: {
              date: '2026-06-01',
              way: { selected: 'on_platform' },
              report_type: ['pdf', 'docx']
            }
          }
        }
      ],
      scopes: [],
      request_files: [],
      addons: [
        {
          'third-party-consultant': [
            { date: '2026-05-18' },
            { date: '2026-05-25' }
          ]
        }
      ]
    }
  },
  {
    uuid: 'mock-offer-003',
    status: 'invited',
    action_status: 'pending',
    project: {
      title: 'Urgent Digital Diagnostics for Retail Chain',
      type: 'urgent_request',
      language: 'english',
      service: { id: 3, name: 'Digital Transformation', slug: 'digital-transformation' },
      service_prompt: 'The client needs a quick-turn digital diagnostics review before an investor meeting.',
      phase: 'growth_stage',
      business_type: 'enterprise',
      industry: 'retail',
      description: 'Audit digital channels, customer funnel gaps, and immediate improvements that can be executed within 30 days.',
      deadline_offer: '2026-04-28T00:00:00.000000Z',
      deadline: '2026-05-08T00:00:00.000000Z',
      components: [
        {
          'target-market': {
            type: 'region',
            objects: [
              { id: 1, name: 'Jordan', flag: 'jordan' },
              { id: 2, name: 'KSA', flag: 'ksa' }
            ]
          }
        },
        {
          'data-sources-expected': 'primary_data'
        }
      ],
      scopes: [],
      request_files: [],
      addons: [
        {
          'survey-conduct': {
            scopes: ['customer-interviews', 'store-journey'],
            parameters: {
              size: '40',
              distribution: 'online'
            },
            template: null
          }
        }
      ]
    }
  },
  {
    uuid: 'mock-offer-004',
    status: 'invited',
    action_status: 'declined',
    project: {
      title: 'B2B Segmentation Study for Industrial Supplier',
      type: 'ad_hoc',
      language: 'arabic',
      service: { id: 4, name: 'Segmentation Study', slug: 'segmentation-study' },
      service_prompt: 'We need customer segmentation and market prioritization for industrial clients across Levant markets.',
      phase: 'operating_stage',
      business_type: 'enterprise',
      industry: 'industrial',
      description: 'Map priority segments, purchasing behaviors, and service-model differences by geography.',
      deadline_offer: '2026-05-14T00:00:00.000000Z',
      deadline: '2026-05-30T00:00:00.000000Z',
      components: [],
      scopes: [],
      request_files: [],
      addons: []
    }
  },
  {
    uuid: 'mock-offer-005',
    status: 'invited',
    action_status: 'approved',
    project: {
      title: 'Consumer Insight Sprint for Food Delivery Startup',
      type: 'ad_hoc',
      language: 'english',
      service: { id: 5, name: 'Consumer Insights', slug: 'consumer-insights' },
      service_prompt: 'Help us understand drop-off reasons among first-time customers and design a retention hypothesis.',
      phase: 'growth_stage',
      business_type: 'startup',
      industry: 'food-and-beverage',
      description: 'The client wants a short sprint with interviews, quick insights, and prioritised actions.',
      deadline_offer: '2026-05-12T00:00:00.000000Z',
      deadline: '2026-05-22T00:00:00.000000Z',
      components: [
        {
          'deliverable-stage': {
            first_draft: {
              date: '2026-05-17',
              way: { selected: 'online_meeting' },
              report_type: ['pdf']
            },
            final_version: {
              date: '2026-05-22',
              way: { selected: 'on_platform' },
              report_type: ['pdf']
            }
          }
        }
      ],
      scopes: [],
      request_files: [],
      addons: [
        {
          'consulting-sessions': [
            { date: '2026-05-18' }
          ]
        }
      ]
    }
  },
  {
    uuid: 'mock-offer-006',
    status: 'invited',
    action_status: 'pending',
    project: {
      title: 'Export Compliance Mapping for Fashion Brand',
      type: 'frame_work_agreement',
      language: 'arabic',
      service: { id: 6, name: 'Compliance Advisory', slug: 'compliance-advisory' },
      service_prompt: 'Need recurring support to map export compliance requirements before entering Europe.',
      phase: 'validation_stage',
      business_type: 'sme',
      industry: 'fashion',
      description: 'This work combines recurring advisory support, documentation review, and market requirement mapping.',
      deadline_offer: '2026-05-16T00:00:00.000000Z',
      deadline: '2026-06-07T00:00:00.000000Z',
      components: [
        {
          'target-market': {
            type: 'country',
            objects: [
              { id: 1, name: 'Germany', flag: 'germany' },
              { id: 2, name: 'France', flag: 'france' }
            ]
          }
        }
      ],
      scopes: [],
      request_files: [],
      addons: [
        {
          'kickoff-meeting': {
            date: '2026-05-20'
          }
        }
      ]
    }
  }
];

@Injectable({
  providedIn: 'root'
})
export class ProjectOffersService {
  private readonly baseUrl = `${environment.apiBaseUrl}/insighter/project/proposal`;
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

    // if (environment.isMockEnabled) {
    //   return of(this.buildMockResponse(page, filters)).pipe(
    //     delay(250),
    //     finalize(() => this.setLoading(false))
    //   );
    // }

    return this.http.get<ApiProjectOffersPaginatedResponse>(this.baseUrl, {
      headers: this.getHeaders(),
      params: this.buildHttpParams(page, filters),
    }).pipe(
      map(response => this.mapPaginatedResponse(response)),
      catchError(error => throwError(() => error)),
      finalize(() => this.setLoading(false))
    );
  }

  getProjectStatistics(): Observable<ProjectOfferStatistics> {
    return this.http.get<any>(`${this.baseUrl}/statistics`, {
      headers: this.getHeaders(),
    }).pipe(
      map(response => this.mapProjectStatistics(response)),
      catchError(error => throwError(() => error))
    );
  }

  getOnWorkProjects(page: number = 1): Observable<ProjectOffersPaginatedResponse> {
    this.setLoading(true);

    return this.http.get<any>(`${environment.apiBaseUrl}/insighter/project`, {
      headers: this.getHeaders(),
      params: new HttpParams().set('page', `${page}`),
    }).pipe(
      map(response => this.mapOnWorkProjectsResponse(response)),
      catchError(error => throwError(() => error)),
      finalize(() => this.setLoading(false))
    );
  }

  getInsighterProjectDetails(projectUuid: string): Observable<ProjectOffer> {
    this.setLoading(true);

    return this.http.get<any>(`${environment.apiBaseUrl}/insighter/project/show/${projectUuid}`, {
      headers: this.getHeaders(),
    }).pipe(
      map(response => this.mapOnWorkProject(response?.data ?? response)),
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
   * Loads a single proposal's full details by its proposal UUID.
   * GET /insighter/project/proposal/show/{uuid}
   */
  getProposalDetails(proposalUuid: string): Observable<ProjectOffer> {
    this.setLoading(true);

    return this.http.get<any>(`${this.baseUrl}/show/${proposalUuid}`, {
      headers: this.getHeaders(),
    }).pipe(
      map(response => this.mapProposalDetailResponse(response)),
      catchError(error => throwError(() => error)),
      finalize(() => this.setLoading(false))
    );
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

  private mapProposalDetailResponse(response: any): ProjectOffer {
    // Endpoint returns either { data: { project_proposal: {..} } } or a flat
    // proposal payload — normalise both shapes through the existing mapper.
    const root = response?.data ?? response ?? {};

    if (root?.project_proposal) {
      return this.mapProjectOffer(root as ApiProjectOffer);
    }

    // Already a proposal-shaped payload — wrap to fit the mapper.
    const synthetic: ApiProjectOffer = {
      uuid: root?.uuid ?? '',
      action_status: root?.action_status ?? null,
      created_at: root?.created_at ?? null,
      updated_at: root?.updated_at ?? null,
      invited_at: root?.invited_at ?? null,
      contract_uuid: root?.contract_uuid ?? null,
      project_proposal: {
        uuid: root?.uuid ?? '',
        proposal_no: root?.proposal_no ?? null,
        status: root?.status ?? null,
        deadline_offer: root?.deadline_offer ?? null,
        created_at: root?.created_at ?? null,
        updated_at: root?.updated_at ?? null,
        contract_uuid: root?.contract_uuid ?? null,
        project: root?.project ?? null,
      },
      offer: root?.offer ?? null,
    };

    return this.mapProjectOffer(synthetic);
  }

  private buildHttpParams(page: number, filters: ProjectOffersFilters): HttpParams {
    let params = new HttpParams().set('page', `${page}`);

    if (filters.action_status) {
      params = params.set('action_status', filters.action_status);
    }
    if (filters.read_status) {
      params = params.set('read_status', filters.read_status);
    }

    return params;
  }

  private mapProjectStatistics(response: any): ProjectOfferStatistics {
    const data = response?.data && typeof response.data === 'object' ? response.data : response;
    const statuses = Array.isArray(data?.statuses) ? data.statuses : [];

    return {
      total: this.toNumber(data?.total),
      statuses: statuses
        .filter((item: any) => item && typeof item === 'object' && !Array.isArray(item))
        .map((item: any) => ({
          status: `${item?.status ?? ''}`.trim(),
          label: `${item?.label ?? ''}`.trim(),
          total: this.toNumber(item?.total),
        }))
        .filter((item: ProjectOfferStatusStatistic) => !!item.status),
    };
  }

  private toNumber(value: any): number {
    const numberValue = Number(value);
    return Number.isFinite(numberValue) ? numberValue : 0;
  }

  private buildMockResponse(page: number, filters: ProjectOffersFilters): ProjectOffersPaginatedResponse {
    const perPage = 3;
    const filteredOffers = MOCK_PROJECT_OFFERS.filter(offer => {
      const matchesActionStatus = !filters.action_status || offer.action_status === filters.action_status;

      return matchesActionStatus;
    });
    const total = filteredOffers.length;
    const lastPage = Math.max(1, Math.ceil(total / perPage));
    const currentPage = Math.min(Math.max(page, 1), lastPage);
    const from = (currentPage - 1) * perPage;
    const to = from + perPage;
    const pageData = filteredOffers.slice(from, to);
    const buildPageUrl = (pageNumber: number) => {
      const params = this.buildHttpParams(pageNumber, filters).toString();
      return `${this.baseUrl}?${params}`;
    };

    return {
      data: pageData,
      links: {
        first: buildPageUrl(1),
        last: buildPageUrl(lastPage),
        prev: currentPage > 1 ? buildPageUrl(currentPage - 1) : null,
        next: currentPage < lastPage ? buildPageUrl(currentPage + 1) : null,
      },
      meta: {
        current_page: currentPage,
        from: pageData.length ? from + 1 : 0,
        last_page: lastPage,
        links: Array.from({ length: lastPage }, (_, index) => {
          const pageNumber = index + 1;
          return {
            url: buildPageUrl(pageNumber),
            label: `${pageNumber}`,
            active: pageNumber === currentPage,
          };
        }),
        path: this.baseUrl,
        per_page: perPage,
        to: pageData.length ? from + pageData.length : 0,
        total,
      },
    };
  }

  private mapPaginatedResponse(response: ApiProjectOffersPaginatedResponse): ProjectOffersPaginatedResponse {
    return {
      data: Array.isArray(response?.data) ? response.data.map(offer => this.mapProjectOffer(offer)) : [],
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
        path: this.baseUrl,
        per_page: 10,
        to: 0,
        total: 0,
      },
    };
  }

  private mapOnWorkProjectsResponse(response: any): ProjectOffersPaginatedResponse {
    return {
      data: Array.isArray(response?.data)
        ? response.data.map((project: any) => this.mapOnWorkProject(project))
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
        path: `${environment.apiBaseUrl}/insighter/project`,
        per_page: 10,
        to: 0,
        total: 0,
      },
    };
  }

  private mapOnWorkProject(project: any): ProjectOffer {
    const contract = project?.contract && typeof project.contract === 'object'
      ? this.mapProjectContract(project.contract)
      : null;
    const contractUuid = contract?.uuid ?? project?.contract_uuid ?? null;

    return {
      uuid: project?.uuid ?? contractUuid ?? '',
      status: contractUuid ? 'contract' : (project?.status ?? 'submitted'),
      action_status: project?.action_status ?? 'offered',
      created_at: project?.created_at ?? null,
      updated_at: project?.updated_at ?? null,
      invited_at: null,
      proposal_no: project?.proposal_no ?? null,
      project_proposal_uuid: project?.project_proposal_uuid ?? project?.proposal_uuid ?? null,
      contract_uuid: contractUuid,
      contract,
      offer: project?.offer ?? null,
      project: {
        uuid: project?.uuid ?? '',
        title: project?.title ?? '',
        type: project?.type ?? '',
        language: project?.language ?? null,
        service: project?.service ?? null,
        service_prompt: project?.service_prompt ?? null,
        phase: project?.phase ?? null,
        business_type: project?.business_type ?? null,
        industry: project?.industry ?? null,
        description: project?.description ?? null,
        deadline_offer: project?.deadline_offer ?? null,
        deadline: project?.deadline ?? null,
        created_at: project?.created_at ?? null,
        updated_at: project?.updated_at ?? null,
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

  private mapProjectOffer(offer: ApiProjectOffer): ProjectOffer {
    const proposal = offer?.project_proposal;
    const project = proposal?.project;
    const rawContract = (offer as any)?.contract
      ?? (proposal as any)?.contract
      ?? (project as any)?.contract
      ?? offer?.offer?.contract
      ?? null;
    const contract = rawContract && typeof rawContract === 'object'
      ? this.mapProjectContract(rawContract)
      : null;
    const contractUuid = contract?.uuid
      ?? offer?.contract_uuid
      ?? proposal?.contract_uuid
      ?? project?.contract_uuid
      ?? offer?.offer?.contract_uuid
      ?? null;

    return {
      uuid: offer?.uuid ?? '',
      status: proposal?.status ?? null,
      action_status: offer?.action_status ?? null,
      created_at: offer?.created_at ?? proposal?.created_at ?? null,
      updated_at: offer?.updated_at ?? proposal?.updated_at ?? null,
      invited_at: offer?.invited_at ?? null,
      proposal_no: proposal?.proposal_no ?? null,
      project_proposal_uuid: proposal?.uuid ?? null,
      contract_uuid: contractUuid,
      contract,
      offer: offer?.offer ?? null,
      project: {
        uuid: project?.uuid ?? '',
        title: project?.title ?? '',
        type: project?.type ?? '',
        language: project?.language ?? null,
        service: project?.service ?? null,
        service_prompt: project?.service_prompt ?? null,
        phase: project?.phase ?? null,
        business_type: project?.business_type ?? null,
        industry: project?.industry ?? null,
        description: project?.description ?? null,
        deadline_offer: proposal?.deadline_offer ?? null,
        deadline: project?.deadline ?? null,
        created_at: project?.created_at ?? null,
        updated_at: project?.updated_at ?? null,
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
