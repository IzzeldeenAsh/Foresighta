import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { filter, map, take } from 'rxjs/operators';
import { MenuItem } from 'primeng/api';
import { ProfileService } from 'src/app/_fake/services/get-profile/get-profile.service';
import { Observable, Subscription } from 'rxjs';
import { TranslationService } from 'src/app/modules/i18n';

@Component({
  selector: 'app-insighter-dashboard',
  templateUrl: './insighter-dashboard.component.html',
  styleUrls: ['./insighter-dashboard.component.scss']
})
export class InsighterDashboardComponent implements OnInit, OnDestroy {
  activeTabIndex: number = 0;
  items: MenuItem[] = [];
  activeItem: MenuItem | undefined;
  hasCompanyRole$: Observable<boolean>;
  isClient$: Observable<any>;
  panelMenuItems: MenuItem[] = [];
  lang: string = 'en';
  isMeetingsExpanded: boolean = false;
  isSettingsExpanded: boolean = false;
  isActivityExpanded: boolean = false;
  isCommerceExpanded: boolean = false;
  isNavCollapsed: boolean = false;
  isMobileSidebarVisible: boolean = false;
  isMobileView: boolean = false;
  isInsighter$: Observable<boolean>;
  isCompany$: Observable<boolean>;
  private subscriptions: Subscription[] = [];
  isCompanyInsighter$: Observable<boolean>;
  constructor(
    private router: Router,
    private profileService: ProfileService,
    private translationService: TranslationService
  ) {
    this.hasCompanyRole$ = this.profileService.hasRole(['company']);
    // Auto-collapse on smaller screens initially
    this.checkScreenSize();
  }

  @HostListener('window:resize', ['$event'])
  onResize(event: any) {
    this.checkScreenSize();
  }

  private checkScreenSize() {
    if (typeof window !== 'undefined') {
      const isMobile = window.innerWidth <= 575;
      this.isMobileView = isMobile;
      
      if (isMobile) {
        // On mobile, always show sidebar when opened
        this.isNavCollapsed = false;
      } else {
        // On desktop, auto-collapse on smaller screens
        this.isNavCollapsed = window.innerWidth <= 1230;
      }
    }
  }

  ngOnInit() {
    this.handleLanguage();
    // Initialize menu items after checking roles
    const hasCompanyRoleSub = this.hasCompanyRole$.pipe(take(1)).subscribe(hasCompanyRole => {
      this.initializeMenuItems(hasCompanyRole);
      this.buildPanelMenu(hasCompanyRole);
      
      // Set initial active tab based on current route
      this.setActiveTabFromRoute(this.router.url);
      
      // Check if we're on a meetings route to expand the meetings section
      this.checkMeetingsRoute(this.router.url);
      
      // Check if we're on a settings route to expand the settings section
      this.checkSettingsRoute(this.router.url);

      // Expand activity/commerce groups when their routes are active
      this.checkActivityRoute(this.router.url);
      this.checkCommerceRoute(this.router.url);
    });
    this.subscriptions.push(hasCompanyRoleSub);

    this.isClient$ = this.profileService.isClient()
    this.isInsighter$ = this.profileService.isInsighter()
    this.isCompany$ = this.profileService.isCompany()
    this.isCompanyInsighter$ = this.profileService.isCompanyInsighter()
    // Subscribe to route changes
    const routerSub = this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe((event: any) => {
      this.setActiveTabFromRoute(event.url);
      this.checkMeetingsRoute(event.url);
      this.checkSettingsRoute(event.url);
      this.checkActivityRoute(event.url);
      this.checkCommerceRoute(event.url);
      // Close mobile sidebar after navigation
      if (this.isMobileView) {
        this.isMobileSidebarVisible = false;
      }
    });
    this.subscriptions.push(routerSub);
  }

  ngOnDestroy() {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  handleLanguage() {
    this.lang = this.translationService.getSelectedLanguage();
    this.translationService.onLanguageChange().subscribe((lang) => {
      this.lang = lang;
      // Rebuild menu when language changes
      this.hasCompanyRole$.pipe(take(1)).subscribe(hasCompanyRole => {
        this.buildPanelMenu(hasCompanyRole);
      });
    });
  }

  buildPanelMenu(hasCompanyRole: boolean) {
    this.panelMenuItems = [
      {
        label: this.translationService.getTranslation('INSIGHTER.DASHBOARD.NAV.DASHBOARD') || 'Dashboard',
        icon: 'pi pi-home',
        items: [
          {
            label: this.translationService.getTranslation('INSIGHTER.DASHBOARD.NAV.OVERVIEW') || 'Overview',
            icon: 'pi pi-chart-line',
            routerLink: '/app/dashboard/my-dashboard'
          }
        ]
      },
      {
        label: this.translationService.getTranslation('INSIGHTER.DASHBOARD.NAV.REQUESTS') || 'Requests & Knowledge',
        icon: 'pi pi-file',
        items: [
          {
            label: this.translationService.getTranslation('INSIGHTER.DASHBOARD.NAV.MY_REQUESTS') || 'My Requests',
            icon: 'pi pi-list',
            routerLink: '/app/dashboard/my-requests'
          },
          {
            label: this.translationService.getTranslation('INSIGHTER.DASHBOARD.NAV.MY_KNOWLEDGE') || 'My Knowledge',
            icon: 'pi pi-book',
            routerLink: '/app/dashboard/my-knowledge'
          },
          {
            label: this.translationService.getTranslation('INSIGHTER.DASHBOARD.NAV.MY_DOWNLOADS') || 'My Downloads',
            icon: 'pi pi-download',
            routerLink: '/app/dashboard/my-downloads'
          }
        ]
      }
    ];

    // Add company section if user has company role
    if (hasCompanyRole) {
      this.panelMenuItems.push({
        label: this.translationService.getTranslation('INSIGHTER.DASHBOARD.NAV.COMPANY') || 'Company',
        icon: 'pi pi-building',
        items: [
          {
            label: this.translationService.getTranslation('INSIGHTER.DASHBOARD.NAV.MY_COMPANY') || 'My Company',
            icon: 'pi pi-users',
            routerLink: '/app/dashboard/my-company-settings'
          }
        ]
      });
    }

    // Add settings section
    this.panelMenuItems.push({
      label: this.translationService.getTranslation('INSIGHTER.DASHBOARD.NAV.SETTINGS') || 'Settings',
      icon: 'pi pi-cog',
      items: [
        {
          label: this.translationService.getTranslation('INSIGHTER.DASHBOARD.NAV.ACCOUNT_SETTINGS') || 'Account Settings',
          icon: 'pi pi-user-edit',
          routerLink: '/app/dashboard/account-settings'
        }
      ]
    });
  }

  initializeMenuItems(hasCompanyRole: boolean) {
    this.items = [
      {
        label: 'My Dashboard',
        icon: 'pi pi-home',
        command: () => {
          this.router.navigate(['my-dashboard']);
        }
      },
      {
        label: 'Requests',
        icon: 'pi pi-list',
        command: () => {
          this.router.navigate(['my-requests']);
        }
      },
      {
        label: 'My Knowledge',
        icon: 'pi pi-book',
        command: () => {
          this.router.navigate(['my-knowledge']);
        }
      },
      {
        label: 'My Downloads',
        icon: 'pi pi-download',
        command: () => {
          this.router.navigate(['my-downloads']);
        }
      }
    ];

    if (hasCompanyRole) {
      this.items.push({
        label: 'My Team',
        icon: 'pi pi-building',
        command: () => {
          this.router.navigate(['my-company-settings']);
        }
      });
    }

    this.items.push({
      label: 'Account Settings',
      icon: 'pi pi-cog',
      command: () => {
        this.router.navigate(['account-settings']);
      }
    });

    this.activeItem = this.items[0];
  }

  setActiveTabFromRoute(url: string) {
    const routes = ['my-dashboard', 'my-requests', 'my-knowledge', 'my-downloads', 'my-company-settings', 'account-settings'];
    const index = routes.findIndex(route => url.includes(route));
    if (index !== -1) {
      this.activeTabIndex = index;
      this.activeItem = this.items[index];
    }
  }

  isRouteActive(route: string): boolean {
    return this.router.url.includes(route);
  }

  isSubRouteActive(route: string, subRoute: string): boolean {
    return this.router.url.includes(route) && this.router.url.includes(subRoute);
  }

  toggleMeetings(): void {
    this.isMeetingsExpanded = !this.isMeetingsExpanded;
  }

  checkMeetingsRoute(url: string): void {
    // Auto-expand meetings section if we're on a meetings route
    if (url.includes('my-meetings')) {
      this.isMeetingsExpanded = true;
    }
  }

  toggleSettings(): void {
    this.isSettingsExpanded = !this.isSettingsExpanded;
  }

  checkSettingsRoute(url: string): void {
    // Auto-expand settings section if we're on a settings route
    if (url.includes('account-settings')) {
      this.isSettingsExpanded = true;
    }
  }

  toggleActivity(): void {
    this.isActivityExpanded = !this.isActivityExpanded;
  }

  checkActivityRoute(url: string): void {
    const routes = ['my-knowledge', 'my-downloads', 'read-later', 'my-company-settings'];
    if (routes.some(route => url.includes(route))) {
      this.isActivityExpanded = true;
    }
  }

  toggleCommerce(): void {
    this.isCommerceExpanded = !this.isCommerceExpanded;
  }

  checkCommerceRoute(url: string): void {
    const routes = ['my-orders', 'sales', 'wallet'];
    if (routes.some(route => url.includes(route))) {
      this.isCommerceExpanded = true;
    }
  }

  toggleNavCollapse(): void {
    if (this.isMobileView) {
      this.isMobileSidebarVisible = !this.isMobileSidebarVisible;
    } else {
      this.isNavCollapsed = !this.isNavCollapsed;
    }
  }

  closeMobileSidebar(): void {
    this.isMobileSidebarVisible = false;
  }

  navigateToSettings(): void {
    this.router.navigate(['/app/insighter-dashboard/account-settings/general-settings']);
    this.closeMobileSidebar();
  }
}
