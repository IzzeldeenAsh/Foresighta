import { ProjectDeliverable, OfferInstallment, InstallmentDueType, appendInstallments, contractFirst, installmentTotal, validInstallments, validProjectFile, PROJECT_FILE_ACCEPT, canRespondToProposal } from 'src/app/_fake/services/project-offers/project-workflow';
import { Component, ElementRef, Injector, OnDestroy, OnInit, QueryList, ViewChildren } from '@angular/core';
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
  ProposalEstimateUnit,
} from 'src/app/_fake/services/project-offers/project-offers.service';

const HOURS_PER_DAY = 8;
type PaymentPlan = 'partial' | 'full';

@Component({
  selector: 'app-send-proposal',
  templateUrl: './send-proposal.component.html',
  styleUrl: './send-proposal.component.scss'
})
export class SendProposalComponent extends BaseComponent implements OnInit, OnDestroy {
  @ViewChildren(NgModel) private formModels!: QueryList<NgModel>;
  @ViewChildren('installmentItem') private installmentItems!: QueryList<ElementRef<HTMLElement>>;
  private installmentKeys = new WeakMap<OfferInstallment, number>();
  private cappedRows = new WeakSet<OfferInstallment>();
  private nextInstallmentKey = 0;

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
  estimateUnit: ProposalEstimateUnit = 'hours';
  estimateAmount: number | null = null;
  coverLetter: string = '';
  selectedAttachments: File[] = [];
  paymentPlan: PaymentPlan = 'partial';
  installments: OfferInstallment[] = [];
  paymentSplitValidationAttempted = false;
  readonly fileAccept = PROJECT_FILE_ACCEPT;
  get deliverables() { return this.proposal?.project.project_services?.reduce<ProjectDeliverable[]>((items, service) => items.concat(service.deliverables), []) ?? []; }
  get paymentSplitTotal(): number { return installmentTotal(this.installments); }
  get hasContractInstallment(): boolean { return this.installments.some(row => row.due_type === 'contract'); }
  get canRespond(): boolean { return canRespondToProposal(this.proposal); }
  addInstallment(): void {
    this.installments.push({ title: '', percentage: '', due_type: 'date', due_date: '' });
    this.paymentSplitValidationAttempted = false;
  }
  /** At least two payments are required. Other payments keep their values. */
  removeInstallment(index: number): void {
    if (this.installments.length > 2) this.installments.splice(index, 1);
  }
  /** Highest value a row may take without pushing the total above 100%. */
  maxPercentageFor(row: OfferInstallment): number {
    const others = this.installments.filter(item => item !== row).reduce((sum, item) => sum + this.pct(item), 0);
    return this.roundPct(Math.max(100 - others, 0));
  }
  /** Caps the typed value so the total can never exceed 100%; nothing else is changed. */
  onPercentageChange(row: OfferInstallment, value: string | number | null, input: HTMLInputElement): void {
    const typed = Number(value);
    if (value === '' || value === null || !Number.isFinite(typed)) { row.percentage = value ?? ''; return; }
    const capped = this.roundPct(Math.min(typed, this.maxPercentageFor(row)));
    row.percentage = capped;
    if (capped !== typed) { input.value = String(capped); this.cappedRows.add(row); } else { this.cappedRows.delete(row); }
  }
  isPercentageCapped(row: OfferInstallment): boolean { return this.cappedRows.has(row); }
  getPercentageCapMessage(row: OfferInstallment): string {
    const left = this.maxPercentageFor(row);
    if (this.lang === 'ar') return left > 0 ? `المتبقي ${left}% فقط. خفّض دفعة أخرى أولاً.` : 'لا توجد نسبة متبقية. خفّض دفعة أخرى أولاً.';
    return left > 0 ? `Only ${left}% is left. Lower another payment first.` : 'No percentage is left. Lower another payment first.';
  }
  /** Red border: the row's own value is missing or out of range, or the rows are all valid but don't reach 100%. */
  isPercentageInvalid(row: OfferInstallment): boolean {
    if (this.isRowPercentageInvalid(row)) return true;
    return this.paymentSplitTotal !== 100 && !this.installments.some(item => this.isRowPercentageInvalid(item));
  }
  private isRowPercentageInvalid(row: OfferInstallment): boolean {
    const value = Number(row.percentage);
    return row.percentage === '' || row.percentage === null || !Number.isFinite(value) || value < 1 || value > 100;
  }
  private pct(row: OfferInstallment): number { return Number(row.percentage) || 0; }
  private roundPct(value: number): number { return Math.round(value * 10000) / 10000; }
  /** Stable per-row key so ngModel names survive reordering. */
  rowKey(row: OfferInstallment): number {
    if (!this.installmentKeys.has(row)) this.installmentKeys.set(row, this.nextInstallmentKey++);
    return this.installmentKeys.get(row)!;
  }
  setDueType(row: OfferInstallment, type: InstallmentDueType): void {
    if (row.due_type === type) return;
    row.due_type = type;
    row.due_date = null;
    row.project_service_deliverable_id = null;
    const before = this.installmentRects();
    this.installments = contractFirst(this.installments);
    // Runs after change detection has moved the cards, so the moved card glides to its new slot.
    if (before.size) setTimeout(() => this.animateReorder(before, type === 'contract' ? row : null));
  }
  /** Dated payments must fall inside the project window: planned start → deadline (inclusive). */
  get paymentDateMin(): string | null { return this.proposal?.project.planned_start_date || null; }
  get paymentDateMax(): string | null { return this.proposal?.project.deadline || null; }
  isInstallmentDateOutOfRange(row: OfferInstallment): boolean {
    if (row.due_type !== 'date' || !row.due_date) return false;
    return (!!this.paymentDateMin && row.due_date < this.paymentDateMin)
      || (!!this.paymentDateMax && row.due_date > this.paymentDateMax);
  }
  getInstallmentDateRangeMessage(): string {
    const ar = this.lang === 'ar';
    const min = this.paymentDateMin ? this.formatDate(this.paymentDateMin) : null;
    const max = this.paymentDateMax ? this.formatDate(this.paymentDateMax) : null;
    if (min && max) return ar ? `اختر تاريخاً بين ${min} و${max}.` : `Pick a date between ${min} and ${max}.`;
    if (min) return ar ? `اختر تاريخاً في ${min} أو بعده.` : `Pick a date on or after ${min}.`;
    return ar ? `اختر تاريخاً في ${max} أو قبله.` : `Pick a date on or before ${max}.`;
  }
  installmentDueSummary(row: OfferInstallment): string {
    const ar = this.lang === 'ar';
    if (row.due_type === 'contract') return ar ? 'تستحق عند توقيع العقد' : 'Due on contract signing';
    if (row.due_type === 'date') return row.due_date ? `${ar ? 'تستحق في' : 'Due'} ${this.formatDate(row.due_date)}` : (ar ? 'اختر تاريخ الاستحقاق' : 'Pick a due date');
    const item = this.deliverables.find(d => d.id === Number(row.project_service_deliverable_id));
    return item ? `${ar ? 'تستحق بعد اعتماد' : 'Due after approval of'} ${item.title}` : (ar ? 'اختر المخرج' : 'Pick a deliverable');
  }
  private installmentRects(): Map<HTMLElement, DOMRect> {
    return new Map((this.installmentItems?.toArray() ?? []).map(ref => [ref.nativeElement, ref.nativeElement.getBoundingClientRect()]));
  }
  private animateReorder(before: Map<HTMLElement, DOMRect>, promoted: OfferInstallment | null): void {
    if (typeof window === 'undefined' || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const promotedIndex = promoted ? this.installments.indexOf(promoted) : -1;
    this.installmentItems.forEach((ref, index) => {
      const el = ref.nativeElement;
      const old = before.get(el);
      if (!old || typeof el.animate !== 'function') return;
      const dy = old.top - el.getBoundingClientRect().top;
      if (Math.abs(dy) < 1) return;
      el.animate([{ transform: `translateY(${dy}px)` }, { transform: 'translateY(0)' }],
        { duration: 450, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' });
      if (index === promotedIndex) {
        el.classList.add('is-promoted');
        setTimeout(() => el.classList.remove('is-promoted'), 1200);
      }
    });
  }
  /** Default schedule: two payments — 30% on contract, 70% after the final deliverable (or on the deadline). */
  initializeInstallments(): void {
    this.paymentSplitValidationAttempted = false;
    const ar = this.lang === 'ar';
    const finalDeliverable = [...this.deliverables]
      .sort((a, b) => (a.project_service_id ?? 0) - (b.project_service_id ?? 0) || a.position - b.position)
      .pop();
    this.installments = [
      { title: ar ? 'دفعة التعاقد' : 'Contract payment', percentage: 30, due_type: 'contract' },
      finalDeliverable
        ? { title: '', percentage: 70, due_type: 'deliverable', project_service_deliverable_id: finalDeliverable.id }
        : { title: '', percentage: 70, due_type: 'date', due_date: this.proposal?.project.deadline || '' },
    ];
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
    if (files.some(file => !validProjectFile(file))) {
      this.showError(this.lang === 'ar' ? 'ملف غير صالح' : 'Invalid file', this.lang === 'ar' ? 'استخدم صيغة مدعومة وحجم لا يتجاوز 50 ميجابايت.' : 'Use a supported format, up to 50 MB per file.');
      input.value = ''; return;
    }

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

  submitProposal(): void {
    if (this.isSubmitting) return;
    this.paymentSplitValidationAttempted = true;
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
      const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? value + 'T00:00:00' : value.replace(' ', 'T'));
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
    return !(this.coverLetter || '').trim() || this.coverLetter.trim().length > 2000;
  }

  isEstimateAmountInvalid(): boolean {
    return this.totalHours < 1 || !Number.isInteger(this.totalHours);
  }

  isHourlyRateInvalid(): boolean {
    return this.hourlyRate === null || !Number.isFinite(Number(this.hourlyRate)) || Number(this.hourlyRate) < 0;
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
    return this.lang === 'ar' ? 'أضف دفعتين على الأقل بعناوين وشروط استحقاق، ونسب بين 1 و100 ومجموع 100%، ودفعة تعاقد واحدة كحد أقصى.' : 'Add at least two payments with titles and due conditions, percentages from 1 to 100 totaling 100%, and at most one contract payment.';
  }

  // ---------- Internals ----------

  private buildProposalFormData(): FormData {
    const formData = new FormData();
    formData.append('hourly_rate', `${Number(this.hourlyRate)}`);
    formData.append('estimated_hours', `${this.totalHours}`);
    formData.append('cover_letter', (this.coverLetter || '').trim());
    formData.append('payment_plan', this.paymentPlan);

    if (this.paymentPlan === 'partial') {
      appendInstallments(formData, this.installments);
    }


    this.selectedAttachments.forEach((file, index) => {
      formData.append(`files[${index}]`, file, file.name);
    });

    return formData;
  }

  isPaymentSplitInvalid(): boolean {
    return this.paymentPlan === 'partial'
      && (!validInstallments(this.installments, this.deliverables) || this.installments.some(row => this.isInstallmentDateOutOfRange(row)));
  }

  private isProposalFormInvalid(): boolean {
    return !this.canRespond
      || this.selectedAttachments.some(file => !validProjectFile(file))
      || this.isCoverLetterInvalid()
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
          this.initializeInstallments();
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
