import { MissingOfferRequirements, OfferRequirementDraft, appendRequirementFormData, mapMissingOfferRequirements, offerRequirementsAreComplete } from 'src/app/_fake/services/project-phase2/project-requirements.model';
import { Component, Injector, OnDestroy, OnInit, QueryList, ViewChildren } from '@angular/core';
import { CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import { NgModel } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntil } from 'rxjs/operators';
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

export type ProposalTab = 'cover' | 'scope' | 'deliverables' | 'pricing' | 'payment';

interface ProposalTabItem {
  key: ProposalTab;
  label: { en: string; ar: string };
  icon: string;
}

const PROPOSAL_TABS: ProposalTabItem[] = [
  { key: 'cover', label: { en: 'Cover letter', ar: 'الرسالة التعريفية' }, icon: 'ki-document' },
  { key: 'scope', label: { en: 'Scope of work', ar: 'نطاق العمل' }, icon: 'ki-questionnaire-tablet' },
  { key: 'deliverables', label: { en: 'Deliverables', ar: 'المخرجات' }, icon: 'ki-cube-2' },
  { key: 'pricing', label: { en: 'Pricing', ar: 'التسعير' }, icon: 'ki-price-tag' },
  { key: 'payment', label: { en: 'Payment schedule', ar: 'جدول الدفعات' }, icon: 'ki-calendar' },
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
    const source = this.proposal?.missing_offer_requirements;
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
  get scopeRequirementsValid(): boolean { return offerRequirementsAreComplete(this.scopeRequirements, this.scopeDraft); }
  get deliverablesRequirementsValid(): boolean { return offerRequirementsAreComplete(this.deliverablesRequirements, this.deliverablesDraft); }
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
  selectedAttachments: File[] = [];
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
    return PROPOSAL_TABS.filter(tab => (tab.key !== 'scope' || hasScope) && (tab.key !== 'deliverables' || hasDeliverables));
  }

  get nextTab(): ProposalTabItem | null {
    const tabs = this.tabs;
    return tabs[tabs.findIndex(tab => tab.key === this.activeTab) + 1] ?? null;
  }

  selectTab(tab: ProposalTab, focus = false): boolean {
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
    setTimeout(() => {
      if (focus) document.getElementById(`sp-tab-${tab}`)?.focus();
      this.revealActiveTab();
    }, 0);
    return true;
  }

  /** On narrow screens the tab strip scrolls; keep the active tab centred in it. */
  private revealActiveTab(): void {
    const tabEl = document.getElementById(`sp-tab-${this.activeTab}`);
    const strip = tabEl?.parentElement;
    if (!tabEl || !strip || strip.scrollWidth <= strip.clientWidth) return;
    const tabRect = tabEl.getBoundingClientRect();
    const stripRect = strip.getBoundingClientRect();
    const delta = (tabRect.left + tabRect.width / 2) - (stripRect.left + stripRect.width / 2);
    strip.scrollBy({ left: delta, behavior: 'smooth' });
  }

  onTabKeydown(event: KeyboardEvent): void {
    const keys = this.tabs.map(tab => tab.key);
    const index = keys.indexOf(this.activeTab);
    const forward = this.lang === 'ar' ? 'ArrowLeft' : 'ArrowRight';
    const backward = this.lang === 'ar' ? 'ArrowRight' : 'ArrowLeft';
    let next = -1;
    if (event.key === forward) next = (index + 1) % keys.length;
    else if (event.key === backward) next = (index - 1 + keys.length) % keys.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = keys.length - 1;
    if (next < 0) return;
    event.preventDefault();
    this.selectTab(keys[next], true);
  }

  goToNextTab(): void {
    const next = this.nextTab;
    if (!next) return;
    if (this.selectTab(next.key)) window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  private isTabInvalid(tab: ProposalTab): boolean {
    const invalid: Record<ProposalTab, boolean> = {
      cover: this.isCoverLetterInvalid(),
      scope: !this.scopeRequirementsValid,
      deliverables: !this.deliverablesRequirementsValid,
      pricing: this.isPricingInvalid(),
      payment: this.isPaymentPlanInvalid(),
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
      item.period_days = this.durationDays;
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
    if (this.paymentPlan !== 'full' || this.durationDays === null) return;
    item.isProjectEnd = true;
    item.due_type = 'date';
    item.period_days = this.durationDays;
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
    if (this.durationDays !== null && paymentDays !== null && paymentDays !== undefined
      && Number(paymentDays) > this.durationDays) {
      errors.push(ar
        ? `لا يمكن أن تتجاوز مدة استحقاق الدفعة مدة المشروع (${this.durationDays} يومًا).`
        : `Payment duration cannot exceed the project duration (${this.durationDays} days).`);
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
        period_days: firstDeliverable ? firstDeliverable.period_days : (this.durationDays ?? 0),
        project_service_deliverable_id: typeof firstDeliverable?.reference === 'number' ? firstDeliverable.reference : null,
        deliverable_key: typeof firstDeliverable?.reference === 'string' ? firstDeliverable.reference : null,
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

    this.selectedAttachments.forEach((file, index) => {
      formData.append(`files[${index}]`, file, file.name);
    });

    appendRequirementFormData(formData, 'offer_scopes', this.requirementDraft.offer_scopes.map(scope => ({ project_service_id: scope.project_service_id, scope: scope.scope.trim(), description: scope.description?.trim(), subscopes: (scope.subscopes ?? []).map(child => ({ scope: child.scope.trim(), description: child.description?.trim() })) })));
    appendRequirementFormData(formData, 'offer_components', this.requirementDraft.offer_components.map(component => ({ project_service_id: component.project_service_id, component_id: component.component_id, value: component.value })));
    return formData;
  }

  private isProposalFormInvalid(): boolean {
    return !this.requirementsValid || !this.proposal
      || this.isCoverLetterInvalid()
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
      this.revealActiveTab();
      // Wait for the reopened accordion's fields to render before focusing one.
      setTimeout(() => this.scrollToFirstInvalidField(), 0);
    }, 0);
  }

  private scrollToFirstInvalidField(): void {
    const panel = document.getElementById(`sp-panel-${this.activeTab}`);
    const firstInvalid = panel?.querySelector<HTMLElement>(
      '.sp-input.is-invalid, .sp-input-group.is-invalid, .sp-pay-card.is-invalid, .sp-installments__total.is-invalid, .sw-input.is-invalid, .sw-pill.is-invalid'
    ) ?? panel?.querySelector<HTMLElement>('.sw-row.is-error .sw-row__toggle');
    firstInvalid?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const control = firstInvalid?.matches('input, textarea, select, button')
      ? firstInvalid : firstInvalid?.querySelector<HTMLElement>('input, textarea, select, button');
    control?.focus({ preventScroll: true });
  }

  private loadAll(uuid: string): void {
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

  override ngOnDestroy(): void {
    super.ngOnDestroy();
  }
}
