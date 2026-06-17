import { Component, Injector, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntil } from 'rxjs/operators';
import { ProjectOffer, ProjectOffersService } from 'src/app/_fake/services/project-offers/project-offers.service';
import { DrawerTab, OnWorkProjectsComponent } from './on-work-projects.component';

@Component({
  selector: 'app-on-work-project-details',
  templateUrl: './on-work-projects.component.html',
  styleUrls: [
    '../project-offers/project-offers.component.scss',
    './on-work-projects.component.scss',
  ],
})
export class OnWorkProjectDetailsComponent extends OnWorkProjectsComponent implements OnInit {
  private readonly detailTabParam = 'tab';
  private readonly detailTabValues: DrawerTab[] = ['overview', 'documents', 'reviews', 'discussion', 'contract'];

  constructor(
    injector: Injector,
    projectOffersService: ProjectOffersService,
    private route: ActivatedRoute,
    private detailsRouter: Router,
  ) {
    super(injector, projectOffersService, detailsRouter);
  }

  override ngOnInit(): void {
    this.isDetailsPage = true;
    this.route.paramMap
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe(params => {
        const uuid = params.get('uuid') || '';
        if (!uuid) {
          this.projectDetailsError = true;
          return;
        }

        this.selectProject(this.createProjectShell(uuid));
        super.setDrawerTab('documents', false);
        this.setDrawerTab(this.getCurrentTabFromUrl());
      });

    this.route.queryParamMap
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe(() => {
        if (!this.selectedProject) return;
        const tab = this.getCurrentTabFromUrl();
        super.setDrawerTab(tab, false);
        this.updateTabQueryParam(this.activeDrawerTab);
      });
  }

  override closeDrawer(): void {
    this.detailsRouter.navigate(['/app/insighter-dashboard/on-work-projects']);
  }

  protected override onDrawerTabChanged(tab: DrawerTab): void {
    this.updateTabQueryParam(tab);
  }

  private getCurrentTabFromUrl(): DrawerTab {
    const tab = this.route.snapshot.queryParamMap.get(this.detailTabParam) || '';
    return this.isValidDetailTab(tab) ? tab : 'overview';
  }

  private isValidDetailTab(tab: string): tab is DrawerTab {
    return this.detailTabValues.includes(tab as DrawerTab);
  }

  private updateTabQueryParam(tab: DrawerTab): void {
    if (this.route.snapshot.queryParamMap.get(this.detailTabParam) === tab) {
      return;
    }

    this.detailsRouter.navigate([], {
      relativeTo: this.route,
      queryParams: { [this.detailTabParam]: tab },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  private createProjectShell(uuid: string): ProjectOffer {
    return {
      uuid,
      status: null,
      action_status: null,
      project: {
        uuid,
        title: '',
        type: '',
        language: null,
        service: null,
        service_prompt: null,
        phase: null,
        business_type: null,
        industry: null,
        description: null,
        deadline_offer: null,
        deadline: null,
        components: [],
        addons: [],
        scopes: [],
        request_files: [],
      },
    };
  }
}
