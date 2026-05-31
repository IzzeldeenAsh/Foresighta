import { Component, Injector, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntil } from 'rxjs/operators';
import { ProjectOffer, ProjectOffersService } from 'src/app/_fake/services/project-offers/project-offers.service';
import { OnWorkProjectsComponent } from './on-work-projects.component';

@Component({
  selector: 'app-on-work-project-details',
  templateUrl: './on-work-projects.component.html',
  styleUrls: [
    '../project-offers/project-offers.component.scss',
    './on-work-projects.component.scss',
  ],
})
export class OnWorkProjectDetailsComponent extends OnWorkProjectsComponent implements OnInit {
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
        this.setDrawerTab('documents');
        this.activeDrawerTab = 'overview';
      });
  }

  override closeDrawer(): void {
    this.detailsRouter.navigate(['/app/insighter-dashboard/on-work-projects']);
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
