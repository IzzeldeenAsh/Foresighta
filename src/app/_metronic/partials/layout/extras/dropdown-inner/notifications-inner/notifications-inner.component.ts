import { Component, HostBinding, Input, OnInit, Output, EventEmitter, OnDestroy, Injector, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { environment } from 'src/environments/environment';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Notification } from 'src/app/_fake/services/nofitications/notifications.service';
import { BaseComponent } from 'src/app/modules/base.component';
import { TranslationService } from 'src/app/modules/i18n';
import { Router } from '@angular/router';
import { ProfileService } from 'src/app/_fake/services/get-profile/get-profile.service';

// No longer need tab types since we consolidated to a single view

@Component({
  selector: 'app-notifications-inner',
  templateUrl: './notifications-inner.component.html',
  host: {
    class: 'd-flex flex-column h-100 w-100',
    '[class.show]': 'true'
  },
  styles: [`
    :host {
      background: #ffffff;
      z-index: 105;
    }

    @media (max-width: 767px) {
      :host {
        width: 100% !important;
        max-width: 100% !important;
      }
    }
  `]
})
export class NotificationsInnerComponent extends BaseComponent implements OnInit {
  @Input() notifications: Notification[] = [];
  @Input() parent: string = '';
  @Output() notificationClicked = new EventEmitter<string>();
  @Output() clickOutside = new EventEmitter<void>();

  // Removed activeTabId since tabs are no longer used
  alerts: Array<AlertModel> = defaultAlerts;
  logs: Array<LogModel> = defaultLogs;

  private readonly isBrowser: boolean;
  private readonly messageCache = new Map<string, { raw: string; unreadHtml: SafeHtml; readText: string }>();

  get unreadNotificationsCount(): number {
    // Count all unread notifications (where read_at is null or undefined)
    return this.notifications.filter(n => !n.read_at).length;
  }

  constructor(
    injector: Injector,
    private translationService: TranslationService,
    private router: Router,
    private profileService: ProfileService,
    private http: HttpClient,
    private sanitizer: DomSanitizer,
    @Inject(PLATFORM_ID) platformId: object
  ) {
    super(injector);
    this.isBrowser = isPlatformBrowser(platformId);
  }

  ngOnInit(): void {
    // Add click outside listener
    document.addEventListener('click', this.onClickOutside.bind(this));
  }

  // Returns a keenicon (ki-duotone) font icon name for notifications that use
  // the newer font set (not available as inline SVGs). Returns null to fall
  // back to the SVG icon pipe.
  getKeeniconName(alert: Notification): string | null {
    if (alert.sub_type === 'project_review_submission_reviewed') {
      const label = (alert.sub_type_value ?? '').toLowerCase();
      const isChanges = label.includes('change') || label.includes('تعديل');
      return isChanges ? 'message-notif' : 'file-added';
    }

    switch (alert.sub_type) {
      case 'project_proposal':
      case 'project_proposal_offer':
        return 'briefcase';
      case 'project_offer_technical_decision':
        return this.isRejectedTechnicalDecision(alert)
          ? 'brifecase-cros'
          : 'brifecase-tick';
      case 'project_offer_not_selected':
      case 'project_cancelled':
        return 'brifecase-cros';
      case 'project':
        return 'clipboard';
      case 'project_closed':
        return 'archive';
      case 'project_service':
        return 'chart-line-star';
      case 'project_review_submission':
        return 'file-up';
      case 'project_file_uploaded':
        return 'folder-up';
      case 'project_discussion':
        return 'messages';
      default:
        return null;
    }
  }

  getKeeniconColor(alert: Notification): string {
    if (alert.sub_type === 'project_review_submission_reviewed') {
      const label = (alert.sub_type_value ?? '').toLowerCase();
      return label.includes('change') || label.includes('تعديل') ? 'warning' : 'success';
    }
    if (alert.sub_type === 'project_offer_technical_decision') {
      return this.isRejectedTechnicalDecision(alert) ? 'danger' : 'success';
    }

    switch (alert.sub_type) {
      case 'project':
      case 'project_service':
        return 'success';
      case 'project_closed':
      case 'project_cancelled':
      case 'project_offer_not_selected':
        return 'danger';
      default:
        return 'info';
    }
  }

  private isRejectedTechnicalDecision(alert: Notification): boolean {
    const message = this.htmlToText((alert?.message ?? '').toString()).toLowerCase();
    return (
      message.includes('reject') ||
      message.includes('declin') ||
      message.includes('رفض') ||
      message.includes('مرفوض')
    );
  }

  getNotificationTitle(alert: Notification): string | null {
    const language = this.translationService.getSelectedLanguage();
    const projectTitles: Record<string, { en: string; ar: string }> = {
      project_offer_technical_decision: {
        en: this.isRejectedTechnicalDecision(alert)
          ? 'Project Offer Technically Rejected'
          : 'Project Offer Technically Accepted',
        ar: this.isRejectedTechnicalDecision(alert)
          ? 'تم رفض عرض المشروع فنياً'
          : 'تم قبول عرض المشروع فنياً'
      },
      project_offer_not_selected: {
        en: 'Project Offer Not Selected',
        ar: 'لم يتم اختيار عرض المشروع'
      },
      project_cancelled: {
        en: 'Project Cancelled',
        ar: 'تم إلغاء المشروع'
      }
    };
    const projectTitle = projectTitles[alert.sub_type];
    return projectTitle
      ? (language === 'ar' ? projectTitle.ar : projectTitle.en)
      : null;
  }

  // ---- Message rendering helpers ----
  // Unread: render safe minimal HTML to preserve <b>/<strong> emphasis.
  // Read: render plain text so `fw-light` always wins and can’t be overridden.
  getUnreadMessageHtml(alert: Notification): SafeHtml {
    const raw = (alert?.message ?? '').toString();
    const cached = this.messageCache.get(alert.id);
    if (cached && cached.raw === raw) return cached.unreadHtml;

    const sanitized = this.sanitizeNotificationHtml(raw);
    const trusted = this.sanitizer.bypassSecurityTrustHtml(sanitized);
    const readText = this.htmlToText(raw);
    this.messageCache.set(alert.id, { raw, unreadHtml: trusted, readText });
    return trusted;
  }

  getReadMessageText(alert: Notification): string {
    const raw = (alert?.message ?? '').toString();
    const cached = this.messageCache.get(alert.id);
    if (cached && cached.raw === raw) return cached.readText;
    // Populate cache via unread getter (cheap, consistent)
    void this.getUnreadMessageHtml(alert);
    return this.messageCache.get(alert.id)?.readText ?? this.htmlToText(raw);
  }

  private htmlToText(html: string): string {
    if (!html) return '';
    // Fast path: no tags
    if (!/[<>]/.test(html)) return html;
    if (!this.isBrowser || typeof DOMParser === 'undefined') {
      return html.replace(/<[^>]*>/g, '').trim();
    }
    try {
      const normalized = html.replace(/<br\s*\/?>/gi, '\n');
      const doc = new DOMParser().parseFromString(normalized, 'text/html');
      return (doc.body?.textContent ?? '').trim();
    } catch {
      return html.replace(/<[^>]*>/g, '').trim();
    }
  }

  private escapeHtml(value: string): string {
    return (value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  private escapeAttribute(value: string): string {
    return this.escapeHtml(value);
  }

  private sanitizeNotificationHtml(html: string): string {
    if (!html) return '';
    if (!this.isBrowser || typeof DOMParser === 'undefined') {
      return this.escapeHtml(this.htmlToText(html));
    }
    try {
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const allowedTags = new Set(['B', 'STRONG', 'I', 'EM', 'BR', 'A', 'SPAN']);

      const sanitizeNode = (node: Node): string => {
        // Text node
        if (node.nodeType === Node.TEXT_NODE) return this.escapeHtml(node.textContent ?? '');
        // Ignore comments/others
        if (node.nodeType !== Node.ELEMENT_NODE) return '';

        const el = node as HTMLElement;
        const tag = (el.tagName || '').toUpperCase();

        // Drop tag but keep children text
        if (!allowedTags.has(tag)) {
          return Array.from(el.childNodes).map(sanitizeNode).join('');
        }

        if (tag === 'BR') return '<br />';

        if (tag === 'A') {
          const rawHref = (el.getAttribute('href') ?? '').trim();
          const href =
            rawHref.startsWith('http://') ||
              rawHref.startsWith('https://') ||
              rawHref.startsWith('/') ||
              rawHref.startsWith('#')
              ? rawHref
              : '#';

          const inner = Array.from(el.childNodes).map(sanitizeNode).join('');
          return `<a href="${this.escapeAttribute(href)}" target="_blank" rel="noopener noreferrer" class="text-decoration-underline">${inner}</a>`;
        }

        const lower = tag.toLowerCase();
        const inner = Array.from(el.childNodes).map(sanitizeNode).join('');
        return `<${lower}>${inner}</${lower}>`;
      };

      return Array.from(doc.body.childNodes).map(sanitizeNode).join('');
    } catch {
      return this.escapeHtml(this.htmlToText(html));
    }
  }

  // Handle click outside of dropdown
  onClickOutside(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    // Check if the click was outside the dropdown
    if (
      target &&
      !target.closest('.notification-dropdown') &&
      !target.closest('.notification-toggle')
    ) {
      this.clickOutside.emit();
    }
  }

  // Mark a single notification as read by its ID
  markAsRead(notificationId: string, callback?: () => void): void {
    const headers = new HttpHeaders({
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Accept-Language': this.translationService.getSelectedLanguage()
    });

    this.http.put(`https://api.foresighta.co/api/account/notification/read/${notificationId}`, {}, { headers })
      .subscribe(
        () => {
          // Update local state to mark this notification as read
          if (this.notifications) {
            const notification = this.notifications.find(n => n.id === notificationId);
            if (notification) {
              notification.read_at = new Date().toISOString();

              // Count unread notifications
              const unreadCount = this.notifications.filter(n => !n.read_at).length;

              // Emit notification count change
              this.notificationClicked.emit(notificationId);

              // Execute callback if provided
              if (callback) {
                callback();
              }
            }
          }
        },
        (error: any) => {
          console.error(`Error marking notification ${notificationId} as read:`, error);
          // Still execute callback even if there was an error
          if (callback) {
            callback();
          }
        }
      );
  }
  ngOnDestroy(): void {
    document.removeEventListener('click', this.onClickOutside.bind(this));
  }

  onNotificationClick(notification: Notification, event?: MouseEvent) {
    // If event exists, prevent default to ensure we can complete the mark-as-read operation
    if (event) {
      event.preventDefault();
    }

    // Always mark the notification as read first and ensure it completes
    this.markAsRead(notification.id, () => {
      // After marking as read is complete, handle navigation if needed
      this.handleNotificationNavigation(notification);
    });
  }

  // Separate navigation logic to make it cleaner
  private handleNotificationNavigation(notification: Notification): void {
    // Project notifications: route by Pusher event name (precise for realtime),
    // with a sub_type/role fallback for REST-fetched ones. Returns true if handled.
    if (this.tryHandleProjectNotification(notification)) {
      return;
    }

    if (notification.sub_type === 'project_proposal_offer') {
      const targetUrl = '/app/insighter-dashboard/project-offers';
      const currentUrl = this.router.url;
      if (currentUrl !== targetUrl) {
        this.router.navigateByUrl(targetUrl);
      }
      return;
    }

    // New: Order notifications redirect to Sales page
    if (notification.type === 'order') {
      const targetUrl = '/app/insighter-dashboard/sales?tab=2';
      const currentUrl = this.router.url;
      if (currentUrl !== targetUrl) {
        this.router.navigateByUrl(targetUrl);
      }
      return;
    }

    // First, check for knowledge accept/decline notifications that need special handling
    if (notification.type === 'knowledge' && (notification.sub_type === 'accept_knowledge' || notification.sub_type === 'declined')) {
      // Check if user has company-insighter role
      this.profileService.getProfile().pipe().subscribe(user => {
        if (user && user.roles && user.roles.includes('company-insighter')) {
          // Route to my-knowledge-base view with param value
          this.router.navigate(['/app/my-knowledge-base/view-my-knowledge/', notification.param, 'details']);
        }
      });
      return;
    }

    // Handle knowledge notifications with category
    if (notification.type === 'knowledge' && notification.category) {
      // Construct the URL for knowledge page with sub_page and param
      const lang = this.translationService.getSelectedLanguage() || 'en';
      const knowledgeUrl = `http://localhost:3000/${lang}/knowledge/${notification.category}/${notification.param || ''}?tab=ask`;

      // Navigate to the external URL
      window.open(knowledgeUrl, '_blank');
      return;
    }

    // For meeting-related notifications, refresh profile first to ensure roles are current
    if (notification.type === 'meeting') {
      this.profileService.refreshProfile().subscribe(user => {
        let targetUrl: string = '';
        if (notification.sub_type === 'insighter_meeting_reminder') {
          targetUrl = '/app/insighter-dashboard/my-meetings?tab=client';
        }
        else if (notification.sub_type === 'client_meeting_new') {
          targetUrl = '/app/insighter-dashboard/my-meetings?tab=client';
        }
        else if (notification.sub_type === 'insighter_meeting_client_new') {
          targetUrl = '/app/insighter-dashboard/my-meetings?tab=client';
        }
        else if (notification.sub_type === 'insighter_meeting_client_approved') {
          targetUrl = '/app/insighter-dashboard/my-meetings?tab=client';
        }
        else if (notification.sub_type.startsWith('client_')) {
          targetUrl = '/app/insighter-dashboard/my-meetings?tab=client';
        }
        else if (notification.sub_type.startsWith('insighter_')) {
          targetUrl = '/app/insighter-dashboard/my-meetings?tab=client';
        }
        else if (notification.sub_type.startsWith('client_meeting_insighter_postponed')) {
          targetUrl = '/app/insighter-dashboard/my-meetings?tab=my-meetings';
        }
        else if (notification.sub_type.startsWith('insighter_meeting_client_reschedule')) {
          targetUrl = '/app/insighter-dashboard/my-meetings?tab=client';
        }
        else if (notification.sub_type.startsWith('client_meeting_reschedule')) {
          targetUrl = '/app/insighter-dashboard/my-meetings?tab=my-meetings';
        }
        else if (notification.sub_type.startsWith('insighter_meeting_reminder')) {
          targetUrl = '/app/insighter-dashboard/my-meetings?tab=client';
        }
        else if (notification.sub_type.startsWith('client_meeting_reminder')) {
          targetUrl = '/app/insighter-dashboard/my-meetings?tab=my-meetings';
        }

        // Check if we're already on this route before navigating
        if (targetUrl) {
          const currentUrl = this.router.url;

          // Only navigate if we're not already on the target page
          if (currentUrl !== targetUrl) {
            this.router.navigateByUrl(targetUrl);
          }
        }
      });
    }
  }

  // Navigate only if we're not already on the target URL.
  private navigateTo(url: string): void {
    if (this.router.url !== url) {
      this.router.navigateByUrl(url);
    }
  }

  /**
   * Routes project-related notifications. Returns true if handled.
   *
   * `notification.param` carries the routing id, which differs per event:
   *   - proposal.uuid  -> project-offers/details/:uuid
   *   - project.uuid   -> on-work-projects/details/:uuid (insighter side)
   *                       or projects-created/:uuid (client side)
   *   - order id (int) -> sales (left to the generic `type === 'order'` branch)
   *
   * Realtime notifications carry `event_name` (exact). REST-fetched ones don't,
   * so we fall back to `sub_type` + the user's role where client/insighter share
   * the same sub_type (project_closed, project, project_file_uploaded).
   */
  private tryHandleProjectNotification(n: Notification): boolean {
    const param = n.param;
    const insighterBase = '/app/insighter-dashboard/on-work-projects';
    const clientBase = '/app/insighter-dashboard/projects-created';
    const offersBase = '/app/insighter-dashboard/project-offers';

    // 1) Precise routing by Pusher event name (realtime).
    switch (n.event_name) {
      // Insighter receives, param = proposal.uuid
      case 'project.match.invited':
        this.navigateTo(param ? `${offersBase}/details/${param}` : offersBase);
        return true;

      // Client receives, param = proposal.uuid (no client proposal-detail route -> list)
      case 'project.proposal.offer':
        this.navigateTo(clientBase);
        return true;

      // Insighter receives, param = project.uuid
      case 'project.insighter.closed':
      case 'project.insighter.contract':
      case 'project.review.submission.reviewed':
        this.navigateTo(param ? `${insighterBase}/details/${param}` : insighterBase);
        return true;

      // Client receives, param = project.uuid
      case 'project.client.closed':
      case 'project.client.contract':
      case 'project.client.started':
      case 'project.review.submission':
        this.navigateTo(param ? `${clientBase}/${param}` : clientBase);
        return true;

      // Insighter receives, param = orderable id (int) -> list page
      case 'project.service.started':
        this.navigateTo(insighterBase);
        return true;

      // param = order id (int) -> handled by the generic `type === 'order'` branch
      case 'order.project':
        return false;

      // Sent to whoever did NOT upload the file -> decide by role
      case 'project.file.uploaded':
        this.navigateByProjectRole(param, insighterBase, clientBase);
        return true;

      // Backend ships the full destination URL in `url` (it resolves stage + role).
      // We navigate to its path and always force the discussion tab.
      case 'project.discussion.message':
        this.navigateToDiscussion(n);
        return true;

      // The backend sends an offer UUID, while the detail route requires the
      // proposal-match UUID. Use the offers list until the payload exposes it.
      case 'project.insighter.offer.technical-decision':
      case 'project.insighter.offer.not-selected':
        this.navigateTo(offersBase);
        return true;

      // Cancellation can target either an invited proposal or an active project.
      // The backend-provided URL is the authoritative destination.
      case 'project.insighter.cancelled':
        if (this.navigateToBackendUrl(n.url)) {
          return true;
        }
        this.navigateTo(insighterBase);
        return true;
    }

    // 2) REST fallback (no event_name): distinguish by sub_type; use role where ambiguous.
    switch (n.sub_type) {
      case 'project_proposal':                    // match.invited (insighter), proposal.uuid
        this.navigateTo(param ? `${offersBase}/details/${param}` : offersBase);
        return true;
      case 'project_review_submission':           // client, project.uuid
        this.navigateTo(param ? `${clientBase}/${param}` : clientBase);
        return true;
      case 'project_review_submission_reviewed':  // insighter, project.uuid
        this.navigateTo(param ? `${insighterBase}/details/${param}` : insighterBase);
        return true;
      case 'project_offer_technical_decision':
      case 'project_offer_not_selected':
        this.navigateTo(offersBase);
        return true;
      case 'project_cancelled':
        if (this.navigateToBackendUrl(n.url)) {
          return true;
        }
        this.navigateTo(insighterBase);
        return true;
      case 'project_service':                     // service.started (insighter), orderable id
        this.navigateTo(insighterBase);
        return true;
      case 'project_closed':                      // client OR insighter, project.uuid -> role
      case 'project':                             // contract: client OR insighter, project.uuid -> role
      case 'project_file_uploaded':               // either side, project.uuid -> role
        this.navigateByProjectRole(param, insighterBase, clientBase);
        return true;
      case 'project_discussion':                  // url = full destination URL
        this.navigateToDiscussion(n);
        return true;
    }

    return false;
  }

  private navigateToBackendUrl(rawUrl?: string): boolean {
    const raw = (rawUrl ?? '').trim();
    if (!raw) {
      return false;
    }

    try {
      const parsed = new URL(raw);
      this.navigateTo(`${parsed.pathname}${parsed.search}`);
    } catch {
      this.navigateTo(raw.startsWith('/') ? raw : `/${raw}`);
    }

    return true;
  }

  // `project.discussion.message` carries the full destination URL the backend
  // resolved (proposal/project stage, client/insighter side). It now arrives in
  // `url`; older notifications carried it in `param`, so we fall back to that.
  // We don't re-derive the route — we navigate to its path inside the dashboard
  // and always force the discussion tab.
  private navigateToDiscussion(n: Notification): void {
    const raw = ((n.url ?? n.param) ?? '').toString().trim();
    if (!raw) { return; }

    let path = raw;
    try {
      // Usually an absolute URL (localhost or prod host) -> keep only its path.
      path = new URL(raw).pathname;
    } catch {
      // Not absolute: treat as a path and drop any existing query/hash.
      path = raw.split(/[?#]/)[0];
    }
    if (path && !path.startsWith('/')) { path = `/${path}`; }

    // This is a discussion notification: always land on the discussion tab,
    // ignoring whatever tab the backend may have baked into the URL.
    this.navigateTo(`${path}?tab=discussion`);
  }

  // Resolve client vs insighter destination by the user's role.
  private navigateByProjectRole(param: any, insighterBase: string, clientBase: string): void {
    this.profileService.getProfile().subscribe(user => {
      const roles: string[] = user?.roles ?? [];
      const isInsighter =
        roles.includes('insighter') ||
        roles.includes('company') ||
        roles.includes('company-insighter');
      if (isInsighter) {
        this.navigateTo(param ? `${insighterBase}/details/${param}` : insighterBase);
      } else {
        this.navigateTo(param ? `${clientBase}/${param}` : clientBase);
      }
    });
  }

  // if(notification.type === 'meeting'){
  //   const baseUrl = window.location.origin;
  //   const lang = this.translationService.getSelectedLanguage() || 'en';
  //   // const tabParam = notification.param && notification.tap ? `?tab=${notification.tap}` : '';
  //   const knowledgeUrl = `http://localhost:3000/${lang}/knowledge/${notification.category}/${notification.param || ''}?`;

  //   // Navigate to the external URL
  //   window.open(knowledgeUrl, '_blank');
  // }

}

export interface AlertModel {
  title: string;
  description: string;
  time: string;
  icon: string;
  state: string;
}

export interface LogModel {
  code: string;
  state: string;
  message: string;
  time: string;
}

const defaultAlerts: Array<AlertModel> = [];
const defaultLogs: Array<LogModel> = [];
