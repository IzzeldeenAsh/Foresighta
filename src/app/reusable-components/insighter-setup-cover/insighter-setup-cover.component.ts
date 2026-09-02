import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { take } from 'rxjs/operators';
import { ProfileService } from 'src/app/_fake/services/get-profile/get-profile.service';
import { TranslationService } from 'src/app/modules/i18n';
import {
  InsighterOnboardingPrompt,
  InsighterOnboardingPromptKey,
  InsighterOnboardingPromptsService,
} from 'src/app/_fake/services/insighter-onboarding/insighter-onboarding-prompts.service';

type CoverStage = 'meeting' | 'project';

/**
 * Query param the post-login onboarding flow (Next.js) puts on the destination
 * URL to ask this app to show the covers.
 */
export const INSIGHTER_SETUP_QUERY_KEY = 'insighterSetup';

const PROVIDER_ROLES = ['insighter', 'company', 'company-insighter'];

const STAGE_ORDER: CoverStage[] = ['meeting', 'project'];

const STAGE_PROMPT_KEY: Record<CoverStage, InsighterOnboardingPromptKey> = {
  meeting: 'session_availability',
  project: 'project_settings',
};

const STAGE_ROUTE: Record<CoverStage, string> = {
  meeting: '/app/insighter-dashboard/account-settings/consulting-schedule',
  project: '/app/insighter-dashboard/account-settings/project-settings',
};

/**
 * The become-Insighter wizard's meeting / service covers, re-offered after login
 * to Insighters who never finished those steps.
 *
 * The onboarding flow completes its redirect first and tags the destination with
 * `?insighterSetup=1`; this picks that up so the covers open over the page the
 * user actually landed on. It is not a dashboard feature — it is mounted at the
 * app shell and only ever runs when that marker is present.
 */
@Component({
  selector: 'app-insighter-setup-cover',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './insighter-setup-cover.component.html',
  styleUrls: ['./insighter-setup-cover.component.scss'],
})
export class InsighterSetupCoverComponent implements OnInit, OnDestroy {
  lang = 'en';
  stage: CoverStage | null = null;
  profile: any = null;
  skipping = false;

  private queue: CoverStage[] = [];
  private checked = false;
  private readonly subscriptions: Subscription[] = [];

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly profileService: ProfileService,
    private readonly translationService: TranslationService,
    private readonly promptsService: InsighterOnboardingPromptsService
  ) {}

  ngOnInit(): void {
    this.lang = this.translationService.getSelectedLanguage() || 'en';
    this.subscriptions.push(
      this.translationService.onLanguageChange().subscribe((lang) => (this.lang = lang))
    );

    const querySub = this.route.queryParams.subscribe((params) => {
      if (params[INSIGHTER_SETUP_QUERY_KEY] !== '1' || this.checked) {
        return;
      }
      this.checked = true;
      this.clearMarker();
      this.loadPrompts();
    });
    this.subscriptions.push(querySub);
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach((sub) => sub.unsubscribe());
  }

  /** CTA: go to the real settings page; the backend completes the prompt on save. */
  goToSettings(): void {
    const stage = this.stage;
    if (!stage) {
      return;
    }

    this.queue = [];
    this.stage = null;
    this.router.navigate([STAGE_ROUTE[stage]]);
  }

  skip(): void {
    const stage = this.stage;
    if (!stage || this.skipping) {
      return;
    }

    this.skipping = true;
    const sub = this.promptsService.skip(STAGE_PROMPT_KEY[stage]).subscribe(() => {
      this.skipping = false;
      this.showNext();
    });
    this.subscriptions.push(sub);
  }

  // ---- Profile preview inside the service cover (mirrors the wizard) ----

  get displayName(): string {
    if (!this.profile) return '';
    const full = `${this.profile.first_name || ''} ${this.profile.last_name || ''}`.trim();
    return full || this.profile.name || '';
  }

  get initials(): string {
    if (!this.profile) return 'I';
    const fromNames =
      `${this.profile.first_name?.[0] ?? ''}${this.profile.last_name?.[0] ?? ''}`.trim();
    return (fromNames || this.profile.name?.[0] || 'I').toUpperCase();
  }

  get countryName(): string {
    const country = this.profile?.country;
    if (!country) return '';
    if (typeof country === 'string') return country;
    return country.names?.[this.lang] || country.name || '';
  }

  /**
   * Drop the marker so a refresh doesn't re-open the covers. Rewrites the
   * current URL rather than navigating — this component is mounted at the app
   * root, where a relative `navigate([])` would land on `/`.
   */
  private clearMarker(): void {
    const tree = this.router.parseUrl(this.router.url);
    delete tree.queryParams[INSIGHTER_SETUP_QUERY_KEY];
    this.router.navigateByUrl(tree, { replaceUrl: true });
  }

  private loadPrompts(): void {
    const profileSub = this.profileService
      .getProfile()
      .pipe(take(1))
      .subscribe({
        next: (profile) => {
          this.profile = profile;

          const roles: string[] = profile?.roles ?? [];
          if (!PROVIDER_ROLES.some((role) => roles.includes(role))) {
            return;
          }

          const sub = this.promptsService.getStatus().subscribe((prompts) => {
            this.queue = STAGE_ORDER.filter((stage) =>
              this.shouldShow(prompts, STAGE_PROMPT_KEY[stage])
            );
            this.showNext();
          });
          this.subscriptions.push(sub);
        },
        error: () => undefined,
      });
    this.subscriptions.push(profileSub);
  }

  private shouldShow(
    prompts: InsighterOnboardingPrompt[],
    promptKey: InsighterOnboardingPromptKey
  ): boolean {
    const prompt = prompts.find((entry) => entry.prompt_key === promptKey);
    return prompt ? prompt.should_show === true : false;
  }

  private showNext(): void {
    this.stage = this.queue.shift() ?? null;
  }
}
