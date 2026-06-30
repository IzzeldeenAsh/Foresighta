import { Component, Injector, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Observable } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { BaseComponent } from 'src/app/modules/base.component';
import {
  ProjectOfferBlock,
  ProjectOffer,
  ProjectOfferActionResponse,
  ProjectOfferActionStatus,
  ProjectOfferFile,
  ProjectOfferScope,
  ProjectOffersPaginatedResponse,
  ProjectOffersFilters,
  ProjectOffersService,
  ProjectOfferReadStatus,
  ProjectOfferStatistics,
  ProjectOfferType,
} from 'src/app/_fake/services/project-offers/project-offers.service';

type ViewMode = 'grid' | 'list';
export type DrawerTab = 'overview' | 'documents' | 'offer' | 'discussion';

interface ProjectTypeMeta {
  key: ProjectOfferType;
  labelEn: string;
  labelAr: string;
}

interface StatusFilterOption<T> {
  value: T;
  labelEn: string;
  labelAr: string;
  iconClass: string;
}

interface DrawerTabOption {
  value: DrawerTab;
  labelEn: string;
  labelAr: string;
  iconClass: string;
}

@Component({
  selector: 'app-project-offers',
  templateUrl: './project-offers.component.html',
  styleUrl: './project-offers.component.scss'
})
export class ProjectOffersComponent extends BaseComponent implements OnInit, OnDestroy {
  isLoading$: Observable<boolean>;

  isDetailsPage = false;
  offers: ProjectOffer[] = [];
  viewMode: ViewMode = 'list';
  offerReadImageUrl = 'https://res.cloudinary.com/dsiku9ipv/image/upload/v1777637418/job-offer_8062313_lqbkuq.png';
  offerUnreadImageUrl = 'https://res.cloudinary.com/dsiku9ipv/image/upload/v1779196244/job-offer_8062313_lqbkuq_belled_zx6gpr.png';
  selectedActionStatus: ProjectOfferActionStatus | null = null;
  selectedReadStatus: ProjectOfferReadStatus | null = null;
  projectStatistics: ProjectOfferStatistics = { total: 0, statuses: [] };
  projectStatisticsLoaded = false;

  currentPage: number = 1;
  rows: number = 10;
  first: number = 0;
  totalRecords: number = 0;

  drawerVisible: boolean = false;
  selectedOffer: ProjectOffer | null = null;
  drawerDetailsLoading: boolean = false;
  drawerDetailsError: boolean = false;
  activeDrawerTab: DrawerTab = 'overview';
  rejectingOfferUuid: string | null = null;
  interestingOfferUuid: string | null = null;
  openingFileUuid: string | null = null;
  markingViewedOfferUuids = new Set<string>();
  currentTime: number = Date.now();
  private deadlineTicker: ReturnType<typeof setInterval> | null = null;
  private drawerDetailsRequestId = 0;
  private readonly defaultOfferDeadlineWindowMs = 14 * 86_400_000;
  private chipRailDragTarget: HTMLElement | null = null;
  private chipRailDragPointerId: number | null = null;
  private chipRailDragStartX = 0;
  private chipRailDragStartScrollLeft = 0;
  private chipRailDragMoved = false;
  private suppressChipClick = false;

  projectTypeOptions: ProjectTypeMeta[] = [
    { key: 'ad_hoc', labelEn: 'Ad Hoc', labelAr: 'خاص' },
    { key: 'frame_work_agreement', labelEn: 'Framework Agreement', labelAr: 'اتفاقية إطارية' },
    { key: 'urgent_request', labelEn: 'Urgent Request', labelAr: 'طلب عاجل' },
  ];
  actionStatusOptions: StatusFilterOption<ProjectOfferActionStatus>[] = [
    { value: 'pending', labelEn: 'Pending', labelAr: 'قيد الانتظار', iconClass: 'pi-clock' },
    { value: 'viewed', labelEn: 'Viewed', labelAr: 'تمت المشاهدة', iconClass: 'pi-eye' },
    { value: 'offered', labelEn: 'Offered', labelAr: 'تم تقديم العرض', iconClass: 'pi-send' },
    { value: 'awarded', labelEn: 'Awarded', labelAr: 'تم الترسية', iconClass: 'pi-star' },
    { value: 'technical_rejected', labelEn: 'Technical Rejected', labelAr: 'مرفوض فنياً', iconClass: 'pi-times-circle' },
    { value: 'expired', labelEn: 'Expired', labelAr: 'منتهي', iconClass: 'pi-clock' },
  ];
  readStatusOptions: StatusFilterOption<ProjectOfferReadStatus>[] = [
    { value: 'not_read', labelEn: 'Unread', labelAr: 'غير مقروء', iconClass: 'ki-notification-on' },
    { value: 'read', labelEn: 'Read', labelAr: 'مقروء', iconClass: 'ki-eye' },
  ];
  drawerTabOptions: DrawerTabOption[] = [
    { value: 'overview', labelEn: 'Overview', labelAr: 'نظرة عامة', iconClass: 'ki-element-7' },
    { value: 'documents', labelEn: 'Shared Documents', labelAr: 'المستندات', iconClass: 'ki-document' },
    { value: 'discussion', labelEn: 'Discussion', labelAr: 'النقاش', iconClass: 'ki-messages' },
    { value: 'offer', labelEn: 'Offer', labelAr: 'العرض', iconClass: 'ki-dollar' },
  ];

  constructor(
    injector: Injector,
    private projectOffersService: ProjectOffersService,
    private router: Router,
  ) {
    super(injector);
    this.isLoading$ = this.projectOffersService.isLoading$;
  }

  ngOnInit(): void {
    this.loadProjectStatistics();
    this.loadOffers(1);
    this.deadlineTicker = setInterval(() => {
      this.currentTime = Date.now();
    }, 60_000);
  }

  private loadProjectStatistics(): void {
    this.projectOffersService.getProjectStatistics()
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe({
        next: statistics => {
          this.projectStatistics = statistics;
          this.projectStatisticsLoaded = true;
        },
        error: () => {
          this.projectStatisticsLoaded = false;
        },
      });
  }

  getAllOffersCount(): number {
    return this.projectStatisticsLoaded ? this.projectStatistics.total : this.totalRecords;
  }

  getActionStatusCount(status: ProjectOfferActionStatus | null | undefined): number {
    if (!status || !this.projectStatisticsLoaded) return 0;
    const key = this.normalizeStatusKey(status);
    const match = this.projectStatistics.statuses.find(item => this.normalizeStatusKey(item.status) === key);
    return match?.total ?? 0;
  }

  private normalizeStatusKey(value: string): string {
    return (value || '').toLowerCase().replace(/[-\s]+/g, '_');
  }

  loadOffers(page: number): void {
    this.projectOffersService.getProjectOffers(page, this.getActiveFilters())
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe({
        next: (res: ProjectOffersPaginatedResponse) => {
          this.offers = res.data || [];
          this.totalRecords = res.meta?.total ?? 0;
          this.rows = res.meta?.per_page ?? 10;
          this.currentPage = res.meta?.current_page ?? page;
          this.first = (this.currentPage - 1) * this.rows;
        },
        error: (err) => this.handleServerErrors(err),
      });
  }

  onPageChange(event: any): void {
    const page = Math.floor(event.first / event.rows) + 1;
    this.first = event.first;
    this.rows = event.rows;
    this.loadOffers(page);
  }

  onActionStatusChange(actionStatus: ProjectOfferActionStatus | null): void {
    if (this.suppressChipClick) return;
    this.selectedActionStatus = actionStatus;
    this.resetPaginationAndReload();
  }

  onReadStatusChange(readStatus: ProjectOfferReadStatus | null): void {
    if (this.suppressChipClick) return;
    this.selectedReadStatus = this.selectedReadStatus === readStatus ? null : readStatus;
    this.resetPaginationAndReload();
  }

  onChipRailWheel(event: WheelEvent): void {
    const rail = event.currentTarget as HTMLElement;
    if (rail.scrollWidth <= rail.clientWidth) return;

    const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
    const direction = getComputedStyle(rail).direction === 'rtl' ? -1 : 1;
    rail.scrollLeft += delta * direction;
    event.preventDefault();
  }

  onChipRailPointerDown(event: PointerEvent): void {
    if (event.pointerType !== 'mouse' || event.button !== 0) return;

    const rail = event.currentTarget as HTMLElement;
    if (rail.scrollWidth <= rail.clientWidth) return;

    this.chipRailDragTarget = rail;
    this.chipRailDragPointerId = event.pointerId;
    this.chipRailDragStartX = event.clientX;
    this.chipRailDragStartScrollLeft = rail.scrollLeft;
    this.chipRailDragMoved = false;
    rail.setPointerCapture(event.pointerId);
    rail.classList.add('is-dragging');
  }

  onChipRailPointerMove(event: PointerEvent): void {
    if (!this.chipRailDragTarget || this.chipRailDragPointerId !== event.pointerId) return;
    if ((event.buttons & 1) !== 1) {
      this.onChipRailPointerUp(event);
      return;
    }

    const distance = event.clientX - this.chipRailDragStartX;
    if (Math.abs(distance) > 4) {
      this.chipRailDragMoved = true;
      this.suppressChipClick = true;
    }

    if (this.chipRailDragMoved) {
      this.chipRailDragTarget.scrollLeft = this.chipRailDragStartScrollLeft - distance;
      event.preventDefault();
    }
  }

  onChipRailPointerUp(event: PointerEvent): void {
    if (!this.chipRailDragTarget || this.chipRailDragPointerId !== event.pointerId) return;

    const rail = this.chipRailDragTarget;
    rail.classList.remove('is-dragging');
    if (rail.hasPointerCapture(event.pointerId)) {
      rail.releasePointerCapture(event.pointerId);
    }

    this.chipRailDragTarget = null;
    this.chipRailDragPointerId = null;
    this.chipRailDragMoved = false;
    setTimeout(() => {
      this.suppressChipClick = false;
    });
  }

  setViewMode(mode: ViewMode): void {
    this.viewMode = mode;
  }

  openDrawer(offer: ProjectOffer): void {
    const detailsUuid = this.getProposalDetailsUuid(offer);
    if (!detailsUuid) {
      this.showError(
        this.lang === 'ar' ? 'تعذر فتح التفاصيل' : 'Cannot open details',
        this.lang === 'ar' ? 'لم يتم العثور على معرّف العرض.' : 'Offer identifier was not found.'
      );
      return;
    }

    this.router.navigate(['/app/insighter-dashboard/project-offers/details', detailsUuid]);
  }

  loadOfferDetails(offer: ProjectOffer): void {
    this.drawerVisible = true;
    this.selectedOffer = null;
    this.drawerDetailsLoading = true;
    this.drawerDetailsError = false;
    this.activeDrawerTab = 'overview';

    const requestId = ++this.drawerDetailsRequestId;
    const detailsUuid = this.getProposalDetailsUuid(offer);

    this.projectOffersService.getProposalDetails(detailsUuid)
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe({
        next: (details) => {
          if (requestId !== this.drawerDetailsRequestId) {
            return;
          }

          this.selectedOffer = this.mergeOfferDetails(offer, details);
          this.drawerDetailsLoading = false;
          this.setDrawerTab(this.getInitialDrawerTab(this.selectedOffer), this.selectedOffer);
          this.markOfferAsViewed(this.selectedOffer);
        },
        error: (err) => {
          if (requestId !== this.drawerDetailsRequestId) {
            return;
          }

          this.drawerDetailsLoading = false;
          this.drawerDetailsError = true;
          this.handleServerErrors(err);
        },
      });
  }

  closeDrawer(): void {
    this.drawerVisible = false;
    this.selectedOffer = null;
    this.drawerDetailsLoading = false;
    this.drawerDetailsError = false;
    this.activeDrawerTab = 'overview';
    this.drawerDetailsRequestId++;
  }

  getTypeMeta(key: ProjectOfferType): ProjectTypeMeta | undefined {
    return this.projectTypeOptions.find(o => o.key === key);
  }

  getStatusBadgeClass(offer: ProjectOffer): string {
    const status = this.getDisplayStatus(offer);
    switch (status) {
      case 'viewed':
        return 'badge-light-viewed';
      case 'pending':
      case 'invited':
        return 'badge-light-warning';
      case 'accepted':
      case 'approved':
      case 'offered':
        return 'badge-light-success';
      case 'awarded':
        return 'badge-light-info';
      case 'rejected':
      case 'declined':
      case 'cancelled':
      case 'expired':
      case 'not_selected':
      case 'technical_rejected':
        return 'badge-light-danger';
      case 'submitted':
      case 'contract':
      case 'closed':
        return 'badge-light-primary';
      default:
        return 'badge-light-info';
    }
  }

  getStatusLabel(offer: ProjectOffer): string {
    const status = this.getDisplayStatus(offer);
    const labels: { [k: string]: { en: string; ar: string } } = {
      pending: { en: 'Pending', ar: 'قيد الانتظار' },
      invited: { en: 'Invited', ar: 'مدعو' },
      viewed: { en: 'Viewed', ar: 'تمت المشاهدة' },
      offered: { en: 'Offered', ar: 'تم تقديم العرض' },
      awarded: { en: 'Awarded', ar: 'تم الترسية' },
      technical_rejected: { en: 'Technical Rejected', ar: 'مرفوض فنياً' },
      accepted: { en: 'Accepted', ar: 'مقبول' },
      approved: { en: 'Approved', ar: 'موافق' },
      rejected: { en: 'Rejected', ar: 'مرفوض' },
      declined: { en: 'Declined', ar: 'مرفوض' },
      cancelled: { en: 'Cancelled', ar: 'ملغي' },
      submitted: { en: 'Submitted', ar: 'مُرسل' },
      contract: { en: 'Contract', ar: 'العقد' },
      closed: { en: 'Closed', ar: 'مغلق' },
      expired: { en: 'Expired', ar: 'منتهي' },
      not_selected: { en: 'Not Selected', ar: 'غير مختار' },
    };
    const match = labels[status];
    if (!match) return this.humanizeValue(status) || '-';
    return this.lang === 'ar' ? match.ar : match.en;
  }

  getTypeLabel(type: ProjectOfferType | null | undefined): string {
    if (!type) {
      return '-';
    }

    const meta = this.getTypeMeta(type);
    if (!meta) {
      return this.humanizeValue(type);
    }

    return this.lang === 'ar' ? meta.labelAr : meta.labelEn;
  }

  formatDate(value: string | null | undefined): string {
    if (!value) return '-';
    try {
      const d = new Date(value);
      return d.toLocaleDateString('en-US', {
        year: 'numeric', month: 'short', day: 'numeric'
      });
    } catch {
      return value;
    }
  }

  getSummary(offer: ProjectOffer): string {
    return offer.project?.service_prompt || offer.project?.description || '-';
  }

  isInsighterUnread(offer: ProjectOffer): boolean {
    return offer.project?.is_read === false;
  }

  getOfferImageUrl(offer: ProjectOffer): string {
    return this.isInsighterUnread(offer) ? this.offerUnreadImageUrl : this.offerReadImageUrl;
  }

  isUnreadFile(file: ProjectOfferFile | null | undefined): boolean {
    return file?.is_read === false;
  }

  getDeadlineLabel(offer: ProjectOffer): string {
    const date = offer.project?.deadline_offer || offer.project?.deadline;
    return this.formatDate(date);
  }

  getOfferDeadlineDate(offer: ProjectOffer | null | undefined): Date | null {
    const value = offer?.project?.deadline_offer;
    if (!value) {
      return null;
    }

    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  getOfferRemainingMs(offer: ProjectOffer | null | undefined): number {
    const deadline = this.getOfferDeadlineDate(offer);
    return deadline ? deadline.getTime() - this.currentTime : 0;
  }

  getOfferRemainingDays(offer: ProjectOffer | null | undefined): number {
    const remainingMs = this.getOfferRemainingMs(offer);
    if (remainingMs <= 0) {
      return 0;
    }

    return Math.ceil(remainingMs / 86_400_000);
  }

  getOfferRemainingHours(offer: ProjectOffer | null | undefined): number {
    const remainingMs = this.getOfferRemainingMs(offer);
    if (remainingMs <= 0) {
      return 0;
    }

    return Math.max(1, Math.ceil(remainingMs / 3_600_000));
  }

  getOfferTimerValue(offer: ProjectOffer | null | undefined): string {
    const deadline = this.getOfferDeadlineDate(offer);
    if (!deadline) {
      return '-';
    }

    if (this.getOfferRemainingMs(offer) <= 0) {
      return '0';
    }

    const days = this.getOfferRemainingDays(offer);
    return days > 1 ? `${days}` : `${this.getOfferRemainingHours(offer)}`;
  }

  getOfferTimerUnit(offer: ProjectOffer | null | undefined): string {
    if (!this.getOfferDeadlineDate(offer)) {
      return this.lang === 'ar' ? 'غير محدد' : 'no date';
    }

    if (this.getOfferRemainingMs(offer) <= 0) {
      return this.lang === 'ar' ? 'منتهي' : 'expired';
    }

    const days = this.getOfferRemainingDays(offer);
    if (days > 1) {
      return this.lang === 'ar' ? 'أيام متبقية' : 'days left';
    }

    return this.lang === 'ar' ? 'ساعات متبقية' : 'hours left';
  }

  getOfferTimerHint(offer: ProjectOffer | null | undefined): string {
    if (!this.getOfferDeadlineDate(offer)) {
      return this.lang === 'ar' ? 'لم يتم تحديد موعد نهائي للعرض.' : 'No offer deadline has been set.';
    }

    if (this.getOfferRemainingMs(offer) <= 0) {
      return this.lang === 'ar' ? 'انتهت مدة إرسال هذا العرض.' : 'This offer submission window has ended.';
    }

    return '';
  }

  getOfferDeadlineProgress(offer: ProjectOffer | null | undefined): number {
    const remainingRatio = this.getOfferRemainingRatio(offer);
    if (remainingRatio <= 0) {
      return 0;
    }

    return Math.max(6, Math.min(100, Math.round(remainingRatio * 100)));
  }

  getOfferTimerClass(offer: ProjectOffer | null | undefined): string {
    if (!this.getOfferDeadlineDate(offer)) {
      return 'po-offer-timer--neutral';
    }

    const elapsedRatio = this.getOfferElapsedRatio(offer);
    if (elapsedRatio >= 1) {
      return 'po-offer-timer--expired';
    }

    if (elapsedRatio < 1 / 3) {
      return 'po-offer-timer--healthy';
    }

    if (elapsedRatio < 2 / 3) {
      return 'po-offer-timer--warning';
    }

    return 'po-offer-timer--danger';
  }

  private getOfferRemainingRatio(offer: ProjectOffer | null | undefined): number {
    const deadline = this.getOfferDeadlineDate(offer);
    if (!deadline) {
      return 0;
    }

    const windowMs = this.getOfferDeadlineWindowMs(offer, deadline);
    if (windowMs <= 0) {
      return 0;
    }

    return Math.max(0, Math.min(1, this.getOfferRemainingMs(offer) / windowMs));
  }

  private getOfferElapsedRatio(offer: ProjectOffer | null | undefined): number {
    return Math.max(0, Math.min(1, 1 - this.getOfferRemainingRatio(offer)));
  }

  private getOfferDeadlineWindowMs(offer: ProjectOffer | null | undefined, deadline: Date): number {
    const startDate = this.getOfferStartDate(offer);
    if (startDate && startDate.getTime() < deadline.getTime()) {
      return deadline.getTime() - startDate.getTime();
    }

    return this.defaultOfferDeadlineWindowMs;
  }

  private getOfferStartDate(offer: ProjectOffer | null | undefined): Date | null {
    const candidates = [
      offer?.created_at,
      offer?.invited_at,
      offer?.project?.created_at,
    ];

    for (const value of candidates) {
      const date = this.parseDate(value);
      if (date) {
        return date;
      }
    }

    return null;
  }

  private parseDate(value: string | null | undefined): Date | null {
    if (!value) {
      return null;
    }

    const normalizedValue = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value)
      ? value.replace(' ', 'T')
      : value;
    const date = new Date(normalizedValue);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  shouldShowOfferTimer(offer: ProjectOffer | null | undefined): boolean {
    if (!offer) {
      return false;
    }

    return this.getResolvedStatus(offer) !== 'awarded'
      && this.getDisplayStatus(offer) !== 'awarded';
  }

  isOfferTimedOut(offer: ProjectOffer | null | undefined): boolean {
    return !!this.getOfferDeadlineDate(offer) && this.getOfferRemainingMs(offer) <= 0;
  }

  getDrawerBackIcon(): string {
    return this.lang === 'ar' ? 'ki-arrow-right' : 'ki-arrow-left';
  }

  getLanguageLabel(value: string | null | undefined): string {
    if (!value) {
      return '-';
    }

    const normalized = value.toLowerCase();
    const labels: Record<string, { en: string; ar: string }> = {
      arabic: { en: 'Arabic', ar: 'العربية' },
      english: { en: 'English', ar: 'الإنجليزية' },
    };

    const match = labels[normalized];
    if (match) {
      return this.lang === 'ar' ? match.ar : match.en;
    }

    return this.humanizeValue(value);
  }

  getCountryFlagPath(flag: string | null | undefined): string {
    return flag ? `assets/media/flags/${flag}.svg` : 'assets/media/flags/default.svg';
  }

  getFileTypeIconPath(extension: string | null | undefined): string {
    if (!extension) {
      return 'assets/media/svg/files/default.svg';
    }

    const normalized = extension.toLowerCase();
    const iconMap: Record<string, string> = {
      pdf: 'pdf',
      doc: 'doc',
      docx: 'docx',
      ppt: 'ppt',
      pptx: 'ppt',
      csv: 'csv',
      xml: 'xml',
      jpg: 'jpg',
      jpeg: 'jpeg',
      png: 'png',
      svg: 'SVG',
      ai: 'ai',
      tif: 'tif',
    };

    const iconName = iconMap[normalized] || 'default';
    return `assets/media/svg/files/${iconName}.svg`;
  }

  onFlagLoadError(event: Event): void {
    const target = event.target as HTMLImageElement | null;
    if (!target) {
      return;
    }

    target.src = 'assets/media/flags/default.svg';
  }

  onFileIconLoadError(event: Event): void {
    const target = event.target as HTMLImageElement | null;
    if (!target) {
      return;
    }

    target.src = 'assets/media/svg/files/default.svg';
  }

  getPhaseLabel(value: string | null | undefined): string {
    return this.getMappedLabel(value, {
      idea_stage: { en: 'Idea Stage', ar: 'مرحلة الفكرة' },
      validation_stage: { en: 'Validation Stage', ar: 'مرحلة التحقق' },
      growth_stage: { en: 'Growth Stage', ar: 'مرحلة النمو' },
      operating_stage: { en: 'Operating Stage', ar: 'مرحلة التشغيل' },
    });
  }

  getBusinessTypeLabel(value: string | null | undefined): string {
    return this.getMappedLabel(value, {
      entrepreneur: { en: 'Entrepreneur', ar: 'رائد أعمال' },
      startup: { en: 'Startup', ar: 'شركة ناشئة' },
      sme: { en: 'SME', ar: 'منشأة صغيرة أو متوسطة' },
      enterprise: { en: 'Enterprise', ar: 'شركة كبيرة' },
    });
  }

  getDataSourceLabel(value: string | null | undefined): string {
    return this.getMappedLabel(value, {
      primary_data: { en: 'Primary Data', ar: 'بيانات أولية' },
      secondary_data: { en: 'Secondary Data', ar: 'بيانات ثانوية' },
      mixed_data: { en: 'Mixed Data', ar: 'بيانات مختلطة' },
    });
  }

  getWayLabel(value: string | null | undefined): string {
    return this.getMappedLabel(value, {
      physical_workshop: { en: 'Physical Workshop', ar: 'ورشة حضورية' },
      on_platform: { en: 'On Platform', ar: 'على المنصة' },
      online_meeting: { en: 'Online Meeting', ar: 'اجتماع عبر الإنترنت' },
      hybrid: { en: 'Hybrid', ar: 'هجينة' },
    });
  }

  getFormattedValue(value: any): string {
    if (value === null || value === undefined || value === '') {
      return '-';
    }

    if (Array.isArray(value)) {
      return value
        .map(item => this.getFormattedValue(item))
        .filter(item => item !== '-')
        .join(', ') || '-';
    }

    if (typeof value === 'string') {
      return this.humanizeValue(value);
    }

    if (typeof value === 'number' || typeof value === 'boolean') {
      return `${value}`;
    }

    return '-';
  }

  getBlockEntries(block: ProjectOfferBlock | null | undefined): Array<{ key: string; value: any }> {
    if (!block || typeof block !== 'object') {
      return [];
    }

    return Object.entries(block)
      .filter(([_, value]) => value !== null && value !== undefined && value !== '')
      .map(([key, value]) => ({ key, value }));
  }

  getDisplayEntries(block: ProjectOfferBlock | null | undefined): Array<{ label: string; value: string }> {
    return this.getBlockEntries(block)
      .map(({ key, value }) => ({
        label: this.humanizeValue(key),
        value: this.getFormattedValue(value),
      }))
      .filter(entry => entry.value !== '-');
  }

  getDisplayList(values: any[] | null | undefined): string[] {
    if (!Array.isArray(values)) {
      return [];
    }

    return values
      .map(value => this.getFormattedValue(value))
      .filter(value => value !== '-');
  }

  setDrawerTab(tab: DrawerTab, offer: ProjectOffer | null | undefined = this.selectedOffer, syncUrl = true): void {
    if (tab === 'offer' && !this.hasSubmittedOffer(offer)) {
      return;
    }

    this.activeDrawerTab = tab;

    if (syncUrl) {
      this.onDrawerTabChanged(tab);
    }
  }

  getVisibleDrawerTabs(offer: ProjectOffer | null | undefined): DrawerTabOption[] {
    return this.drawerTabOptions.filter(tab => tab.value !== 'offer' || this.hasSubmittedOffer(offer));
  }

  protected getInitialDrawerTab(_: ProjectOffer | null | undefined): DrawerTab {
    return 'overview';
  }

  protected onDrawerTabChanged(_: DrawerTab): void {}

  hasSubmittedOffer(offer: ProjectOffer | null | undefined): boolean {
    return !!offer?.offer;
  }

  getProposalFiles(
    offer: ProjectOffer | null | undefined,
    type: 'general' | 'scopes' | 'offer'
  ): ProjectOfferFile[] {
    const files = offer?.project?.file?.proposal?.[type];
    return Array.isArray(files) ? files : [];
  }

  getAllProposalFiles(offer: ProjectOffer | null | undefined): ProjectOfferFile[] {
    return [
      ...this.getProposalFiles(offer, 'general'),
      ...this.getProposalFiles(offer, 'scopes'),
      ...this.getProposalFiles(offer, 'offer'),
    ];
  }

  getOfferFiles(offer: ProjectOffer | null | undefined): ProjectOfferFile[] {
    const files = offer?.offer?.files;
    return Array.isArray(files) ? files : [];
  }

  getOfferStatusLabel(status: string | null | undefined): string {
    return this.getMappedLabel(status, {
      pending: { en: 'Pending', ar: 'قيد الانتظار' },
      accepted: { en: 'Accepted', ar: 'مقبول' },
      approved: { en: 'Approved', ar: 'موافق عليه' },
      rejected: { en: 'Rejected', ar: 'مرفوض' },
      declined: { en: 'Declined', ar: 'مرفوض' },
      cancelled: { en: 'Cancelled', ar: 'ملغي' },
      not_selected: { en: 'Not Selected', ar: 'غير مختار' },
    });
  }

  getOfferStatusBadgeClass(status: string | null | undefined): string {
    switch ((status || '').toLowerCase()) {
      case 'accepted':
      case 'approved':
      case 'selected':
        return 'badge-light-success';
      case 'rejected':
      case 'declined':
      case 'cancelled':
      case 'not_selected':
        return 'badge-light-danger';
      case 'pending':
      default:
        return 'badge-light-warning';
    }
  }

  isOfferNotSelected(offer: ProjectOffer | null | undefined): boolean {
    return (offer?.offer?.status || '').toLowerCase() === 'not_selected';
  }

  getDiscussionDisabledMessage(): string {
    return this.lang === 'ar'
      ? 'لم يتم اختيار عرضك لهذا المشروع. يمكنك مراجعة المحادثة فقط.'
      : 'Your offer was not selected for this project. You can review the discussion only.';
  }

  formatMoney(value: string | number | null | undefined): string {
    if (value === null || value === undefined || value === '') {
      return '-';
    }

    const numericValue = typeof value === 'number' ? value : Number(value);
    if (Number.isNaN(numericValue)) {
      return `${value}`;
    }

    return numericValue.toLocaleString('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    });
  }

  shouldShowDownPayment(offer: any): boolean {
    const paymentPlan = this.normalizePaymentPlan(offer?.payment_plan);
    if (paymentPlan) return paymentPlan === 'full_at_start' || paymentPlan === 'partial';

    return this.hasPaymentAmount(offer?.down_payment);
  }

  shouldShowFinalPayment(offer: any): boolean {
    const paymentPlan = this.normalizePaymentPlan(offer?.payment_plan);
    if (paymentPlan) return paymentPlan === 'full_at_end' || paymentPlan === 'partial';

    return this.hasPaymentAmount(offer?.final_price ?? offer?.final_payment);
  }

  getDownPaymentAmount(offer: any): string | number | null | undefined {
    return this.normalizePaymentPlan(offer?.payment_plan) === 'full_at_start'
      ? offer?.proposed_price
      : offer?.down_payment;
  }

  getFinalPaymentAmount(offer: any): string | number | null | undefined {
    return this.normalizePaymentPlan(offer?.payment_plan) === 'full_at_end'
      ? offer?.proposed_price
      : (offer?.final_price ?? offer?.final_payment);
  }

  private normalizePaymentPlan(value: unknown): string {
    return String(value || '').trim().toLowerCase();
  }

  private hasPaymentAmount(value: string | number | null | undefined): boolean {
    const numericValue = Number(value ?? 0);
    return Number.isFinite(numericValue) && numericValue > 0;
  }

  formatPercentage(value: string | number | null | undefined): string {
    if (value === null || value === undefined || value === '') {
      return '-';
    }

    const numericValue = typeof value === 'number' ? value : Number(value);
    if (Number.isNaN(numericValue)) {
      return `${value}%`;
    }

    return `${numericValue.toLocaleString('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    })}%`;
  }

  onSendProposal(): void {
    if (!this.selectedOffer) return;

    const offerUuid = this.selectedOffer.uuid;
    if (!offerUuid) {
      this.showError(
        this.lang === 'ar' ? 'تعذر فتح صفحة العرض' : 'Cannot open proposal page',
        this.lang === 'ar' ? 'لم يتم العثور على معرّف العرض.' : 'Offer identifier was not found.'
      );
      return;
    }

    this.router.navigate(['/app/insighter-dashboard/project-offers/send-proposal', offerUuid]);
  }

  hasContractAction(offer: ProjectOffer | null | undefined): boolean {
    return !!this.getContractUuid(offer);
  }

  viewContract(offer: ProjectOffer | null | undefined = this.selectedOffer): void {
    const contractUuid = this.getContractUuid(offer);
    if (!contractUuid) {
      this.showError(
        this.lang === 'ar' ? 'تعذر فتح العقد' : 'Cannot open contract',
        this.lang === 'ar' ? 'لم يتم العثور على معرّف العقد.' : 'Contract identifier was not found.'
      );
      return;
    }

    this.router.navigate(['/app/insighter-dashboard/project-offers/contract', contractUuid]);
  }

  onAskClient(): void {
    if (!this.selectedOffer) return;

    const detailsUuid = this.getProposalDetailsUuid(this.selectedOffer);
    if (!detailsUuid) {
      this.showError(
        this.lang === 'ar' ? 'تعذر فتح النقاش' : 'Cannot open discussion',
        this.lang === 'ar' ? 'لم يتم العثور على معرّف العرض.' : 'Offer identifier was not found.'
      );
      return;
    }

    this.router.navigate(
      ['/app/insighter-dashboard/project-offers/details', detailsUuid],
      { queryParams: { tab: 'discussion' } }
    );
  }

  onInterestOffer(): void {
    if (!this.selectedOffer || this.isInterestingSelectedOffer()) {
      return;
    }

    const offerUuid = this.selectedOffer.uuid;
    const proposalUuid = this.getProposalInterestUuid(this.selectedOffer);

    if (!proposalUuid) {
      this.showError(
        this.lang === 'ar' ? 'تعذر تسجيل الاهتمام' : 'Cannot mark interested',
        this.lang === 'ar' ? 'لم يتم العثور على معرّف المقترح.' : 'Proposal identifier was not found.'
      );
      return;
    }

    this.interestingOfferUuid = offerUuid || proposalUuid;

    this.projectOffersService.markProposalAsInterested(proposalUuid)
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe({
        next: (response: ProjectOfferActionResponse) => {
          const successMessage = response?.message
            || (this.lang === 'ar' ? 'تم تسجيل اهتمامك بنجاح.' : 'Interest registered successfully.');

          this.showSuccess(
            this.lang === 'ar' ? 'تم تسجيل الاهتمام' : 'Interested',
            successMessage
          );

          if (offerUuid) {
            this.updateOfferActionStatus(offerUuid, 'interested');
          }

          this.loadOffers(this.currentPage);
          this.interestingOfferUuid = null;
        },
        error: (err) => {
          this.interestingOfferUuid = null;
          this.handleServerErrors(err);
        },
      });
  }

  onRejectOffer(): void {
    if (!this.selectedOffer?.uuid || this.isRejectingSelectedOffer()) {
      return;
    }

    const offerUuid = this.selectedOffer.uuid;
    this.rejectingOfferUuid = offerUuid;

    this.projectOffersService.declineOffer(offerUuid)
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe({
        next: (response: ProjectOfferActionResponse) => {
          const successMessage = response?.message
            || (this.lang === 'ar' ? 'تم رفض العرض بنجاح.' : 'Offer rejected successfully.');

          this.showSuccess(
            this.lang === 'ar' ? 'تم الرفض' : 'Rejected',
            successMessage
          );

          this.loadOffers(this.currentPage);

          if (this.selectedOffer) {
            this.selectedOffer = {
              ...this.selectedOffer,
              action_status: 'declined',
            };
          }

          this.rejectingOfferUuid = null;
        },
        error: (err) => {
          this.rejectingOfferUuid = null;
          this.handleServerErrors(err);
        },
      });
  }

  // Helpers to extract nested component/addon blocks by key
  getComponent(offer: ProjectOffer | null, key: string): any | null {
    if (!offer) return null;
    const list = offer.project?.components || [];
    for (const item of list) {
      if (item && Object.prototype.hasOwnProperty.call(item, key)) {
        return item[key];
      }
    }
    return null;
  }

  getAddon(offer: ProjectOffer | null, key: string): any | null {
    if (!offer) return null;
    const list = offer.project?.addons || [];
    for (const item of list) {
      if (item && Object.prototype.hasOwnProperty.call(item, key)) {
        return item[key];
      }
    }
    return null;
  }

  hasComponents(offer: ProjectOffer | null): boolean {
    return !!(offer && offer.project?.components?.length);
  }

  getScopeLabel(scope: ProjectOfferScope | null | undefined): string {
    return this.getFormattedValue(scope?.scope);
  }

  getScopeDescription(scope: ProjectOfferScope | null | undefined): string {
    return scope?.description || '';
  }

  getScopeChildren(scope: ProjectOfferScope | null | undefined): ProjectOfferScope[] {
    const children = scope?.children;
    return Array.isArray(children) ? children : [];
  }

  getScopeFiles(scope: ProjectOfferScope | null | undefined): ProjectOfferFile[] {
    const files = scope?.files;
    return Array.isArray(files) ? files : [];
  }

  getRequestFiles(offer: ProjectOffer | null | undefined): ProjectOfferFile[] {
    const files = offer?.project?.request_files;
    return Array.isArray(files) ? files : [];
  }

  getProjectFileName(file: ProjectOfferFile | null | undefined): string {
    const rawName = file?.name || (file?.url || '').split('/').pop()?.split('?')[0];
    return rawName ? decodeURIComponent(rawName) : (this.lang === 'ar' ? 'ملف' : 'File');
  }

  getProjectFileExtension(file: ProjectOfferFile | null | undefined): string {
    const name = this.getProjectFileName(file);
    if (name.includes('.')) return (name.split('.').pop() || '').toLowerCase();

    const urlPath = (file?.url || '').split('?')[0];
    return urlPath.includes('.') ? (urlPath.split('.').pop() || '').toLowerCase() : '';
  }

  openProjectFile(file: ProjectOfferFile | null | undefined): void {
    if (!file?.uuid) {
      this.showError(
        this.lang === 'ar' ? 'تعذر فتح الملف' : 'Cannot open file',
        this.lang === 'ar' ? 'لم يتم العثور على معرّف الملف.' : 'File identifier was not found.'
      );
      return;
    }

    const fileWindow = window.open('', '_blank');
    this.openingFileUuid = file.uuid;

    this.projectOffersService.getProjectFileUrl(file.uuid)
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe({
        next: (url: string) => {
          this.openingFileUuid = null;
          if (!url) {
            if (fileWindow) fileWindow.close();
            this.showError(
              this.lang === 'ar' ? 'تعذر فتح الملف' : 'Cannot open file',
              this.lang === 'ar' ? 'لم يرجع الخادم رابط الملف.' : 'The server did not return a file URL.'
            );
            return;
          }

          if (fileWindow) {
            fileWindow.location.href = url;
          } else {
            window.open(url, '_blank');
          }

          this.markProjectFileAsRead(file);
        },
        error: (err) => {
          this.openingFileUuid = null;
          if (fileWindow) fileWindow.close();
          this.handleServerErrors(err);
        },
      });
  }

  private markProjectFileAsRead(file: ProjectOfferFile): void {
    if (!file.uuid || file.is_read !== false) {
      return;
    }

    this.projectOffersService.markProjectFileAsRead(file.uuid)
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe({
        next: () => {
          file.is_read = true;
          file.read_at = file.read_at ?? new Date().toISOString();
        },
      });
  }

  hasAddons(offer: ProjectOffer | null): boolean {
    return !!(offer && offer.project?.addons?.length);
  }

  canRejectOffer(offer: ProjectOffer | null): boolean {
    if (!offer?.uuid) {
      return false;
    }

    const status = this.getResolvedStatus(offer);
    return ['pending', 'viewed'].includes(status);
  }

  canSendOffer(offer: ProjectOffer | null): boolean {
    if (!offer?.uuid) {
      return false;
    }

    return ['pending', 'viewed', 'interested'].includes(this.getResolvedStatus(offer));
  }

  canInterestOffer(offer: ProjectOffer | null): boolean {
    if (!offer?.uuid) {
      return false;
    }

    return this.getResolvedStatus(offer) === 'pending';
  }

  isRejectingSelectedOffer(): boolean {
    return !!this.selectedOffer?.uuid
      && this.rejectingOfferUuid === this.selectedOffer.uuid;
  }

  isInterestingSelectedOffer(): boolean {
    return !!this.selectedOffer
      && !!this.interestingOfferUuid
      && [this.selectedOffer.uuid, this.selectedOffer.project_proposal_uuid].includes(this.interestingOfferUuid);
  }

  isOpeningFile(file: ProjectOfferFile | null | undefined): boolean {
    return !!file?.uuid && this.openingFileUuid === file.uuid;
  }

  trackByOffer(_: number, offer: ProjectOffer): string {
    return offer.uuid;
  }

  trackByValue(_: number, value: string): string {
    return value;
  }

  trackByDrawerTab(_: number, tab: DrawerTabOption): DrawerTab {
    return tab.value;
  }

  trackByIndex(index: number): number {
    return index;
  }

  trackByScope(index: number, scope: ProjectOfferScope): string {
    return `${scope?.scope || 'scope'}-${index}`;
  }

  trackByFile(_: number, file: ProjectOfferFile): string {
    return file.uuid;
  }

  trackByEntry(_: number, entry: { key?: string; label?: string; value: any }): string {
    return `${entry.key || entry.label}-${JSON.stringify(entry.value)}`;
  }

  private handleServerErrors(error: any): void {
    if (error?.error?.errors) {
      const serverErrors = error.error.errors;
      for (const key in serverErrors) {
        if (Object.prototype.hasOwnProperty.call(serverErrors, key)) {
          const messages = serverErrors[key];
          this.showError(
            this.lang === 'ar' ? 'حدث خطأ' : 'An error occurred',
            messages.join(', ')
          );
        }
      }
    } else {
      this.showError(
        this.lang === 'ar' ? 'حدث خطأ' : 'An error occurred',
        this.lang === 'ar' ? 'حدث خطأ غير متوقع' : 'An unexpected error occurred.'
      );
    }
  }

  private getMappedLabel(
    value: string | null | undefined,
    labels: Record<string, { en: string; ar: string }>
  ): string {
    if (!value) {
      return '-';
    }

    const normalized = value.toLowerCase();
    const match = labels[normalized];

    if (!match) {
      return this.humanizeValue(value);
    }

    return this.lang === 'ar' ? match.ar : match.en;
  }

  private getActiveFilters(): ProjectOffersFilters {
    return {
      action_status: this.selectedActionStatus,
      read_status: this.selectedReadStatus,
    };
  }

  private resetPaginationAndReload(): void {
    this.currentPage = 1;
    this.first = 0;
    this.loadOffers(1);
  }

  private getProposalDetailsUuid(offer: ProjectOffer): string {
    return offer.uuid || offer.project_proposal_uuid || '';
  }

  private getProposalInterestUuid(offer: ProjectOffer): string {
    return offer.uuid || offer.project_proposal_uuid || '';
  }

  private getContractUuid(offer: ProjectOffer | null | undefined): string {
    return offer?.contract_uuid || offer?.project?.contract_uuid || offer?.offer?.contract_uuid || '';
  }

  private mergeOfferDetails(summary: ProjectOffer, details: ProjectOffer): ProjectOffer {
    return {
      ...details,
      uuid: summary.uuid || details.uuid,
      status: details.status ?? summary.status,
      action_status: summary.action_status ?? details.action_status,
      created_at: details.created_at ?? summary.created_at,
      updated_at: details.updated_at ?? summary.updated_at,
      invited_at: details.invited_at ?? summary.invited_at,
      proposal_no: details.proposal_no ?? summary.proposal_no,
      project_proposal_uuid: details.project_proposal_uuid ?? summary.project_proposal_uuid,
      contract_uuid: details.contract_uuid ?? summary.contract_uuid,
      offer: details.offer ?? summary.offer,
      project: {
        ...details.project,
        uuid: details.project?.uuid || summary.project?.uuid,
        is_read: details.project?.is_read ?? summary.project?.is_read,
        read_at: details.project?.read_at ?? summary.project?.read_at,
        created_at: details.project?.created_at ?? summary.project?.created_at,
        updated_at: details.project?.updated_at ?? summary.project?.updated_at,
        file: details.project?.file ?? summary.project?.file,
        contract_uuid: details.project?.contract_uuid ?? summary.project?.contract_uuid ?? details.contract_uuid ?? summary.contract_uuid,
      },
    };
  }

  private markOfferAsViewed(offer: ProjectOffer): void {
    const offerUuid = offer?.uuid;
    const projectUuid = offer?.project?.uuid;

    if (!offerUuid || !projectUuid || !this.isInsighterUnread(offer) || this.markingViewedOfferUuids.has(offerUuid)) {
      return;
    }

    this.markingViewedOfferUuids.add(offerUuid);

    this.projectOffersService.markInsighterProjectAsRead(projectUuid)
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe({
        next: () => {
          this.updateOfferInsighterReadState(offerUuid, true);
        },
        error: () => {
          this.markingViewedOfferUuids.delete(offerUuid);
        },
        complete: () => {
          this.markingViewedOfferUuids.delete(offerUuid);
        },
      });
  }

  private updateOfferInsighterReadState(offerUuid: string, readState: boolean): void {
    this.offers = this.offers.map(offer =>
      offer.uuid === offerUuid
        ? {
          ...offer,
          project: {
            ...offer.project,
            is_read: readState,
            read_at: readState ? (offer.project?.read_at ?? new Date().toISOString()) : null,
          },
        }
        : offer
    );

    if (this.selectedOffer?.uuid === offerUuid) {
      this.selectedOffer = {
        ...this.selectedOffer,
        project: {
          ...this.selectedOffer.project,
          is_read: readState,
          read_at: readState ? (this.selectedOffer.project?.read_at ?? new Date().toISOString()) : null,
        },
      };
    }
  }

  private updateOfferActionStatus(offerUuid: string, actionStatus: ProjectOfferActionStatus): void {
    this.offers = this.offers.map(offer =>
      offer.uuid === offerUuid
        ? {
          ...offer,
          action_status: actionStatus,
          project: {
            ...offer.project,
            is_read: true,
            read_at: offer.project?.read_at ?? new Date().toISOString(),
          },
        }
        : offer
    );

    if (this.selectedOffer?.uuid === offerUuid) {
      this.selectedOffer = {
        ...this.selectedOffer,
        action_status: actionStatus,
        project: {
          ...this.selectedOffer.project,
          is_read: true,
          read_at: this.selectedOffer.project?.read_at ?? new Date().toISOString(),
        },
      };
    }
  }

  private canMarkOfferAsViewed(status: string): boolean {
    return ![
      'viewed',
      'offered',
      'declined',
      'expired',
      'accepted',
      'approved',
      'rejected',
      'cancelled',
      'submitted',
      'closed',
    ].includes(status);
  }

  private getResolvedStatus(offer: ProjectOffer): string {
    return (offer?.action_status || offer?.status || '').toLowerCase();
  }

  private getDisplayStatus(offer: ProjectOffer): string {
    return (offer?.offer?.status || this.getResolvedStatus(offer) || '').toLowerCase();
  }

  private humanizeValue(value: string): string {
    return value
      .replace(/[_-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/\b\w/g, letter => letter.toUpperCase());
  }

  override ngOnDestroy(): void {
    if (this.deadlineTicker) {
      clearInterval(this.deadlineTicker);
      this.deadlineTicker = null;
    }

    super.ngOnDestroy();
  }
}
