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
  ProjectOfferProjectStatus,
  ProjectOffersPaginatedResponse,
  ProjectOffersFilters,
  ProjectOffersService,
  ProjectOfferType,
} from 'src/app/_fake/services/project-offers/project-offers.service';

type ViewMode = 'grid' | 'list';

interface ProjectTypeMeta {
  key: ProjectOfferType;
  labelEn: string;
  labelAr: string;
}

interface StatusFilterOption<T> {
  value: T;
  labelEn: string;
  labelAr: string;
}

interface DropdownOption<T> {
  label: string;
  value: T;
}

@Component({
  selector: 'app-project-offers',
  templateUrl: './project-offers.component.html',
  styleUrl: './project-offers.component.scss'
})
export class ProjectOffersComponent extends BaseComponent implements OnInit, OnDestroy {
  isLoading$: Observable<boolean>;

  offers: ProjectOffer[] = [];
  viewMode: ViewMode = 'grid';
  selectedProjectStatus: ProjectOfferProjectStatus | null = null;
  selectedActionStatus: ProjectOfferActionStatus | null = null;

  currentPage: number = 1;
  rows: number = 10;
  first: number = 0;
  totalRecords: number = 0;

  drawerVisible: boolean = false;
  selectedOffer: ProjectOffer | null = null;
  rejectingOfferUuid: string | null = null;

  projectTypeOptions: ProjectTypeMeta[] = [
    { key: 'ad_hoc', labelEn: 'Ad Hoc', labelAr: 'خاص' },
    { key: 'frame_work_agreement', labelEn: 'Framework Agreement', labelAr: 'اتفاقية إطارية' },
    { key: 'urgent_request', labelEn: 'Urgent Request', labelAr: 'طلب عاجل' },
  ];
  projectStatusOptions: StatusFilterOption<ProjectOfferProjectStatus>[] = [
    { value: 'invited', labelEn: 'Invited', labelAr: 'مدعو' },
    { value: 'cancelled', labelEn: 'Cancelled', labelAr: 'ملغي' },
    { value: 'submitted', labelEn: 'Submitted', labelAr: 'مُرسل' },
    { value: 'closed', labelEn: 'Closed', labelAr: 'مغلق' },
  ];
  actionStatusOptions: StatusFilterOption<ProjectOfferActionStatus>[] = [
    { value: 'pending', labelEn: 'Pending', labelAr: 'قيد الانتظار' },
    { value: 'viewed', labelEn: 'Viewed', labelAr: 'تمت المشاهدة' },
    { value: 'offered', labelEn: 'Offered', labelAr: 'تم تقديم العرض' },
    { value: 'declined', labelEn: 'Declined', labelAr: 'مرفوض' },
    { value: 'expired', labelEn: 'Expired', labelAr: 'منتهي' },
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
    this.loadOffers(1);
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

  onProjectStatusChange(projectStatus: ProjectOfferProjectStatus | null): void {
    this.selectedProjectStatus = projectStatus;
    this.resetPaginationAndReload();
  }

  onActionStatusChange(actionStatus: ProjectOfferActionStatus | null): void {
    this.selectedActionStatus = actionStatus;
    this.resetPaginationAndReload();
  }

  setViewMode(mode: ViewMode): void {
    this.viewMode = mode;
  }

  openDrawer(offer: ProjectOffer): void {
    this.selectedOffer = offer;
    this.drawerVisible = true;
  }

  closeDrawer(): void {
    this.drawerVisible = false;
    this.selectedOffer = null;
  }

  getTypeMeta(key: ProjectOfferType): ProjectTypeMeta | undefined {
    return this.projectTypeOptions.find(o => o.key === key);
  }

  getStatusBadgeClass(offer: ProjectOffer): string {
    const status = this.getResolvedStatus(offer);
    switch (status) {
      case 'pending':
      case 'invited':
      case 'viewed':
        return 'badge-light-warning';
      case 'accepted':
      case 'approved':
      case 'offered':
        return 'badge-light-success';
      case 'rejected':
      case 'declined':
      case 'cancelled':
      case 'expired':
        return 'badge-light-danger';
      case 'submitted':
      case 'closed':
        return 'badge-light-primary';
      default:
        return 'badge-light-info';
    }
  }

  getStatusLabel(offer: ProjectOffer): string {
    const status = this.getResolvedStatus(offer);
    const labels: { [k: string]: { en: string; ar: string } } = {
      pending: { en: 'Pending', ar: 'قيد الانتظار' },
      invited: { en: 'Invited', ar: 'مدعو' },
      viewed: { en: 'Viewed', ar: 'تمت المشاهدة' },
      offered: { en: 'Offered', ar: 'تم تقديم العرض' },
      accepted: { en: 'Accepted', ar: 'مقبول' },
      approved: { en: 'Approved', ar: 'موافق' },
      rejected: { en: 'Rejected', ar: 'مرفوض' },
      declined: { en: 'Declined', ar: 'مرفوض' },
      cancelled: { en: 'Cancelled', ar: 'ملغي' },
      submitted: { en: 'Submitted', ar: 'مُرسل' },
      closed: { en: 'Closed', ar: 'مغلق' },
      expired: { en: 'Expired', ar: 'منتهي' },
    };
    const match = labels[status];
    if (!match) return status || '-';
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
      return d.toLocaleDateString(this.lang === 'ar' ? 'ar-EG' : 'en-US', {
        year: 'numeric', month: 'short', day: 'numeric'
      });
    } catch {
      return value;
    }
  }

  getSummary(offer: ProjectOffer): string {
    return offer.project?.service_prompt || offer.project?.description || '-';
  }

  getDeadlineLabel(offer: ProjectOffer): string {
    const date = offer.project?.deadline_offer || offer.project?.deadline;
    return this.formatDate(date);
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

  get projectStatusDropdownOptions(): DropdownOption<ProjectOfferProjectStatus>[] {
    return this.projectStatusOptions.map(option => ({
      label: this.lang === 'ar' ? option.labelAr : option.labelEn,
      value: option.value,
    }));
  }

  get actionStatusDropdownOptions(): DropdownOption<ProjectOfferActionStatus>[] {
    return this.actionStatusOptions.map(option => ({
      label: this.lang === 'ar' ? option.labelAr : option.labelEn,
      value: option.value,
    }));
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

  onAskClient(): void {
    if (!this.selectedOffer) return;
    this.showInfo(
      this.lang === 'ar' ? 'سؤال العميل' : 'Ask Client',
      this.lang === 'ar' ? 'سيتم فتح نافذة المحادثة.' : 'Conversation will open shortly.'
    );
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

  hasAddons(offer: ProjectOffer | null): boolean {
    return !!(offer && offer.project?.addons?.length);
  }

  canRejectOffer(offer: ProjectOffer | null): boolean {
    if (!offer?.uuid) {
      return false;
    }

    const status = this.getResolvedStatus(offer);
    return ['pending', 'viewed', 'offered'].includes(status);
  }

  isRejectingSelectedOffer(): boolean {
    return !!this.selectedOffer?.uuid
      && this.rejectingOfferUuid === this.selectedOffer.uuid;
  }

  trackByOffer(_: number, offer: ProjectOffer): string {
    return offer.uuid;
  }

  trackByValue(_: number, value: string): string {
    return value;
  }

  trackByIndex(index: number): number {
    return index;
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
      project_status: this.selectedProjectStatus,
      action_status: this.selectedActionStatus,
    };
  }

  private resetPaginationAndReload(): void {
    this.currentPage = 1;
    this.first = 0;
    this.loadOffers(1);
  }

  private getResolvedStatus(offer: ProjectOffer): string {
    return (offer?.action_status || offer?.status || '').toLowerCase();
  }

  private humanizeValue(value: string): string {
    return value
      .replace(/[_-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/\b\w/g, letter => letter.toUpperCase());
  }

  override ngOnDestroy(): void {
    super.ngOnDestroy();
  }
}
