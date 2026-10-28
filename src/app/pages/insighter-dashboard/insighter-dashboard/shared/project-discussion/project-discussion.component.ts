import {
  AfterViewChecked,
  Component,
  ElementRef,
  EventEmitter,
  Injector,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  Output,
  SimpleChanges,
  ViewChild,
} from '@angular/core';
import { Observable } from 'rxjs';
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
  @Input() sharedWithInvitees = false;
  @Input() disabledBadgeLabel: string | null = null;
  @Input() disabledBadgeClass = 'badge-light-warning';
  @Input() disabledMessage: string | null = null;
  /**
   * Submitted offer (project_proposal_offer UUID). When set, the component talks to the private
   * Client ↔ Insighter offer thread instead of the project discussion.
   */
  @Input() offerUuid: string | null | undefined = null;
  /** Name of the other participant, used in the private-thread empty/waiting copy. */
  @Input() counterpartName: string | null = null;
  /** Fired when the API refuses the private thread (403 — e.g. the offer was awarded meanwhile). */
  @Output() accessClosed = new EventEmitter<void>();
  /** Fired after the open private thread was marked read on the server, so parents can clear its badge. */
  @Output() threadRead = new EventEmitter<void>();

  @ViewChild('messagesScroller') messagesScroller?: ElementRef<HTMLDivElement>;

  messages: ProjectDiscussionMessage[] = [];
  draft = '';
  isLoading = false;
  isRefreshing = false;
  isSending = false;
  loadFailed = false;
  currentProfileUuid: string | null = null;
  currentProfileName: string | null = null;
  /** True once the current thread answered at least once, so "waiting for the client" is not shown while loading. */
  hasLoadedThread = false;

  private refreshTimer: ReturnType<typeof setInterval> | null = null;
  private isMarkingRead = false;
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
    const threadChanged = (changes.projectUuid && !changes.projectUuid.firstChange)
      || (changes.offerUuid && !changes.offerUuid.firstChange);
    if (threadChanged) {
      this.messages = [];
      this.draft = '';
      this.hasLoadedThread = false;
      this.isLoading = false;
      this.isRefreshing = false;
      this.loadMessages();
      this.startRefreshTimer();
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

    const threadKey = this.threadKey;
    this.listThread(projectUuid)
      .pipe(
        takeUntil(this.unsubscribe$),
        finalize(() => {
          if (threadKey !== this.threadKey) return;
          this.isLoading = false;
          this.isRefreshing = false;
        })
      )
      .subscribe({
        next: messages => {
          if (threadKey !== this.threadKey) return;
          const visible = this.isPrivateThread
            ? messages
            : messages.filter(message => message.visibility !== 'private_offer');
          const grew = visible.length !== this.messages.length;
          this.messages = visible;
          this.loadFailed = false;
          this.hasLoadedThread = true;
          this.markThreadReadIfNeeded();
          if (!silent || grew) this.queueScrollToBottom();
        },
        error: err => {
          if (threadKey !== this.threadKey) return;
          if (this.isPrivateThread && err?.status === 403) {
            this.stopRefreshTimer();
            this.loadFailed = true;
            this.accessClosed.emit();
            return;
          }
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
    if (!this.canCompose || !body || !projectUuid || this.isSending) return;

    this.isSending = true;

    this.sendToThread(projectUuid, body)
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
        error: err => {
          this.handleServerErrors(err);
          if (this.isPrivateThread && err?.status === 403) {
            this.loadMessages(true);
            this.accessClosed.emit();
          }
        },
      });
  }

  onMessageKeydown(event: KeyboardEvent): void {
    if (!this.canCompose || event.key !== 'Enter' || event.shiftKey) return;
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

  get hasEmptyThread(): boolean {
    return !this.isLoading && !!this.normalizedProjectUuid && !this.loadFailed && this.messages.length === 0;
  }

  get normalizedProjectUuid(): string {
    return (this.projectUuid || '').trim();
  }

  get normalizedOfferUuid(): string {
    return (this.offerUuid || '').trim();
  }

  get isPrivateThread(): boolean {
    return !!this.normalizedOfferUuid;
  }

  /**
   * The Insighter can only answer a private offer thread the Client opened. Only the two of them can
   * post there and the Insighter cannot go first, so any loaded message means the Client has written.
   */
  get isAwaitingClient(): boolean {
    return this.isPrivateThread && this.context === 'insighter' && this.messages.length === 0;
  }

  /** Composer is shown (and usable) — read-only footers cover the other cases. */
  get canCompose(): boolean {
    return this.canSend && !this.isAwaitingClient;
  }

  get counterpartLabel(): string {
    return (this.counterpartName || '').trim()
      || (this.context === 'client'
        ? (this.lang === 'ar' ? 'الخبير' : 'the Insighter')
        : (this.lang === 'ar' ? 'العميل' : 'the client'));
  }

  private get threadKey(): string {
    return `${this.context}|${this.normalizedProjectUuid}|${this.normalizedOfferUuid}`;
  }

  /**
   * GET never marks anything read: once the open private thread shows incoming unread messages,
   * tell the API (PUT .../offer/read/...) and clear them locally only after it succeeds.
   */
  private markThreadReadIfNeeded(): void {
    const projectUuid = this.normalizedProjectUuid;
    if (!this.isPrivateThread || this.isMarkingRead || !projectUuid) return;
    if (!this.messages.some(message => message.is_read === false)) return;

    const threadKey = this.threadKey;
    this.isMarkingRead = true;
    this.discussionService.markOfferThreadRead(this.context, projectUuid, this.normalizedOfferUuid)
      .pipe(
        takeUntil(this.unsubscribe$),
        finalize(() => (this.isMarkingRead = false))
      )
      .subscribe({
        next: () => {
          if (threadKey !== this.threadKey) return;
          this.messages = this.messages.map(message => message.is_read === false ? { ...message, is_read: true } : message);
          this.threadRead.emit();
        },
        error: () => undefined,
      });
  }

  private listThread(projectUuid: string): Observable<ProjectDiscussionMessage[]> {
    return this.isPrivateThread
      ? this.discussionService.listOfferMessages(this.context, projectUuid, this.normalizedOfferUuid)
      : this.discussionService.listMessages(this.context, projectUuid);
  }

  private sendToThread(projectUuid: string, body: string): Observable<ProjectDiscussionMessage | null> {
    return this.isPrivateThread
      ? this.discussionService.sendOfferMessage(this.context, projectUuid, this.normalizedOfferUuid, body)
      : this.discussionService.sendMessage(this.context, projectUuid, body);
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
