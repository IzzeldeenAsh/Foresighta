import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { BehaviorSubject, Observable, throwError } from 'rxjs';
import { catchError, finalize, map } from 'rxjs/operators';
import { TranslationService } from 'src/app/modules/i18n/translation.service';
import { environment } from 'src/environments/environment';

export type ProjectOfferType = 'ad_hoc' | 'frame_work_agreement' | 'urgent_request' | string;
export type ProjectOfferProjectStatus = 'invited' | 'cancelled' | 'submitted' | 'closed' | string;
export type ProjectOfferActionStatus = 'pending' | 'viewed' | 'offered' | 'declined' | 'expired' | string;

export interface ProjectOffersFilters {
  project_status?: ProjectOfferProjectStatus | null;
  action_status?: ProjectOfferActionStatus | null;
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

export interface ProjectOffer {
  uuid: string;
  status: ProjectOfferProjectStatus | null;
  action_status: ProjectOfferActionStatus | null;
  proposal_no?: string | null;
  project_proposal_uuid?: string | null;
  offer?: any;
  project: {
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
    components: ProjectOfferBlock[];
    addons: ProjectOfferBlock[];
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
  estimated_hours: string | number;
  proposed_price: number;
}

interface ApiProjectOffer {
  uuid: string;
  action_status: ProjectOfferActionStatus | null;
  project_proposal: {
    uuid: string;
    proposal_no: string | null;
    status?: ProjectOfferProjectStatus | null;
    deadline_offer: string | null;
    project: {
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
      components: ProjectOfferBlock[];
      addons: ProjectOfferBlock[];
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

  declineOffer(offerUuid: string): Observable<ProjectOfferActionResponse> {
    this.setLoading(true);

    return this.http.post<ProjectOfferActionResponse>(
      `${this.baseUrl}/decline-offer/${offerUuid}`,
      {},
      { headers: this.getHeaders() }
    ).pipe(
      catchError(error => throwError(() => error)),
      finalize(() => this.setLoading(false))
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
    payload: ProjectProposalOfferPayload
  ): Observable<ProjectOfferActionResponse> {
    this.setLoading(true);

    return this.http.post<ProjectOfferActionResponse>(
      `${this.baseUrl}/add-offer/${proposalUuid}`,
      payload,
      { headers: this.getHeaders() }
    ).pipe(
      catchError(error => throwError(() => error)),
      finalize(() => this.setLoading(false))
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
      project_proposal: {
        uuid: root?.uuid ?? '',
        proposal_no: root?.proposal_no ?? null,
        status: root?.status ?? null,
        deadline_offer: root?.deadline_offer ?? null,
        project: root?.project ?? null,
      },
      offer: root?.offer ?? null,
    };

    return this.mapProjectOffer(synthetic);
  }

  private buildHttpParams(page: number, filters: ProjectOffersFilters): HttpParams {
    let params = new HttpParams().set('page', `${page}`);

    if (filters.project_status) {
      params = params.set('project_status', filters.project_status);
    }

    if (filters.action_status) {
      params = params.set('action_status', filters.action_status);
    }

    return params;
  }

  private buildMockResponse(page: number, filters: ProjectOffersFilters): ProjectOffersPaginatedResponse {
    const perPage = 3;
    const filteredOffers = MOCK_PROJECT_OFFERS.filter(offer => {
      const matchesProjectStatus = !filters.project_status || offer.status === filters.project_status;
      const matchesActionStatus = !filters.action_status || offer.action_status === filters.action_status;

      return matchesProjectStatus && matchesActionStatus;
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

  private mapProjectOffer(offer: ApiProjectOffer): ProjectOffer {
    const proposal = offer?.project_proposal;
    const project = proposal?.project;

    return {
      uuid: offer?.uuid ?? '',
      status: proposal?.status ?? null,
      action_status: offer?.action_status ?? null,
      proposal_no: proposal?.proposal_no ?? null,
      project_proposal_uuid: proposal?.uuid ?? null,
      offer: offer?.offer ?? null,
      project: {
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
        components: this.sanitizeBlocks(project?.components),
        addons: this.sanitizeBlocks(project?.addons),
      },
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
}
