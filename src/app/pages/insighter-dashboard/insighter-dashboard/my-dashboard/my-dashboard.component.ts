import { Component, Injector, OnDestroy, OnInit } from '@angular/core';
import { Observable } from 'rxjs';
import { ProfileService } from 'src/app/_fake/services/get-profile/get-profile.service';
import { BaseComponent } from 'src/app/modules/base.component';
import {
  ProjectAccountCheckResults,
  ProjectSettingsService,
} from '../account-settings/project-settings/project-settings.service';

@Component({
  selector: 'app-my-dashboard',
  templateUrl: './my-dashboard.component.html',
  styleUrl: './my-dashboard.component.scss'
})
export class MyDashboardComponent extends BaseComponent implements OnInit, OnDestroy {
showProjectServiceSetupWidget = false;
isProjectServiceSetupCheckLoading = false;

constructor(
  injector: Injector,
  private profileService: ProfileService,
  private projectSettingsService: ProjectSettingsService,
){
  super(injector);
}

ngOnInit(): void {
  const profileSub = this.profileService.getProfile().subscribe({
    next: (profile) => {
      const roles = profile?.roles || [];

      if (this.canShowProjectServicePrompt(roles)) {
        this.loadProjectServiceSetupStatus();
        return;
      }

      this.showProjectServiceSetupWidget = false;
    },
    error: () => {
      this.showProjectServiceSetupWidget = false;
    },
  });

  this.unsubscribe.push(profileSub);
}

ngOnDestroy(): void {
  super.ngOnDestroy();
}

isClient(): Observable<any>{
  return this.profileService.isClient();
}

isInsighter(): Observable<any>{
  return this.profileService.isInsighter();
}

isCompanyInsighter(): Observable<any>{
  return this.profileService.isCompanyInsighter();
}

isCompany(): Observable<any>{
  return this.profileService.isCompany();
}

private loadProjectServiceSetupStatus(): void {
  this.isProjectServiceSetupCheckLoading = true;

  const setupSub = this.projectSettingsService.getProjectAccountCheck().subscribe({
    next: (results) => {
      this.showProjectServiceSetupWidget = this.isProjectServiceSetupIncomplete(results);
      this.isProjectServiceSetupCheckLoading = false;
    },
    error: () => {
      this.showProjectServiceSetupWidget = false;
      this.isProjectServiceSetupCheckLoading = false;
    },
  });

  this.unsubscribe.push(setupSub);
}

private canShowProjectServicePrompt(roles: string[]): boolean {
  return roles.some((role) =>
    ['company', 'insighter', 'company-insighter'].includes(role)
  );
}

private isProjectServiceSetupIncomplete(results: ProjectAccountCheckResults): boolean {
  return results.pass === false;
}

}
