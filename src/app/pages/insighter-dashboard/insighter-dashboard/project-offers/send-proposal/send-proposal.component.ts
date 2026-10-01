import { Component, Injector, OnDestroy, OnInit, QueryList, ViewChildren } from '@angular/core';
import { NgModel } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntil } from 'rxjs/operators';
import { BaseComponent } from 'src/app/modules/base.component';
import {
  InsighterProjectAccountSettings,
  ProjectOffer,
  ProjectOfferFile,
  ProjectOfferScope,
  ProjectOffersService,
} from 'src/app/_fake/services/project-offers/project-offers.service';
import {
  InstallmentDueType,
  ProjectDeliverable,
  ProjectPaymentPlan,
  ProjectPriceType,
  addDaysToDate,
  deliverableWayLabel,
  dueTypeLabel,
  periodDaysLabel,
  priceTypeLabel,
  scheduleBaseDate,
} from 'src/app/_fake/services/project-phase2/project-phase2.model';

const HOURS_PER_DAY = 8;

export interface InstallmentDraft {
  key: number;
  title: string;
  percentage: number | null;
  due_type: InstallmentDueType;
  period_days: number | null;
  project_service_deliverable_id: number | null;
}

@Component({
  selector: 'app-send-proposal',
  templateUrl: './send-proposal.component.html',
  styleUrl: './send-proposal.component.scss'
})
export class SendProposalComponent extends BaseComponent implements OnInit, OnDestroy {
  @ViewChildren(NgModel) private formModels!: QueryList<NgModel>;

  proposal: ProjectOffer | null = null;

  /** Route param — project UUID used to load details from /insighter/project/show. */
  proposalUuid: string | null = null;
  hourlyRate: number | null = null;
  isLoading: boolean = false;
  isSubmitting: boolean = false;

  // Project details drawer state
  detailsDrawerVisible: boolean = false;
  openingFileUuid: string | null = null;

  // Form state
  priceType: ProjectPriceType = 'hourly';
  estimatedHours: number | null = null;
  dailyRate: number | null = null;
  estimatedDays: number | null = null;
  fixedPrice: number | null = null;
  coverLetter: string = '';
  selectedAttachments: File[] = [];
  paymentPlan: ProjectPaymentPlan = 'partial';
  installments: InstallmentDraft[] = [];
  /** Set once the insighter edits the plan, so project data no longer reseeds it. */
  private installmentsTouched = false;
  private installmentKey = 0;
  private submitAttempted = false;

  get showInstallmentErrors(): boolean {
    return this.submitAttempted || this.installmentsTouched;
  }

  get priceTypeLabel(): string {
    return priceTypeLabel(this.priceType, this.lang);
  }

  readonly hoursPerDay = HOURS_PER_DAY;

  private projectTypeOptions = [
    { key: 'ad_hoc', labelEn: 'Ad Hoc', labelAr: 'خاص' },
    { key: 'frame_work_agreement', labelEn: 'Framework Agreement', labelAr: 'اتفاقية إطارية' },
    { key: 'urgent_request', labelEn: 'Urgent Request', labelAr: 'طلب عاجل' },
  ];

  constructor(
    injector: Injector,
    private route: ActivatedRoute,
    private router: Router,
    private projectOffersService: ProjectOffersService,
  ) {
    super(injector);
  }

  ngOnInit(): void {
    this.projectOffersService.isLoading$
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe(loading => this.isLoading = loading);

    this.route.paramMap
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe(params => {
        const uuid = params.get('uuid');
        if (uuid) {
          this.proposalUuid = uuid;
          this.loadAll(uuid);
        }
      });
  }

  goBack(): void {
    this.router.navigate(['/app/insighter-dashboard/project-offers']);
  }

  openDetailsDrawer(): void {
    this.detailsDrawerVisible = true;
  }

  closeDetailsDrawer(): void {
    this.detailsDrawerVisible = false;
  }

  /** Public alias for the humanize helper, used by the drawer template. */
  humanize(value: string | null | undefined): string {
    if (!value) return '';
    return this.humanizeValue(value);
  }

  onAttachmentsSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = input.files ? Array.from(input.files) : [];
    if (!files.length) return;

    this.selectedAttachments = [...this.selectedAttachments, ...files];
    input.value = '';
  }

  removeAttachment(index: number): void {
    this.selectedAttachments = this.selectedAttachments.filter((_, i) => i !== index);
  }

  // ---------- Pricing ----------

  setPriceType(type: ProjectPriceType): void {
    if (this.priceType === type) return;
    this.priceType = type;
    if (type === 'daily' && !this.dailyRate && this.hourlyRate) {
      this.dailyRate = Number(this.hourlyRate) * HOURS_PER_DAY;
    }
  }

  /** Offer total — what the backend stores as `proposed_price`. */
  get totalPrice(): number {
    const value = (() => {
      switch (this.priceType) {
        case 'daily': return (Number(this.dailyRate) || 0) * (Number(this.estimatedDays) || 0);
        case 'fixed': return Number(this.fixedPrice) || 0;
        default: return (Number(this.hourlyRate) || 0) * (Number(this.estimatedHours) || 0);
      }
    })();
    return isFinite(value) && value > 0 ? Number(value.toFixed(2)) : 0;
  }

  // ---------- Project schedule ----------

  get deliverables(): ProjectDeliverable[] {
    return this.proposal?.project?.deliverables ?? [];
  }

  get lastDeliverable(): ProjectDeliverable | null {
    const list = this.deliverables;
    return list.length ? list[list.length - 1] : null;
  }

  get plannedStartDate(): string | null {
    const schedule = this.proposal?.project?.schedule;
    return schedule ? scheduleBaseDate(schedule) : null;
  }

  get durationDays(): number | null {
    return this.proposal?.project?.schedule?.duration_days ?? null;
  }

  get plannedCloseDate(): string | null {
    return this.proposal?.project?.schedule?.planned_close_date ?? null;
  }

  dateForDays(days: number | null | undefined): string | null {
    if (days === null || days === undefined || !this.plannedStartDate) return null;
    return addDaysToDate(this.plannedStartDate, days);
  }

  periodLabel(days: number | null | undefined): string {
    return periodDaysLabel(days, this.lang);
  }

  wayLabel(way: string | null | undefined): string {
    return deliverableWayLabel(way, this.lang);
  }

  dueTypeLabel(type: string | null | undefined): string {
    return dueTypeLabel(type, this.lang);
  }

  // ---------- Payment plan & installments ----------

  readonly dueTypes: InstallmentDueType[] = ['contract', 'date', 'deliverable'];

  setPaymentPlan(plan: ProjectPaymentPlan): void {
    if (this.paymentPlan === plan) return;
    this.paymentPlan = plan;
    this.installmentsTouched = true;
    this.installments = plan === 'full' ? [this.defaultFullInstallment()] : this.defaultPartialInstallments();
  }

  addInstallment(): void {
    this.installmentsTouched = true;
    const used = this.installmentsPercentTotal;
    const lastDay = this.durationDays ?? (this.lastDeliverable?.period_days ?? 0);
    this.installments = [
      ...this.installments,
      this.createInstallment({
        title: this.lang === 'ar' ? `دفعة ${this.installments.length + 1}` : `Payment ${this.installments.length + 1}`,
        percentage: Math.max(0, 100 - used) || null,
        due_type: 'date',
        period_days: lastDay,
      }),
    ];
  }

  removeInstallment(key: number): void {
    if (this.installments.length <= 2) return;
    this.installmentsTouched = true;
    this.installments = this.installments.filter(item => item.key !== key);
  }

  onInstallmentChanged(item: InstallmentDraft): void {
    this.installmentsTouched = true;
    if (item.due_type === 'date' && (item.period_days === null || item.period_days === undefined)) {
      item.period_days = 0;
    }
    if (item.due_type === 'deliverable' && !item.project_service_deliverable_id) {
      item.project_service_deliverable_id = this.lastDeliverable?.id ?? null;
    }
  }

  canChooseContract(item: InstallmentDraft): boolean {
    return item.due_type === 'contract'
      || !this.installments.some(other => other.key !== item.key && other.due_type === 'contract');
  }

  get installmentsPercentTotal(): number {
    const total = this.installments.reduce((sum, item) => sum + (Number(item.percentage) || 0), 0);
    return Number(total.toFixed(4));
  }

  installmentAmount(item: InstallmentDraft): number {
    return Number(((this.totalPrice * (Number(item.percentage) || 0)) / 100).toFixed(2));
  }

  /** Planned date of an installment, for display (contract = signing date, unknown in advance). */
  installmentDate(item: InstallmentDraft): string | null {
    if (item.due_type === 'date') return this.dateForDays(item.period_days);
    if (item.due_type === 'deliverable') {
      const deliverable = this.deliverables.find(d => d.id === item.project_service_deliverable_id);
      return deliverable?.date ?? this.dateForDays(deliverable?.period_days);
    }
    return null;
  }

  trackByInstallment(_: number, item: InstallmentDraft): number { return item.key; }
  trackByDeliverable(_: number, item: ProjectDeliverable): number { return item.id; }

  getInstallmentErrors(item: InstallmentDraft): string[] {
    const errors: string[] = [];
    const ar = this.lang === 'ar';
    if (!(item.title || '').trim()) errors.push(ar ? 'عنوان الدفعة مطلوب.' : 'Give the payment a title.');
    const pct = Number(item.percentage);
    if (!isFinite(pct) || pct < 1 || pct > 100) errors.push(ar ? 'النسبة بين 1 و100.' : 'Percentage must be between 1 and 100.');
    if (item.due_type === 'date' && !(Number(item.period_days) >= 0 && Number.isInteger(Number(item.period_days)))) {
      errors.push(ar ? 'حدد عدد الأيام من بدء المشروع.' : 'Enter the number of days from the project start.');
    }
    if (item.due_type === 'deliverable' && !item.project_service_deliverable_id) {
      errors.push(ar ? 'اختر المخرج المرتبط.' : 'Pick the linked deliverable.');
    }
    return errors;
  }

  getPaymentPlanError(): string | null {
    const ar = this.lang === 'ar';
    if (this.paymentPlan === 'full' && this.installments.length !== 1) {
      return ar ? 'الدفع الكامل يكون دفعة واحدة.' : 'A full payment is a single installment.';
    }
    if (this.paymentPlan === 'partial' && this.installments.length < 2) {
      return ar ? 'أضف دفعتين على الأقل.' : 'Add at least two installments.';
    }
    if (this.installmentsPercentTotal !== 100) {
      return ar
        ? `يجب أن يكون مجموع النسب 100% (الحالي ${this.installmentsPercentTotal}%).`
        : `Percentages must add up to 100% (currently ${this.installmentsPercentTotal}%).`;
    }
    if (this.installments.filter(item => item.due_type === 'contract').length > 1) {
      return ar ? 'يمكن ربط دفعة واحدة فقط بتوقيع العقد.' : 'Only one installment can be due on contract signing.';
    }
    return null;
  }

  private createInstallment(partial: Partial<InstallmentDraft>): InstallmentDraft {
    this.installmentKey += 1;
    return {
      key: this.installmentKey,
      title: '',
      percentage: null,
      due_type: 'date',
      period_days: 0,
      project_service_deliverable_id: null,
      ...partial,
    };
  }

  private defaultFullInstallment(): InstallmentDraft {
    return this.createInstallment({
      title: this.lang === 'ar' ? 'الدفعة الكاملة' : 'Full payment',
      percentage: 100,
      due_type: 'contract',
      period_days: 0,
    });
  }

  private defaultPartialInstallments(): InstallmentDraft[] {
    const lastDeliverable = this.lastDeliverable ?? null;
    return [
      this.createInstallment({
        title: this.lang === 'ar' ? 'دفعة توقيع العقد' : 'Contract payment',
        percentage: 30,
        due_type: 'contract',
        period_days: 0,
      }),
      this.createInstallment({
        title: this.lang === 'ar' ? 'الدفعة الأخيرة' : 'Final payment',
        percentage: 70,
        due_type: lastDeliverable ? 'deliverable' : 'date',
        period_days: lastDeliverable ? lastDeliverable.period_days : (this.durationDays ?? 0),
        project_service_deliverable_id: lastDeliverable?.id ?? null,
      }),
    ];
  }

  submitProposal(): void {
    if (this.isSubmitting) return;
    if (!this.proposalUuid || this.isProposalFormInvalid()) {
      this.markRequiredFieldsTouchedAndDirty();
      return;
    }

    // The add-offer endpoint expects the proposal-match UUID from the loaded details.
    const matchUuid = this.proposal?.match_uuid;
    if (!matchUuid) {
      this.showError(
        this.lang === 'ar' ? 'تعذر إرسال العرض' : 'Cannot submit offer',
        this.lang === 'ar' ? 'لم يتم العثور على معرّف المقترح.' : 'Proposal identifier was not found.'
      );
      return;
    }

    this.isSubmitting = true;
    const payload = this.buildProposalFormData();

    this.projectOffersService.submitProposalOffer(matchUuid, payload)
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe({
        next: (res) => {
          this.isSubmitting = false;
          this.showSuccess(
            this.lang === 'ar' ? 'تم الإرسال' : 'Submitted',
            res?.message || (this.lang === 'ar' ? 'تم إرسال عرضك بنجاح.' : 'Your proposal has been sent successfully.')
          );
          this.router.navigate(['/app/insighter-dashboard/project-offers']);
        },
        error: (err) => {
          this.isSubmitting = false;
          this.handleServerErrors(err);
        },
      });
  }

  // ---------- Display helpers (mirror project-detail patterns) ----------

  getTypeLabel(type: string | null | undefined): string {
    if (!type) return '-';
    const meta = this.projectTypeOptions.find(o => o.key === type);
    if (!meta) return this.humanizeValue(type);
    return this.lang === 'ar' ? meta.labelAr : meta.labelEn;
  }

  getStatusBadgeClass(status: string | null | undefined): string {
    switch ((status || '').toLowerCase()) {
      case 'invited': return 'badge-light-primary';
      case 'submitted': return 'badge-light-primary';
      case 'closed': return 'badge-light-success';
      case 'cancelled': return 'badge-light-danger';
      case 'expired': return 'badge-light-danger';
      default: return 'badge-light-info';
    }
  }

  getStatusLabel(status: string | null | undefined): string {
    const labels: Record<string, { en: string; ar: string }> = {
      invited: { en: 'Invited', ar: 'مدعو' },
      submitted: { en: 'Submitted', ar: 'مُرسل' },
      closed: { en: 'Closed', ar: 'مغلق' },
      cancelled: { en: 'Cancelled', ar: 'ملغي' },
      expired: { en: 'Expired', ar: 'منتهي' },
    };
    const key = (status || '').toLowerCase();
    const match = labels[key];
    if (!match) return status || '-';
    return this.lang === 'ar' ? match.ar : match.en;
  }

  getLanguageLabel(value: string | null | undefined): string {
    if (!value) return '-';
    const labels: Record<string, { en: string; ar: string }> = {
      arabic: { en: 'Arabic', ar: 'العربية' },
      english: { en: 'English', ar: 'الإنجليزية' },
    };
    const match = labels[value.toLowerCase()];
    return match ? (this.lang === 'ar' ? match.ar : match.en) : this.humanizeValue(value);
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

  getCountryFlagPath(flag: string | null | undefined): string {
    return flag ? `assets/media/flags/${flag}.svg` : 'assets/media/flags/default.svg';
  }

  getFileTypeIconPath(extension: string | null | undefined): string {
    if (!extension) return 'assets/media/svg/files/default.svg';
    const iconMap: Record<string, string> = {
      pdf: 'pdf', doc: 'doc', docx: 'docx',
      ppt: 'ppt', pptx: 'ppt', csv: 'csv',
      xml: 'xml', xlsx: 'csv',
    };
    return `assets/media/svg/files/${iconMap[extension.toLowerCase()] || 'default'}.svg`;
  }

  onFlagLoadError(event: Event): void {
    const t = event.target as HTMLImageElement | null;
    if (t) t.src = 'assets/media/flags/default.svg';
  }

  onFileIconLoadError(event: Event): void {
    const t = event.target as HTMLImageElement | null;
    if (t) t.src = 'assets/media/svg/files/default.svg';
  }

  getFormattedValue(value: any): string {
    if (value === null || value === undefined || value === '') return '-';
    if (Array.isArray(value)) {
      return value.map(v => this.getFormattedValue(v)).filter(v => v !== '-').join(', ') || '-';
    }
    if (typeof value === 'string') return this.humanizeValue(value);
    if (typeof value === 'number' || typeof value === 'boolean') return `${value}`;
    return '-';
  }

  trackByValue(_: number, value: string): string { return value; }
  trackByIndex(index: number): number { return index; }
  trackByScope(index: number, scope: ProjectOfferScope): string {
    return `${scope?.scope || 'scope'}-${index}`;
  }
  trackByFile(_: number, file: ProjectOfferFile): string { return file.uuid; }

  /** Find a component block by key inside the loaded proposal's project. */
  getComponent(key: string): any | null {
    if (!this.proposal) return null;
    for (const item of this.proposal.project?.components || []) {
      if (item && Object.prototype.hasOwnProperty.call(item, key)) return item[key];
    }
    return null;
  }

  /** Find an addon block by key inside the loaded proposal's project. */
  getAddon(key: string): any | null {
    if (!this.proposal) return null;
    for (const item of this.proposal.project?.addons || []) {
      if (item && Object.prototype.hasOwnProperty.call(item, key)) return item[key];
    }
    return null;
  }

  hasAddons(): boolean {
    return !!(this.proposal?.project?.addons?.length);
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

  getRequestFiles(): ProjectOfferFile[] {
    const files = this.proposal?.project?.request_files;
    return Array.isArray(files) ? files : [];
  }

  getProjectFileName(file: ProjectOfferFile | null | undefined): string {
    const rawName = (file?.url || '').split('/').pop()?.split('?')[0];
    return rawName ? decodeURIComponent(rawName) : (this.lang === 'ar' ? 'ملف' : 'File');
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

  isOpeningFile(file: ProjectOfferFile | null | undefined): boolean {
    return !!file?.uuid && this.openingFileUuid === file.uuid;
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

  formatPrice(value: number | null | undefined): string {
    const n = Number(value ?? 0);
    if (!isFinite(n)) return '$0.00';
    return n.toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD',
    });
  }

  getBackIcon(): string {
    return this.lang === 'ar' ? 'ki-arrow-right' : 'ki-arrow-left';
  }

  formatFileSize(file: File): string {
    if (!file?.size) return '0 KB';
    const sizeInKb = file.size / 1024;
    if (sizeInKb < 1024) return `${sizeInKb.toFixed(sizeInKb >= 10 ? 0 : 1)} KB`;
    return `${(sizeInKb / 1024).toFixed(1)} MB`;
  }

  isCoverLetterInvalid(): boolean {
    return !(this.coverLetter || '').trim();
  }

  isEstimatedHoursInvalid(): boolean {
    return this.priceType === 'hourly' && !(Number(this.estimatedHours) >= 1);
  }

  isHourlyRateInvalid(): boolean {
    return this.priceType === 'hourly' && !(Number(this.hourlyRate) > 0);
  }

  isEstimatedDaysInvalid(): boolean {
    return this.priceType === 'daily' && !(Number(this.estimatedDays) >= 1);
  }

  isDailyRateInvalid(): boolean {
    return this.priceType === 'daily' && !(Number(this.dailyRate) > 0);
  }

  isFixedPriceInvalid(): boolean {
    return this.priceType === 'fixed' && !(Number(this.fixedPrice) > 0);
  }

  isPricingInvalid(): boolean {
    return this.isEstimatedHoursInvalid()
      || this.isHourlyRateInvalid()
      || this.isEstimatedDaysInvalid()
      || this.isDailyRateInvalid()
      || this.isFixedPriceInvalid();
  }

  isPaymentPlanInvalid(): boolean {
    return !!this.getPaymentPlanError()
      || this.installments.some(item => this.getInstallmentErrors(item).length > 0);
  }

  shouldShowFieldError(model: NgModel | null | undefined, invalidByValue: boolean = false): boolean {
    return !!(
      (model?.touched || model?.dirty)
      && (model?.invalid || invalidByValue)
    );
  }

  // ---------- Internals ----------

  private buildProposalFormData(): FormData {
    const formData = new FormData();
    formData.append('price_type', this.priceType);

    if (this.priceType === 'hourly') {
      formData.append('hourly_rate', `${Number(this.hourlyRate)}`);
      formData.append('estimated_hours', `${Math.round(Number(this.estimatedHours))}`);
    } else if (this.priceType === 'daily') {
      formData.append('daily_rate', `${Number(this.dailyRate)}`);
      formData.append('estimated_days', `${Math.round(Number(this.estimatedDays))}`);
    } else {
      formData.append('fixed_price', `${Number(this.fixedPrice)}`);
    }

    formData.append('payment_plan', this.paymentPlan);
    this.installments.forEach((item, index) => {
      const prefix = `installments[${index}]`;
      formData.append(`${prefix}[title]`, item.title.trim());
      formData.append(`${prefix}[percentage]`, `${Number(item.percentage)}`);
      formData.append(`${prefix}[due_type]`, item.due_type);
      if (item.due_type === 'date') {
        formData.append(`${prefix}[period_days]`, `${Math.max(0, Math.round(Number(item.period_days) || 0))}`);
      }
      if (item.due_type === 'deliverable' && item.project_service_deliverable_id) {
        formData.append(`${prefix}[project_service_deliverable_id]`, `${item.project_service_deliverable_id}`);
      }
    });

    formData.append('cover_letter', (this.coverLetter || '').trim());

    this.selectedAttachments.forEach((file, index) => {
      formData.append(`files[${index}]`, file, file.name);
    });

    return formData;
  }

  private isProposalFormInvalid(): boolean {
    return this.isCoverLetterInvalid()
      || this.isPricingInvalid()
      || this.isPaymentPlanInvalid();
  }

  private markRequiredFieldsTouchedAndDirty(): void {
    this.submitAttempted = true;
    this.formModels?.forEach(model => {
      model.control.markAsTouched();
      model.control.markAsDirty();
      model.control.updateValueAndValidity();
    });
    setTimeout(() => this.scrollToFirstInvalidField(), 0);
  }

  private scrollToFirstInvalidField(): void {
    const firstInvalid = document.querySelector<HTMLElement>(
      '.sp-input.is-invalid, .sp-input-group.is-invalid, .sp-installments__total.is-invalid'
    );
    firstInvalid?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  private loadAll(uuid: string): void {
    this.projectOffersService.getProposalDetails(uuid)
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe({
        next: (proposal) => {
          this.proposal = proposal;
          if (!this.installmentsTouched) {
            this.installments = this.paymentPlan === 'full'
              ? [this.defaultFullInstallment()]
              : this.defaultPartialInstallments();
          }
        },
        error: (err) => this.handleServerErrors(err),
      });

    this.loadDefaultHourlyRate();
  }

  private loadDefaultHourlyRate(): void {
    this.projectOffersService.getAccountSettings()
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe({
        next: (settings) => {
          const rate = this.getHourlyRateFromSettings(settings);
          if (rate !== null && (this.hourlyRate === null || this.hourlyRate === undefined)) {
            this.hourlyRate = rate;
          }
        },
        error: () => undefined,
      });
  }

  private getHourlyRateFromSettings(settings: InsighterProjectAccountSettings | null | undefined): number | null {
    const rate = Number(settings?.hourly_rate);
    return isFinite(rate) && rate > 0 ? rate : null;
  }

  private humanizeValue(value: string): string {
    return value.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim()
      .replace(/\b\w/g, l => l.toUpperCase());
  }

  private getMappedLabel(
    value: string | null | undefined,
    labels: Record<string, { en: string; ar: string }>
  ): string {
    if (!value) return '-';
    const match = labels[value.toLowerCase()] ?? labels[value];
    if (!match) return this.humanizeValue(value);
    return this.lang === 'ar' ? match.ar : match.en;
  }

  private handleServerErrors(error: any): void {
    if (error?.error?.errors) {
      const serverErrors = error.error.errors;
      for (const key in serverErrors) {
        if (Object.prototype.hasOwnProperty.call(serverErrors, key)) {
          this.showError(
            this.lang === 'ar' ? 'حدث خطأ' : 'An error occurred',
            serverErrors[key].join(', ')
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

  override ngOnDestroy(): void {
    super.ngOnDestroy();
  }
}
