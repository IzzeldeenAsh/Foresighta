import { Component, Injector, OnInit, OnDestroy } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
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
  isCompanyInsighter$: Observable<boolean>;
  private routerSubscription: Subscription;

  constructor(
    injector: Injector,
    private router: Router,
    private profileService: ProfileService
  ) {
    super(injector);
    this.isInsighter$ = this.profileService.isInsighter();
    this.isCompany$ = this.profileService.isCompany();
    this.isClient$ = this.profileService.isClient();
    this.isCompanyInsighter$ = this.profileService.isCompanyInsighter()
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

  getSettingsSubtitle(): string {
    switch (this.activeTab) {
      case 'general-settings':
        return this.lang === 'ar' ?
          'إدارة المعلومات الشخصية وإعدادات الحساب.' :
          'Manage personal information and account settings.';
      case 'notification-settings':
        return this.lang === 'ar'
          ? 'إدارة إعدادات إشعارات واتساب والرسائل النصية.'
          : 'Manage WhatsApp and SMS notification settings.';
      case 'payment-settings':
        return this.lang === 'ar' ?
          'تكوين طرق الدفع وإعدادات الفوترة.' :
          'Configure payment methods and billing settings.';
      case 'consulting-schedule':
        return this.lang === 'ar' ?
          'إدارة جدولة الاستشارات وأوقات التوفر.' :
          'Manage consultation scheduling and availability.';
      default:
        return this.lang === 'ar' ?
          'إدارة إعدادات الحساب والتفضيلات.' :
          'Manage account settings and preferences.';
    }
  }

  private updateActiveTabFromRoute(url: string): void {
    if (url.includes('general-settings')) {
      this.activeTab = 'general-settings';
    } else if (url.includes('notification-settings')) {
      this.activeTab = 'notification-settings';
    } else if (url.includes('payment-settings')) {
      this.activeTab = 'payment-settings';
    } else if (url.includes('consulting-schedule')) {
      this.activeTab = 'consulting-schedule';
    }
  }

  switchTab(tab: string): void {
    this.activeTab = tab;
    this.router.navigate([`/app/insighter-dashboard/account-settings/${tab}`]);
  }
}
