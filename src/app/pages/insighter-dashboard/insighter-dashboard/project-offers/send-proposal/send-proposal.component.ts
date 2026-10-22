import Swal from 'sweetalert2';
import { forkJoin, from, Observable } from 'rxjs';
import { ProfileService } from 'src/app/_fake/services/get-profile/get-profile.service';
import { AgreementRevisionsService } from 'src/app/_fake/services/agreement-revisions/agreement-revisions.service';
import { agreementIsLocked, agreementPaymentStarted, commercialDraft, CommercialDraft, COVER_LETTER_MAX_LENGTH, emptyAgreementGroups, emptiedScopeFiles, linkedDeliverableIds, payloadHasFiles, OFFER_FILE_EXTENSIONS, offerDurationSuggestion, offerFileError } from 'src/app/_fake/services/agreement-revisions/agreement-revisions.model';
import { offerEditRequirements, offerEditPatch, offerEditFingerprint, editableOfferScopes, editableOfferDeliverables, OfferTermsDraft } from 'src/app/_fake/services/agreement-revisions/offer-edit.model';
import { MissingOfferRequirements, OfferRequirementDraft, appendRequirementFormData, mapMissingOfferRequirements, offerRequirementsAreComplete } from 'src/app/_fake/services/project-phase2/project-requirements.model';
import { Component, HostListener, Injector, OnDestroy, OnInit, QueryList, ViewChildren } from '@angular/core';
import { CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import { NgModel } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntil, map } from 'rxjs/operators';
import { BaseComponent } from 'src/app/modules/base.component';
import { OfferRequirementsEditorComponent } from '../../shared/offer-requirements-editor.component';
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
  deliverable_key?: string | null;
  isProjectEnd?: boolean;
}

interface PaymentDeliverable {
  reference: number | string;
  title: string;
  period_days: number | null;
  date: string | null;
}

export type ProposalTab = 'cover' | 'scope' | 'deliverables' | 'pricing' | 'payment' | 'summary' | 'review';

interface ProposalTabItem {
  key: ProposalTab;
  label: { en: string; ar: string };
  icon: string;
}

const PROPOSAL_TABS: ProposalTabItem[] = [
  { key: 'cover', label: { en: 'Technical proposal', ar: 'العرض الفني' }, icon: 'ki-document' },
  { key: 'scope', label: { en: 'Scope of work', ar: 'نطاق العمل' }, icon: 'ki-questionnaire-tablet' },
  { key: 'deliverables', label: { en: 'Deliverables', ar: 'المخرجات' }, icon: 'ki-cube-2' },
  { key: 'pricing', label: { en: 'Pricing', ar: 'التسعير' }, icon: 'ki-price-tag' },
  { key: 'payment', label: { en: 'Payment schedule', ar: 'جدول الدفعات' }, icon: 'ki-calendar' },
  { key: 'summary', label: { en: 'Financial summary', ar: 'الملخص المالي' }, icon: 'ki-wallet' },
  { key: 'review', label: { en: 'Review changes', ar: 'مراجعة التغييرات' }, icon: 'ki-check-circle' },
];

@Component({
  selector: 'app-send-proposal',
  templateUrl: './send-proposal.component.html',
  styleUrl: './send-proposal.component.scss'
})
export class SendProposalComponent extends BaseComponent implements OnInit, OnDestroy {
  @ViewChildren(NgModel) private formModels!: QueryList<NgModel>;
  @ViewChildren(OfferRequirementsEditorComponent) private requirementEditors!: QueryList<OfferRequirementsEditorComponent>;

  proposal: ProjectOffer | null = null;
  scopeDraft: OfferRequirementDraft = { offer_scopes: [], offer_components: [] };
  deliverablesDraft: OfferRequirementDraft = { offer_scopes: [], offer_components: [] };
  private requirementSource?: MissingOfferRequirements;
  private requirementsBySection = { scope: mapMissingOfferRequirements(null), deliverables: mapMissingOfferRequirements(null) };

  /** Stable input references keep both editors' answers intact across tab changes. */
  private get splitRequirements() {
    const source = this.editMode ? this.editRequirements : this.proposal?.missing_offer_requirements;
    if (source !== this.requirementSource) {
      this.requirementSource = source;
      const missing = mapMissingOfferRequirements(source);
      const isDeliverable = (item: MissingOfferRequirements['service_components'][number]) => item.component.slug === 'deliverable-stage';
      this.requirementsBySection = {
        scope: {
          scopes: missing.scopes,
          project_components: missing.project_components.filter(item => !isDeliverable(item)),
          service_components: missing.service_components.filter(item => !isDeliverable(item)),
        },
        deliverables: {
          scopes: [],
          project_components: missing.project_components.filter(isDeliverable),
          service_components: missing.service_components.filter(isDeliverable),
        },
      };
    }
    return this.requirementsBySection;
  }
  get scopeRequirements(): MissingOfferRequirements { return this.splitRequirements.scope; }
  get deliverablesRequirements(): MissingOfferRequirements { return this.splitRequirements.deliverables; }
  get requirementDraft(): OfferRequirementDraft {
    return {
      offer_scopes: this.scopeDraft.offer_scopes,
      offer_components: [...this.scopeDraft.offer_components, ...this.deliverablesDraft.offer_components],
    };
  }
  /** Advanced projects carry the client's own scopes and deliverables, so editing the offer skips them. */
  get editHidesRequirements(): boolean { return this.editMode && this.proposal?.project?.definition_mode !== 'simple'; }
  get scopeRequirementsValid(): boolean { if (this.editHidesRequirements) return true; if (this.editMode) return this.editSectionValid('scope'); return offerRequirementsAreComplete(this.scopeRequirements, this.scopeDraft); }
  get deliverablesRequirementsValid(): boolean { if (this.editHidesRequirements) return true; if (this.editMode) return this.editSectionValid('deliverables'); return offerRequirementsAreComplete(this.deliverablesRequirements, this.deliverablesDraft); }
  get requirementsValid(): boolean { return this.scopeRequirementsValid && this.deliverablesRequirementsValid; }
  hasAttemptedTab(tab: ProposalTab): boolean { return this.submitAttempted || this.attemptedTabs.has(tab); }

  /** Route param — project UUID used to load details from /insighter/project/show. */
  proposalUuid: string | null = null;
  hourlyRate: number | null = null;
  isLoading: boolean = false;
  isSubmitting: boolean = false;

  // Project details drawer state
  detailsDrawerVisible: boolean = false;
  openingFileUuid: string | null = null;

  // Form state
  priceType: ProjectPriceType = 'fixed';
  estimatedHours: number | null = null;
  dailyRate: number | null = null;
  estimatedDays: number | null = null;
  fixedPrice: number | null = null;
  coverLetter: string = '';
  readonly coverLetterMaxLength = COVER_LETTER_MAX_LENGTH;
  readonly attachmentAccept = OFFER_FILE_EXTENSIONS.map(extension => `.${extension}`).join(',');
  /** Documents that usually strengthen an offer, shown as hints on the upload box. */
  readonly suggestedAttachments = [
    { en: 'Company profile', ar: 'الملف التعريفي للشركة' },
    { en: 'Methodology', ar: 'المنهجية' },
    { en: 'Team structure', ar: 'هيكل الفريق' },
    { en: 'Previous work', ar: 'الأعمال السابقة' },
    { en: 'Management plan', ar: 'خطة الإدارة' },
  ];
  /** New files to upload with the offer. */
  selectedAttachments: File[] = [];
  /** Edit mode: existing offer files the insighter keeps. */
  retainedAttachmentUuids: string[] = [];
  attachmentErrors: string[] = [];
  /** A longer project duration the insighter proposes (null keeps the client's duration). */
  suggestedDurationDays: number | null = null;
  paymentPlan: ProjectPaymentPlan = 'partial';
  installments: InstallmentDraft[] = [];
  /** Set once the insighter edits the plan, so project data no longer reseeds it. */
  private installmentsTouched = false;
  private installmentKey = 0;
  private submitAttempted = false;
  private attemptedTabs = new Set<ProposalTab>();

  activeTab: ProposalTab = 'cover';

  /** Show each requirement tab only when the backend requests its fields. */
  get tabs(): ProposalTabItem[] {
    const scope = this.scopeRequirements, deliverables = this.deliverablesRequirements;
    const hasScope = !!(scope.scopes.length || scope.project_components.length || scope.service_components.length);
    const hasDeliverables = !!(deliverables.project_components.length || deliverables.service_components.length);
    if (this.editMode) {
      const offer = this.proposal?.offer, hidden = this.editHidesRequirements;
      return PROPOSAL_TABS.filter(tab => ({
        cover: true,
        scope: !hidden && (hasScope || this.readOnlyScopes.length > 0),
        deliverables: !hidden && (hasDeliverables || this.readOnlyDeliverables.length > 0),
        pricing: !!offer && ['fixed_price', 'hourly_rate', 'daily_rate', 'proposed_price'].some(key => (offer as any)[key] != null),
        payment: !!offer?.installments?.length || !!offer?.payment_plan,
        summary: false,
        review: !this.editLocked,
      }[tab.key]));
    }
    return PROPOSAL_TABS.filter(tab => (tab.key !== 'scope' || hasScope) && (tab.key !== 'deliverables' || hasDeliverables) && tab.key !== 'review');

  }

  get nextTab(): ProposalTabItem | null {
    const tabs = this.tabs;
    return tabs[tabs.findIndex(tab => tab.key === this.activeTab) + 1] ?? null;
  }

  get previousTab(): ProposalTabItem | null {
    const tabs = this.tabs;
    return tabs[tabs.findIndex(tab => tab.key === this.activeTab) - 1] ?? null;
  }

  get activeStepIndex(): number {
    return this.tabs.findIndex(tab => tab.key === this.activeTab);
  }

  /** Steps before the current one read as done; the stepper only marks progress, validation still runs on navigation. */
  stepState(index: number): 'done' | 'active' | 'upcoming' {
    const active = this.activeStepIndex;
    return index < active ? 'done' : index === active ? 'active' : 'upcoming';
  }

  /** Creating an offer: the total stays hidden until the insighter reaches pricing and enters a price. */
  get showOfferTotal(): boolean {
    if (this.editMode) return true;
    const pricingIndex = this.tabs.findIndex(tab => tab.key === 'pricing');
    return this.totalPrice > 0 && pricingIndex >= 0 && this.activeStepIndex >= pricingIndex;
  }

  selectTab(tab: ProposalTab): boolean {
    const keys = this.tabs.map(item => item.key);
    const targetIndex = keys.indexOf(tab);
    if (targetIndex < 0) return false;
    if (targetIndex > keys.indexOf(this.activeTab)) {
      const blockingTab = keys.slice(0, targetIndex).find(key => this.isTabInvalid(key));
      if (blockingTab) {
        this.activeTab = blockingTab;
        this.attemptedTabs.add(blockingTab);
        this.revealValidationErrors();
        return false;
      }
    }
    this.activeTab = tab;
    return true;
  }

  onTabClick(tab: ProposalTab): void {
    if (this.selectTab(tab)) window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  goToNextTab(): void {
    const next = this.nextTab;
    if (!next) return;
    if (this.selectTab(next.key)) window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  goToPreviousTab(): void {
    const previous = this.previousTab;
    if (previous && this.selectTab(previous.key)) window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  private isTabInvalid(tab: ProposalTab): boolean {
    const invalid: Record<ProposalTab, boolean> = {
      cover: !(this.editMode && this.editLocked) && (this.isCoverLetterInvalid() || this.attachmentErrors.length > 0),
      scope: !this.scopeRequirementsValid,
      deliverables: !this.deliverablesRequirementsValid || !!this.durationOverflowDays || !!this.suggestedDurationError,
      pricing: this.editMode && this.editCommercialLocked ? false : this.isPricingInvalid(),
      payment: this.editMode && this.editCommercialLocked ? false : this.isPaymentPlanInvalid(),
      summary: false,
      review: false,
    };
    return invalid[tab];
  }

  /** First tab, in tab order, that currently blocks submission. */
  private firstInvalidTab(): ProposalTab | null {
    return this.tabs.find(tab => this.isTabInvalid(tab.key))?.key ?? null;
  }

  get showInstallmentErrors(): boolean {
    return this.hasAttemptedTab('payment') || this.installmentsTouched;
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
    this.revisionsApi = injector.get(AgreementRevisionsService);
    this.profile = injector.get(ProfileService);
  }

  ngOnInit(): void {
    this.editMode = !!this.route.snapshot.data['editOffer'];
    if (this.editMode) this.revisionsApi.changed$.pipe(takeUntil(this.unsubscribe$)).subscribe(event => {
      if (event.projectUuid === this.proposalUuid && !this.editSaved) this.editStale = true;
    });
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
    if (this.editMode) this.router.navigate(this.editReturnRoute, { queryParams: { tab: 'revisions' } });
    else this.router.navigate(['/app/insighter-dashboard/project-offers']);
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
    input.value = '';
    if (!files.length) return;

    // Rejected files never join the list, so the request only carries what the API accepts.
    const ar = this.lang === 'ar';
    this.attachmentErrors = files.map(file => offerFileError(file, ar)).filter((error): error is string => !!error);
    this.selectedAttachments = [...this.selectedAttachments, ...files.filter(file => !offerFileError(file, ar))];
  }

  removeAttachment(index: number): void {
    this.selectedAttachments = this.selectedAttachments.filter((_, i) => i !== index);
    this.attachmentErrors = [];
  }

  /** Edit mode: the offer's current files, each marked kept or removed. */
  get existingAttachments(): Array<{ file: ProjectOfferFile; kept: boolean }> {
    return (this.proposal?.offer?.files ?? []).filter(file => !!file.uuid)
      .map(file => ({ file, kept: this.retainedAttachmentUuids.includes(file.uuid) }));
  }

  toggleExistingAttachment(file: ProjectOfferFile): void {
    this.retainedAttachmentUuids = this.retainedAttachmentUuids.includes(file.uuid)
      ? this.retainedAttachmentUuids.filter(uuid => uuid !== file.uuid)
      : [...this.retainedAttachmentUuids, file.uuid];
  }

  // ---------- Suggested project duration ----------

  /** Edit mode: the suggestion is fixed once the client awards the offer. */
  get durationLocked(): boolean {
    return this.editMode && (this.editLocked || this.proposal?.offer?.status === 'awarded');
  }

  /** The duration deliverables and payments are planned against: the suggestion when there is one. */
  get effectiveDurationDays(): number | null {
    return this.suggestedDurationDays ?? this.durationDays;
  }

  get suggestedCloseDate(): string | null {
    return this.suggestedDurationDays === null ? null : this.dateForDays(this.suggestedDurationDays);
  }

  /**
   * The latest due day across the insighter's own deliverables (drafted, or saved with the offer).
   * Client deliverables already sit inside the client's duration, so only these can need a longer one.
   */
  get longestDeliverableDays(): number | null {
    const drafted = this.deliverablesDraft.offer_components
      .reduce<any[]>((all, component) => all.concat(component.value?.deliverables ?? []), []);
    const offerRows = this.paymentDeliverables.filter(row => typeof row.reference === 'string');
    const days = [...drafted, ...offerRows]
      .map(row => row?.period_days)
      .filter(value => value !== null && value !== undefined && value !== '')
      .map(Number)
      .filter(value => Number.isFinite(value));
    return days.length ? Math.max(...days) : null;
  }

  /** The due day that runs past the planned duration, when one does. */
  get durationOverflowDays(): number | null {
    const longest = this.longestDeliverableDays, end = this.effectiveDurationDays;
    if (this.durationLocked || this.durationDays === null || longest === null || end === null) return null;
    return longest > end ? longest : null;
  }

  /** Whether any of the insighter's deliverables is due after the client's duration. */
  get suggestionNeeded(): boolean {
    const longest = this.longestDeliverableDays;
    return longest !== null && this.durationDays !== null && longest > this.durationDays;
  }

  get suggestedDurationError(): string | null {
    const days = this.suggestedDurationDays, ar = this.lang === 'ar';
    if (days === null || this.durationLocked) return null;
    if (!Number.isInteger(Number(days)) || Number(days) < 1) return ar ? 'أدخل عدد أيام صحيحًا.' : 'Enter a whole number of days.';
    if (this.durationDays !== null && Number(days) <= this.durationDays)
      return ar ? `يجب أن تكون المدة المقترحة أكثر من مدة المشروع الحالية (${this.durationDays} يومًا).` : `Suggest more than the current project duration (${this.durationDays} days).`;
    return null;
  }

  /** Every installment pinned to the project end follows the planned duration. */
  setSuggestedDuration(days: number | string | null): void {
    const value = days === null || days === '' ? null : Math.round(Number(days));
    this.suggestedDurationDays = value === null || !Number.isFinite(value) ? null : value;
    this.installments.filter(item => item.isProjectEnd).forEach(item => item.period_days = this.effectiveDurationDays);
  }

  /** Deliverables tab: extend the suggestion so the latest deliverable fits. */
  suggestDurationForDeliverables(): void {
    const days = this.durationOverflowDays;
    if (days !== null) this.setSuggestedDuration(days);
  }

  clearSuggestedDuration(): void {
    this.setSuggestedDuration(null);
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

  /** How the total was reached, e.g. "$85.00 × 120 hrs". Empty for fixed price or missing inputs. */
  get priceBreakdown(): string {
    const ar = this.lang === 'ar';
    if (this.priceType === 'hourly' && this.hourlyRate && this.estimatedHours) {
      return `${this.formatPrice(this.hourlyRate)} × ${this.estimatedHours} ${ar ? 'ساعة' : 'hrs'}`;
    }
    if (this.priceType === 'daily' && this.dailyRate && this.estimatedDays) {
      return `${this.formatPrice(this.dailyRate)} × ${this.estimatedDays} ${ar ? 'يوم' : 'days'}`;
    }
    return '';
  }

  // ---------- Project schedule ----------

  get deliverables(): ProjectDeliverable[] {
    return this.proposal?.project?.deliverables ?? [];
  }

  /** Persisted client deliverables use IDs; offer deliverables keep their frontend keys. */
  get paymentDeliverables(): PaymentDeliverable[] {
    const existing = this.deliverables.map(deliverable => ({ ...deliverable, reference: deliverable.id }));
    const drafted: PaymentDeliverable[] = [];
    this.deliverablesDraft.offer_components.forEach(component => {
      (component.value?.deliverables ?? []).forEach((deliverable: any, index: number) => {
        if (deliverable.key) drafted.push({
          reference: deliverable.key,
          title: deliverable.title?.trim() || `${this.lang === 'ar' ? 'مخرج' : 'Deliverable'} ${index + 1}`,
          period_days: deliverable.period_days ?? null,
          date: null,
        });
      });
    });
    if (this.editMode) {
      const offerRows: PaymentDeliverable[] = [];
      const offerDeliverables = this.proposal?.offer?.offer_deliverables
        ?? (this.proposal?.offer?.offer_components ?? []).reduce<any[]>((all, component) => all.concat((component.value?.deliverables ?? []).map((row: any) => ({ ...row, project_service_id: component.project_service_id }))), []);
      offerDeliverables.filter(row => !this.editRequirements.service_components.some(group => group.project_service_id === row.project_service_id)).forEach(row => {
        if (row.id) offerRows.push({ reference: `offer:${row.id}`, title: row.title, period_days: row.period_days, date: null });
      });
      // Keep an existing offer-deliverable link selectable even on older detail responses.
      this.installments.filter(item => item.deliverable_key?.startsWith('offer:')).forEach(item => {
        if (!offerRows.some(row => row.reference === item.deliverable_key)) offerRows.push({ reference: item.deliverable_key!, title: item.title, period_days: item.period_days, date: null });
      });
      const saved = existing.filter(row => !this.editRequirements.service_components.some(group => group.project_service_id === row.project_service_id && editableOfferDeliverables(this.proposal!, group.project_service_id!, this.editUserId).source === 'project' && editableOfferDeliverables(this.proposal!, group.project_service_id!, this.editUserId).items.some(item => item.id === row.id)));
      this.deliverablesDraft.offer_components.forEach(component => (component.value?.deliverables ?? []).forEach((row: any) => {
        if (row.id) saved.push({ ...row, reference: editableOfferDeliverables(this.proposal!, component.project_service_id!, this.editUserId).source === 'offer' ? `offer:${row.id}` : row.id });
      }));
      return [...saved, ...offerRows];
    }
    return [...existing, ...drafted];
  }

  installmentDeliverableReference(item: InstallmentDraft): number | string | null {
    return item.project_service_deliverable_id ?? item.deliverable_key ?? null;
  }

  selectInstallmentDeliverable(item: InstallmentDraft, reference: number | string | null): void {
    item.project_service_deliverable_id = typeof reference === 'number' ? reference : null;
    item.deliverable_key = typeof reference === 'string' ? reference : null;
    this.installmentsTouched = true;
  }

  installmentDeliverableTitle(item: InstallmentDraft): string { return this.linkedDeliverable(item)?.title || ''; }
  private linkedDeliverable(item: InstallmentDraft): PaymentDeliverable | undefined {
    return this.paymentDeliverables.find(deliverable => deliverable.reference === this.installmentDeliverableReference(item));
  }

  onDeliverablesDraftChanged(draft: OfferRequirementDraft): void {
    this.deliverablesDraft = draft;
    this.installments.forEach(item => {
      // A removed deliverable must be chosen again, without silently moving its payment.
      if (item.deliverable_key && !this.linkedDeliverable(item)) {
        this.selectInstallmentDeliverable(item, null);
      }
    });
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
    const lastDay = this.effectiveDurationDays ?? (this.lastDeliverable?.period_days ?? 0);
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

  dropInstallment(event: CdkDragDrop<InstallmentDraft[]>): void {
    this.moveInstallment(event.previousIndex, event.currentIndex - event.previousIndex);
  }

  moveInstallment(index: number, offset: number): void {
    const target = index + offset;
    if (target < 0 || target >= this.installments.length || target === index) return;
    this.installmentsTouched = true;
    const reordered = [...this.installments];
    moveItemInArray(reordered, index, target);
    this.installments = reordered;
  }

  removeInstallment(key: number): void {
    if (this.installments.length <= 2) return;
    this.installmentsTouched = true;
    this.installments = this.installments.filter(item => item.key !== key);
  }

  getAvailableDeliverables(item: InstallmentDraft): PaymentDeliverable[] {
    const selectedReferences = new Set(this.installments
      .filter(other => other.key !== item.key && other.due_type === 'deliverable')
      .map(other => this.installmentDeliverableReference(other)));
    return this.paymentDeliverables.filter(deliverable => !selectedReferences.has(deliverable.reference));
  }

  onInstallmentChanged(item: InstallmentDraft): void {
    this.installmentsTouched = true;
    if (item.isProjectEnd) {
      item.period_days = this.effectiveDurationDays;
    }
  }

  canChooseContract(item: InstallmentDraft): boolean {
    return item.due_type === 'contract'
      || !this.installments.some(other => other.key !== item.key && other.due_type === 'contract');
  }

  isDueTypeDisabled(item: InstallmentDraft, type: InstallmentDueType): boolean {
    return (type === 'contract' && !this.canChooseContract(item))
      || (type === 'deliverable' && !this.getAvailableDeliverables(item).length);
  }

  setDueType(item: InstallmentDraft, type: InstallmentDueType): void {
    if ((item.due_type === type && !item.isProjectEnd) || this.isDueTypeDisabled(item, type)) return;
    item.isProjectEnd = false;
    item.due_type = type;
    if (type === 'deliverable') {
      const available = this.getAvailableDeliverables(item);
      if (!available.some(deliverable => deliverable.reference === this.installmentDeliverableReference(item))) {
        this.selectInstallmentDeliverable(item, available[0]?.reference ?? null);
      }
    }
    this.onInstallmentChanged(item);
  }

  setProjectEnd(item: InstallmentDraft): void {
    if (this.paymentPlan !== 'full' || this.effectiveDurationDays === null) return;
    item.isProjectEnd = true;
    item.due_type = 'date';
    item.period_days = this.effectiveDurationDays;
    this.onInstallmentChanged(item);
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
      const deliverable = this.linkedDeliverable(item);
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
    if (item.due_type === 'date' && (item.period_days === null || item.period_days === undefined
      || !(Number(item.period_days) >= 0 && Number.isInteger(Number(item.period_days))))) {
      errors.push(ar ? 'حدد عدد الأيام من بدء المشروع.' : 'Enter the number of days from the project start.');
    }
    const paymentDays = item.due_type === 'deliverable'
      ? this.linkedDeliverable(item)?.period_days
      : item.due_type === 'date' ? item.period_days : null;
    const endDays = this.effectiveDurationDays;
    if (endDays !== null && paymentDays !== null && paymentDays !== undefined
      && Number(paymentDays) > endDays) {
      errors.push(this.suggestedDurationDays !== null
        ? (ar ? `لا يمكن أن تتجاوز مدة استحقاق الدفعة مدة المشروع المقترحة (${endDays} يومًا).` : `Payment duration cannot exceed the suggested project duration (${endDays} days).`)
        : (ar ? `لا يمكن أن تتجاوز مدة استحقاق الدفعة مدة المشروع (${endDays} يومًا).` : `Payment duration cannot exceed the project duration (${endDays} days).`));
    }
    if (item.due_type === 'deliverable' && !this.linkedDeliverable(item)) {
      errors.push(ar ? 'اختر المخرج المرتبط.' : 'Pick the linked deliverable.');
    }
    if (item.due_type === 'deliverable' && this.linkedDeliverable(item)
      && !this.getAvailableDeliverables(item).some(deliverable => deliverable.reference === this.installmentDeliverableReference(item))) {
      errors.push(ar ? 'هذا المخرج مرتبط بدفعة أخرى.' : 'This deliverable is already linked to another payment.');
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
      deliverable_key: null,
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
    const firstDeliverable = this.paymentDeliverables[0] ?? null;
    return [
      this.createInstallment({
        title: this.lang === 'ar' ? 'دفعة توقيع العقد' : 'Contract payment',
        percentage: 30,
        due_type: 'contract',
        period_days: 0,
      }),
      this.createInstallment({
        title: this.lang === 'ar' ? 'دفعة 2' : 'Payment 2',
        percentage: 70,
        due_type: firstDeliverable ? 'deliverable' : 'date',
        period_days: firstDeliverable ? firstDeliverable.period_days : (this.effectiveDurationDays ?? 0),
        project_service_deliverable_id: typeof firstDeliverable?.reference === 'number' ? firstDeliverable.reference : null,
        deliverable_key: typeof firstDeliverable?.reference === 'string' ? firstDeliverable.reference : null,
      }),
    ];
  }

  submitProposal(): void {
    if (this.editMode) { this.saveEditedOffer(); return; }
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
          this.router.navigate(['/app/insighter-dashboard/project-offers/details', this.proposalUuid!], { queryParams: { tab: 'offer' } });
        },
        error: (err) => {
          this.isSubmitting = false;
          this.handleServerErrors(err);
        },
      });
  }

  editMode = false;
  editStale = false;
  editSaved = false;
  editError = '';
  revisionNote = '';
  editUserId: number | null = null;
  editRequirements = mapMissingOfferRequirements(null);
  readOnlyScopeRequirements = mapMissingOfferRequirements(null);
  readOnlyDeliverablesRequirements = mapMissingOfferRequirements(null);
  readOnlyScopeSeed: OfferRequirementDraft = { offer_scopes: [], offer_components: [] };
  readOnlyDeliverablesSeed: OfferRequirementDraft = { offer_scopes: [], offer_components: [] };
  scopeSeed: OfferRequirementDraft = { offer_scopes: [], offer_components: [] };
  deliverablesSeed: OfferRequirementDraft = { offer_scopes: [], offer_components: [] };
  editLinkedIds = new Set<number>();
  editLinkedOfferIds = new Set<number>();
  editOfferDeliverableServiceIds = new Set<number>();
  private editSnapshot = '';
  private revisionsApi: AgreementRevisionsService;
  private profile: ProfileService;

  get editLocked(): boolean {
    const record = this.proposal;
    return !record?.offer?.uuid || agreementIsLocked(record.contract ?? record.project.contract ?? record.offer?.contract, record.project.status) ||
      (!!record.contract_uuid && !record.contract && !record.project.contract && !record.offer?.contract);
  }
  get editCommercialLocked(): boolean { return this.editLocked || agreementPaymentStarted(this.proposal?.order); }
  get editReturnRoute(): string[] {
    return this.route.snapshot.queryParamMap.get('from') === 'projects'
      ? ['/app/insighter-dashboard/on-work-projects/details', this.proposalUuid!]
      : ['/app/insighter-dashboard/project-offers/details', this.proposalUuid!];
  }
  get readOnlyScopes(): Array<{ serviceId: number; title: string; items: any[]; offerRows: boolean }> {
    const record = this.proposal;
    if (!record) return [];
    return record.project.project_services.filter(service => service.id !== null).map(service => {
      const editable = editableOfferScopes(record, service.id!, this.editUserId);
      const offerRows = !service.scopes.length;
      const original = (record.offer?.offer_scopes ?? []).filter(row => row.project_service_id === service.id);
      const source = offerRows ? original : this.editLocked && editable.source === 'offer' ? [...service.scopes, ...original] : service.scopes;
      const items = this.editLocked || editable.source !== (offerRows ? 'offer' : 'project') ? source : source.filter(row => !editable.items.includes(row));
      return { serviceId: service.id!, title: service.title || service.service?.name || '', items, offerRows };
    }).filter(group => group.items.length > 0);
  }
  get readOnlyDeliverables(): Array<{ serviceId: number; title: string; items: any[]; offerRows: boolean }> {
    const record = this.proposal;
    if (!record) return [];
    return record.project.project_services.filter(service => service.id !== null).map(service => {
      const editable = editableOfferDeliverables(record, service.id!, this.editUserId);
      const offerRows = !service.deliverables.length;
      // Same rows editableOfferDeliverables returns, so the editable ones drop out of this read-only list.
      const original = record.offer?.offer_deliverables?.filter(row => row.project_service_id === service.id)
        ?? (record.offer?.offer_components ?? []).filter(row => row.project_service_id === service.id).reduce<any[]>((all, row) => all.concat(row.value?.deliverables ?? []), []);
      const source = offerRows ? original : this.editLocked && editable.source === 'offer' ? [...service.deliverables, ...original] : service.deliverables;
      const items = this.editLocked || editable.source !== (offerRows ? 'offer' : 'project') ? source : source.filter(row => !editable.items.includes(row));
      return { serviceId: service.id!, title: service.title || service.service?.name || '', items, offerRows };
    }).filter(group => group.items.length > 0);
  }
  /** Why the read-only scopes and deliverables can't be changed, shown on hover of their badge. */
  get readOnlyReason(): string {
    const ar = this.lang === 'ar';
    if (this.editLocked) return ar
      ? 'لا يمكن تعديل العرض بعد توقيع العقد أو بدء المشروع.'
      : 'This offer can no longer be changed because the contract is signed or the project has started.';
    return ar
      ? 'أضافها العميل في طلب المشروع، لذا يمكن للعميل فقط تعديلها.'
      : 'The client added these in the project request, so only the client can change them.';
  }
  isEditTabReadOnly(key: ProposalTab): boolean {
    if (!this.editMode || key === 'review') return false;
    if (this.editLocked) return true;
    if (key === 'cover') return false;
    if (key === 'scope') return !this.scopeRequirements.scopes.length;
    if (key === 'deliverables') return !this.deliverablesRequirements.service_components.length;
    return this.editCommercialLocked;
  }
  private editCommercial(): CommercialDraft {
    return commercialDraft({ price_type: this.priceType, fixed_price: this.fixedPrice, hourly_rate: this.hourlyRate, estimated_hours: this.estimatedHours,
      daily_rate: this.dailyRate, estimated_days: this.estimatedDays, payment_plan: this.paymentPlan,
      installments: this.installments.map(item => ({ title: item.title, percentage: item.percentage, due_type: item.due_type,
        period_days: item.period_days, project_service_deliverable_id: item.project_service_deliverable_id,
        project_proposal_offer_deliverable_id: item.deliverable_key?.startsWith('offer:') ? Number(item.deliverable_key.slice(6)) : null })) });
  }
  private get editTerms(): OfferTermsDraft {
    return { coverLetter: this.coverLetter || '', retainedAttachmentUuids: this.retainedAttachmentUuids, newFileCount: this.selectedAttachments.length,
      suggestedDurationDays: this.suggestedDurationDays, durationLocked: this.durationLocked };
  }
  get editPatch() {
    if (!this.proposal || this.editLocked) return {};
    const commercial = this.editCommercialLocked ? commercialDraft(this.proposal.offer) : this.editCommercial();
    return offerEditPatch(this.proposal, this.editUserId, this.requirementDraft, commercial, this.editTerms);
  }
  /** Review tab: the duration the offer suggested before this edit. */
  get editSavedSuggestion(): number | null { return offerDurationSuggestion(this.proposal?.offer, this.durationDays); }
  get editDurationChanged(): boolean { return !this.durationLocked && this.suggestedDurationDays !== this.editSavedSuggestion; }
  get editRemovedAttachments(): ProjectOfferFile[] { return this.existingAttachments.filter(row => !row.kept).map(row => row.file); }
  get editScopeChanges() { return [...(this.editPatch.scopes ?? []), ...(this.editPatch.offer_scopes ?? [])]; }
  get editDeliverableChanges() { return [...(this.editPatch.deliverables ?? []), ...(this.editPatch.offer_deliverables ?? [])]; }
  get editDirty(): boolean { return this.editMode && Object.keys(this.editPatch).length > 0; }
  get editChangeSummary(): string[] {
    const patch = this.editPatch, ar = this.lang === 'ar', result: string[] = [];
    for (const group of [...(patch.scopes ?? []), ...(patch.offer_scopes ?? [])]) {
      const service = this.proposal?.project.project_services.find(s => s.id === group.project_service_id);
      result.push(`${ar ? 'تحديث النطاقات' : 'Update scopes'} · ${service?.title || service?.service?.name || ''}`);
    }
    for (const group of [...(patch.deliverables ?? []), ...(patch.offer_deliverables ?? [])]) {
      const service = this.proposal?.project.project_services.find(s => s.id === group.project_service_id);
      result.push(`${ar ? 'تحديث المخرجات' : 'Update deliverables'} · ${service?.title || service?.service?.name || ''}`);
    }
    if (patch.price_type) result.push(ar ? 'تحديث السعر وجدول الدفعات' : 'Update pricing and payment schedule');
    if (patch.cover_letter !== undefined) result.push(ar ? 'تحديث نص العرض الفني' : 'Update the technical proposal');
    if (patch.attachment_uuids) result.push(ar ? 'تحديث المرفقات' : 'Update attachments');
    if (this.editDurationChanged) result.push(ar ? 'تحديث مدة المشروع المقترحة' : 'Update the suggested project duration');
    return result;
  }
  get editPreviousTotal(): number { return Number(this.proposal?.offer?.proposed_price) || 0; }
  get editPreviousPriceType(): string { return priceTypeLabel(this.proposal?.offer?.price_type, this.lang); }
  /** Review tab, left card: the submitted schedule; rows past the new length were removed. */
  get editPreviousScheduleRows(): Array<{ title: string; percentage: number; amount: number; due: string; removed: boolean }> {
    const original: any[] = this.proposal?.offer?.installments ?? [];
    return original.map((row, index) => {
      const reference = row.project_service_deliverable_id ?? (row.project_proposal_offer_deliverable_id ? `offer:${row.project_proposal_offer_deliverable_id}` : null);
      const detail = row.due_type === 'date' ? this.periodLabel(row.period_days) : row.due_type === 'deliverable' ? this.paymentDeliverables.find(item => item.reference === reference)?.title || '' : '';
      return {
        title: row.title, percentage: Number(row.percentage) || 0,
        amount: Math.round(this.editPreviousTotal * (Number(row.percentage) || 0)) / 100,
        due: [this.dueTypeLabel(row.due_type), detail].filter(Boolean).join(' · '),
        removed: index >= this.installments.length,
      };
    });
  }
  /** Review tab, right card: installments after the edit, compared position by position with the submitted offer. */
  get editScheduleRows(): Array<{ item: InstallmentDraft; amount: number; due: string; status: 'new' | 'changed' | 'same' }> {
    const original: any[] = this.proposal?.offer?.installments ?? [];
    return this.installments.map((item, index) => {
      const before = original[index];
      const linkBefore = before?.project_service_deliverable_id ?? (before?.project_proposal_offer_deliverable_id ? `offer:${before.project_proposal_offer_deliverable_id}` : null);
      const changed = !!before && (before.title !== item.title || Number(before.percentage) !== Number(item.percentage) || before.due_type !== item.due_type
        || (item.due_type === 'date' && Number(before.period_days ?? 0) !== Number(item.period_days ?? 0))
        || (item.due_type === 'deliverable' && linkBefore !== this.installmentDeliverableReference(item)));
      const detail = item.due_type === 'date' ? this.periodLabel(item.period_days) : item.due_type === 'deliverable' ? this.installmentDeliverableTitle(item) : '';
      return {
        item, amount: Math.round(this.totalPrice * (Number(item.percentage) || 0)) / 100,
        due: [this.dueTypeLabel(item.due_type), detail].filter(Boolean).join(' · '),
        status: !before ? 'new' : changed ? 'changed' : 'same',
      };
    });
  }
  /** Financial summary step: every installment as a timeline stop — when it is due, what triggers it, its share and the running total. */
  get summaryScheduleRows(): Array<{ item: InstallmentDraft; amount: number; date: string | null; when: string; whenSub: string; tag: string; detail: string; upfront: boolean; cumulative: number }> {
    const ar = this.lang === 'ar';
    let cumulative = 0;
    return this.installments.map(item => {
      const date = this.installmentDate(item);
      const upfront = item.due_type === 'contract';
      cumulative = Number((cumulative + (Number(item.percentage) || 0)).toFixed(4));
      const parsed = date ? new Date(date) : null;
      const valid = !!parsed && !isNaN(parsed.getTime());
      const locale = ar ? 'ar-EG' : 'en-US';
      const when = upfront ? (ar ? 'التوقيع' : 'Signing')
        : valid ? parsed!.toLocaleDateString(locale, { month: 'short', day: 'numeric' })
        : item.due_type === 'date' && item.period_days !== null && item.period_days !== undefined ? (ar ? `اليوم ${item.period_days}` : `Day ${item.period_days}`) : '—';
      const whenSub = upfront ? (ar ? 'اليوم 0' : 'Day 0') : valid ? parsed!.toLocaleDateString(locale, { year: 'numeric' }) : '';
      const tag = upfront ? (ar ? 'مقدّم' : 'Upfront')
        : item.isProjectEnd ? (ar ? 'نهاية المشروع' : 'Project end')
        : item.due_type === 'deliverable' ? (ar ? 'مخرج' : 'Deliverable') : (ar ? 'مدة' : 'Duration');
      const detail = upfront ? this.dueTypeLabel(item.due_type)
        : item.due_type === 'deliverable' ? this.installmentDeliverableTitle(item) : this.periodLabel(item.period_days);
      return { item, amount: this.installmentAmount(item), date, when, whenSub, tag, detail, upfront, cumulative };
    });
  }

  /** Last planned date in the schedule, for the timeline footer. */
  get summaryScheduleEnd(): string | null {
    const dates = this.summaryScheduleRows.map(row => row.date).filter((date): date is string => !!date).sort();
    return dates.length ? dates[dates.length - 1] : null;
  }
  private editSectionValid(section: 'scope' | 'deliverables'): boolean {
    const editor = this.requirementEditors?.find(item => item.section === section && !item.readOnly);
    const requirements = section === 'scope' ? this.scopeRequirements : this.deliverablesRequirements;
    if (!requirements.scopes.length && !requirements.service_components.length) return true;
    return editor?.complete ?? false;
  }
  private loadEditedOffer(uuid: string): void {
    this.isLoading = true;
    forkJoin({ record: this.projectOffersService.getProposalDetails(uuid), user: this.profile.getProfile() }).pipe(takeUntil(this.unsubscribe$)).subscribe({
      next: ({ record, user }) => {
        this.proposal = record; this.editUserId = Number(user?.id) || null;
        const adapted = offerEditRequirements(record, this.editUserId);
        this.editRequirements = this.editLocked ? mapMissingOfferRequirements(null) : adapted.requirements;
        this.scopeSeed = { offer_scopes: this.editLocked ? [] : adapted.draft.offer_scopes, offer_components: [] };
        this.deliverablesSeed = { offer_scopes: [], offer_components: this.editLocked ? [] : adapted.draft.offer_components };
        this.scopeDraft = JSON.parse(JSON.stringify(this.scopeSeed)); this.deliverablesDraft = JSON.parse(JSON.stringify(this.deliverablesSeed));
        this.editOfferDeliverableServiceIds = new Set(this.editRequirements.service_components.filter(group => editableOfferDeliverables(record, group.project_service_id!, this.editUserId).source === 'offer').map(group => group.project_service_id!));
        const scopes = this.readOnlyScopes, deliverables = this.readOnlyDeliverables;
        this.readOnlyScopeRequirements = { scopes: scopes.map(group => ({ project_service_id: group.serviceId, required_in_offer: false })), project_components: [], service_components: [] };
        this.readOnlyScopeSeed = { offer_scopes: scopes.reduce<OfferRequirementDraft['offer_scopes']>((all, group) => all.concat(group.items.map(item => ({ ...item, project_service_id: group.serviceId }))), []), offer_components: [] };
        this.readOnlyDeliverablesRequirements = { scopes: [], project_components: [], service_components: deliverables.map(group => ({ project_service_id: group.serviceId, component_id: -1, component: { id: -1, name: this.lang === 'ar' ? 'المخرجات' : 'Deliverables', slug: 'deliverable-stage' }, ownership_level: 'project_service', required_in_offer: false })) };
        this.readOnlyDeliverablesSeed = { offer_scopes: [], offer_components: deliverables.map(group => ({ project_service_id: group.serviceId, component_id: -1, value: { deliverables: group.items.map(item => ({ ...item, period_days: item.period_days ?? null, report_type: item.report_type ?? [], way: { ...item.way, selected: item.way?.selected ?? '', address: item.way?.address ?? '' } })) } })) };
        const terms = commercialDraft(record.offer ?? {});
        this.coverLetter = record.offer?.cover_letter || '';
        this.retainedAttachmentUuids = (record.offer?.files ?? []).map(file => file.uuid).filter(Boolean);
        this.selectedAttachments = []; this.attachmentErrors = [];
        this.suggestedDurationDays = offerDurationSuggestion(record.offer, record.project.schedule?.duration_days);
        this.priceType = terms.price_type as ProjectPriceType; this.fixedPrice = terms.fixed_price;
        this.hourlyRate = terms.hourly_rate ?? null; this.estimatedHours = terms.estimated_hours ?? null;
        this.dailyRate = terms.daily_rate ?? null; this.estimatedDays = terms.estimated_days ?? null;
        this.paymentPlan = terms.payment_plan as ProjectPaymentPlan;
        this.installments = terms.installments.map(item => this.createInstallment({ ...item, due_type: item.due_type as InstallmentDueType, period_days: item.period_days ?? null, project_service_deliverable_id: item.project_service_deliverable_id ?? null,
          deliverable_key: item.project_proposal_offer_deliverable_id ? `offer:${item.project_proposal_offer_deliverable_id}` : null }));
        this.installmentsTouched = true;
        this.editLinkedIds = linkedDeliverableIds([...(record.offer?.installments ?? []), ...(record.order?.installments ?? [])]);
        this.editLinkedOfferIds = new Set<number>((record.offer?.installments ?? []).map(item => Number(item.project_proposal_offer_deliverable_id)).filter(id => id > 0));
        this.editSnapshot = offerEditFingerprint(record);
        this.activeTab = this.tabs[0]?.key ?? 'review'; this.isLoading = false;
      }, error: error => { this.isLoading = false; this.editError = this.lang === 'ar' ? 'تعذر تحميل العرض. أعد المحاولة.' : 'Could not load the offer. Please try again.'; this.handleServerErrors(error); },
    });
  }
  private saveEditedOffer(): void {
    if (this.isSubmitting || !this.editDirty || this.editLocked || this.editStale) return;
    const invalid = this.firstInvalidTab();
    if (invalid) { this.markRequiredFieldsTouchedAndDirty(); return; }
    if (this.activeTab !== 'review') { this.selectTab('review'); return; }
    const payload = { ...this.editPatch, user_note: this.revisionNote.trim() || undefined };
    const files = [...this.selectedAttachments];
    // A request with uploads goes as multipart, which cannot carry an empty list.
    const multipart = files.length > 0 || payloadHasFiles(payload);
    if (multipart && emptyAgreementGroups(payload)) {
      this.editError = this.lang === 'ar'
        ? 'لا يمكن حذف كل نطاقات أو مخرجات خدمة ورفع ملفات جديدة في الحفظ نفسه. احفظ الحذف أولاً ثم ارفع الملفات.'
        : 'Removing every scope or deliverable of a service cannot be saved together with new files. Save the removal first, then upload the files.';
      return;
    }
    if (multipart && emptiedScopeFiles(payload)) {
      this.editError = this.lang === 'ar'
        ? 'لا يمكن حذف كل مرفقات نطاق فرعي ورفع ملفات جديدة في مكان آخر في الحفظ نفسه. احفظ الحذف أولاً ثم ارفع الملفات.'
        : 'Removing every file of a sub-scope cannot be saved together with new uploads elsewhere. Save the removal first, then upload the files.';
      return;
    }
    this.isSubmitting = true; this.editError = '';
    this.projectOffersService.getProposalDetails(this.proposalUuid!).pipe(takeUntil(this.unsubscribe$)).subscribe({
      next: latest => {
        if (offerEditFingerprint(latest) !== this.editSnapshot) { this.isSubmitting = false; this.editStale = true; return; }
        this.revisionsApi.update('insighter', this.proposal!.offer!.uuid, payload, files).pipe(takeUntil(this.unsubscribe$)).subscribe({
          next: revision => {
            this.isSubmitting = false; this.editSaved = true;
            this.revisionsApi.changed$.next({ projectUuid: this.proposalUuid!, revisionId: revision.id });
            this.showSuccess(this.lang === 'ar' ? 'تم حفظ التعديلات' : 'Changes saved', this.lang === 'ar' ? `تم حفظ المراجعة #${revision.revision_number}. سيتم إشعار العميل.` : `Revision #${revision.revision_number} saved. The client will be notified.`);
            this.router.navigate(this.editReturnRoute, { queryParams: { tab: 'revisions' } });
          }, error: error => { this.isSubmitting = false; this.editError = this.lang === 'ar' ? 'تعذر الحفظ. تغييراتك ما زالت موجودة، أعد المحاولة.' : 'Could not save. Your changes are still here; please retry.'; this.handleServerErrors(error); },
        });
      }, error: error => { this.isSubmitting = false; this.editError = this.lang === 'ar' ? 'تعذر التحقق من أحدث بيانات العرض. أعد المحاولة.' : 'Could not check the latest offer details. Please retry.'; this.handleServerErrors(error); },
    });
  }
  canDeactivate(): boolean | Observable<boolean> {
    if (!this.editMode || this.editSaved) return true;
    if (this.isSubmitting) return false;
    if (!this.editDirty && !this.revisionNote.trim()) return true;
    return from(Swal.fire({ title: this.lang === 'ar' ? 'تجاهل التغييرات غير المحفوظة؟' : 'Discard unsaved changes?', icon: 'warning', showCancelButton: true,
      confirmButtonText: this.lang === 'ar' ? 'تجاهل التغييرات' : 'Discard changes', cancelButtonText: this.lang === 'ar' ? 'متابعة التعديل' : 'Keep editing' })).pipe(map(result => result.isConfirmed));
  }
  @HostListener('window:beforeunload', ['$event']) beforeUnload(event: BeforeUnloadEvent): void {
    if (this.editMode && !this.editSaved && (this.editDirty || this.revisionNote.trim() || this.isSubmitting)) { event.preventDefault(); event.returnValue = ''; }
  }

  // ---------- Display helpers (mirror project-detail patterns) ----------

  getTypeLabel(type: string | null | undefined): string {
    if (!type) return '-';
    const meta = this.projectTypeOptions.find(o => o.key === type);
    if (!meta) return this.humanizeValue(type);
    return this.lang === 'ar' ? meta.labelAr : meta.labelEn;
  }

  /** Insighter-side status of this proposal match (not the client's project status). */
  getStatusBadgeClass(status: string | null | undefined): string {
    switch ((status || '').toLowerCase()) {
      case 'pending': return 'badge-light-warning';
      case 'viewed': return 'badge-light-info';
      case 'interested':
      case 'offered': return 'badge-light-success';
      case 'not_interested':
      case 'expired': return 'badge-light-danger';
      default: return 'badge-light-info';
    }
  }

  getStatusLabel(status: string | null | undefined): string {
    const labels: Record<string, { en: string; ar: string }> = {
      pending: { en: 'Pending', ar: 'قيد الانتظار' },
      viewed: { en: 'Viewed', ar: 'تمت المشاهدة' },
      interested: { en: 'Interested', ar: 'مهتم' },
      offered: { en: 'Offered', ar: 'تم تقديم العرض' },
      not_interested: { en: 'Not Interested', ar: 'غير مهتم' },
      expired: { en: 'Expired', ar: 'منتهي' },
    };
    const key = (status || '').toLowerCase();
    const match = labels[key];
    if (!match) return status ? this.humanizeValue(status) : '-';
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
  trackByExistingAttachment(_: number, row: { file: ProjectOfferFile }): string { return row.file.uuid; }

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
    const text = (this.coverLetter || '').trim();
    if (text.length > COVER_LETTER_MAX_LENGTH) return true;
    // An edit only fails when it clears a saved text: an offer saved without one can still change other terms.
    return this.editMode ? !text && !!(this.proposal?.offer?.cover_letter || '').trim() : !text;
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
      (this.hasAttemptedTab(this.activeTab) || model?.touched || model?.dirty)
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
      if (item.due_type === 'deliverable') {
        if (item.project_service_deliverable_id) {
          formData.append(`${prefix}[project_service_deliverable_id]`, `${item.project_service_deliverable_id}`);
        } else if (item.deliverable_key) {
          formData.append(`${prefix}[deliverable_key]`, item.deliverable_key);
        }
      }
    });

    formData.append('cover_letter', (this.coverLetter || '').trim());
    if (this.suggestedDurationDays !== null) formData.append('suggested_duration_days', `${this.suggestedDurationDays}`);

    this.selectedAttachments.forEach((file, index) => {
      formData.append(`files[${index}]`, file, file.name);
    });

    appendRequirementFormData(formData, 'offer_scopes', this.requirementDraft.offer_scopes.map(scope => ({ project_service_id: scope.project_service_id, scope: scope.scope.trim(), description: scope.description?.trim(), subscopes: (scope.subscopes ?? []).map(child => ({ scope: child.scope.trim(), description: child.description?.trim() })) })));
    // Sub-scope files go under the same indexes as the sub-scopes above.
    this.requirementDraft.offer_scopes.forEach((scope, scopeIndex) => (scope.subscopes ?? []).forEach((child, childIndex) =>
      (child.new_files ?? []).forEach((file, fileIndex) => formData.append(`offer_scopes[${scopeIndex}][subscopes][${childIndex}][file][${fileIndex}]`, file, file.name))));
    appendRequirementFormData(formData, 'offer_components', this.requirementDraft.offer_components.map(component => ({ project_service_id: component.project_service_id, component_id: component.component_id, value: component.value })));
    return formData;
  }

  private isProposalFormInvalid(): boolean {
    return !this.requirementsValid || !this.proposal
      || this.isCoverLetterInvalid()
      || !!this.suggestedDurationError
      || !!this.durationOverflowDays
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
    const invalidTab = this.firstInvalidTab();
    if (invalidTab) this.activeTab = invalidTab;
    this.revealValidationErrors();
  }

  private revealValidationErrors(): void {
    setTimeout(() => {
      this.requirementEditors?.forEach(editor => {
        if (editor.section === this.activeTab) editor.revealFirstIncompleteRow();
      });
      // Wait for the reopened accordion's fields to render before focusing one.
      setTimeout(() => this.scrollToFirstInvalidField(), 0);
    }, 0);
  }

  private scrollToFirstInvalidField(): void {
    const panel = document.getElementById(`sp-panel-${this.activeTab}`);
    const firstInvalid = panel?.querySelector<HTMLElement>(
      '.sp-input.is-invalid, .sp-input-group.is-invalid, .sp-pay-card.is-invalid, .sp-installments__total.is-invalid, .sw-input.is-invalid, .sw-pill.is-invalid, .sp-duration-callout.is-invalid'
    ) ?? panel?.querySelector<HTMLElement>('.sw-row.is-error .sw-row__toggle');
    firstInvalid?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const control = firstInvalid?.matches('input, textarea, select, button')
      ? firstInvalid : firstInvalid?.querySelector<HTMLElement>('input, textarea, select, button');
    control?.focus({ preventScroll: true });
  }

  private loadAll(uuid: string): void {
    if (this.editMode) { this.loadEditedOffer(uuid); return; }
    this.projectOffersService.getProposalDetails(uuid)
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe({
        next: (proposal) => {
          this.proposal = proposal;
          this.scopeDraft = { offer_scopes: [], offer_components: [] };
          this.deliverablesDraft = { offer_scopes: [], offer_components: [] };
          if (!this.tabs.some(tab => tab.key === this.activeTab)) this.activeTab = 'cover';
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
}
