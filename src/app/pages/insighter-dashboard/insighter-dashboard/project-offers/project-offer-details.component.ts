import { Component, Injector, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntil } from 'rxjs/operators';
import { ProjectOffer, ProjectOffersService } from 'src/app/_fake/services/project-offers/project-offers.service';
import { ProjectOffersComponent } from './project-offers.component';

@Component({
  selector: 'app-project-offer-details',
  templateUrl: './project-offers.component.html',
  styleUrl: './project-offers.component.scss',
})
export class ProjectOfferDetailsComponent extends ProjectOffersComponent implements OnInit {
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
          this.drawerDetailsError = true;
          return;
        }

        this.loadOfferDetails(this.createOfferShell(uuid));
      });
  }

  override closeDrawer(): void {
    this.detailsRouter.navigate(['/app/insighter-dashboard/project-offers']);
  }

  private createOfferShell(uuid: string): ProjectOffer {
    return {
      uuid,
      status: null,
      action_status: null,
      project: {
        uuid: null,
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
