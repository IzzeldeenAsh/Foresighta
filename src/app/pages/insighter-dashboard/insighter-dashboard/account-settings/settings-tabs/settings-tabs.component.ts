import { Component, Injector, OnInit, OnDestroy } from '@angular/core';
import { Router, ActivatedRoute, NavigationEnd } from '@angular/router';
import { Observable, Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';
import { BaseComponent } from 'src/app/modules/base.component';
import { ProfileService } from 'src/app/_fake/services/get-profile/get-profile.service';

@Component({
  selector: 'app-settings-tabs',
  templateUrl: './settings-tabs.component.html',
  styleUrls: ['./settings-tabs.component.scss']
})
export class SettingsTabsComponent extends BaseComponent implements OnInit, OnDestroy {
  activeTab: string = 'general-settings';
  isInsighter$: Observable<boolean>;
  isCompany$: Observable<boolean>;
  isClient$: Observable<any>;
  private routerSubscription: Subscription;

  constructor(
    injector: Injector,
    private router: Router,
    private route: ActivatedRoute,
    private profileService: ProfileService
  ) {
    super(injector);
    this.isInsighter$ = this.profileService.isInsighter();
    this.isCompany$ = this.profileService.isCompany();
    this.isClient$ = this.profileService.isClient();
  }

  ngOnInit(): void {
    // Set initial active tab based on current route
    this.updateActiveTabFromRoute(this.router.url);

    // Listen to route changes to update active tab
    this.routerSubscription = this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe((event) => {
      this.updateActiveTabFromRoute((event as NavigationEnd).url);
    });
  }

  ngOnDestroy(): void {
    if (this.routerSubscription) {
      this.routerSubscription.unsubscribe();
    }
    super.ngOnDestroy();
  }

  private updateActiveTabFromRoute(url: string): void {
    if (url.includes('general-settings')) {
      this.activeTab = 'general-settings';
    } else if (url.includes('payment-settings')) {
      this.activeTab = 'payment-settings';
    }
  }

  switchTab(tab: string): void {
    this.activeTab = tab;
    this.router.navigate([`/app/insighter-dashboard/account-settings/${tab}`]);
  }
}
