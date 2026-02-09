import { Component, HostBinding, Input, OnInit, Output, EventEmitter, OnDestroy, Injector } from '@angular/core';
import { environment } from 'src/environments/environment';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Notification } from 'src/app/_fake/services/nofitications/notifications.service';
import { BaseComponent } from 'src/app/modules/base.component';
import { TranslationService } from 'src/app/modules/i18n';
import { Router } from '@angular/router';
import { ProfileService } from 'src/app/_fake/services/get-profile/get-profile.service';

@Component({
  selector: 'app-admin-notifications',
  templateUrl: './admin-notifications.component.html',
  styleUrls: ['./admin-notifications.component.scss'],
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
export class AdminNotificationsComponent extends BaseComponent implements OnInit, OnDestroy {
  @Input() notifications: Notification[] = [];
  @Input() parent: string = 'admin';
  @Output() notificationClicked = new EventEmitter<string>();
  @Output() clickOutside = new EventEmitter<void>();
  
  get unreadNotificationsCount(): number {
    // Count all unread notifications (where read_at is null or undefined)
    return this.notifications.filter(n => !n.read_at).length;
  }
  
  constructor(
    injector: Injector,
    private translationService: TranslationService,
    private router: Router,
    private profileService: ProfileService,
    private http: HttpClient
  ) {
    super(injector);
  }

  ngOnInit(): void {
    // Add click outside listener
    document.addEventListener('click', this.onClickOutside.bind(this));
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
    
    this.http.put(`https://api.insightabusiness.com/api/account/notification/read/${notificationId}`, {}, { headers })
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
    // For admin, all notification types go to requests dashboard by default
    // But handle specific types if needed
    if (notification.type === 'order') {
      const targetUrl = '/admin-dashboard/admin/dashboard/main-dashboard/requests';
      const currentUrl = this.router.url;
      if (currentUrl !== targetUrl) {
        this.router.navigateByUrl(targetUrl);
      }
      return;
    }
    
    // Handle knowledge notifications with category
    if (notification.type === 'knowledge' && notification.category) {
      // Construct the URL for knowledge page with sub_page and param
      const lang = this.translationService.getSelectedLanguage() || 'en';
      const knowledgeUrl = `https://insightabusiness.com/${lang}/knowledge/${notification.category}/${notification.param || ''}?tab=ask`;
      
      // Navigate to the external URL
      window.open(knowledgeUrl, '_blank');
      return;
    }
    
    // Handle contact-us notifications
    if (notification.type === 'contact-us' || notification.sub_type === 'contact_us') {
      this.router.navigate(['/admin-dashboard/admin/contact-messages/contact-list']);
      return;
    }
    
    // Default: navigate to requests dashboard for admin
    const targetUrl = '/admin-dashboard/admin/dashboard/main-dashboard/requests';
    const currentUrl = this.router.url;
    if (currentUrl !== targetUrl) {
      this.router.navigateByUrl(targetUrl);
    }
  }
}
