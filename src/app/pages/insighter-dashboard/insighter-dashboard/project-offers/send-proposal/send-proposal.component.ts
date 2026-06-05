import { Component, Injector, OnDestroy, OnInit, QueryList, ViewChildren } from '@angular/core';
import { NgModel } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntil } from 'rxjs/operators';
import { BaseComponent } from 'src/app/modules/base.component';
import {
  ProjectOffer,
  ProjectOfferFile,
  ProjectOfferScope,
  ProjectOffersService,
  ProposalEstimateUnit,
} from 'src/app/_fake/services/project-offers/project-offers.service';

const HOURS_PER_DAY = 8;
type PaymentPlan = 'partial' | 'full_at_start' | 'full_at_end';

@Component({
  selector: 'app-send-proposal',
  templateUrl: './send-proposal.component.html',
  styleUrl: './send-proposal.component.scss'
})
export class SendProposalComponent extends BaseComponent implements OnInit, OnDestroy {
  @ViewChildren(NgModel) private formModels!: QueryList<NgModel>;

  proposal: ProjectOffer | null = null;

  proposalUuid: string | null = null;
  hourlyRate: number | null = null;
  isLoading: boolean = false;
  isSubmitting: boolean = false;

  // Project details drawer state
  detailsDrawerVisible: boolean = false;
  openingFileUuid: string | null = null;

  // Form state
  estimateUnit: ProposalEstimateUnit = 'hours';
  estimateAmount: number | null = null;
  coverLetter: string = '';
  selectedAttachments: File[] = [];
  firstPaymentPercentage: number | null = 30;
  finalPaymentPercentage: number | null = 70;

  get paymentPlan(): PaymentPlan {
    const first = Number(this.firstPaymentPercentage);
    const final = Number(this.finalPaymentPercentage);
    if (first === 0 && final === 100) return 'full_at_end';
    if (first === 100 && final === 0) return 'full_at_start';
    return 'partial';
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

  setEstimateUnit(unit: ProposalEstimateUnit): void {
    if (this.estimateUnit === unit) return;
    this.estimateUnit = unit;
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

  /** Total estimated working hours (what we send to the API). */
  get totalHours(): number {
    const amt = Number(this.estimateAmount ?? 0);
    if (!isFinite(amt) || amt <= 0) return 0;
    return this.estimateUnit === 'days' ? amt * HOURS_PER_DAY : amt;
  }

  /** Auto-suggested price from hours × hourly rate (used when user hasn't edited). */
  get suggestedPrice(): number {
    return this.totalHours * (Number(this.hourlyRate) || 0);
  }

  get paymentSplitTotal(): number {
    const first = Number(this.firstPaymentPercentage);
    const final = Number(this.finalPaymentPercentage);
    if (!isFinite(first) || !isFinite(final)) return 0;
    return Number((first + final).toFixed(2));
  }

  get downPaymentPercentageForPayload(): number {
    return Number(this.firstPaymentPercentage);
  }

  get finalPaymentPercentageForPayload(): number {
    return Number(this.finalPaymentPercentage);
  }

  submitProposal(): void {
    if (this.isSubmitting) return;
    if (!this.proposalUuid || this.isProposalFormInvalid()) {
      this.markRequiredFieldsTouchedAndDirty();
      return;
    }

    this.isSubmitting = true;
    const payload = this.buildProposalFormData();

    this.projectOffersService.submitProposalOffer(this.proposalUuid, payload)
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

  isEstimateAmountInvalid(): boolean {
    return !this.estimateAmount || this.estimateAmount <= 0;
  }

  isHourlyRateInvalid(): boolean {
    return !this.hourlyRate || this.hourlyRate <= 0;
  }

  shouldShowFieldError(model: NgModel | null | undefined, invalidByValue: boolean = false): boolean {
    return !!(
      (model?.touched || model?.dirty)
      && (model?.invalid || invalidByValue)
    );
  }

  shouldShowPaymentSplitError(...models: Array<NgModel | null | undefined>): boolean {
    const hasInteracted = models.some(model => !!(model?.touched || model?.dirty));
    return hasInteracted && this.isPaymentSplitInvalid();
  }

  getPaymentSplitErrorMessage(): string {
    const first = Number(this.firstPaymentPercentage);
    const final = Number(this.finalPaymentPercentage);

    if (first === 0 && final !== 100) {
      return this.lang === 'ar'
        ? 'عند جعل الدفعة المقدمة 0% يجب أن تكون الدفعة الأخيرة 100%.'
        : 'When down payment is 0%, final payment must be 100%.';
    }

    if (final === 0 && first !== 100) {
      return this.lang === 'ar'
        ? 'عند جعل الدفعة الأخيرة 0% يجب أن تكون الدفعة المقدمة 100%.'
        : 'When final payment is 0%, down payment must be 100%.';
    }

    return this.lang === 'ar'
      ? 'يجب أن تكون كل نسبة بين 0 و100 وأن يكون المجموع 100%.'
      : 'Each percentage must be between 0 and 100, and the total must be 100%.';
  }

  // ---------- Internals ----------

  private buildProposalFormData(): FormData {
    const formData = new FormData();
    formData.append('hourly_rate', `${Number(this.hourlyRate)}`);
    formData.append('estimated_hours', `${this.totalHours}`);
    formData.append('cover_letter', (this.coverLetter || '').trim());
    formData.append('payment_plan', this.paymentPlan);

    if (this.paymentPlan === 'partial') {
      formData.append('down_payment_percentage', `${this.downPaymentPercentageForPayload}`);
      formData.append('final_payment_percentage', `${this.finalPaymentPercentageForPayload}`);
    }


    this.selectedAttachments.forEach((file, index) => {
      formData.append(`files[${index}]`, file, file.name);
    });

    return formData;
  }

  private isPaymentSplitInvalid(): boolean {
    if (!this.isValidPercentage(this.firstPaymentPercentage)
      || !this.isValidPercentage(this.finalPaymentPercentage)) {
      return true;
    }

    const first = Number(this.firstPaymentPercentage);
    const final = Number(this.finalPaymentPercentage);

    if (first === 0) return final !== 100;
    if (final === 0) return first !== 100;

    return this.paymentSplitTotal !== 100;
  }

  private isProposalFormInvalid(): boolean {
    return this.isCoverLetterInvalid()
      || this.isEstimateAmountInvalid()
      || this.isHourlyRateInvalid()
      || this.isPaymentSplitInvalid();
  }

  private isValidPercentage(value: number | null): boolean {
    const n = Number(value);
    return isFinite(n) && n >= 0 && n <= 100;
  }

  private markRequiredFieldsTouchedAndDirty(): void {
    this.formModels?.forEach(model => {
      model.control.markAsTouched();
      model.control.markAsDirty();
      model.control.updateValueAndValidity();
    });
    setTimeout(() => this.scrollToFirstInvalidField(), 0);
  }

  private scrollToFirstInvalidField(): void {
    const firstInvalid = document.querySelector<HTMLElement>(
      '.sp-input.is-invalid, .sp-input-group.is-invalid'
    );
    firstInvalid?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  private loadAll(uuid: string): void {
    this.projectOffersService.getProposalDetails(uuid)
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe({
        next: (proposal) => {
          this.proposal = proposal;
        },
        error: (err) => this.handleServerErrors(err),
      });
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
