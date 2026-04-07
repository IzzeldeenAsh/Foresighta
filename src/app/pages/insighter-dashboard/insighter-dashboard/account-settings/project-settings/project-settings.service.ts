import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from 'src/environments/environment';
import { TranslationService } from 'src/app/modules/i18n';

interface PublishInsightsCheck {
  required?: {
    paid?: number;
    free?: number;
  };
  pass?: boolean;
}

interface WhatsAppCheck {
  pass?: boolean;
}

interface ExperienceCheck {
  pass?: boolean | number | string | null;
}

interface ProfileCheck {
  required?: {
    profile_photo?: string | boolean | null;
    bio?: boolean | null;
    about_us?: boolean | null;
    country?: boolean | null;
  };
  pass?: boolean;
}

export interface ProjectAccountCheckResults {
  publish_insights?: PublishInsightsCheck;
  whatsapp?: WhatsAppCheck;
  experience?: ExperienceCheck;
  profile?: ProfileCheck;
}

interface ProjectAccountCheckResponse {
  data?: {
    data?: {
      check_results?: ProjectAccountCheckResults;
    };
    check_results?: ProjectAccountCheckResults;
  };
  check_results?: ProjectAccountCheckResults;
}

export interface ProjectServiceOption {
  id: number;
  name: string;
  slug: string;
}

export type ProjectAccountProjectType =
  | 'ad_hoc'
  | 'frame_work_agreement'
  | 'urgent_request';

interface ProjectServiceListResponse {
  data?: ProjectServiceOption[];
}

export interface SyncProjectAccountPropertiesPayload {
  project_status: 'active' | 'inactive';
  project_languages: 'english' | 'arabic' | 'both';
  hourly_rate: string;
  services: number[];
  project_types: ProjectAccountProjectType[];
}

export interface ProjectAccountProperties {
  project_status?: 'active' | 'inactive';
  project_languages?: 'english' | 'arabic' | 'both';
  hourly_rate?: string | number | null;
  services?: Array<ProjectServiceOption | number>;
  project_types?: Array<ProjectAccountProjectType | 'framework' | 'urgent'>;
}

interface ProjectAccountPropertiesResponse {
  data?: ProjectAccountProperties;
}

@Injectable({
  providedIn: 'root'
})
export class ProjectSettingsService {
  private readonly checkApiUrl = `${environment.apiBaseUrl}/insighter/project/account/initiate/check`;
  private readonly propertiesApiUrl = `${environment.apiBaseUrl}/insighter/project/account/properties`;
  private readonly syncApiUrl = `${environment.apiBaseUrl}/insighter/project/account/properties/sync`;
  private readonly servicesApiUrl = `${environment.apiBaseUrl}/common/setting/service`;

  constructor(
    private readonly http: HttpClient,
    private readonly translationService: TranslationService
  ) {}

  private getHeaders(): HttpHeaders {
    return new HttpHeaders({
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'Accept-Language': this.translationService.getSelectedLanguage() || 'en',
    });
  }

  getProjectAccountCheck(): Observable<ProjectAccountCheckResults> {
    return this.http
      .post<ProjectAccountCheckResponse>(this.checkApiUrl, {}, {
        headers: this.getHeaders(),
      })
      .pipe(
        map((response) =>
          response?.data?.check_results ??
          response?.data?.data?.check_results ??
          response?.check_results ??
          {}
        )
      );
  }

  getProjectServices(): Observable<ProjectServiceOption[]> {
    return this.http
      .get<ProjectServiceListResponse>(this.servicesApiUrl, {
        headers: this.getHeaders(),
      })
      .pipe(map((response) => response?.data ?? []));
  }

  getProjectAccountProperties(): Observable<ProjectAccountProperties> {
    return this.http
      .get<ProjectAccountPropertiesResponse>(this.propertiesApiUrl, {
        headers: this.getHeaders(),
      })
      .pipe(map((response) => response?.data ?? {}));
  }

  syncProjectAccountProperties(
    payload: SyncProjectAccountPropertiesPayload
  ): Observable<unknown> {
    return this.http.post(this.syncApiUrl, payload, {
      headers: this.getHeaders(),
    });
  }
}
