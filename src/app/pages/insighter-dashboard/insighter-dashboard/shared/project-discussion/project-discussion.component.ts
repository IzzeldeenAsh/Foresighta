import {
  AfterViewChecked,
  Component,
  ElementRef,
  Injector,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  SimpleChanges,
  ViewChild,
} from '@angular/core';
import { finalize, takeUntil } from 'rxjs/operators';
import { ProfileService } from 'src/app/_fake/services/get-profile/get-profile.service';
import { BaseComponent } from 'src/app/modules/base.component';
import { environment } from 'src/environments/environment';
import {
  ProjectDiscussionContext,
  ProjectDiscussionMessage,
  ProjectDiscussionService,
} from './project-discussion.service';

@Component({
  selector: 'app-project-discussion',
  templateUrl: './project-discussion.component.html',
  styleUrl: './project-discussion.component.scss',
})
export class ProjectDiscussionComponent extends BaseComponent implements OnInit, OnChanges, OnDestroy, AfterViewChecked {
  @Input() projectUuid: string | null | undefined = null;
  @Input() context: ProjectDiscussionContext = 'client';
  @Input() canSend = true;
  @Input() disabledBadgeLabel: string | null = null;
  @Input() disabledBadgeClass = 'badge-light-warning';
  @Input() disabledMessage: string | null = null;

  @ViewChild('messagesScroller') messagesScroller?: ElementRef<HTMLDivElement>;

  messages: ProjectDiscussionMessage[] = [];
  draft = '';
  isLoading = false;
  isRefreshing = false;
  isSending = false;
  loadFailed = false;
  currentProfileUuid: string | null = null;
  currentProfileName: string | null = null;

  private refreshTimer: ReturnType<typeof setInterval> | null = null;
  private shouldScrollToBottom = false;

  constructor(
    injector: Injector,
    private discussionService: ProjectDiscussionService,
    private profileService: ProfileService,
  ) {
    super(injector);
  }

  ngOnInit(): void {
    this.loadCurrentProfile();
    this.loadMessages();
    this.startRefreshTimer();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes.projectUuid && !changes.projectUuid.firstChange) {
      this.messages = [];
      this.loadMessages();
    }
  }

  ngAfterViewChecked(): void {
    if (!this.shouldScrollToBottom) return;
    this.shouldScrollToBottom = false;
    this.scrollToBottom();
  }

  override ngOnDestroy(): void {
    this.stopRefreshTimer();
    super.ngOnDestroy();
  }

  loadMessages(silent = false): void {
    const projectUuid = this.normalizedProjectUuid;
    if (!projectUuid || this.isLoading || this.isRefreshing) return;

    this.isLoading = !silent;
    this.isRefreshing = silent;
    if (!silent) {
      this.loadFailed = false;
    }

    this.discussionService.listMessages(this.context, projectUuid)
      .pipe(
        takeUntil(this.unsubscribe$),
        finalize(() => {
          this.isLoading = false;
          this.isRefreshing = false;
        })
      )
      .subscribe({
        next: messages => {
          this.messages = messages;
          this.loadFailed = false;
          this.queueScrollToBottom();
        },
        error: err => {
          if (!silent) {
            this.loadFailed = true;
            this.handleServerErrors(err);
          }
        },
      });
  }

  sendMessage(): void {
    const body = this.draft.trim();
    const projectUuid = this.normalizedProjectUuid;
    if (!this.canSend || !body || !projectUuid || this.isSending) return;

    this.isSending = true;

    this.discussionService.sendMessage(this.context, projectUuid, body)
      .pipe(
        takeUntil(this.unsubscribe$),
        finalize(() => (this.isSending = false))
      )
      .subscribe({
        next: message => {
          this.draft = '';
          if (message?.body) {
            this.messages = [
              ...this.messages,
              {
                ...message,
                id: message.id || `local-${Date.now()}`,
                is_current_user: true,
              },
            ];
          } else {
            this.loadMessages();
          }
          this.queueScrollToBottom();
        },
        error: err => this.handleServerErrors(err),
      });
  }

  onMessageKeydown(event: KeyboardEvent): void {
    if (!this.canSend || event.key !== 'Enter' || event.shiftKey) return;
    event.preventDefault();
    this.sendMessage();
  }

  isOwnMessage(message: ProjectDiscussionMessage): boolean {
    if (typeof message.is_current_user === 'boolean') {
      return message.is_current_user;
    }

    if (this.currentProfileUuid && message.uuid) {
      return message.uuid === this.currentProfileUuid;
    }

    const matchesCurrentProfileName = !!this.currentProfileName
      && !!message.sender
      && message.sender.toLowerCase() === this.currentProfileName.toLowerCase();

    if (matchesCurrentProfileName) {
      return true;
    }

    const stage = (message.stage || '').toLowerCase();
    if (this.context === 'client') {
      return !message.uuid || ['project', 'client', 'account'].includes(stage);
    }

    return false;
  }

  getSenderLabel(message: ProjectDiscussionMessage): string {
    if (this.isOwnMessage(message)) {
      return this.lang === 'ar' ? 'أنت' : 'You';
    }

    return message.sender || (this.lang === 'ar' ? 'مستخدم' : 'User');
  }

  getInitials(name: string | null | undefined): string {
    const source = (name || '').trim();
    if (!source) return '?';

    const parts = source.split(/\s+/).filter(Boolean);
    const first = parts[0]?.[0] || '';
    const second = parts.length > 1 ? parts[parts.length - 1]?.[0] || '' : '';
    return `${first}${second}`.toUpperCase();
  }

  getRelativeTime(date: string | null | undefined): string {
    if (!date) return '';

    const parsed = new Date(date.replace(' ', 'T'));
    const time = parsed.getTime();
    if (!Number.isFinite(time)) return date;

    const diffMs = Date.now() - time;
    if (diffMs < 60_000) return this.lang === 'ar' ? 'الآن' : 'Just now';

    const minutes = Math.floor(diffMs / 60_000);
    if (minutes < 60) {
      return this.lang === 'ar' ? `منذ ${minutes} د` : `${minutes} min${minutes === 1 ? '' : 's'}`;
    }

    const hours = Math.floor(minutes / 60);
    if (hours < 24) {
      return this.lang === 'ar' ? `منذ ${hours} س` : `${hours} hour${hours === 1 ? '' : 's'}`;
    }

    const days = Math.floor(hours / 24);
    if (days < 7) {
      return this.lang === 'ar' ? `منذ ${days} ي` : `${days} day${days === 1 ? '' : 's'}`;
    }

    return parsed.toLocaleDateString(this.lang === 'ar' ? 'ar-JO' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }

  getProfileUrl(message: ProjectDiscussionMessage): string | null {
    if (!message.uuid) return null;
    const locale = this.lang === 'ar' ? 'ar' : 'en';
    return `${environment.mainAppUrl}/${locale}/profile/${message.uuid}?entity=insighter`;
  }

  onAvatarError(message: ProjectDiscussionMessage): void {
    message.profile_photo_url = null;
  }

  trackByMessage(index: number, message: ProjectDiscussionMessage): string {
    return `${message.id}-${message.date || index}-${message.sender || 'sender'}`;
  }

  get normalizedProjectUuid(): string {
    return (this.projectUuid || '').trim();
  }

  private loadCurrentProfile(): void {
    this.profileService.getProfile()
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe({
        next: profile => {
          this.currentProfileUuid = profile?.uuid ? String(profile.uuid) : null;
          this.currentProfileName = profile?.name ? String(profile.name) : null;
        },
        error: () => undefined,
      });
  }

  private queueScrollToBottom(): void {
    this.shouldScrollToBottom = true;
  }

  private startRefreshTimer(): void {
    this.stopRefreshTimer();
    this.refreshTimer = setInterval(() => {
      this.loadMessages(true);
    }, 5000);
  }

  private stopRefreshTimer(): void {
    if (!this.refreshTimer) return;
    clearInterval(this.refreshTimer);
    this.refreshTimer = null;
  }

  private scrollToBottom(): void {
    const el = this.messagesScroller?.nativeElement;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }

  private handleServerErrors(err: any): void {
    const message = this.getServerErrorMessage(
      err,
      this.lang === 'ar' ? 'تعذر تحميل المحادثة.' : 'Failed to load discussion.'
    );
    this.showError(this.lang === 'ar' ? 'حدث خطأ' : 'An error occurred', message);
  }

  private getServerErrorMessage(err: any, fallback: string): string {
    const errors = err?.error?.errors;
    if (errors && typeof errors === 'object') {
      const firstKey = Object.keys(errors)[0];
      const firstError = firstKey ? errors[firstKey] : null;
      if (Array.isArray(firstError) && firstError.length) {
        return String(firstError[0]);
      }
    }

    return err?.error?.message || err?.message || fallback;
  }
}
