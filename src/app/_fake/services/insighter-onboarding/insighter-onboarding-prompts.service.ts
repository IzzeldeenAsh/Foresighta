import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, catchError, map, of } from 'rxjs';
import { environment } from 'src/environments/environment';
import { TranslationService } from 'src/app/modules/i18n';

/** Mirrors App\Enums\InsighterOnboardingPromptKeyEnum on the backend. */
export type InsighterOnboardingPromptKey =
  | 'session_availability'
  | 'whatsapp'
  | 'project_settings';

/** Mirrors App\Enums\UserOnboardingPromptStatusEnum. */
export type InsighterOnboardingPromptStatus = 'pending' | 'completed' | 'skipped';

/** One entry of `POST /insighter/onboarding/prompts/status`. */
export interface InsighterOnboardingPrompt {
  prompt_key: InsighterOnboardingPromptKey;
  status: InsighterOnboardingPromptStatus;
  cannot_skip: boolean;
  should_show: boolean;
  has_record: boolean;
  completed_at: string | null;
  skipped_at: string | null;
  last_shown_at: string | null;
  show_count: number;
  metadata: Record<string, unknown> | null;
}

interface InsighterOnboardingPromptResponse {
  data?: InsighterOnboardingPrompt;
}

interface InsighterOnboardingPromptListResponse {
  data?: InsighterOnboardingPrompt[];
}

/**
 * Insighter-scoped onboarding prompts.
 *
 * Backend: routes/api/insighter.php -> InsighterOnboardingPromptController.
 * Both endpoints sit behind `auth:api + verified +
 * role:insighter|company|company-insighter`, so callers must role-gate first.
 *
 * A prompt is marked *completed* by the backend as a side effect of the user
 * actually doing the thing (availability sync, project-settings sync, WhatsApp
 * number saved) — there is no "complete" endpoint to call from here.
 */
@Injectable({
  providedIn: 'root',
})
export class InsighterOnboardingPromptsService {
  private readonly statusApiUrl = `${environment.apiBaseUrl}/insighter/onboarding/prompts/status`;
  private readonly skipApiUrl = `${environment.apiBaseUrl}/insighter/onboarding/prompts/skip`;

  constructor(
    private readonly http: HttpClient,
    private readonly translationService: TranslationService
  ) {}

  /** Never throws: a failed check must not block the page the user landed on. */
  getStatus(): Observable<InsighterOnboardingPrompt[]> {
    return this.http
      .post<InsighterOnboardingPromptListResponse>(
        this.statusApiUrl,
        {},
        { headers: this.getHeaders() }
      )
      .pipe(
        map((response) => response?.data ?? []),
        catchError(() => of([] as InsighterOnboardingPrompt[]))
      );
  }

  /** Never throws: recording a skip must not interrupt the flow. */
  skip(promptKey: InsighterOnboardingPromptKey): Observable<InsighterOnboardingPrompt | null> {
    return this.http
      .post<InsighterOnboardingPromptResponse>(
        this.skipApiUrl,
        { prompt_key: promptKey },
        { headers: this.getHeaders() }
      )
      .pipe(
        map((response) => response?.data ?? null),
        catchError(() => of(null))
      );
  }

  private getHeaders(): HttpHeaders {
    return new HttpHeaders({
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'Accept-Language': this.translationService.getSelectedLanguage() || 'en',
    });
  }
}
