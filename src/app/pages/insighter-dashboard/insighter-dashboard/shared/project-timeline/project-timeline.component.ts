import { Component, EventEmitter, Input, Output } from '@angular/core';
import {
  ProjectTimelineStep,
  TIMELINE_STEP,
  TimelineParty,
  TimelineActionType,
  TimelineAudience,
  TimelineStepActionEvent,
  isDraftStep,
  isPartyStep,
  isPaymentStep,
} from 'src/app/_fake/services/project-timeline/project-timeline.model';
import { environment } from 'src/environments/environment';

type ContractStepState = 'waiting_user' | 'waiting_insighter' | 'completed' | null;

interface TimelineBadge {
  label: string;
  cssClass: string;
  tone: 'success' | 'warning' | 'primary' | 'muted' | 'danger';
}

/**
 * Presentational timeline. Renders the API-driven project timeline steps as the
 * shared "Project Actions" card + dot + progress-line design, and emits
 * `stepAction` events (keyed by step `key`) for the host to handle. All render
 * decisions come from the step payload (`display`, `state`, `status`, `amount`,
 * `date`, `party`) — the component never decides which steps exist.
 */
@Component({
  selector: 'app-project-timeline',
  templateUrl: './project-timeline.component.html',
  styleUrls: ['./project-timeline.component.scss'],
})
export class ProjectTimelineComponent {
  @Input() steps: ProjectTimelineStep[] = [];
  @Input() audience: TimelineAudience = 'client';
  @Input() lang: 'en' | 'ar' | string = 'en';

  /** Client action / in-flight state (ignored for the insighter audience). */
  @Input() paymentSubmitting = false;
  @Input() closeSubmitting = false;
  @Input() closeError: string | null = null;
  @Input() canClose = false;
  @Input() closeDisabledReason = '';
  @Input() contractState: ContractStepState = null;
  @Input() paymentButtonLabel = '';
  @Input() canViewOffer = false;
  @Input() canViewContract = true;

  @Output() stepAction = new EventEmitter<TimelineStepActionEvent>();

  readonly STEP = TIMELINE_STEP;

  get visibleSteps(): ProjectTimelineStep[] {
    return this.orderVisibleSteps(this.normalizeClosedStep((this.steps || []).filter(step => step?.display)));
  }

  get isClient(): boolean {
    return this.audience === 'client';
  }

  /** Progress % for the vertical connector: reaches the last completed dot. */
  get progress(): string {
    const steps = this.visibleSteps;
    if (steps.length <= 1) {
      return steps.length === 1 && steps[0].state === 'completed' ? '100%' : '0%';
    }

    let lastCompleted = -1;
    steps.forEach((step, index) => {
      if (step.state === 'completed') {
        lastCompleted = index;
      }
    });

    if (lastCompleted < 0) {
      return '0%';
    }

    return `${(lastCompleted / (steps.length - 1)) * 100}%`;
  }

  trackByStep(_index: number, step: ProjectTimelineStep): string {
    return `${step.key}-${step.step_no}`;
  }

  isPayment(step: ProjectTimelineStep): boolean {
    return isPaymentStep(step.key);
  }

  isDraft(step: ProjectTimelineStep): boolean {
    return isDraftStep(step.key);
  }

  isParty(step: ProjectTimelineStep): boolean {
    return isPartyStep(step.key);
  }

  private orderVisibleSteps(steps: ProjectTimelineStep[]): ProjectTimelineStep[] {
    const completedPartyIndex = steps.findIndex(step => this.isParty(step) && this.isCompleted(step));

    if (completedPartyIndex <= 0) {
      return steps;
    }

    const orderedSteps = [...steps];
    const [completedPartyStep] = orderedSteps.splice(completedPartyIndex, 1);
    orderedSteps.unshift(completedPartyStep);
    return orderedSteps;
  }

  private normalizeClosedStep(steps: ProjectTimelineStep[]): ProjectTimelineStep[] {
    const finalPaymentCompleted = steps.some(step => this.isFinalSettlementPayment(step) && this.isCompleted(step));

    if (!finalPaymentCompleted) {
      return steps;
    }

    return steps.map(step => {
      if (step.key !== TIMELINE_STEP.CLOSED_PROJECT) {
        return step;
      }

      return {
        ...step,
        status: 'completed',
        state: 'completed',
      };
    });
  }

  private isFinalSettlementPayment(step: ProjectTimelineStep): boolean {
    return step.key === TIMELINE_STEP.FINAL_PAYMENT
      || step.key === TIMELINE_STEP.FULL_PAYMENT_AT_END;
  }

  isActive(step: ProjectTimelineStep): boolean {
    return step.state === 'in_progress';
  }

  isCompleted(step: ProjectTimelineStep): boolean {
    return step.state === 'completed';
  }

  isLocked(step: ProjectTimelineStep): boolean {
    return step.state === 'locked';
  }

  isPending(step: ProjectTimelineStep): boolean {
    return !this.isCompleted(step) && !this.isActive(step);
  }

  isReadonlyContractStatus(step: ProjectTimelineStep): boolean {
    return !this.isClient
      && step.key === TIMELINE_STEP.CONTRACTING
      && this.isActive(step)
      && step.status === 'awaiting_client_signature';
  }

  isActiveDraftSubmission(step: ProjectTimelineStep): boolean {
    return !this.isClient && this.isDraft(step) && this.isActive(step);
  }

  isReadonlyDraftReviewStatus(step: ProjectTimelineStep): boolean {
    return this.isActiveDraftSubmission(step) && step.status === 'pending';
  }

  /** Amount is only ever rendered for payment steps that carry a value. */
  showAmount(step: ProjectTimelineStep): boolean {
    return this.isPayment(step) && step.amount !== null && step.amount !== undefined;
  }

  amountLabel(step: ProjectTimelineStep): string {
    if (!this.showAmount(step)) {
      return '';
    }

    try {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(Number(step.amount));
    } catch {
      return `$${Number(step.amount).toFixed(2)}`;
    }
  }

  dateLabel(step: ProjectTimelineStep): string {
    if (!step.date) {
      return '';
    }

    const parsed = new Date(step.date);
    if (isNaN(parsed.getTime())) {
      return step.date;
    }

    return new Intl.DateTimeFormat(this.lang === 'ar' ? 'ar' : 'en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(parsed);
  }

  stepNumberLabel(step: ProjectTimelineStep): string {
    if (step.key === TIMELINE_STEP.CANCELLED_PROJECT) {
      return '';
    }

    const stepWord = this.lang === 'ar' ? 'الخطوة' : 'Step';
    const displayStepNo = this.displayStepNumber(step);

    return step.key === TIMELINE_STEP.CLOSED_PROJECT
      ? (this.lang === 'ar' ? 'الخطوة الأخيرة' : 'Final Step')
      : `${stepWord} ${displayStepNo}`;
  }

  private displayStepNumber(step: ProjectTimelineStep): number | string {
    if (step.key === TIMELINE_STEP.CONTRACTING && this.hasVisiblePartyStep()) {
      return 2;
    }

    return step.step_no ?? '';
  }

  private hasVisiblePartyStep(): boolean {
    return this.visibleSteps.some(item => this.isParty(item));
  }

  iconClass(step: ProjectTimelineStep): string {
    switch (step.key) {
      case TIMELINE_STEP.CONTRACTING:
        return 'ki-notepad-edit';
      case TIMELINE_STEP.AWARDED_INSIGHTER:
      case TIMELINE_STEP.CLIENT_INFO:
        return 'ki-profile-circle';
      case TIMELINE_STEP.DOWN_PAYMENT:
        return 'ki-credit-cart';
      case TIMELINE_STEP.FULL_PAYMENT_AT_START:
      case TIMELINE_STEP.FULL_PAYMENT_AT_END:
      case TIMELINE_STEP.FINAL_PAYMENT:
        return 'ki-dollar';
      case TIMELINE_STEP.FIRST_DRAFT:
        return 'ki-file-added';
      case TIMELINE_STEP.FINAL_DRAFT:
        return 'ki-file-right';
      case TIMELINE_STEP.CLOSED_PROJECT:
        return 'ki-check-circle';
      case TIMELINE_STEP.CANCELLED_PROJECT:
        return 'ki-cross-circle';
      default:
        return 'ki-abstract-26';
    }
  }

  /** Dot color bucket. */
  dotModifier(step: ProjectTimelineStep): string {
    if (step.status === 'cancelled' || step.key === TIMELINE_STEP.CANCELLED_PROJECT) {
      return 'pd-timeline-dot--danger';
    }
    if (this.isCompleted(step)) {
      return 'pd-timeline-dot--completed';
    }
    if (this.isActive(step)) {
      // Contract awaiting the client's own signature reads as a warning cue.
      if (this.isClient && step.key === TIMELINE_STEP.CONTRACTING && this.contractState === 'waiting_user') {
        return 'pd-timeline-dot--warning';
      }
      return 'pd-timeline-dot--active';
    }
    return 'pd-timeline-dot--pending';
  }

  badge(step: ProjectTimelineStep): TimelineBadge {
    const ar = this.lang === 'ar';

    if (step.status === 'cancelled' || step.key === TIMELINE_STEP.CANCELLED_PROJECT) {
      return { label: ar ? 'ملغي' : 'Cancelled', cssClass: '', tone: 'danger' };
    }

    // Contract step reflects the signature stage for the client.
    if (this.isClient && step.key === TIMELINE_STEP.CONTRACTING && this.isActive(step)) {
      if (this.contractState === 'waiting_user') {
        return { label: ar ? 'بانتظار توقيعك' : 'Waiting your sign', cssClass: '', tone: 'warning' };
      }
      return { label: ar ? 'بانتظار توقيع الخبير' : "Awaiting Insighter's Signature", cssClass: '', tone: 'primary' };
    }

    if (this.isCompleted(step)) {
      return { label: ar ? 'مكتمل' : 'Completed', cssClass: '', tone: 'success' };
    }

    if (!this.isClient && this.isPayment(step) && this.isActive(step)) {
      return { label: ar ? 'بانتظار دفع العميل' : 'Awaiting Client Payment', cssClass: '', tone: 'primary' };
    }

    if (this.isReadonlyDraftReviewStatus(step)) {
      return { label: ar ? 'بانتظار مراجعة العميل' : "Waiting Client's Review", cssClass: '', tone: 'primary' };
    }

    switch (step.status) {
      case 'changes_requested':
        return { label: ar ? 'مطلوب تعديل' : 'Changes Requested', cssClass: '', tone: 'warning' };
      case 'pending':
        return this.isActive(step)
          ? { label: ar ? 'قيد التنفيذ' : 'In Progress', cssClass: '', tone: 'primary' }
          : { label: ar ? 'قيد الانتظار' : 'Pending', cssClass: '', tone: 'muted' };
      case 'waiting_for_draft':
        return this.isActive(step)
          ? { label: ar ? 'قيد التنفيذ' : 'In Progress', cssClass: '', tone: 'primary' }
          : { label: ar ? 'قيد الانتظار' : 'Pending', cssClass: '', tone: 'muted' };
      default:
        if (this.isActive(step)) {
          return { label: ar ? 'قيد التنفيذ' : 'In Progress', cssClass: '', tone: 'primary' };
        }
        return { label: ar ? 'قيد الانتظار' : 'Pending', cssClass: '', tone: 'muted' };
    }
  }

  /** Which action (if any) this step exposes for the current audience. */
  actionType(step: ProjectTimelineStep): TimelineActionType | null {
    if (this.isDraft(step) && this.isCompleted(step)) {
      return 'view_reviews';
    }

    if (step.key === TIMELINE_STEP.CONTRACTING && this.isCompleted(step) && this.canViewContract) {
      return 'view_contract';
    }

    if (this.isClient) {
      if (step.key === TIMELINE_STEP.CONTRACTING && this.isActive(step) && this.contractState === 'waiting_user') {
        return 'view_contract';
      }
      if (this.isPayment(step) && this.isActive(step)) {
        return 'pay';
      }
      if (this.isDraft(step) && this.hasSubmission(step)) {
        return 'open_review';
      }
      if (step.key === TIMELINE_STEP.CLOSED_PROJECT && this.isActive(step) && this.canClose) {
        return 'close_project';
      }
      return null;
    }

    if (step.key === TIMELINE_STEP.CONTRACTING && this.isActive(step) && step.status === 'awaiting_insighter_signature') {
      return 'view_contract';
    }

    if (this.isDraft(step) && (this.isCompleted(step) || this.isReadonlyDraftReviewStatus(step))) {
      return null;
    }

    // Insighter: only the draft/review steps are interactive.
    if (this.isDraft(step) && !this.isLocked(step)) {
      return 'open_review';
    }
    return null;
  }

  actionLabel(step: ProjectTimelineStep): string {
    const ar = this.lang === 'ar';
    switch (this.actionType(step)) {
      case 'view_contract':
        if (this.isCompleted(step)) {
          return ar ? 'عرض العقد' : 'View Contract';
        }
        return this.isClient
          ? (ar ? 'بانتظار توقيعك' : 'Waiting your sign')
          : (ar ? 'بانتظار توقيعك' : 'Waiting your Signature');
      case 'view_offer':
        return ar ? 'عرض العرض' : 'View Offer';
      case 'pay':
        return this.paymentButtonLabel || (ar ? 'ادفع الآن' : 'Pay Now');
      case 'open_review':
        if (this.isActiveDraftSubmission(step) && step.status === 'changes_requested') {
          return ar ? 'مطلوب تعديل' : 'Change Requested';
        }
        if (this.isActiveDraftSubmission(step)) {
          return step.key === TIMELINE_STEP.FINAL_DRAFT
            ? (ar ? 'إرسال المسودة النهائية' : 'Submit Final Draft')
            : (ar ? 'إرسال المسودة الأولى' : 'Submit First Draft');
        }
        return ar ? 'فتح المراجعة' : 'Open Review';
      case 'view_reviews':
        return ar ? 'عرض المراجعات' : 'View Reviews';
      case 'close_project':
        return this.closeSubmitting
          ? (ar ? 'جاري الإغلاق...' : 'Closing...')
          : (ar ? 'إغلاق المشروع' : 'Close Project');
      default:
        return '';
    }
  }

  actionIcon(step: ProjectTimelineStep): string {
    switch (this.actionType(step)) {
      case 'view_contract':
        return this.isCompleted(step) ? 'ki-document' : 'ki-notepad-edit';
      case 'view_offer':
        return 'ki-briefcase';
      case 'pay':
        return 'ki-credit-cart';
      case 'open_review':
        if (this.isActiveDraftSubmission(step) && step.status === 'changes_requested') {
          return 'ki-message-question';
        }
        if (this.isActiveDraftSubmission(step)) {
          return 'ki-file-up';
        }
        return 'ki-eye';
      case 'view_reviews':
        return 'ki-eye';
      case 'close_project':
        return 'ki-check';
      default:
        return '';
    }
  }

  readonlyContractStatusLabel(): string {
    return this.lang === 'ar' ? 'بانتظار توقيع العميل' : 'Waiting for client signature';
  }

  readonlyDraftReviewStatusLabel(): string {
    return this.lang === 'ar' ? 'بانتظار مراجعة العميل' : "Waiting Client's Review";
  }

  cancelledByClientLabel(): string {
    return this.lang === 'ar'
      ? 'تم إلغاء هذا المشروع من قبل العميل.'
      : 'This project has been cancelled by the client.';
  }

  actionDisabled(step: ProjectTimelineStep): boolean {
    switch (this.actionType(step)) {
      case 'pay':
        return this.paymentSubmitting;
      case 'close_project':
        return this.closeSubmitting;
      default:
        return false;
    }
  }

  hasSubmission(step: ProjectTimelineStep): boolean {
    const status = step.status;
    return status === 'pending' || status === 'approved' || status === 'changes_requested';
  }

  partyInitials(step: ProjectTimelineStep): string {
    const name = step.party?.name || '';
    return name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map(part => part.charAt(0).toUpperCase())
      .join('');
  }

  partyAvatar(party: TimelineParty): string | null {
    return party.avatar || party.image || null;
  }

  partyDisplayName(party: TimelineParty | null | undefined): string {
    return party?.legal_name || party?.name || '-';
  }

  partyProfileUrl(step: ProjectTimelineStep | null | undefined): string {
    const uuid = step?.party?.uuid;
    const locale = this.lang === 'ar' ? 'ar' : 'en';
    if (!uuid) {
      return '';
    }

    return `${environment.mainAppUrl}/${locale}/profile/${uuid}?entity=insighter`;
  }

  viewOfferLabel(): string {
    return this.lang === 'ar' ? 'عرض العرض' : 'View Offer';
  }

  viewProfileLabel(): string {
    return this.lang === 'ar' ? 'عرض الملف' : 'View Profile';
  }

  onOfferAction(step: ProjectTimelineStep): void {
    if (!this.canViewOffer) {
      return;
    }
    this.stepAction.emit({ key: step.key, action: 'view_offer', step });
  }

  onAction(step: ProjectTimelineStep): void {
    const action = this.actionType(step);
    if (!action) {
      return;
    }
    if (this.actionDisabled(step)) {
      return;
    }
    this.stepAction.emit({ key: step.key, action, step });
  }
}
