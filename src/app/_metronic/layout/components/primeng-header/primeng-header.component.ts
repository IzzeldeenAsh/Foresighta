import { Component, OnInit, OnDestroy, ElementRef, ViewChild, HostListener, Renderer2, NgZone, ChangeDetectorRef } from '@angular/core';
import { trigger, transition, style, animate } from '@angular/animations';
import { MenuItem } from 'primeng/api';
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { Subscription } from 'rxjs';
import { ProfileService } from 'src/app/_fake/services/get-profile/get-profile.service';
import { Router, NavigationEnd } from '@angular/router';
import { TranslationService } from 'src/app/modules/i18n';
import { TranslateService } from '@ngx-translate/core';
import { Notification, NotificationsService } from 'src/app/_fake/services/nofitications/notifications.service';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { filter } from 'rxjs/operators';
import { PusherClientService } from 'src/app/services/pusher-client.service';
import type { Channel } from 'pusher-js';
//d
interface CustomMenuItem extends MenuItem {
  expanded?: boolean;
  iconName: string;
  iconClass?: string;
  iconType?: string;
}

interface Industry {
  id: number;
  name: string;
  slug: string;
  children: any[];
}

interface IndustriesResponse {
  data: Industry[];
}

@Component({
  selector: 'app-primeng-header',
  templateUrl: './primeng-header.component.html',
  styleUrls: ['./primeng-header.component.scss'],
  animations: [
    trigger('drawerSlide', [
      transition(':enter', [
        style({ transform: 'translateX({fromX})' }),
        animate('300ms ease-out', style({ transform: 'translateX(0)' }))
      ], { params: { fromX: '100%' } }),
      transition(':leave', [
        animate('250ms ease-in', style({ transform: 'translateX({fromX})' }))
      ], { params: { fromX: '100%' } })
    ]),
    trigger('backdropFade', [
      transition(':enter', [
        style({ opacity: 0 }),
        animate('200ms ease-out', style({ opacity: 1 }))
      ]),
      transition(':leave', [
        animate('150ms ease-in', style({ opacity: 0 }))
      ])
    ])
  ]
})
export class PrimengHeaderComponent implements OnInit, OnDestroy {
  @ViewChild('userDropdown') userDropdown: ElementRef;
  @ViewChild('mobileUserDropdown') mobileUserDropdown: ElementRef;
  @ViewChild('userDropdownMenu') userDropdownMenu: ElementRef;
  @ViewChild('userDropdownToggle') userDropdownToggle: ElementRef;

  // Make Math available in the template
  Math = Math;

  items: CustomMenuItem[] = [];
  profile: any;
  sidebarVisible: boolean = false;
  isSmallScreen: boolean = false;
  userMenuItems: MenuItem[] = [];
  isUserDropdownOpen: boolean = false;
  isMobileUserDropdownOpen: boolean = false;
  private breakpointSubscription: Subscription;
  private profileSubscription: Subscription;

  // User profile data
  userName: string = '';
  userEmail: string = '';
  userInitials: string = '';
  userProfileImage: string | null = null;
  lang: string = '';
  
  // Notification related properties
  notifications: Notification[] = [];
  isNotificationsOpen: boolean = false;
  notificationCount: number = 0;
  private notificationChannel: Channel | null = null;
  private pusherGlobalHandler: ((eventName: string, data: any) => void) | null = null;
  
  // Industries dropdown
  industries: Industry[] = [];
  isIndustriesMenuOpen: boolean = false;
  
  isDashboardRoute: boolean = false;
  
  // Search functionality
  searchQuery: string = '';

  // Sticky / glass header state (activated when page is scrolled)
  isSticky: boolean = false;
  
  /**
   * Handle search submission
   * @param query Search query string
   * @param searchType Type of search (knowledge or insighter)
   */
  handleSearch(query: string = this.searchQuery, searchType: 'knowledge' | 'insighter' = 'knowledge') {
    const searchParams = new URLSearchParams();
    if (query.trim()) {
      searchParams.set('keyword', query.trim());
    }
    searchParams.set('search_type', searchType);
    
    // Navigate to the React app's search page
    const searchUrl = `https://insightabusiness.com/${this.lang}/home?${searchParams.toString()}`;
    window.location.href = searchUrl;
  }
  
  /**
   * Handle search form submission
   * @param event Form submit event
   */
  onSearchSubmit(event: Event) {
    event.preventDefault();
    event.stopPropagation();
    this.handleSearch();
  }
  
  /**
   * Handle search input click - just focus, don't redirect immediately
   */
  onSearchInputClick() {
    // Don't redirect immediately on click, let user type first
    // Redirect only happens on form submit or search icon click
  }
  
  /**
   * Handle search input change
   * @param event Input event
   */
  onSearchInput(event: Event) {
    const target = event.target as HTMLInputElement;
    this.searchQuery = target.value;
  }

  /**
   * Check if the user has any of the specified roles
   * @param roles Array of role names to check against
   * @returns boolean indicating if the user has any of the specified roles
   */
  hasRole(roles: string[]): boolean {
    if (!this.profile || !this.profile.roles) {
      return false;
    }
    return roles.some(role => this.profile.roles.includes(role));
  }

  /**
   * Check if the Add Knowledge button should be shown
   * @returns boolean indicating if the button should be displayed
   */
  shouldShowAddKnowledgeButton(): boolean {
    const currentUrl = this.router.url;
    const excludedRoutes = [
      '/app/insighter-register/vertical',
      '/app/add-knowledge/stepper'
    ];
    
    return !excludedRoutes.some(route => currentUrl.includes(route));
  }

  constructor(
    private breakpointObserver: BreakpointObserver,
    private profileService: ProfileService,
    private router: Router,
    private translationService: TranslationService,
    public translate: TranslateService,
    private renderer: Renderer2,
    private notificationService: NotificationsService,
    private http: HttpClient,
    private pusherClient: PusherClientService,
    private ngZone: NgZone,
    private cdr: ChangeDetectorRef
  ) {
    this.lang = this.translationService.getSelectedLanguage();
  }

  ngOnInit(): void {
    // Check initial screen size and subscribe to changes
    this.breakpointSubscription = this.breakpointObserver
      .observe([Breakpoints.XSmall, Breakpoints.Small, Breakpoints.Medium])
      .subscribe(result => {
        const wasSmallScreen = this.isSmallScreen;
        // Consider XSmall and Small as mobile, Medium and above as desktop
        this.isSmallScreen = result.matches;
        
        // If transitioning from small to large screen, close mobile sidebar and dropdowns
        if (wasSmallScreen && !this.isSmallScreen) {
          this.sidebarVisible = false;
          this.closeAllDropdowns();
        }
        
        // Close dropdowns when switching to mobile to prevent overlap issues
        if (!wasSmallScreen && this.isSmallScreen) {
          this.closeAllDropdowns();
        }
      });

    // Load profile and fetch industries
    this.profileService.getProfile().subscribe({
      next: (profile) => {
        this.profile = profile;
        this.loadUserProfile();
        this.fetchIndustries(); // Fetch industries
        this.initializeMenu(); // Initialize menu after getting profile
        this.onLanguageChange(); // Subscribe to language changes

        // Fetch notifications once (no periodic polling)
        this.notificationService.getNotifications(this.lang || 'en').subscribe((notifications) => {
          this.notifications = notifications;
          this.notificationCount = this.notifications.filter(n => !n.read_at).length;
        });

        // Initialize realtime (Pusher) if available
        const token = this.getAuthToken();
        const userId = profile?.id;
        if (userId && token) {
          this.initPusher(userId, token, this.lang || 'en');
        }
      }
    });

    // Subscribe to route changes
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe((event) => {
      // Use type assertion here
      const navEvent = event as NavigationEnd;
      // Check if the current URL contains 'dashboard'
      this.isDashboardRoute = navEvent.url.includes('dashboard');
      
      // Close mobile sidebar on route change
      if (this.isSmallScreen) {
        this.sidebarVisible = false;
      }
    });
    
    // Also check the initial route
    this.isDashboardRoute = this.router.url.includes('dashboard');
    
    // Initialize screen size on component load
    this.checkScreenSize();

    // Ensure sticky state is correct on initial load (e.g. refresh while scrolled)
    this.onWindowScroll();
  }

  get isRtl(): boolean {
    return this.lang === 'ar' || this.lang === 'he';
  }

  // Add method to check screen size manually
  private checkScreenSize() {
    this.isSmallScreen = window.innerWidth <= 991.98; // Bootstrap lg breakpoint
  }

  getHomeUrl(): string {
    const url= 'https://insightabusiness.com/' + this.lang;
    return url;
  }

  private static readonly DRAFT_TOAST_FLAG_KEY = 'knoldg:draft_saved_toast';
  private static readonly NEXT_TOAST_QUERY_KEY = 'toast';
  private static readonly NEXT_TOAST_QUERY_VALUE = 'draft_saved';

  private shouldAppendDraftToastToNextUrl(): boolean {
    // Only if user is currently in Add Knowledge wizard
    if (!this.router.url?.includes('/app/add-knowledge/stepper')) return false;
    try {
      return !!sessionStorage.getItem(PrimengHeaderComponent.DRAFT_TOAST_FLAG_KEY);
    } catch {
      return false;
    }
  }

  getHomeUrlForLogo(): string {
    const base = this.getHomeUrl();
    if (!this.shouldAppendDraftToastToNextUrl()) return base;

    try {
      const u = new URL(base);
      u.searchParams.set(
        PrimengHeaderComponent.NEXT_TOAST_QUERY_KEY,
        PrimengHeaderComponent.NEXT_TOAST_QUERY_VALUE
      );
      return u.toString();
    } catch {
      return base;
    }
  }

  onLogoClick(event: MouseEvent) {
    // Allow opening in a new tab/window with normal browser behavior
    if (event.metaKey || event.ctrlKey || event.button === 1) return;

    event.preventDefault();
    event.stopPropagation();

    window.location.href = this.getHomeUrlForLogo();
  }

  ngOnDestroy() {
    // Clean up subscriptions to prevent memory leaks
    if (this.breakpointSubscription) {
      this.breakpointSubscription.unsubscribe();
    }
    if (this.profileSubscription) {
      this.profileSubscription.unsubscribe();
    }
    
    // Unsubscribe realtime
    try {
      if (this.profile?.id) {
        this.pusherClient.unsubscribePrivateUser(this.profile.id);
      }
      // Best-effort unbind global handler
      try {
        if (this.pusherGlobalHandler) {
          this.pusherClient.unbindGlobal(this.pusherGlobalHandler);
        }
      } catch {}
      this.pusherClient.disconnect();
    } catch {}
  }

  loadUserProfile() {
    // Get user profile from service
    this.profileSubscription = this.profileService.getProfile().subscribe(
      (profile) => {
        this.userName = profile.name || '';
        this.userEmail = profile.email || '';

        // Set user initials (first letter of first and last name)
        if (this.userName) {
          const nameParts = this.userName.split(' ');
          if (nameParts.length >= 2) {
            this.userInitials = (nameParts[0][0] + nameParts[1][0]).toUpperCase();
          } else {
            this.userInitials = nameParts[0][0].toUpperCase();
          }
        }

        // Check if profile has a profile_photo_url
        this.userProfileImage = profile.profile_photo_url || null;
    //  if(profile.roles.includes('company') || profile.roles.includes('company-insighter')){
    //   this.userProfileImage = profile.company?.logo || null;
    //  }else{
    //   this.userProfileImage = profile.profile_photo_url || null;
    //  }
      },
      (error) => {
        console.error('Error loading user profile:', error);
      }
    );
  }

  fetchIndustries() {
    const headers = new HttpHeaders({
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'Accept-Language': this.lang
    });

    const body = {
      top_industry: 6,
      top_sub_industry: 1
    };

    this.http.post<IndustriesResponse>('https://api.insightabusiness.com/api/platform/industries/menu', body, { headers })
      .subscribe({
        next: (response) => {
          this.industries = response.data;
        },
        error: (error) => {
          console.error('Error fetching industries:', error);
        }
      });
  }

  getIndustryUrl(industry: Industry): string {
    return `https://insightabusiness.com/${this.lang}/industry/${industry.id}/${industry.slug}`;
  }

  initializeMenu() {
    // Create industries menu item with dropdown
    const industriesMenuItem: CustomMenuItem = {
      label: this.translate.instant('MENU.INDUSTRIES'),
      iconName: 'element-11',
      iconClass: 'text-primary',
      iconType: 'outline',
      expanded: false,
      items: this.industries.map(industry => ({
        label: industry.name,
        url: this.getIndustryUrl(industry),
        target: '_self'
      }))
    };

    const menuItems = [
      industriesMenuItem, // Add Industries as first item
      {
        label: this.translate.instant('MENU.REPORTS'),
        iconName: '',
        iconClass: 'text-primary',
        iconType: 'outline',
        expanded: false,
        routerLink: `https://insightabusiness.com/${this.lang}/industries/report`
      },
      {
        label: this.translate.instant('MENU.INSIGHTS'),
        iconName: '',
        iconClass: 'text-primary',
        iconType: 'outline',
        expanded: false,
        routerLink: `https://insightabusiness.com/${this.lang}/industries/insight`
      },
     
      {
        label: this.translate.instant('MENU.DATA'),
        iconName: '',
        iconClass: 'text-primary',
        iconType: 'outline',
        expanded: false,
        routerLink: `https://insightabusiness.com/${this.lang}/industries/data`
      },
      {
        label: this.translate.instant('MENU.MANUAL'),
        iconName: '',
        iconClass: 'text-primary',
        iconType: 'outline',
        expanded: false,
        routerLink: `https://insightabusiness.com/${this.lang}/industries/manual`
      },
      {
        label: this.translate.instant('MENU.COURSES'),
        iconName: '',
        iconClass: 'text-primary',
        iconType: 'outline',
        expanded: false,
        routerLink: `https://insightabusiness.com/${this.lang}/industries/course`
      }
    ];

    // Add the "Add Knowledge" menu item only for specific roles
    if (this.profile?.roles?.some((role: string) => ['insighter', 'insighter-company', 'company'].includes(role))) {
      menuItems.push({
        label: this.translate.instant('MENU.ADD_KNOWLEDGE'),
        iconName: 'plus-square',
        iconClass: 'text-info fs-2 fw-bold',
        iconType: 'duotone',
        expanded: false,
        routerLink: this.getAddKnowledgeRoute()
      });
    }

    this.items = menuItems;

    this.userMenuItems = [
      {
        label: this.translate.instant('HOME.MY_PROFILE'),
        iconName: 'user',
        iconClass: 'text-primary',
        iconType: 'outline',
        routerLink: '/app/profile'
      },
      {
        label: this.translate.instant('HOME.ACCOUNT_SETTINGS'),
        iconName: 'settings',
        iconClass: 'text-info',
        iconType: 'outline',
        routerLink: '/app/insighter-dashboard/account-settings'
      },
      {
        separator: true
      },
      {
        label: this.translate.instant('HOME.SIGN_OUT'),
        iconName: 'log-out',
        iconClass: 'text-danger',
        iconType: 'outline',
        command: () => {
          // Handle logout
        }
      }
    ] as CustomMenuItem[];
  }

  // Determines the correct route for the Add Knowledge button based on user roles
  getAddKnowledgeRoute(): string {
    if(this.profile?.roles?.includes('client') && !this.profile?.roles?.includes('company-insighter') && !this.profile?.roles?.includes('company') && !this.profile?.roles?.includes('insighter') ){
      return '/app/insighter-register/vertical';
    }else{
      return '/app/add-knowledge/stepper';
    }
  }

  toggleSidebar() {
    this.sidebarVisible = !this.sidebarVisible;
    // Close dropdowns when sidebar is toggled
    this.closeAllDropdowns();
  }

  toggleSubmenu(item: CustomMenuItem) {
    item.expanded = !item.expanded;
  }

  toggleUserDropdown(event: Event) {
    event.preventDefault();
    event.stopPropagation();
    this.isUserDropdownOpen = !this.isUserDropdownOpen;
    this.isMobileUserDropdownOpen = false;
    this.isNotificationsOpen = false;
  }

  toggleMobileUserDropdown(event: Event) {
    event.preventDefault();
    event.stopPropagation();
    this.isMobileUserDropdownOpen = !this.isMobileUserDropdownOpen;
    this.isUserDropdownOpen = false;
    this.isNotificationsOpen = false;
    
    // Handle mobile dropdown positioning to prevent off-screen issues
    if (this.isMobileUserDropdownOpen) {
      setTimeout(() => {
        const dropdown = document.querySelector('.mobile-user-dropdown-menu.show') as HTMLElement;
        if (dropdown) {
          const rect = dropdown.getBoundingClientRect();
          const viewportWidth = window.innerWidth;
          
          // If dropdown goes off-screen to the right, adjust position
          if (rect.right > viewportWidth) {
            dropdown.style.right = '0.5rem';
            dropdown.style.left = 'auto';
          }
          
          // If dropdown goes off-screen to the left (for RTL)
          if (rect.left < 0) {
            dropdown.style.left = '0.5rem';
            dropdown.style.right = 'auto';
          }
        }
      }, 10);
    }
  }
  
  // Toggle notifications dropdown
  toggleNotifications(event: Event) {
    event.preventDefault();
    event.stopPropagation();
    this.isNotificationsOpen = !this.isNotificationsOpen;
    this.isUserDropdownOpen = false;
    this.isMobileUserDropdownOpen = false;

    // If opening the notifications dropdown, mark all as read
    if (this.isNotificationsOpen && this.notificationCount > 0) {
      // Immediately set notification count to 0 for UI feedback
      // this.notificationCount = 0;
      
      // const headers = new HttpHeaders({
      //   'Accept': 'application/json',
      //   'Content-Type': 'application/json',
      //   'Accept-Language': this.lang || 'en'
      // });

      // this.http.put('https://api.insightabusiness.com/api/account/notification/read', {}, { headers })
      //   .subscribe({
      //     next: () => {
      //       // Refresh notifications from API
      //       this.notificationService.getNotifications(this.lang || 'en').subscribe(notifications => {
      //         this.notifications = notifications;
      //       });
      //     },
      //     error: (error) => {
      //       console.error('Error marking all notifications as read:', error);
      //     }
      //   });
    }
  }

  // Close notifications dropdown
  closeNotifications() {
    this.isNotificationsOpen = false;
  }

  @HostListener('window:keydown', ['$event'])
  onKeyDown(e: KeyboardEvent) {
    if (e.key === 'Escape' && this.isNotificationsOpen) {
      this.isNotificationsOpen = false;
    }
  }

  @HostListener('window:scroll')
  onWindowScroll() {
    const next = (typeof window !== 'undefined' ? window.scrollY : 0) > 0;
    if (next !== this.isSticky) {
      this.isSticky = next;
    }
  }
  
  // Handle notification click
  handleNotificationClick(notificationId: string) {
    // Close notifications dropdown when clicked
    this.closeNotifications();
    
    // Find the notification by ID
    const notification = this.notifications.find(n => n.id === notificationId);
    
    // Mark notification as read
    this.notificationService.markAsRead(notificationId, this.lang).subscribe({
      next: () => {
        // Refresh notifications from API
        this.notificationService.getNotifications(this.lang ? this.lang : 'en').subscribe(notifications => {
          this.notifications = notifications;
          // Count only unread notifications (where read_at is null or undefined)
          this.notificationCount = notifications.filter(n => !n.read_at).length;
        });
      },
      error: (error) => {
        console.error('Error marking notification as read:', error);
      }
    });
    
    // Handle routing for knowledge notifications
    if (notification && notification.type === 'knowledge') {
      if (notification.sub_type === 'accept_knowledge' || notification.sub_type === 'declined') {
        // Check user role and route accordingly
        this.profileService.getProfile().subscribe(user => {
          if (user && user.roles.includes('company-insighter')) {
            // Navigate to knowledge view page for company insighter
            this.router.navigate(['/app/my-knowledge-base/view-my-knowledge/', notification.param, 'details']);
          } else {
            // For others, navigate to my-requests page
            this.router.navigate(['/app/insighter-dashboard/my-requests']);
          }
        });
      } else if (notification.category) {
        // External knowledge page with category is already handled in the notifications-inner component
        // Don't do any additional navigation here to prevent duplicate windows
        return;
      } else {
        // Default for other knowledge notifications
        this.router.navigate(['/app/insighter-dashboard/my-requests']);
      }
    } else if (notification && notification.type === 'requests') {
      // Handle request notifications
      this.router.navigate(['/app/insighter-dashboard/my-requests']);
    } else {
      // Default route for other notification types
      this.router.navigate(['/app/insighter-dashboard/my-dashboard']);
    }
  }

  toggleIndustriesMenu(event: Event) {
    event.preventDefault();
    event.stopPropagation();
    this.isIndustriesMenuOpen = !this.isIndustriesMenuOpen;
    // Close other open menus
    this.isUserDropdownOpen = false;
    this.isMobileUserDropdownOpen = false;
    this.isNotificationsOpen = false;
  }

  closeIndustriesMenu() {
    this.isIndustriesMenuOpen = false;
  }

  @HostListener('window:resize', ['$event'])
  onResize(event: Event) {
    // Update isSmallScreen based on window width
    const wasSmallScreen = this.isSmallScreen;
    this.checkScreenSize();
    
    // If transitioning from small to large screen, close mobile sidebar and dropdowns
    if (wasSmallScreen && !this.isSmallScreen) {
      this.sidebarVisible = false;
      this.closeAllDropdowns();
    }
    
    // If transitioning from large to small screen, close desktop dropdowns
    if (!wasSmallScreen && this.isSmallScreen) {
      this.closeAllDropdowns();
    }
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    // Close user dropdown when clicking outside
    if (this.isUserDropdownOpen && this.userDropdownToggle && this.userDropdownMenu) {
      const target = event.target as HTMLElement;
      if (!this.userDropdownToggle.nativeElement.contains(target) && !this.userDropdownMenu.nativeElement.contains(target)) {
        this.isUserDropdownOpen = false;
      }
    }

    // Close mobile user dropdown when clicking outside
    if (this.isMobileUserDropdownOpen && this.mobileUserDropdown) {
      const target = event.target as HTMLElement;
      if (!this.mobileUserDropdown.nativeElement.contains(target)) {
        this.isMobileUserDropdownOpen = false;
      }
    }
    
    // Close notifications dropdown when clicking outside
    if (this.isNotificationsOpen) {
      const target = event.target as HTMLElement;
      // Check if the click is outside the notification area
      if (!target.closest('.notification-dropdown') && !target.closest('.notification-toggle')) {
        this.closeNotifications();
      }
    }

    // Close industries dropdown when clicking outside
    if (this.isIndustriesMenuOpen) {
      const target = event.target as HTMLElement;
      if (!target.closest('.industries-dropdown') && !target.closest('.industries-toggle')) {
        this.closeIndustriesMenu();
      }
    }
  }

  onLanguageChange() {
    this.translationService.onLanguageChange().subscribe(lang => {
      this.lang = lang || 'en';
      // Re-initialize menu to update translations
      this.initializeMenu();

      // Re-init Pusher so auth headers include updated locale (matches Next.js behavior)
      try {
        const token = this.getAuthToken();
        const userId = this.profile?.id;
        if (userId && token) {
          this.initPusher(userId, token, this.lang || 'en');
        }
      } catch {}
    });
  }

  closeAllDropdowns() {
    this.isUserDropdownOpen = false;
    this.isMobileUserDropdownOpen = false;
    this.isNotificationsOpen = false;
    this.isIndustriesMenuOpen = false;
  }

  // ---- Realtime helpers ----
  private getAuthToken(): string | null {
    try {
      // Cookie first (primary), then localStorage fallback.
      // Important: decode cookie value (token cookie is often URL-encoded).
      if (typeof document !== 'undefined') {
        const tokenPair = document.cookie
          .split(';')
          .map((c) => c.trim())
          .find((c) => c.startsWith('token='));
        if (tokenPair) {
          const raw = tokenPair.split('=').slice(1).join('=');
          const decoded = decodeURIComponent(raw);
          return decoded || null;
        }
      }
      return typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    } catch {
      return null;
    }
  }

  private initPusher(userId: number, token: string, currentLocale: string) {
    try {
      // eslint-disable-next-line no-console
      // console.log('[Pusher] Initializing', {
      //   userId,
      //   locale: currentLocale,
      //   tokenPreview: token ? `${token.slice(0, 6)}…${token.slice(-4)}` : null
      // });

      // If we already had a channel, clean it up to avoid duplicate bindings.
      try {
        if (this.pusherGlobalHandler) {
          this.pusherClient.unbindGlobal(this.pusherGlobalHandler);
        }
      } catch {}
      try {
        this.pusherClient.unsubscribePrivateUser(userId);
      } catch {}

      const channel = this.pusherClient.subscribePrivateUser(userId, token, currentLocale);
      this.notificationChannel = channel;

      // Surface auth issues explicitly (otherwise it feels like "Pusher doesn't work")
      channel.bind('pusher:subscription_succeeded', () => {
          // eslint-disable-next-line no-console
         // console.log('[Pusher] Subscription succeeded', `private-user.${userId}`);
      });
      channel.bind('pusher:subscription_error', (status: any) => {
        // eslint-disable-next-line no-console
        console.warn('[Pusher] Subscription error', status, {
          channel: `private-user.${userId}`,
          hint: 'Check Authorization token + authEndpoint CORS + broadcasting/auth response'
        });
      });

      // Log ALL events received on this channel (like your Next.js hook does)
      this.pusherGlobalHandler = (eventName: string, data: any) => {
        // eslint-disable-next-line no-console
    //   console.log('[Pusher][GLOBAL EVENT]', eventName, data);
      };
      try {
        this.pusherClient.bindGlobal(this.pusherGlobalHandler);
      } catch {}

      const events = [
        'account.activated',
        'account.deactivated',
        'knowledge.accepted',
        'knowledge.declined',
        'order.insight',
        'knowledge.answer_question',
        'knowledge.ask_question',
        'meeting.client_meeting_insighter_approved',
        'meeting.client_meeting_insighter_postponed',
        'meeting.client_meeting_reminder',
        'meeting.client_meeting_new',
        'meeting.client_meeting_reschedule',
        'meeting.insighter_meeting_approved',
        'meeting.insighter_meeting_reminder',
        'meeting.insighter_meeting_client_new',
        'requests.action',
        'requests'
      ];
      events.forEach(evt => {
        channel.bind(evt, (data: any) => {
          // eslint-disable-next-line no-console
     //   console.log('[Pusher] Event:', evt, data);

          // Pusher callbacks can run outside Angular's zone -> UI won't update unless we re-enter.
          this.ngZone.run(() => {
            const mapped = this.mapEventToNotification(data);
            // Prepend to local list
            this.notifications = [mapped, ...this.notifications];
            // Update unread count (new events are unread)
            this.notificationCount = this.notifications.filter(n => !n.read_at).length;
            // Ensure view refresh even if event arrives outside normal Angular change detection
            this.cdr.detectChanges();
          });
        });
      });
    } catch (e) {
      // eslint-disable-next-line no-console
       console.warn('[Pusher] init error', e);
    }
  }

  private mapEventToNotification(data: any): Notification {
    return {
      id: data?.id ?? `evt-${Date.now()}`,
      message: data?.message ?? '',
      type: data?.type ?? 'notification',
      notifiable_group_id: data?.notifiable_group_id ?? '',
      notifiable_id: data?.notifiable_id ?? 0,
      request_id: data?.request_id ?? 0,
      param: data?.param ?? null,
      sub_type: data?.sub_type ?? 'info',
      redirect_page: !!data?.redirect_page,
      read_at: undefined,
      sub_page: data?.sub_page,
      tap: data?.tap,
      category: data?.category,
    };
  }
}
