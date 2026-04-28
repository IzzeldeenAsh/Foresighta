import { Component, Injector, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { BaseComponent } from 'src/app/modules/base.component';
import {
  InsighterProjectAccountSettings,
  ProjectOffer,
  ProjectOffersService,
  ProposalEstimateUnit,
} from 'src/app/_fake/services/project-offers/project-offers.service';

const HOURS_PER_DAY = 8;

@Component({
  selector: 'app-send-proposal',
  templateUrl: './send-proposal.component.html',
  styleUrl: './send-proposal.component.scss'
})
export class SendProposalComponent extends BaseComponent implements OnInit, OnDestroy {
  proposal: ProjectOffer | null = null;
  settings: InsighterProjectAccountSettings | null = null;

  proposalUuid: string | null = null;
  hourlyRate: number = 0;
  isLoading: boolean = false;
  isSubmitting: boolean = false;
  priceManuallyEdited: boolean = false;

  // Project details drawer state
  detailsDrawerVisible: boolean = false;

  // Form state
  estimateUnit: ProposalEstimateUnit = 'days';
  estimateAmount: number | null = null;
  proposedPrice: number | null = null;
  coverLetter: string = '';

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
    this.recomputePrice(true);
  }

  onEstimateAmountChange(): void {
    this.recomputePrice(false);
  }

  onProposedPriceManualChange(): void {
    // The user has touched the price — stop auto-overwriting it.
    this.priceManuallyEdited = true;
  }

  /** Total estimated working hours (what we send to the API). */
  get totalHours(): number {
    const amt = Number(this.estimateAmount ?? 0);
    if (!isFinite(amt) || amt <= 0) return 0;
    return this.estimateUnit === 'days' ? amt * HOURS_PER_DAY : amt;
  }

  /** Auto-suggested price from hours × hourly rate (used when user hasn't edited). */
  get suggestedPrice(): number {
    return this.totalHours * (this.hourlyRate || 0);
  }

  isSubmitDisabled(): boolean {
    if (this.isSubmitting) return true;
    if (!this.proposalUuid) return true;
    if (!this.coverLetter || !this.coverLetter.trim()) return true;
    if (!this.estimateAmount || this.estimateAmount <= 0) return true;
    if (!this.proposedPrice || this.proposedPrice <= 0) return true;
    return false;
  }

  submitProposal(): void {
    if (this.isSubmitDisabled() || !this.proposalUuid) return;

    this.isSubmitting = true;
    const payload = {
      cover_letter: (this.coverLetter || '').trim(),
      estimated_hours: `${this.totalHours}`,
      proposed_price: Number(this.proposedPrice),
    };

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
    return n.toLocaleString(this.lang === 'ar' ? 'ar-EG' : 'en-US', {
      style: 'currency',
      currency: 'USD',
    });
  }

  getBackIcon(): string {
    return this.lang === 'ar' ? 'ki-arrow-right' : 'ki-arrow-left';
  }

  // ---------- Internals ----------

  private loadAll(uuid: string): void {
    forkJoin({
      proposal: this.projectOffersService.getProposalDetails(uuid),
      settings: this.projectOffersService.getAccountSettings(),
    })
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe({
        next: ({ proposal, settings }) => {
          this.proposal = proposal;
          this.settings = settings;
          this.hourlyRate = this.parseRate(settings?.hourly_rate);
          this.recomputePrice(true);
        },
        error: (err) => this.handleServerErrors(err),
      });
  }

  private parseRate(value: string | number | null | undefined): number {
    if (value === null || value === undefined || value === '') return 0;
    const n = typeof value === 'number' ? value : parseFloat(value);
    return isFinite(n) ? n : 0;
  }

  private recomputePrice(force: boolean): void {
    // Only overwrite the price if the user hasn't manually edited it,
    // or when we explicitly need to reset (mode change / fresh load).
    if (force) {
      this.priceManuallyEdited = false;
    }
    if (!this.priceManuallyEdited) {
      const next = this.suggestedPrice;
      this.proposedPrice = next > 0 ? Number(next.toFixed(2)) : null;
    }
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
