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
      const knowledgeUrl = `https://foresighta.co/${lang}/knowledge/${notification.category}/${notification.param || ''}?tab=ask`;
      
      // Navigate to the external URL
      window.open(knowledgeUrl, '_blank');
      return;
    }
    
    // For meeting-related notifications, refresh profile first to ensure roles are current
    if(notification.type === 'meeting') {
      this.profileService.refreshProfile().subscribe(user => {
        let targetUrl: string = '';
        if(notification.sub_type === 'insighter_meeting_reminder') {
          targetUrl = '/app/insighter-dashboard/my-meetings?tab=client';
        }
        else if(notification.sub_type === 'client_meeting_new'){
          targetUrl = '/app/insighter-dashboard/my-meetings?tab=client';
        }
         else if(notification.sub_type === 'insighter_meeting_client_new')
        {
          targetUrl = '/app/insighter-dashboard/my-meetings?tab=client';
        }
        else if(notification.sub_type === 'insighter_meeting_client_approved'){
          targetUrl = '/app/insighter-dashboard/my-meetings?tab=client';
        }
        else if (notification.sub_type.startsWith('client_')) {
          targetUrl = '/app/insighter-dashboard/my-meetings?tab=client';
        } 
        else if (notification.sub_type.startsWith('insighter_')) {
          targetUrl = '/app/insighter-dashboard/my-meetings?tab=client';
        } 
        else if(notification.sub_type.startsWith('client_meeting_insighter_postponed')) {
          targetUrl = '/app/insighter-dashboard/my-meetings?tab=my-meetings';
        } 
        else if(notification.sub_type.startsWith('insighter_meeting_client_reschedule')) {
          targetUrl = '/app/insighter-dashboard/my-meetings?tab=client';
        } 
        else if(notification.sub_type.startsWith('client_meeting_reschedule')) {
          targetUrl = '/app/insighter-dashboard/my-meetings?tab=my-meetings';
        } 
        else if(notification.sub_type.startsWith('insighter_meeting_reminder')) {
          targetUrl = '/app/insighter-dashboard/my-meetings?tab=client';
        } 
        else if(notification.sub_type.startsWith('client_meeting_reminder')) {
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
  
  // if(notification.type === 'meeting'){
  //   const baseUrl = window.location.origin;
  //   const lang = this.translationService.getSelectedLanguage() || 'en';
  //   // const tabParam = notification.param && notification.tap ? `?tab=${notification.tap}` : '';
  //   const knowledgeUrl = `https://foresighta.co/${lang}/knowledge/${notification.category}/${notification.param || ''}?`;
    
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
