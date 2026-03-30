import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, catchError, map, of } from 'rxjs';
import { ProfileService as AccountProfileService } from 'src/app/_fake/services/get-profile/get-profile.service';
import {
  ProjectAccountCheckResults,
  ProjectSettingsService,
} from 'src/app/pages/insighter-dashboard/insighter-dashboard/account-settings/project-settings/project-settings.service';

export type ProjectProgressMilestone = 'publish_insights' | 'whatsapp' | 'profile';

export interface ProjectProgressCelebrationState {
  trigger: ProjectProgressMilestone;
  results: ProjectAccountCheckResults;
}

type StoredProjectProgressState = Partial<Record<ProjectProgressMilestone, boolean>>;

@Injectable({
  providedIn: 'root',
})
export class ProjectProgressCelebrationService {
  private readonly eligibleRoles = new Set(['insighter', 'company', 'company-insighter']);
  private readonly stateSubject = new BehaviorSubject<ProjectProgressCelebrationState | null>(null);
  readonly celebrationState$ = this.stateSubject.asObservable();

  constructor(
    private readonly projectSettingsService: ProjectSettingsService,
    private readonly accountProfileService: AccountProfileService
  ) {}

  checkMilestone(
    trigger: ProjectProgressMilestone,
    roles?: string[] | null
  ): Observable<boolean> {
    const resolvedRoles = roles?.length
      ? roles
      : this.accountProfileService.getCurrentUser()?.roles ?? [];

    if (resolvedRoles.length > 0 && !this.hasEligibleRole(resolvedRoles)) {
      return of(false);
    }

    return this.projectSettingsService.getProjectAccountCheck().pipe(
      map((results) => {
        const previousState = this.readStoredState();
        const nextState = this.toStoredState(results);
        const shouldOpen = nextState[trigger] === true && previousState[trigger] !== true;

        this.writeStoredState(nextState);

        if (shouldOpen) {
          this.stateSubject.next({ trigger, results });
        }

        return shouldOpen;
      }),
      catchError(() => of(false))
    );
  }

  dismiss(): void {
    this.stateSubject.next(null);
  }

  private hasEligibleRole(roles: string[]): boolean {
    return roles.some((role) => this.eligibleRoles.has(role));
  }

  private toStoredState(results: ProjectAccountCheckResults): StoredProjectProgressState {
    return {
      publish_insights: !!results.publish_insights?.pass,
      whatsapp: !!results.whatsapp?.pass,
      profile: !!results.profile?.pass,
    };
  }

  private readStoredState(): StoredProjectProgressState {
    if (typeof window === 'undefined') {
      return {};
    }

    try {
      const raw = window.localStorage.getItem(this.getStorageKey());
      return raw ? (JSON.parse(raw) as StoredProjectProgressState) : {};
    } catch {
      return {};
    }
  }

  private writeStoredState(state: StoredProjectProgressState): void {
    if (typeof window === 'undefined') {
      return;
    }

    try {
      window.localStorage.setItem(this.getStorageKey(), JSON.stringify(state));
    } catch {
      // Ignore storage write failures; the popup still works for the current action.
    }
  }

  private getStorageKey(): string {
    const userId = this.accountProfileService.getCurrentUser()?.id ?? 'anonymous';
    return `knoldg-project-progress:${userId}`;
  }
}
