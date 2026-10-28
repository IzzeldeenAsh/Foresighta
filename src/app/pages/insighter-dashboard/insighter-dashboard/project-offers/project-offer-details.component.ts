import { Component, Injector, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntil } from 'rxjs/operators';
import { ProjectOffer, ProjectOffersService } from 'src/app/_fake/services/project-offers/project-offers.service';
import { DrawerTab, OfferDrawerSection, ProjectOffersComponent } from './project-offers.component';

@Component({
  selector: 'app-project-offer-details',
  templateUrl: './project-offers.component.html',
  styleUrl: './project-offers.component.scss',
})
export class ProjectOfferDetailsComponent extends ProjectOffersComponent implements OnInit {
  private readonly detailTabParam = 'tab';
  private handledOfferParam: string | null = null;
  private readonly detailTabValues: DrawerTab[] = ['overview', 'documents', 'discussion'];
  /** `?tab=offer|revisions` (old tab links, notifications) now opens the "View Offer" drawer on that section. */
  private pendingOfferSection: OfferDrawerSection | null = null;

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
    this.takeOfferSubmittedFlag();
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
      .subscribe(params => {
        // `?offer=` (private-message notification) opens the private drawer once per link.
        const offerParam = params.get('offer');
        if (offerParam && offerParam !== this.handledOfferParam) {
          this.handledOfferParam = offerParam;
          this.pendingPrivateOfferUuid = offerParam;
        }
        const matchParam = params.get('match');
        if (matchParam && params.get('revision')) this.notificationMatchUuid = matchParam;
        const tabParam = params.get(this.detailTabParam);
        if (tabParam === 'offer' || tabParam === 'revisions') this.pendingOfferSection = tabParam;
        if (!this.selectedOffer) return;
        this.openPendingPrivateMessages();
        this.openPendingOfferDrawer();
        const tab = this.getCurrentTabFromUrl(this.selectedOffer);
        super.setDrawerTab(tab, this.selectedOffer, false);
        this.updateTabQueryParam(tab);
      });
  }

  /** send-proposal navigates here with `state.offerSubmitted`; drop it from history so a reload doesn't greet again. */
  private takeOfferSubmittedFlag(): void {
    if (typeof history === 'undefined') return;
    const submitted = this.detailsRouter.getCurrentNavigation()?.extras.state?.['offerSubmitted'] || history.state?.offerSubmitted;
    if (!submitted) return;
    this.offerSubmittedVisible = true;
    if (history.state?.offerSubmitted) history.replaceState({ ...history.state, offerSubmitted: false }, '');
  }

  override closeDrawer(): void {
    this.detailsRouter.navigate(['/app/insighter-dashboard/project-offers']);
  }

  protected override openPendingOfferDrawer(): void {
    const section = this.pendingOfferSection;
    if (!section || !this.selectedOffer) return;
    this.pendingOfferSection = null;
    if (!this.offerDrawerVisible) this.openOfferDrawer(this.selectedOffer, section);
  }

  /** A notification's `?revision=` is handled once; drop it so reopening the drawer starts fresh. */
  protected override onOfferDrawerClosed(): void {
    this.handledOfferParam = null;
    this.pendingOfferSection = null;
    this.pendingPrivateOfferUuid = null;
    if (this.route.snapshot.queryParamMap.has('offer')) {
      this.detailsRouter.navigate([], { relativeTo: this.route, queryParams: { offer: null, tab: 'overview' }, queryParamsHandling: 'merge', replaceUrl: true });
    }
    if (!this.route.snapshot.queryParamMap.has('revision')) return;
    this.detailsRouter.navigate([], { relativeTo: this.route, queryParams: { revision: null }, queryParamsHandling: 'merge', replaceUrl: true });
  }

  protected override getInitialDrawerTab(offer: ProjectOffer | null | undefined): DrawerTab {
    return this.getCurrentTabFromUrl(offer);
  }

  protected override onDrawerTabChanged(tab: DrawerTab): void {
    this.updateTabQueryParam(tab);
  }

  private getCurrentTabFromUrl(_offer: ProjectOffer | null | undefined): DrawerTab {
    const tab = this.route.snapshot.queryParamMap.get(this.detailTabParam) || '';
    if (!this.isValidDetailTab(tab)) {
      return 'overview';
    }

    return tab;
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
        components: [],
        addons: [],
        scopes: [],
        project_services: [],
        deliverables: [],
        schedule: { planned_start_date: null, duration_days: null, planned_close_date: null, started_at: null, closed_at: null },
        request_files: [],
      },
    };
  }
}
