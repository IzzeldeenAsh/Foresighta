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
  status?: string | null;
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
  down_payment: string | number | null;
  final_payment: string | number | null;
  estimated_hours: string | number | null;
  cover_letter: string | null;
  status: string | null;
}

export interface CreatedProjectProposalInvite {
  uuid: string;
  action_status: string | null;
  submission_status: string | null;
  deadline_offer: string | null;
  total_matches: number | null;
  insighter: CreatedProjectInvitedInsighter | null;
  offer: CreatedProjectSubmittedOffer | null;
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

  getProjectProposalInvites(uuid: string): Observable<CreatedProjectProposalInvite[]> {
    this.setLoading(true);

    return this.http.get<any>(`${this.baseUrl}/proposal/submit-list/${uuid}`, {
      headers: this.getHeaders(),
    }).pipe(
      map(response => this.mapProposalInvites(response)),
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
      status: p?.status ?? null,
    };
  }

  private mapProposalInvites(response: any): CreatedProjectProposalInvite[] {
    const groups = Array.isArray(response?.data) ? response.data : [];

    return groups.flatMap((group: any) => {
      const invited = Array.isArray(group?.invited) ? group.invited : [];

      return invited.map((item: any) => ({
        uuid: item?.uuid ?? '',
        action_status: item?.action_status ?? null,
        submission_status: group?.status ?? null,
        deadline_offer: group?.deadline_offer ?? null,
        total_matches: group?.total_matches ?? null,
        insighter: item?.insighter ? {
          uuid: item.insighter?.uuid ?? '',
          name: item.insighter?.name ?? null,
          profile_photo_url: item.insighter?.profile_photo_url ?? null,
          roles: Array.isArray(item.insighter?.roles) ? item.insighter.roles : [],
          country: item.insighter?.country ?? null,
          company: item.insighter?.company ?? null,
        } : null,
        offer: item?.offer ? {
          uuid: item.offer?.uuid ?? '',
          proposed_price: item.offer?.proposed_price ?? null,
          down_payment: item.offer?.down_payment ?? null,
          final_payment: item.offer?.final_payment ?? null,
          estimated_hours: item.offer?.estimated_hours ?? null,
          cover_letter: item.offer?.cover_letter ?? null,
          status: item.offer?.status ?? null,
        } : null,
      }));
    });
  }

  private sanitizeBlocks(blocks: any[] | null | undefined): CreatedProjectBlock[] {
    if (!Array.isArray(blocks)) return [];
    return blocks.filter(block => {
      if (!block || typeof block !== 'object' || Array.isArray(block)) return false;
      return Object.keys(block).length > 0;
    });
  }
}
