import { Component, HostBinding, Input, OnInit, Output, EventEmitter, OnDestroy, Injector } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Notification } from 'src/app/_fake/services/nofitications/notifications.service';
import { BaseComponent } from 'src/app/modules/base.component';
import { TranslationService } from 'src/app/modules/i18n';

// No longer need tab types since we consolidated to a single view

@Component({
  selector: 'app-notifications-inner',
  templateUrl: './notifications-inner.component.html',
  host: {
    class: 'menu menu-sub menu-sub-dropdown menu-column w-350px w-lg-375px',
    '[class.show]': 'true'
  },
  styles: [`
    :host {
      position: absolute;
      z-index: 105;
      background: white;
      border-radius: 0.475rem;
      box-shadow: 0 0 50px 0 rgb(82 63 105 / 15%);
    }

    @media (max-width: 767px) {
      :host {
        width: 300px !important;
        max-width: 90vw !important;
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
  
  get unreadNotificationsCount(): number {
    // Count all unread notifications (where read_at is null or undefined)
    return this.notifications.filter(n => !n.read_at).length;
  }

  private http: HttpClient;
  private translationService: TranslationService;

  constructor(injector: Injector) {
    super(injector);
    this.http = injector.get(HttpClient);
    this.translationService = injector.get(TranslationService);
  }

  ngOnInit(): void {
    // Add click outside listener
    document.addEventListener('click', this.onClickOutside.bind(this));
    
    // Mark all notifications as read when the component is initialized
    this.markAllNotificationsAsRead();
  }

  ngOnDestroy(): void {
    document.removeEventListener('click', this.onClickOutside.bind(this));
  }

  private onClickOutside(event: MouseEvent) {
    if (!(event.target as HTMLElement).closest('.app-navbar-item')) {
      this.clickOutside.emit();
    }
  }

  /**
   * Mark all notifications as read
   */
  markAllNotificationsAsRead() {
    // Get the current language
    const lang = this.translationService.getSelectedLanguage() || 'en';
    
    // Create headers
    const headers = new HttpHeaders({
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'Accept-Language': lang
    });
    
    // Call API to mark all as read
    this.http.put('https://api.knoldg.com/api/account/notification/read', {}, { headers })
      .subscribe({
        next: () => {
          // Success - notifications have been marked as read on the server
          // We'll let the parent component handle refreshing the notifications list
        },
        error: (error: any) => {
          console.error('Error marking notifications as read:', error);
        }
      });
  }

  onNotificationClick(notification: Notification) {
    // Check if this is a question_received notification with a sub_page
    if (notification.type === 'knowledge' && notification.category) {
      // Construct the URL for knowledge page with sub_page and param
      const baseUrl = 'https://knoldg.com';
      const lang = this.translationService.getSelectedLanguage() || 'en';
      const tabParam = notification.param && notification.tap ? `?tab=${notification.tap}` : '';
      const knowledgeUrl = `${baseUrl}/${lang}/knowledge/${notification.category}/${notification.param || ''}${tabParam}`;
      
      // Navigate to the external URL
      window.open(knowledgeUrl, '_blank');
    } else {
      // For other notifications, just emit the ID as before
      this.notificationClicked.emit(notification.id);
    }
  }
}

interface AlertModel {
  title: string;
  description: string;
  time: string;
  icon: string;
  state: 'primary' | 'danger' | 'warning' | 'success' | 'info';
}

const defaultAlerts: Array<AlertModel> = [
  {
    title: 'Project Alice',
    description: 'Phase 1 development',
    time: '1 hr',
    icon: 'icons/duotune/technology/teh008.svg',
    state: 'primary',
  },
  {
    title: 'HR Confidential',
    description: 'Confidential staff documents',
    time: '2 hrs',
    icon: 'icons/duotune/general/gen044.svg',
    state: 'danger',
  },
  {
    title: 'Company HR',
    description: 'Corporeate staff profiles',
    time: '5 hrs',
    icon: 'icons/duotune/finance/fin006.svg',
    state: 'warning',
  },
  {
    title: 'Project Redux',
    description: 'New frontend admin theme',
    time: '2 days',
    icon: 'icons/duotune/files/fil023.svg',
    state: 'success',
  },
  {
    title: 'Project Breafing',
    description: 'Product launch status update',
    time: '21 Jan',
    icon: 'icons/duotune/maps/map001.svg',
    state: 'primary',
  },
  {
    title: 'Banner Assets',
    description: 'Collection of banner images',
    time: '21 Jan',
    icon: 'icons/duotune/general/gen006.svg',
    state: 'info',
  },
  {
    title: 'Icon Assets',
    description: 'Collection of SVG icons',
    time: '20 March',
    icon: 'icons/duotune/art/art002.svg',
    state: 'warning',
  },
];

interface LogModel {
  code: string;
  state: 'success' | 'danger' | 'warning';
  message: string;
  time: string;
}

const defaultLogs: Array<LogModel> = [
  { code: '200 OK', state: 'success', message: 'New order', time: 'Just now' },
  { code: '500 ERR', state: 'danger', message: 'New customer', time: '2 hrs' },
  {
    code: '200 OK',
    state: 'success',
    message: 'Payment process',
    time: '5 hrs',
  },
  {
    code: '300 WRN',
    state: 'warning',
    message: 'Search query',
    time: '2 days',
  },
  {
    code: '200 OK',
    state: 'success',
    message: 'API connection',
    time: '1 week',
  },
  {
    code: '200 OK',
    state: 'success',
    message: 'Database restore',
    time: 'Mar 5',
  },
  {
    code: '300 WRN',
    state: 'warning',
    message: 'System update',
    time: 'May 15',
  },
  {
    code: '300 WRN',
    state: 'warning',
    message: 'Server OS update',
    time: 'Apr 3',
  },
  {
    code: '300 WRN',
    state: 'warning',
    message: 'API rollback',
    time: 'Jun 30',
  },
  {
    code: '500 ERR',
    state: 'danger',
    message: 'Refund process',
    time: 'Jul 10',
  },
  {
    code: '500 ERR',
    state: 'danger',
    message: 'Withdrawal process',
    time: 'Sep 10',
  },
  { code: '500 ERR', state: 'danger', message: 'Mail tasks', time: 'Dec 10' },
];
