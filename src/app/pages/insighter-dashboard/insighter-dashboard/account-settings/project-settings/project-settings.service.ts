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

interface ProfileCheck {
  required?: {
    profile_photo?: string | boolean | null;
    about_us?: boolean | null;
    country?: boolean | null;
  };
  pass?: boolean;
}

export interface ProjectAccountCheckResults {
  publish_insights?: PublishInsightsCheck;
  whatsapp?: WhatsAppCheck;
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

@Injectable({
  providedIn: 'root'
})
export class ProjectSettingsService {
  private readonly apiUrl = `${environment.apiBaseUrl}/insighter/project/account/initiate/check`;

  constructor(
    private readonly http: HttpClient,
    private readonly translationService: TranslationService
  ) {}

  getProjectAccountCheck(): Observable<ProjectAccountCheckResults> {
    const headers = new HttpHeaders({
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'Accept-Language': this.translationService.getSelectedLanguage() || 'en',
    });

    return this.http
      .post<ProjectAccountCheckResponse>(this.apiUrl, {}, { headers })
      .pipe(
        map((response) =>
          response?.data?.check_results ??
          response?.data?.data?.check_results ??
          response?.check_results ??
          {}
        )
      );
  }
}
