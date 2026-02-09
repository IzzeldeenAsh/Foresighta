import { Component, OnInit, OnDestroy, inject, DestroyRef, signal, computed } from '@angular/core';
import { Subject, take, takeUntil, forkJoin, Observable, combineLatest } from 'rxjs';
import { MeetingsService, Meeting, MeetingResponse, ClientMeetingStatistics } from '../../../../_fake/services/meetings/meetings.service';
import { SentMeetingsService, SentMeeting, SentMeetingResponse, AvailableHoursResponse, AvailableDay, AvailableTime, RescheduleRequest, MeetingStatistics } from '../../../../_fake/services/meetings/sent-meetings.service';
import { Router, ActivatedRoute } from '@angular/router';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { DialogModule } from 'primeng/dialog';
import { TooltipModule } from 'primeng/tooltip';
import { InputTextareaModule } from 'primeng/inputtextarea';
import { TruncateTextPipe } from 'src/app/pipes/truncate-pipe/truncate-text.pipe';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslationModule } from 'src/app/modules/i18n';
import { BaseComponent } from 'src/app/modules/base.component';
import { ProfileService } from 'src/app/_fake/services/get-profile/get-profile.service';
import { InsighterDashboardSharedModule } from '../shared/shared.module';
type TabType = 'pending' | 'approved' | 'postponed' | 'upcoming' | 'past' | 'coming';
@Component({
  selector: 'app-my-meetings',
  templateUrl: './my-meetings.component.html',
  styleUrls: ['./my-meetings.component.scss'],
  standalone: true,
  imports : [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    DialogModule,
    TooltipModule,
    InputTextareaModule,
    TruncateTextPipe,
    TranslationModule,
    DatePipe,
    InsighterDashboardSharedModule
  ]
})
export class MyMeetingsComponent extends BaseComponent implements OnInit {
[x: string]: any;
  activeTab: 'client-meetings' | 'my-meetings' = 'client-meetings';
  clientMeetingsSubTab: 'coming' | 'past' = 'coming';
  myMeetingsSubTab: 'coming' | 'past' = 'coming';

  // Role observables
  isClient$: Observable<boolean>;

  // Client meetings (my-meetings) state
  meetings = signal<Meeting[]>([]);
  loading = signal<boolean>(false);
  currentPage=signal<number>(1);
  totalPages = signal<number>(1);
  totalItems = signal<number>(0);
  perPage = signal<number>(10);

  // Sent meetings (my-meetings) state
  sentMeetings = signal<SentMeeting[]>([]);
  sentLoading = signal<boolean>(false);
  sentCurrentPage = signal<number>(1);
  sentTotalPages = signal<number>(1);
  sentTotalItems = signal<number>(0);

  get currentLang(): 'ar' | 'en' {
    return this.lang === 'ar' ? 'ar' : 'en';
  }

  getMeetingsSubtitle(): string {
    if (this.activeTab === 'client-meetings') {
      return this.lang === 'ar'
        ? 'إدارة اجتماعات العملاء.'
        : 'Review and manage meetings requested by clients.';
    }

    return this.lang === 'ar'
      ? 'تابع الجلسات التي قمت بجدولتها مع العملاء.'
      : 'Track the sessions you have scheduled with clients.';
  }

  // Filter tabs
  selectedTab = signal<TabType>('coming');

  // Client meetings archived state
  showArchivedMeetings = signal<boolean>(false);
  archivedMeetings = signal<Meeting[]>([]);
  archivedCurrentPage = signal<number>(1);
  archivedTotalPages = signal<number>(1);
  archivedTotalItems = signal<number>(0);

  // Sent meetings archived state
  sentShowArchivedMeetings = signal<boolean>(false);
  sentArchivedMeetings = signal<SentMeeting[]>([]);
  sentArchivedCurrentPage = signal<number>(1);
  sentArchivedTotalPages = signal<number>(1);
  sentArchivedTotalItems = signal<number>(0);

  // Archived counts
  clientArchivedCount = signal<number>(0);
  sentArchivedCount = signal<number>(0);

  
  // Dialog properties for client meetings
  selectedMeeting = signal<Meeting | null> (null);
  approveNotes= signal<string>('');
  postponeNotes = signal<string>('');
  actionLoading = signal<boolean>(false);
  showApproveDialog = signal<boolean>(false);
  showPostponeDialog = signal<boolean>(false);

  // Sent meetings reschedule modal properties
  showRescheduleModal = signal<boolean>(false);
  selectedMeetingForReschedule = signal<SentMeeting | null>(null);
  availableDays = signal<AvailableDay[]>([]);
  selectedDate = signal<string>('');
  selectedCalendarDate = signal<Date | null>(null);
  selectedTimeSlot = signal<AvailableTime | null>(null);
  rescheduleLoading = signal<boolean>(false);
  minDate = signal<Date>(new Date());
  maxDate = signal<Date>(new Date(new Date().setMonth(new Date().getMonth() + 3)));

  // Custom calendar properties
  currentMonth = signal<Date>(new Date());
  currentYear = signal<number>(new Date().getFullYear());
  currentMonthName = signal<string>('');
  monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                'July', 'August', 'September', 'October', 'November', 'December'];

  // Math reference for template
  Math = Math;

  private meetingsService= inject(MeetingsService);
  private sentMeetingsService = inject(SentMeetingsService);
  private profileService = inject(ProfileService);
  private router=inject(Router);
  private route = inject(ActivatedRoute);
  private destroyRef = inject(DestroyRef);



  ngOnInit(): void {
    this.updateCurrentMonthName();

    // Initialize role observables
    this.isClient$ = this.profileService.isClient();

    // Determine initial tab from query param while respecting role
    combineLatest([
      this.isClient$.pipe(take(1)),
      this.route.queryParamMap.pipe(take(1))
    ])
    .pipe(takeUntilDestroyed(this.destroyRef))
    .subscribe(([isClient, queryMap]) => {
      const tabParam = (queryMap.get('tab') || '').toLowerCase();
      let requestedTab: 'client-meetings' | 'my-meetings' | null = null;
      if (tabParam === 'client') {
        requestedTab = 'client-meetings';
      } else if (tabParam === 'my-meetings') {
        requestedTab = 'my-meetings';
      }

      if (isClient) {
        this.activeTab = 'my-meetings';
      } else if (requestedTab) {
        this.activeTab = requestedTab;
      } else {
        this.activeTab = 'client-meetings';
      }

      // Sync selectedTab signal with the chosen activeTab
      if (this.activeTab === 'client-meetings') {
        this.selectedTab.set(this.clientMeetingsSubTab);
      } else {
        this.selectedTab.set(this.myMeetingsSubTab);
      }
      this.showArchivedMeetings.set(false);
      this.sentShowArchivedMeetings.set(false);

      // Load data for the initial tab
      this.loadCurrentTabData();

      // Reflect actual tab in URL
      const actualTabParam = this.activeTab === 'client-meetings' ? 'client' : 'my-meetings';
      this.router.navigate([], {
        queryParams: { tab: actualTabParam },
        queryParamsHandling: 'merge',
        replaceUrl: true
      });
    });

    // Only load client meeting statistics if user is not a client
    this.isClient$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(isClient => {
      if (!isClient) {
        this.loadClientMeetingStatistics();
      }
    });

    this.loadSentMeetingStatistics();

    // Subscribe to loading states
    this.meetingsService.isLoading$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(loading => this.loading.set(loading));

    this.sentMeetingsService.isLoading$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(loading => this.sentLoading.set(loading));
  }

  setActiveTab(tab: 'client-meetings' | 'my-meetings'): void {
    // Prevent clients from accessing client-meetings tab
    this.isClient$.pipe(take(1)).subscribe(isClient => {
      if (isClient && tab === 'client-meetings') {
        return; // Don't allow clients to switch to client-meetings
      }

      this.activeTab = tab;
      if (tab === 'client-meetings') {
        this.selectedTab.set(this.clientMeetingsSubTab);
      } else {
        this.selectedTab.set(this.myMeetingsSubTab);
      }
      this.showArchivedMeetings.set(false);
      this.sentShowArchivedMeetings.set(false);
      this.loadCurrentTabData();

      // Update URL param to reflect chosen tab
      const tabParam = this.activeTab === 'client-meetings' ? 'client' : 'my-meetings';
      this.router.navigate([], {
        queryParams: { tab: tabParam },
        queryParamsHandling: 'merge',
        replaceUrl: true
      });
    });
  }

  setClientMeetingsSubTab(tab: 'coming' | 'past'): void {
    this.clientMeetingsSubTab = tab;
    this.selectedTab.set(tab);
    this.showArchivedMeetings.set(false);
    this.loadCurrentTabData();
  }

  setMyMeetingsSubTab(tab: 'coming' | 'past'): void {
    this.myMeetingsSubTab = tab;
    this.selectedTab.set(tab);
    this.sentShowArchivedMeetings.set(false);
    this.loadCurrentTabData();
  }

  private loadCurrentTabData(): void {
    if (this.activeTab === 'client-meetings') {
      this.loadMeetings();
    } else {
      this.loadSentMeetings();
    }
  }

  goToClientProfile(meeting: Meeting): void {
    if (meeting.client.uuid) {
      const currentLocale = localStorage.getItem('language') || 'en';
      const url = `https://foresighta.co/${currentLocale}/profile/${meeting.client.uuid}?entity=insighter`;
      window.open(url, '_blank');
    }
  }

  openClientProfileInNewTab(meeting: SentMeeting): void {
    if (meeting.client && meeting.client.uuid) {
      const currentLocale = localStorage.getItem('language') || 'en';
      const url = `https://foresighta.co/${currentLocale}/profile/${meeting.client.uuid}?entity=insighter`;
      window.open(url, '_blank');
    }
  }

  loadMeetings(page: number = 1): void {
    this.currentPage.set(page);
    const dateStatus = this.getDateStatusFilter();
    this.meetingsService.getMeetings(page, this.perPage(), dateStatus)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response: MeetingResponse) => {
          this.meetings.set(response.data);
          this.currentPage.set(response.meta.current_page);
          this.totalPages.set(response.meta.last_page);
          this.totalItems.set(response.meta.total)
        },
        error: (error) => {
          console.error('Error loading meetings:', error);
          this.handleServerErrors(error);
        }
      });
  }

  loadSentMeetings(page: number = 1): void {
    this.sentCurrentPage.set(page);
    if (this.selectedTab() === 'coming') {
      this.sentLoading.set(true);
      // Rely solely on the "upcoming" endpoint; it already includes future approved meetings.
      this.sentMeetingsService.getSentMeetings(page, this.perPage(), 'upcoming')
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (upcomingRes: SentMeetingResponse) => {
            this.sentMeetings.set(upcomingRes.data);
            this.sentTotalPages.set(upcomingRes.meta.last_page);
            this.sentTotalItems.set(upcomingRes.meta.total);
            this.sentCurrentPage.set(upcomingRes.meta.current_page);
            this.sentLoading.set(false);
          },
          error: (error) => {
            console.error('Error loading coming meetings:', error);
            this.sentLoading.set(false);
          }
        });
    } else {
      const dateStatus = this.getSentMeetingsDateStatusFilter();
      this.sentMeetingsService.getSentMeetings(page, this.perPage(), dateStatus)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (response: SentMeetingResponse) => {
            this.sentMeetings.set(response.data);
            this.sentTotalPages.set(response.meta.last_page);
            this.sentTotalItems.set(response.meta.total);
            this.sentCurrentPage.set(response.meta.current_page);
          },
          error: (error) => {
            console.error('Error loading sent meetings:', error);
          }
        });
    }
  }

  getSentMeetingsDateStatusFilter(): string | undefined {
    if (this.selectedTab() === 'coming') {
      return 'upcoming';
    } else if (this.selectedTab() === 'past') {
      return 'past';
    }
    return undefined;
  }

  onTabChange(tab: TabType): void {
    this.selectedTab.set(tab);
    this.showArchivedMeetings.set(false);
    this.sentShowArchivedMeetings.set(false);
    this.loadCurrentTabData();
  }

  getDateStatusFilter(): string | undefined {
    if (this.selectedTab() === 'coming') {
      return 'upcoming';
    } else if (this.selectedTab() === 'past') {
      return 'past';
    }
    return undefined;
  }

  getFilteredMeetings(): (Meeting | SentMeeting)[] {
    if (this.activeTab === 'client-meetings') {
      return this.getFilteredClientMeetings();
    } else {
      return this.getFilteredSentMeetings();
    }
  }

  getFilteredClientMeetings(): Meeting[] {
    let filteredMeetings: Meeting[] = [];

    // If showing archived meetings, return archived meetings
    if (this.selectedTab() === 'past' && this.showArchivedMeetings()) {
      filteredMeetings = this.archivedMeetings();
    } else if(this.selectedTab() === 'coming' || this.selectedTab() === 'past'){
      // date based (coming,past) // backend filter
      filteredMeetings = this.meetings();
    } else {
      // status-based tabs ( pending , approved , postponed)
      filteredMeetings = this.meetings().filter((meeting:Meeting)=>(meeting.status === this.selectedTab()))
    }
   //sort by date closest meeting first
   return filteredMeetings.sort((a,b)=>{
    const dateA = new Date(a.date).getTime();
    const dateB = new Date(b.date).getTime();
    return dateA-dateB
   })
  }

  getFilteredSentMeetings(): SentMeeting[] {
    let filteredMeetings: SentMeeting[] = [];

    // If showing archived meetings, return archived meetings
    if (this.selectedTab() === 'past' && this.sentShowArchivedMeetings()) {
      filteredMeetings = this.sentArchivedMeetings();
    } else if (this.selectedTab() === 'coming' || this.selectedTab() === 'past') {
      // For date-based tabs (coming/past), the filtering is done on the backend
      filteredMeetings = this.sentMeetings();
    } else {
      // For status-based tabs (pending, approved, postponed)
      filteredMeetings = this.sentMeetings().filter(meeting => meeting.status === this.selectedTab());
    }
    // Sort by date (closest meetings first)
    return filteredMeetings.sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      return dateA - dateB;
    });
  }

  onPageChange(page: number): void {
    if (this.activeTab === 'client-meetings') {
      if (this.showArchivedMeetings()) {
        this.loadArchivedMeetings(page);
      } else {
        this.loadMeetings(page);
      }
    } else {
      if (this.sentShowArchivedMeetings()) {
        this.loadSentArchivedMeetings(page);
      } else {
        this.loadSentMeetings(page);
      }
    }
  }

  onClientMeetingsPageChange(page: number): void {
    if (this.showArchivedMeetings()) {
      this.loadArchivedMeetings(page);
    } else {
      this.loadMeetings(page);
    }
  }

  onMyMeetingsPageChange(page: number): void {
    if (this.sentShowArchivedMeetings()) {
      this.loadSentArchivedMeetings(page);
    } else {
      this.loadSentMeetings(page);
    }
  }

  getSentPageNumbers(): number[] {
    const pages: number[] = [];
    const totalPages = this.sentShowArchivedMeetings() ? this.sentArchivedTotalPages() : this.sentTotalPages();
    for (let i = 1; i <= totalPages; i++) {
      pages.push(i);
    }
    return pages;
  }

  getSentCurrentPage(): number {
    return this.sentShowArchivedMeetings() ? this.sentArchivedCurrentPage() : this.sentCurrentPage();
  }

  getClientPageNumbers(): number[] {
    const pages: number[] = [];
    const totalPages = this.showArchivedMeetings() ? this.archivedTotalPages() : this.totalPages();
    for (let i = 1; i <= totalPages; i++) {
      pages.push(i);
    }
    return pages;
  }

  getClientCurrentPage(): number {
    return this.showArchivedMeetings() ? this.archivedCurrentPage() : this.currentPage();
  }

  getClientTotalPages(): number {
    return this.showArchivedMeetings() ? this.archivedTotalPages() : this.totalPages();
  }

  getStatusClass(status: string): string {
    switch (status) {
      case 'approved':
        return 'badge-success';
      case 'pending':
        return 'badge-warning';
      case 'postponed':
        return 'badge-secondary';
      default:
        return 'badge-primary';
    }
  }

  getInitials(firstName: string, lastName: string): string {
    return this.meetingsService.getInitials(firstName, lastName);
  }

  getSentMeetingInitials(name: string): string {
    const names = name.split(' ');
    const firstName = names[0] || '';
    const lastName = names[1] || '';
    return this.sentMeetingsService.getInitials(name);
  }

  formatTime(time: string): string {
    // Use 24-hour format
    const [hours, minutes] = time.split(':');
    return `${hours}:${minutes}`;
  }

  formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      day: 'numeric',
      month: 'short'
    });
  }

  formatMonth(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short'
    });
  }

  formatDay(dateString: string): string {
    const date = new Date(dateString);
    return date.getDate().toString();
  }

  isClosestMeeting(meeting: Meeting | SentMeeting, index: number): boolean {
    const filteredMeetings = this.getFilteredMeetings();
    // Only the first meeting (closest) gets the orange color
    return index === 0 && filteredMeetings.length > 0;
  }

  openApproveModal(meeting: Meeting): void {
    this.selectedMeeting.set(meeting);
    this.approveNotes.set('')
    this.showApproveDialog.set(true);
  }

  openPostponeModal(meeting: Meeting): void {
   
    this.selectedMeeting.set(meeting);
    this.postponeNotes.set('')
    this.showPostponeDialog.set(true);
  }

  closeApproveDialog(): void {
    this.showApproveDialog.set(false)
    this.selectedMeeting.set(null);
    this.approveNotes.set('')
  }

  closePostponeDialog(): void {
    this.showPostponeDialog.set(false);
    this.selectedMeeting.set(null);
    this.postponeNotes.set('')
  }

  approveMeeting(): void {
    const meeting = this.selectedMeeting();
    if (!meeting ) {
      return;
    }
    this.actionLoading.set(true);
    this.meetingsService.updateMeetingStatus(
      meeting.uuid,
      'approved',
      this.approveNotes().trim()
    ).pipe(takeUntilDestroyed(this.destroyRef))
    .subscribe({
      next: () => {
        this.actionLoading.set(false);
        // Always reload meetings from backend after status change
        this.showApproveDialog.set(false);
        this.selectedMeeting.set(null);
        this.approveNotes.set('');
        this.reloadMeetingsAfterAction();
      },
      error: (error: any) => {
        this.actionLoading.set(false);
        this.handleServerErrors(error);
      }
    });
  }

  postponeMeeting(): void {
    const meeting = this.selectedMeeting();
    const notes = this.postponeNotes();

    if (!meeting || !notes.trim()) {
      return;
      //show warning toast message
    }

    this.actionLoading.set(true);
    this.meetingsService.updateMeetingStatus(
      meeting.uuid,
      'postponed',
      notes.trim()
    ).pipe(takeUntilDestroyed(this.destroyRef))
    .subscribe({
      next: () => {
        this.actionLoading.set(false);
        this.showPostponeDialog.set(false);
        this.selectedMeeting.set(null);
        this.postponeNotes.set('');
        this.reloadMeetingsAfterAction();
      },
      error: (error: any) => {
        this.actionLoading.set(false)
        this.handleServerErrors(error);
      }
    });
  }

  /**
   * Reload meetings after an action (approve/postpone). If the current page becomes empty and is not the first page, go to the previous page.
   */
  private reloadMeetingsAfterAction(): void {
    // Reload meetings for the current page
    this.loadMeetings(this.currentPage());

    // Reload client meeting statistics only if user is not a client
    this.isClient$.pipe(take(1)).subscribe(isClient => {
      if (!isClient) {
        this.loadClientMeetingStatistics();
      }
    });

    // After loading, check if the current page is empty and not the first page
    setTimeout(() => {
      if (this.getFilteredMeetings().length === 0 && this.currentPage() > 1) {
        this.loadMeetings(this.currentPage() - 1);
      }
    }, 500); // Wait for meetings to reload
  }

  private handleServerErrors(error: any) {
    if (error.error && error.error.errors) {
      const serverErrors = error.error.errors;
      for (const key in serverErrors) {
        if (serverErrors.hasOwnProperty(key)) {
          const messages = serverErrors[key];
          if (error.error.type === "warning") {
            this.showWarn('', messages.join(", "));
          } else {
            this.showError('', messages.join(", "));
          }
        }
      }
    } else {
      if (error.error && error.error.type === "warning") {
        this.showWarn('','An unexpected warning occurred.');
      } else {
        this.showError('','An unexpected error occurred.');
      }
    }
  }

  /**
   * Open the meeting URL in a new tab
   */
  joinMeeting(meetingUrl: string): void {
    if (meetingUrl && meetingUrl !== '?pwd=') {
      window.open(meetingUrl, '_blank');
    }
  }

  /**
   * Archive a meeting
   */
  archiveMeeting(meeting: Meeting): void {
    this.actionLoading.set(true);
    this.meetingsService.archiveMeeting(meeting.uuid)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.actionLoading.set(false);
          this.showSuccess('Success', 'Meeting archived successfully');
          this.reloadMeetingsAfterAction();
        },
        error: (error: any) => {
          this.actionLoading.set(false);
          this.handleServerErrors(error);
        }
      });
  }


  /**
   * Load archived meetings
   */
  loadArchivedMeetings(page: number = 1): void {
    this.archivedCurrentPage.set(page);
    this.meetingsService.getArchivedMeetings(page, this.perPage())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response: MeetingResponse) => {
          this.archivedMeetings.set(response.data);
          this.archivedCurrentPage.set(response.meta.current_page);
          this.archivedTotalPages.set(response.meta.last_page);
          this.archivedTotalItems.set(response.meta.total);
        },
        error: (error) => {
          console.error('Error loading archived meetings:', error);
          this.handleServerErrors(error);
        }
      });
  }

  // Sent meetings methods
  goToInsighterProfile(insighterUuid: string): void {
    const currentLocale = localStorage.getItem('language') || 'en';
    window.location.href = `https://foresighta.co/${currentLocale}/profile/${insighterUuid}?entity=insighter&tab=meet`;
  }

  canJoinMeeting(meeting: SentMeeting): boolean {
    return this.selectedTab() !== 'past' && meeting.status === 'approved';
  }

  canRescheduleMeeting(meeting: SentMeeting): boolean {
    return meeting.status === 'postponed';
  }

  openRescheduleModal(meeting: SentMeeting): void {
    this.selectedMeetingForReschedule.set(meeting);
    this.showRescheduleModal.set(true);
    this.loadAvailableHours(meeting.insighter.uuid);
  }

  closeRescheduleModal(): void {
    this.showRescheduleModal.set(false);
    this.selectedMeetingForReschedule.set(null);
    this.availableDays.set([]);
    this.selectedDate.set('');
    this.selectedCalendarDate.set(null);
    this.selectedTimeSlot.set(null);
  }

  loadAvailableHours(insighterUuid: string): void {
    this.rescheduleLoading.set(true);
    this.sentMeetingsService.getAvailableHours(insighterUuid)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response: AvailableHoursResponse) => {
          this.availableDays.set(response.data);
          this.rescheduleLoading.set(false);
        },
        error: (error) => {
          console.error('Error loading available hours:', error);
          this.rescheduleLoading.set(false);
        }
      });
  }

  selectDate(date: string): void {
    this.selectedDate.set(date);
    this.selectedTimeSlot.set(null);
  }

  selectTimeSlot(timeSlot: AvailableTime): void {
    this.selectedTimeSlot.set(timeSlot);
  }

  isDifferentTime(): boolean {
    const selectedMeeting = this.selectedMeetingForReschedule();
    const selectedTime = this.selectedTimeSlot();
    const selectedDateValue = this.selectedDate();

    if (!selectedMeeting || !selectedTime || !selectedDateValue) {
      return false;
    }

    const currentDate = selectedMeeting.date;
    const currentStartTime = selectedMeeting.start_time;
    const currentEndTime = selectedMeeting.end_time;

    return !(selectedDateValue === currentDate &&
             selectedTime.start_time === currentStartTime &&
             selectedTime.end_time === currentEndTime);
  }

  getAvailableTimesForDate(date: string): AvailableTime[] {
    const day = this.availableDays().find(d => d.date === date);
    return day ? day.times : [];
  }

  isDateActive(date: string): boolean {
    const day = this.availableDays().find(d => d.date === date);
    return day ? day.active : false;
  }

  formatDateForDisplay(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    });
  }

  formatTimeForDisplay(time: string): string {
    const [hours, minutes] = time.split(':');
    return `${hours}:${minutes}`;
  }

  confirmReschedule(): void {
    const selectedMeeting = this.selectedMeetingForReschedule();
    const selectedTime = this.selectedTimeSlot();
    const selectedDateValue = this.selectedDate();

    if (!selectedMeeting || !selectedTime || !selectedDateValue || !this.isDifferentTime()) {
      return;
    }

    const rescheduleData: RescheduleRequest = {
      meeting_date: selectedDateValue,
      start_time: selectedTime.start_time.substring(0, 5),
      end_time: selectedTime.end_time.substring(0, 5)
    };

    this.rescheduleLoading.set(true);
    this.sentMeetingsService.rescheduleMeeting(selectedMeeting.uuid, rescheduleData)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          console.log('Meeting rescheduled successfully:', response);
          this.closeRescheduleModal();
          this.loadSentMeetings(this.sentCurrentPage());
          this.rescheduleLoading.set(false);
        },
        error: (error) => {
          console.error('Error rescheduling meeting:', error);
          this.rescheduleLoading.set(false);
        }
      });
  }

  // Calendar methods
  updateCurrentMonthName(): void {
    const currentMonthValue = this.currentMonth();
    this.currentMonthName.set(this.monthNames[currentMonthValue.getMonth()]);
    this.currentYear.set(currentMonthValue.getFullYear());
  }

  previousMonth(): void {
    const currentMonthValue = this.currentMonth();
    const newMonth = new Date(currentMonthValue.getFullYear(), currentMonthValue.getMonth() - 1, 1);
    this.currentMonth.set(newMonth);
    this.updateCurrentMonthName();
  }

  nextMonth(): void {
    const currentMonthValue = this.currentMonth();
    const newMonth = new Date(currentMonthValue.getFullYear(), currentMonthValue.getMonth() + 1, 1);
    this.currentMonth.set(newMonth);
    this.updateCurrentMonthName();
  }

  getEmptyDays(): number[] {
    const currentMonthValue = this.currentMonth();
    const firstDay = new Date(currentMonthValue.getFullYear(), currentMonthValue.getMonth(), 1).getDay();
    return Array(firstDay).fill(0);
  }

  getDaysInCurrentMonth(): number[] {
    const currentMonthValue = this.currentMonth();
    const daysInMonth = new Date(currentMonthValue.getFullYear(), currentMonthValue.getMonth() + 1, 0).getDate();
    return Array.from({length: daysInMonth}, (_, i) => i + 1);
  }

  getDateString(day: number): string {
    const currentMonthValue = this.currentMonth();
    const year = currentMonthValue.getFullYear();
    const month = currentMonthValue.getMonth();
    const date = new Date(year, month, day);
    return this.formatDateToString(date);
  }

  formatDateToString(date: Date): string {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  getFormattedSelectedDate(): string {
    const selectedDateValue = this.selectedDate();
    if (!selectedDateValue) return '';
    const date = new Date(selectedDateValue);
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayName = dayNames[date.getDay()];
    const monthName = this.monthNames[date.getMonth()];
    const dayNumber = date.getDate();
    return `${dayName}, ${monthName} ${dayNumber}`;
  }

  // Sent meetings archive methods
  archiveSentMeeting(meeting: SentMeeting): void {
    this.actionLoading.set(true);
    this.sentMeetingsService.archiveMeeting(meeting.uuid)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.actionLoading.set(false);
          this.showSuccess('Success', 'Meeting archived successfully');
          this.reloadSentMeetingsAfterAction();
        },
        error: (error: any) => {
          this.actionLoading.set(false);
          this.handleServerErrors(error);
        }
      });
  }

  toggleSentArchivedMeetings(): void {
    const newState = !this.sentShowArchivedMeetings();
    this.sentShowArchivedMeetings.set(newState);

    if (newState) {
      this.loadSentArchivedMeetings(1);
    } else {
      this.loadSentMeetings(1);
    }
  }

  loadSentArchivedMeetings(page: number = 1): void {
    this.sentArchivedCurrentPage.set(page);
    this.sentMeetingsService.getArchivedMeetings(page, this.perPage())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response: SentMeetingResponse) => {
          this.sentArchivedMeetings.set(response.data);
          this.sentArchivedCurrentPage.set(response.meta.current_page);
          this.sentArchivedTotalPages.set(response.meta.last_page);
          this.sentArchivedTotalItems.set(response.meta.total);
        },
        error: (error) => {
          console.error('Error loading archived sent meetings:', error);
          this.handleServerErrors(error);
        }
      });
  }

  private reloadSentMeetingsAfterAction(): void {
    this.loadSentMeetings(this.sentCurrentPage());
    // Reload sent meeting statistics to update archived count
    this.loadSentMeetingStatistics();
    setTimeout(() => {
      if (this.getFilteredSentMeetings().length === 0 && this.sentCurrentPage() > 1) {
        this.loadSentMeetings(this.sentCurrentPage() - 1);
      }
    }, 500);
  }

  // Helper method to determine which type of meeting for template
  isClientMeeting(meeting: Meeting | SentMeeting): meeting is Meeting {
    return this.activeTab === 'client-meetings';
  }

  isSentMeeting(meeting: Meeting | SentMeeting): meeting is SentMeeting {
    return this.activeTab === 'my-meetings';
  }

  // Updated toggle archived meetings method
  toggleArchivedMeetings(): void {
    if (this.activeTab === 'client-meetings') {
      const newState = !this.showArchivedMeetings();
      this.showArchivedMeetings.set(newState);

      if (newState) {
        this.loadArchivedMeetings(1);
      } else {
        this.loadMeetings(1);
      }
    } else {
      this.toggleSentArchivedMeetings();
    }
  }

  /**
   * Load client meeting statistics to get archived count
   */
  loadClientMeetingStatistics(): void {
    this.meetingsService.getClientMeetingStatistics()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.clientArchivedCount.set(response.data.archived);
        },
        error: (error) => {
          console.error('Error loading client meeting statistics:', error);
        }
      });
  }

  /**
   * Load sent meeting statistics to get archived count
   */
  loadSentMeetingStatistics(): void {
    this.sentMeetingsService.getMeetingStatistics()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.sentArchivedCount.set(response.data.archived);
        },
        error: (error) => {
          console.error('Error loading sent meeting statistics:', error);
        }
      });
  }
}
