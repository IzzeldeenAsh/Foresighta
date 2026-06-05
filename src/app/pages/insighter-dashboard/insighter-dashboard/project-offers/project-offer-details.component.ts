import { Component, Injector, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntil } from 'rxjs/operators';
import { ProjectOffer, ProjectOffersService } from 'src/app/_fake/services/project-offers/project-offers.service';
import { DrawerTab, ProjectOffersComponent } from './project-offers.component';

@Component({
  selector: 'app-project-offer-details',
  templateUrl: './project-offers.component.html',
  styleUrl: './project-offers.component.scss',
})
export class ProjectOfferDetailsComponent extends ProjectOffersComponent implements OnInit {
  private readonly detailTabParam = 'tab';
  private readonly detailTabValues: DrawerTab[] = ['overview', 'documents', 'discussion', 'offer'];

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

    this.route.queryParamMap
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe(() => {
        if (!this.selectedOffer) return;
        const tab = this.getCurrentTabFromUrl(this.selectedOffer);
        super.setDrawerTab(tab, this.selectedOffer, false);
        this.updateTabQueryParam(tab);
      });
  }

  override closeDrawer(): void {
    this.detailsRouter.navigate(['/app/insighter-dashboard/project-offers']);
  }

  protected override getInitialDrawerTab(offer: ProjectOffer | null | undefined): DrawerTab {
    return this.getCurrentTabFromUrl(offer);
  }

  protected override onDrawerTabChanged(tab: DrawerTab): void {
    this.updateTabQueryParam(tab);
  }

  private getCurrentTabFromUrl(offer: ProjectOffer | null | undefined): DrawerTab {
    const tab = this.route.snapshot.queryParamMap.get(this.detailTabParam) || '';
    if (!this.isValidDetailTab(tab)) {
      return 'overview';
    }

    return tab === 'offer' && !this.hasSubmittedOffer(offer) ? 'overview' : tab;
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
