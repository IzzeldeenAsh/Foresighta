import { Component, Injector, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { finalize, takeUntil, tap } from 'rxjs/operators';
import { WalletService } from 'src/app/_fake/services/wallet/wallet.service';
import { BaseComponent } from 'src/app/modules/base.component';
import { environment } from 'src/environments/environment';
import {
  CreatedProject,
  CreatedProjectBlock,
  CreatedProjectFile,
  CreatedProjectOrder,
  CreatedProjectProposalInvite,
  CreatedProjectProposalMatch,
  CreatedProjectProposalMatchCountry,
  CreatedProjectScope,
  CreatedProjectSubmittedOffer,
  CreatedProjectType,
  ProjectCheckoutPaymentMethod,
  ProjectFileUploadType,
  ProjectReviewAction,
  ProjectReviewSubmission,
  ProjectsCreatedService,
  SubmitRematchProposalPayload,
} from 'src/app/_fake/services/projects-created/projects-created.service';

type ProjectDetailTab = 'overview' | 'documents' | 'reviews';
type RematchWizardStep = 'matches' | 'deadline';
type RematchPhase = 'idle' | 'creating' | 'loading' | 'ready' | 'empty' | 'error' | 'submitting';

interface ProjectDocumentGroup {
  key: string;
  labelEn: string;
  labelAr: string;
  descriptionEn: string;
  descriptionAr: string;
  files: CreatedProjectFile[];
}

interface ProjectFileTypeOption {
  value: ProjectFileUploadType;
  labelEn: string;
  labelAr: string;
}

interface MatchCriteriaEntry {
  key: string;
  label: string;
  matched: boolean;
}

const MATCH_CRITERIA_LABELS: Record<string, { en: string; ar: string }> = {
  ORIGIN_MATCH: { en: 'Origin', ar: 'البلد' },
  INDUSTRY_MATCH: { en: 'Industry', ar: 'القطاع' },
  EXPERIENCE_MATCH: { en: 'Experience', ar: 'الخبرة' },
  TEAM_SIZE_MATCH: { en: 'Team size', ar: 'حجم الفريق' },
  INSIGHTER_TYPE_MATCH: { en: 'Insighter type', ar: 'نوع الخبير' },
};

const PROJECT_FILE_GROUP_META: Record<string, Omit<ProjectDocumentGroup, 'files'>> = {
  first_draft: {
    key: 'first_draft',
    labelEn: 'First Draft',
    labelAr: 'المسودة الأولى',
    descriptionEn: 'Initial deliverables submitted by the insighter or client.',
    descriptionAr: 'المخرجات الأولية المرسلة من الخبير أو العميل.',
  },
  final_draft: {
    key: 'final_draft',
    labelEn: 'Final Draft',
    labelAr: 'المسودة النهائية',
    descriptionEn: 'Final delivery files for acceptance.',
    descriptionAr: 'ملفات التسليم النهائية للاعتماد.',
  },
  samples: {
    key: 'samples',
    labelEn: 'Samples',
    labelAr: 'عينات',
    descriptionEn: 'Sample materials and partial outputs.',
    descriptionAr: 'مواد عينة ومخرجات جزئية.',
  },
  document: {
    key: 'document',
    labelEn: 'Documents',
    labelAr: 'مستندات',
    descriptionEn: 'Supporting documents and working files.',
    descriptionAr: 'المستندات الداعمة وملفات العمل.',
  },
  other: {
    key: 'other',
    labelEn: 'Other',
    labelAr: 'أخرى',
    descriptionEn: 'Additional project materials.',
    descriptionAr: 'مواد إضافية للمشروع.',
  },
  unknown: {
    key: 'unknown',
    labelEn: 'Uncategorized',
    labelAr: 'غير مصنفة',
    descriptionEn: 'Files without a delivery category.',
    descriptionAr: 'ملفات بدون تصنيف تسليم.',
  },
};

const PROJECT_FILE_GROUP_ORDER = ['first_draft', 'final_draft', 'samples', 'document', 'other'];

@Component({
  selector: 'app-project-detail',
  templateUrl: './project-detail.component.html',
  styleUrl: './project-detail.component.scss'
})
export class ProjectDetailComponent extends BaseComponent implements OnInit, OnDestroy {
  project: CreatedProject | null = null;
  invitedInsighters: CreatedProjectProposalInvite[] = [];
  activeTab: ProjectDetailTab = 'overview';
  isLoading: boolean = false;
  proposalDrawerVisible: boolean = false;
  selectedInvite: CreatedProjectProposalInvite | null = null;
  openingFileUuid: string | null = null;
  acceptingOfferUuid: string | null = null;
  rematchDialogVisible = false;
  rematchStep: RematchWizardStep = 'matches';
  rematchPhase: RematchPhase = 'idle';
  rematchProposalUuid = '';
  rematchMatches: CreatedProjectProposalMatch[] = [];
  selectedRematchIds: string[] = [];
  includePreviousInvited = false;
  deadlineOfferDate = '';
  rematchError: string | null = null;
  expandedMatchIds = new Set<string>();
  projectPaymentDialogVisible = false;
  selectedProjectPaymentMethod: ProjectCheckoutPaymentMethod | null = null;
  projectCheckoutSubmitting = false;
  projectCheckoutError: string | null = null;
  projectWalletBalance: number | null = null;
  isProjectWalletBalanceLoading = false;
  projectWalletBalanceLoadFailed = false;
  reviewSubmissions: ProjectReviewSubmission[] = [];
  reviewSubmissionsLoading = false;
  respondingReviewUuid: string | null = null;
  reviewChangeNotes: Record<string, string> = {};
  projectFileName = '';
  projectFileType: ProjectFileUploadType = 'document';
  selectedProjectFiles: File[] = [];
  projectFilesUploading = false;

  private rematchMatchDelayTimer: ReturnType<typeof setTimeout> | null = null;

  private projectTypeOptions = [
    { key: 'ad_hoc', labelEn: 'Ad Hoc', labelAr: 'خاص' },
    { key: 'frame_work_agreement', labelEn: 'Framework Agreement', labelAr: 'اتفاقية إطارية' },
    { key: 'urgent_request', labelEn: 'Urgent Request', labelAr: 'طلب عاجل' },
  ];
  projectFileTypeOptions: ProjectFileTypeOption[] = [
    { value: 'first_draft', labelEn: 'First Draft', labelAr: 'المسودة الأولى' },
    { value: 'final_draft', labelEn: 'Final Draft', labelAr: 'المسودة النهائية' },
    { value: 'samples', labelEn: 'Samples', labelAr: 'عينات' },
    { value: 'document', labelEn: 'Documents', labelAr: 'مستندات' },
    { value: 'other', labelEn: 'Other', labelAr: 'أخرى' },
  ];

  constructor(
    injector: Injector,
    private route: ActivatedRoute,
    private router: Router,
    private projectsCreatedService: ProjectsCreatedService,
    private walletService: WalletService,
  ) {
    super(injector);
  }

  ngOnInit(): void {
    this.projectsCreatedService.isLoading$
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe(loading => this.isLoading = loading);

    this.route.paramMap
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe(params => {
        const uuid = params.get('uuid');
        if (uuid) this.loadProject(uuid);
      });
  }

  goBack(): void {
    this.router.navigate(['/app/insighter-dashboard/projects-created']);
  }

  onRematch(): void {
    if (!this.project?.uuid) return;

    this.resetRematchState();
    this.closeProposalDrawer();
    this.deadlineOfferDate = this.defaultOfferExpiryDate(this.project.type);
    this.rematchPhase = 'creating';

    this.projectsCreatedService.createProjectProposal(this.project.uuid)
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe({
        next: (proposalUuid: string) => {
          this.rematchProposalUuid = proposalUuid;
          this.rematchDialogVisible = true;
          this.waitThenLoadRematchMatches(proposalUuid);
        },
        error: (err) => this.handleRematchStartError(
          err,
          this.lang === 'ar' ? 'تعذر بدء إعادة المطابقة.' : 'Failed to start rematch.'
        ),
      });
  }

  get todayDateString(): string {
    return this.toDateInputValue(new Date());
  }

  get tomorrowDateString(): string {
    return this.futureDateInputValue(1);
  }

  get visibleRematchMatches(): CreatedProjectProposalMatch[] {
    if (this.hasNewRematchMatches && !this.includePreviousInvited) {
      return this.rematchMatches.filter(match => !match.is_match_before);
    }

    return this.rematchMatches;
  }

  get hasNewRematchMatches(): boolean {
    return this.rematchMatches.some(match => !match.is_match_before);
  }

  get shouldAskToIncludePreviousInvited(): boolean {
    return this.hasNewRematchMatches && this.rematchMatches.some(match => match.is_match_before);
  }

  get selectedRematchCount(): number {
    const visibleIds = new Set(this.visibleRematchMatches.map(match => match.uuid));
    return this.selectedRematchIds.filter(id => visibleIds.has(id)).length;
  }

  get isRematchLoading(): boolean {
    return this.rematchPhase === 'creating' || this.rematchPhase === 'loading';
  }

  get isSubmittingRematch(): boolean {
    return this.rematchPhase === 'submitting';
  }

  get canContinueRematchMatches(): boolean {
    return this.rematchPhase === 'ready' && this.selectedRematchCount > 0;
  }

  get isRematchUrgentProject(): boolean {
    return this.normalizeProjectType(this.project?.type || null) === 'urgent_request';
  }

  get deadlineValidationError(): string | null {
    if (!this.deadlineOfferDate) return null;
    if (this.deadlineOfferDate < this.todayDateString) {
      return this.lang === 'ar' ? 'لا يمكن أن يكون التاريخ في الماضي.' : 'Date cannot be in the past.';
    }
    if (this.isRematchUrgentProject && this.deadlineOfferDate > this.tomorrowDateString) {
      return this.lang === 'ar'
        ? 'يجب أن تنتهي صلاحية عرض الطلب العاجل خلال 24 ساعة.'
        : 'Urgent request offer must expire within 24 hours.';
    }

    return null;
  }

  setIncludePreviousInvited(include: boolean): void {
    this.includePreviousInvited = include;

    if (!include && this.hasNewRematchMatches) {
      const newMatchIds = new Set(
        this.rematchMatches
          .filter(match => !match.is_match_before)
          .map(match => match.uuid)
      );
      this.selectedRematchIds = this.selectedRematchIds.filter(id => newMatchIds.has(id));
    }
  }

  toggleRematchSelection(matchUuid: string): void {
    if (this.rematchPhase !== 'ready') return;

    this.selectedRematchIds = this.selectedRematchIds.includes(matchUuid)
      ? this.selectedRematchIds.filter(id => id !== matchUuid)
      : [...this.selectedRematchIds, matchUuid];
  }

  isRematchSelected(matchUuid: string): boolean {
    return this.selectedRematchIds.includes(matchUuid);
  }

  goToRematchDeadline(): void {
    if (!this.canContinueRematchMatches) return;
    this.rematchError = null;
    this.rematchStep = 'deadline';
  }

  goToRematchMatches(): void {
    if (this.isSubmittingRematch) return;
    this.rematchError = null;
    this.rematchStep = 'matches';
  }

  submitRematchProposal(): void {
    if (this.isSubmittingRematch) return;

    const projectUuid = this.project?.uuid || '';
    if (!this.rematchProposalUuid) {
      this.rematchError = this.lang === 'ar'
        ? 'تعذر العثور على معرّف المقترح.'
        : 'The proposal identifier is missing.';
      return;
    }

    if (this.selectedRematchCount === 0) {
      this.rematchError = this.lang === 'ar'
        ? 'يرجى اختيار خبير واحد على الأقل.'
        : 'Please select at least one insighter.';
      return;
    }

    if (!this.deadlineOfferDate) {
      this.rematchError = this.lang === 'ar'
        ? 'يرجى اختيار تاريخ انتهاء العرض.'
        : 'Please select an offer expiry date.';
      return;
    }

    const validationError = this.deadlineValidationError;
    if (validationError) {
      this.rematchError = validationError;
      return;
    }

    const payload: SubmitRematchProposalPayload = {
      deadline_offer: this.formatDeadlineOffer(this.deadlineOfferDate),
      matches: [...this.selectedRematchIds],
    };

    this.rematchPhase = 'submitting';
    this.rematchError = null;

    this.projectsCreatedService.submitRematchProposal(this.rematchProposalUuid, payload)
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe({
        next: () => {
          this.showSuccess(
            this.lang === 'ar' ? 'تم الإرسال' : 'Submitted',
            this.lang === 'ar'
              ? 'تم إرسال المقترح إلى الخبراء المختارين.'
              : 'The proposal was submitted to the selected insighters.'
          );
          this.closeRematchWizard();
          if (projectUuid) this.loadProject(projectUuid);
        },
        error: (err) => {
          this.rematchPhase = 'ready';
          this.rematchError = this.getServerErrorMessage(
            err,
            this.lang === 'ar' ? 'تعذر إرسال المقترح.' : 'Failed to submit proposal.'
          );
          this.showError(
            this.lang === 'ar' ? 'حدث خطأ' : 'An error occurred',
            this.rematchError
          );
        },
      });
  }

  closeRematchWizard(): void {
    if (this.isSubmittingRematch) return;
    this.resetRematchState();
  }

  setActiveTab(tab: ProjectDetailTab): void {
    this.activeTab = tab;
    if (tab === 'reviews' && this.project?.uuid && !this.reviewSubmissions.length) {
      this.loadProjectReviewSubmissions(this.project.uuid);
    }
  }

  openProposalDrawer(invite: CreatedProjectProposalInvite): void {
    if (!this.canViewSubmittedOffer(invite)) return;
    this.selectedInvite = invite;
    this.proposalDrawerVisible = true;
  }

  closeProposalDrawer(): void {
    this.proposalDrawerVisible = false;
    this.selectedInvite = null;
  }

  acceptOffer(invite: CreatedProjectProposalInvite | null): void {
    const offerUuid = invite?.offer?.uuid || '';
    if (!offerUuid || this.acceptingOfferUuid) {
      if (!offerUuid) {
        this.showError(
          this.lang === 'ar' ? 'تعذر قبول العرض' : 'Cannot accept offer',
          this.lang === 'ar' ? 'لم يتم العثور على معرّف العرض.' : 'Offer identifier was not found.'
        );
      }
      return;
    }

    this.acceptingOfferUuid = offerUuid;

    this.projectsCreatedService.acceptProposalOffer(offerUuid)
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe({
        next: () => {
          this.showSuccess(
            this.lang === 'ar' ? 'تم قبول العرض' : 'Offer accepted',
            this.lang === 'ar'
              ? 'تم قبول العرض. يمكنك الآن مراجعة العقد.'
              : 'The offer was accepted. You can now review the contract.'
          );
          this.closeProposalDrawer();
          if (this.project?.uuid) {
            this.router.navigate(['/app/insighter-dashboard/projects-created', this.project.uuid, 'contract']);
          }
        },
        error: (err) => {
          this.acceptingOfferUuid = null;
          this.handleServerErrors(err);
        },
        complete: () => {
          this.acceptingOfferUuid = null;
        },
      });
  }

  isAcceptingOffer(invite: CreatedProjectProposalInvite | null): boolean {
    return !!invite?.offer?.uuid && this.acceptingOfferUuid === invite.offer.uuid;
  }

  canAcceptOffer(invite: CreatedProjectProposalInvite | null): boolean {
    if (!invite?.offer?.uuid || this.acceptingOfferUuid) return false;
    const status = this.getInvitedStatus(invite);
    return !['accepted', 'approved', 'closed', 'cancelled', 'expired'].includes(status);
  }

  hasContractAction(project: CreatedProject | null = this.project): boolean {
    return !!this.getProjectContractUuid(project) || this.normalizeValue(project?.status) === 'contract';
  }

  isContractingStatus(project: CreatedProject | null = this.project): boolean {
    const status = this.normalizeValue(project?.status);
    return status === 'contracting' || status === 'contract';
  }

  isProjectWorkStatus(project: CreatedProject | null = this.project): boolean {
    const status = this.normalizeValue(project?.status);
    const stage = this.normalizeValue(project?.stage);
    return ['in_progress', 'in_review'].includes(status) || ['in_progress', 'in_review'].includes(stage);
  }

  isProjectReviewStatus(project: CreatedProject | null = this.project): boolean {
    const status = this.normalizeValue(project?.status);
    const stage = this.normalizeValue(project?.stage);
    return status === 'in_review' || stage === 'in_review';
  }

  isPaymentStatusOnly(project: CreatedProject | null = this.project): boolean {
    return this.normalizeValue(project?.status) === 'payment';
  }

  shouldShowProjectTimeline(project: CreatedProject | null = this.project): boolean {
    return this.isContractingStatus(project) || this.isPaymentStatusOnly(project) || this.isProjectWorkStatus(project);
  }

  getContractSignatureState(
    project: CreatedProject | null = this.project,
  ): 'waiting_user' | 'waiting_insighter' | 'completed' | null {
    const contract = project?.contract;
    if (!contract) return null;
    if (!contract.user_sign_at) return 'waiting_user';
    if (!contract.insighter_sign_at) return 'waiting_insighter';
    return 'completed';
  }

  getContractStepState(
    project: CreatedProject | null = this.project,
  ): 'waiting_user' | 'waiting_insighter' | 'completed' {
    if (this.isPaymentStatusOnly(project) || this.isProjectWorkStatus(project)) return 'completed';
    return this.getContractSignatureState(project) ?? 'waiting_user';
  }

  shouldShowInvitedInsightersPanel(project: CreatedProject | null = this.project): boolean {
    const status = this.normalizeValue(project?.status);
    const stage = this.normalizeValue(project?.stage);
    const hiddenStates = ['contract', 'payment', 'contracting', 'in_progress', 'in_review', 'closed'];

    return !hiddenStates.includes(status) && !hiddenStates.includes(stage);
  }

  openReviewsTab(): void {
    this.setActiveTab('reviews');
  }

  viewContract(): void {
    if (!this.project?.uuid) return;
    this.router.navigate(['/app/insighter-dashboard/projects-created', this.project.uuid, 'contract']);
  }

  getProjectActionsHint(project: CreatedProject | null = this.project): string {
    if (this.shouldShowProjectPayment(project)) {
      return this.lang === 'ar'
        ? 'اكتمل العقد. اختر طريقة الدفع المناسبة لبدء المشروع.'
        : 'The contract is complete. Choose a payment method to start the project.';
    }

    if (this.hasContractAction(project)) {
      return this.lang === 'ar'
        ? 'تم قبول عرض لهذا المشروع. راجع العقد واختر طريقة التوقيع.'
        : 'An offer has been accepted for this project. Review the contract and choose how to sign.';
    }

    return this.lang === 'ar'
      ? 'راجع تفاصيل مشروعك أو ابدأ عملية مطابقة جديدة مع الخبراء.'
      : 'Review your project details or start a new matching process with experts.';
  }

  shouldShowProjectPayment(project: CreatedProject | null = this.project): boolean {
    if (!project || this.isProjectFinalPaymentPlan(project.order)) return false;

    return this.isProjectPaymentStatus(project) && !!this.getProjectCheckoutProjectUuid(project);
  }

  getProjectCheckoutProjectUuid(project: CreatedProject | null = this.project): string | undefined {
    return project?.uuid || undefined;
  }

  getRequiredProjectPaymentAmount(order: CreatedProjectOrder | null | undefined): number {
    if (!order) return 0;

    const plan = this.getProjectOrderPaymentPlan(order);
    if (plan === 'down_payment' || plan === 'partial' || plan === 'partial_payment') {
      const directDownPayment = this.toOptionalNumber(order.down_payment_amount ?? order.down_payment);
      if (directDownPayment !== null) return directDownPayment;

      const startPaymentAmount = this.getProjectStartPaymentAmount(order);
      if (startPaymentAmount !== null) return startPaymentAmount;

      const downPaymentPercentage = this.toOptionalNumber(order.down_payment_percentage);
      if (downPaymentPercentage !== null) {
        return this.toNumber(order.amount) * downPaymentPercentage / 100;
      }
    }

    return this.toNumber(order.amount);
  }

  getProjectRequiredPaymentLabel(order: CreatedProjectOrder | null | undefined): string {
    if (!order) return '-';
    return this.formatProjectCurrency(this.getRequiredProjectPaymentAmount(order), order.currency);
  }

  getProjectOrderTotalLabel(order: CreatedProjectOrder | null | undefined): string {
    if (!order) return '-';
    return this.formatProjectCurrency(order.amount, order.currency);
  }

  getProjectPaymentPlanLabel(order: CreatedProjectOrder | null | undefined): string {
    const plan = this.getProjectOrderPaymentPlan(order);
    const labels: Record<string, { en: string; ar: string }> = {
      full_payment: { en: 'Full payment', ar: 'دفعة كاملة' },
      full_at_start: { en: 'Full payment', ar: 'دفعة كاملة' },
      full_start: { en: 'Full payment', ar: 'دفعة كاملة' },
      down_payment: { en: 'Down payment', ar: 'دفعة مقدمة' },
      partial: { en: 'Down payment', ar: 'دفعة مقدمة' },
      partial_payment: { en: 'Down payment', ar: 'دفعة مقدمة' },
      final_payment: { en: 'Final payment', ar: 'دفعة نهائية' },
    };

    const match = labels[plan];
    if (match) return this.lang === 'ar' ? match.ar : match.en;

    return this.lang === 'ar' ? 'دفعة المشروع' : 'Project payment';
  }

  getProjectPaymentButtonLabel(order: CreatedProjectOrder | null | undefined): string {
    if (this.isProjectDownPaymentDue(order)) {
      return this.lang === 'ar'
        ? 'ادفع الدفعة المقدمة'
        : 'Pay Down Payment ';
    }

    return this.lang === 'ar' ? 'ادفع لبدء المشروع' : 'Pay to Start Project';
  }

  shouldShowCompletedDownPayment(project: CreatedProject | null = this.project): boolean {
    return this.isProjectWorkStatus(project) && this.isProjectDownPaymentDue(project?.order);
  }

  shouldShowPendingReviewStep(project: CreatedProject | null = this.project): boolean {
    return this.isProjectReviewStatus(project);
  }

  shouldShowPendingFinalPayment(project: CreatedProject | null = this.project): boolean {
    if (!this.isProjectWorkStatus(project) || !project?.order) return false;

    if ((project.order as any).has_outstanding_payment === false) return false;
    if ((project.order as any).has_outstanding_payment === true) return true;

    const plan = this.getProjectOrderPaymentPlan(project.order);
    if (['partial', 'partial_payment', 'down_payment', 'final_payment', 'full_at_end'].includes(plan)) return true;

    const finalPayment = this.toOptionalNumber(project.order.final_payment);
    if (finalPayment !== null && finalPayment > 0) return true;

    const finalPaymentPercentage = this.toOptionalNumber(project.order.final_payment_percentage);
    return finalPaymentPercentage !== null && finalPaymentPercentage > 0;
  }

  getProjectDownPaymentLabel(order: CreatedProjectOrder | null | undefined): string {
    if (!order) return '-';
    return this.formatProjectCurrency(this.getProjectDownPaymentAmount(order), order.currency);
  }

  getProjectFinalPaymentLabel(order: CreatedProjectOrder | null | undefined): string {
    if (!order) return '-';
    return this.formatProjectCurrency(this.getProjectFinalPaymentAmount(order), order.currency);
  }

  getWorkflowStepNumber(
    step: 'contracting' | 'down_payment' | 'review' | 'final_payment',
    project: CreatedProject | null = this.project,
  ): number {
    const steps: Array<'contracting' | 'down_payment' | 'review' | 'final_payment'> = ['contracting'];

    if (this.shouldShowCompletedDownPayment(project)) steps.push('down_payment');
    if (this.shouldShowPendingReviewStep(project)) steps.push('review');
    if (this.shouldShowPendingFinalPayment(project)) steps.push('final_payment');

    const index = steps.indexOf(step);
    return index >= 0 ? index + 1 : steps.length + 1;
  }

  isFirstPendingWorkflowStep(
    step: 'review' | 'final_payment',
    project: CreatedProject | null = this.project,
  ): boolean {
    const pendingSteps: Array<'review' | 'final_payment'> = [];

    if (this.shouldShowPendingReviewStep(project)) pendingSteps.push('review');
    if (this.shouldShowPendingFinalPayment(project)) pendingSteps.push('final_payment');

    return pendingSteps[0] === step;
  }

  getWorkflowTimelineProgress(project: CreatedProject | null = this.project): string {
    const totalSteps = this.getWorkflowTotalSteps(project);
    if (totalSteps <= 1) return '0%';

    const completedSegments = Math.max(this.getWorkflowCompletedSteps(project) - 1, 0);
    const progress = Math.min(Math.max(completedSegments / (totalSteps - 1), 0), 1) * 100;

    return `${progress}%`;
  }

  getProjectPaymentMethodLabel(method: ProjectCheckoutPaymentMethod): string {
    if (method === 'manual') {
      return this.lang === 'ar' ? 'محفظة إنسايتا' : 'Insighta Wallet';
    }

    return this.lang === 'ar' ? 'بطاقة أو محفظة رقمية' : 'Card or digital wallet';
  }

  getProjectWalletBalanceLabel(): string {
    if (this.isProjectWalletBalanceLoading) {
      return this.lang === 'ar' ? 'جاري التحقق...' : 'Checking balance...';
    }

    if (this.projectWalletBalance === null) {
      return this.lang === 'ar' ? 'الرصيد غير متاح' : 'Balance unavailable';
    }

    const currency = this.project?.order?.currency || 'USD';
    return this.formatProjectCurrency(this.projectWalletBalance, currency);
  }

  canUseProjectWallet(project: CreatedProject | null = this.project): boolean {
    if (!project?.order || this.isProjectWalletBalanceLoading || this.projectWalletBalance === null) return false;
    return this.projectWalletBalance >= this.getRequiredProjectPaymentAmount(project.order);
  }

  openProjectPaymentDialog(): void {
    if (!this.shouldShowProjectPayment(this.project)) {
      this.showError(
        this.lang === 'ar' ? 'تعذر بدء الدفع' : 'Cannot start payment',
        this.lang === 'ar' ? 'لم يتم العثور على طلب دفع صالح لهذا المشروع.' : 'A valid payment order was not found for this project.'
      );
      return;
    }

    this.projectCheckoutError = null;
    this.projectPaymentDialogVisible = true;
    this.selectedProjectPaymentMethod = this.canUseProjectWallet(this.project) ? 'manual' : 'provider';

    if (this.projectWalletBalance === null && !this.isProjectWalletBalanceLoading) {
      this.loadProjectWalletBalance(this.project);
    }
  }

  closeProjectPaymentDialog(): void {
    if (this.projectCheckoutSubmitting) return;
    this.projectPaymentDialogVisible = false;
    this.projectCheckoutError = null;
  }

  selectProjectPaymentMethod(method: ProjectCheckoutPaymentMethod): void {
    if (this.projectCheckoutSubmitting) return;

    if (method === 'manual' && !this.canUseProjectWallet(this.project)) {
      return;
    }

    this.selectedProjectPaymentMethod = method;
    this.projectCheckoutError = null;
  }

  submitProjectPayment(): void {
    if (this.projectCheckoutSubmitting) return;

    const projectUuid = this.project?.uuid || '';
    const paymentMethod = this.selectedProjectPaymentMethod;

    if (!projectUuid) {
      this.projectCheckoutError = this.lang === 'ar'
        ? 'لم يتم العثور على معرّف المشروع.'
        : 'The project identifier was not found.';
      return;
    }

    if (!paymentMethod) {
      this.projectCheckoutError = this.lang === 'ar'
        ? 'يرجى اختيار طريقة الدفع.'
        : 'Please select a payment method.';
      return;
    }

    if (paymentMethod === 'manual' && !this.canUseProjectWallet(this.project)) {
      this.projectCheckoutError = this.lang === 'ar'
        ? 'رصيد المحفظة غير كافٍ لإتمام الدفع.'
        : 'Wallet balance is not sufficient for this payment.';
      return;
    }

    this.projectCheckoutSubmitting = true;
    this.projectCheckoutError = null;

    this.projectsCreatedService.checkoutProjectStart(projectUuid, paymentMethod)
      .pipe(
        takeUntil(this.unsubscribe$),
        finalize(() => (this.projectCheckoutSubmitting = false))
      )
      .subscribe({
        next: response => this.handleProjectCheckoutResponse(response, paymentMethod, projectUuid),
        error: err => {
          this.projectCheckoutError = this.getServerErrorMessage(
            err,
            this.lang === 'ar' ? 'تعذر بدء الدفع.' : 'Failed to start payment.'
          );
          this.showError(
            this.lang === 'ar' ? 'تعذر بدء الدفع' : 'Payment failed',
            this.projectCheckoutError
          );
        },
      });
  }

  getTypeLabel(type: CreatedProjectType | null | undefined): string {
    if (!type) return '-';
    const meta = this.projectTypeOptions.find(o => o.key === type);
    if (!meta) return this.humanizeValue(type);
    return this.lang === 'ar' ? meta.labelAr : meta.labelEn;
  }

  getStatusBadgeClass(status: string | null | undefined): string {
    switch ((status || '').toLowerCase()) {
      case 'proposal': return 'badge-light-warning';
      case 'submitted': return 'badge-light-submitted';
      case 'contract': return 'badge-light-info';
      case 'payment': return 'badge-light-warning';
      case 'in_progress': return 'badge-light-progress';
      case 'in_review': return 'badge-light-primary';
      case 'closed': return 'badge-light-success';
      case 'cancelled': return 'badge-light-cancelled';
      case 'expired': return 'badge-light-expired';
      default: return 'badge-light-info';
    }
  }

  getStatusLabel(status: string | null | undefined): string {
    const labels: Record<string, { en: string; ar: string }> = {
      proposal: { en: 'Proposal', ar: 'مقترح' },
      submitted: { en: 'Submitted', ar: 'مُرسل' },
      contract: { en: 'Contracting', ar: 'العقد' },
      payment: { en: 'Payment', ar: 'الدفع' },
      in_progress: { en: 'In Progress', ar: 'قيد التنفيذ' },
      in_review: { en: 'In Review', ar: 'قيد المراجعة' },
      closed: { en: 'Closed', ar: 'مغلق' },
      cancelled: { en: 'Cancelled', ar: 'ملغي' },
      expired: { en: 'Expired', ar: 'منتهي' },
    };
    const key = (status || '').toLowerCase();
    const match = labels[key];
    if (!match) return this.humanizeValue(key) || '-';
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
      'idea stage': { en: 'Idea Stage', ar: 'مرحلة الفكرة' },
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

  formatPrice(value: string | number | null | undefined): string {
    const n = Number(value ?? 0);
    if (!isFinite(n)) return '$0.00';
    return n.toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD',
    });
  }

  shouldShowDownPayment(offer: CreatedProjectSubmittedOffer | null | undefined): boolean {
    const paymentPlan = this.normalizeValue(offer?.payment_plan);
    if (paymentPlan) return paymentPlan === 'full_at_start' || paymentPlan === 'partial';

    return this.hasPaymentAmount(offer?.down_payment);
  }

  shouldShowFinalPayment(offer: CreatedProjectSubmittedOffer | null | undefined): boolean {
    const paymentPlan = this.normalizeValue(offer?.payment_plan);
    if (paymentPlan) return paymentPlan === 'full_at_end' || paymentPlan === 'partial';

    return this.hasPaymentAmount(offer?.final_payment);
  }

  getDownPaymentAmount(offer: CreatedProjectSubmittedOffer | null | undefined): string | number | null | undefined {
    return this.normalizeValue(offer?.payment_plan) === 'full_at_start'
      ? offer?.proposed_price
      : offer?.down_payment;
  }

  getFinalPaymentAmount(offer: CreatedProjectSubmittedOffer | null | undefined): string | number | null | undefined {
    return this.normalizeValue(offer?.payment_plan) === 'full_at_end'
      ? offer?.proposed_price
      : offer?.final_payment;
  }

  private hasPaymentAmount(value: string | number | null | undefined): boolean {
    const n = Number(value ?? 0);
    return Number.isFinite(n) && n > 0;
  }

  getProfileUrl(insighterUuid: string | null | undefined): string {
    if (!insighterUuid) return '#';
    const locale = this.lang === 'ar' ? 'ar' : 'en';
    return `https://insightabusiness.com/${locale}/profile/${insighterUuid}?entity=insighter`;
  }

  getCompanyProfileUrl(companyUuid: string | null | undefined): string {
    if (!companyUuid) return '#';
    const locale = this.lang === 'ar' ? 'ar' : 'en';
    return `https://insightabusiness.com/${locale}/profile/${companyUuid}`;
  }

  toggleMatchDetails(matchUuid: string, event?: Event): void {
    event?.stopPropagation();
    const next = new Set(this.expandedMatchIds);
    if (next.has(matchUuid)) {
      next.delete(matchUuid);
    } else {
      next.add(matchUuid);
    }
    this.expandedMatchIds = next;
  }

  isMatchExpanded(matchUuid: string): boolean {
    return this.expandedMatchIds.has(matchUuid);
  }

  isCompanyMatch(match: CreatedProjectProposalMatch): boolean {
    return (match.insighter.roles || []).some(role => {
      const normalized = this.normalizeValue(role);
      return normalized === 'company' || normalized === 'company-insighter';
    });
  }

  getMatchBadgeLabel(match: CreatedProjectProposalMatch): string {
    const isCompany = this.isCompanyMatch(match);
    return this.lang === 'ar'
      ? isCompany ? 'شركة' : 'خبير'
      : isCompany ? 'Company' : 'Insighter';
  }

  getMatchAvatarUrl(match: CreatedProjectProposalMatch): string {
    if (this.isCompanyMatch(match)) {
      return match.insighter.company?.logo || match.insighter.profile_photo_url || '';
    }

    return match.insighter.profile_photo_url || '';
  }

  getMatchOverlayAvatarUrl(match: CreatedProjectProposalMatch): string {
    if (!this.isCompanyMatch(match)) return '';

    const profilePhoto = match.insighter.profile_photo_url || '';
    const companyLogo = match.insighter.company?.logo || '';
    return profilePhoto && profilePhoto !== companyLogo ? profilePhoto : '';
  }

  getMatchInitials(match: CreatedProjectProposalMatch): string {
    const cleaned = (match.insighter.name || '').trim();
    if (!cleaned) return '?';

    const parts = cleaned.split(/\s+/).filter(Boolean);
    if (parts.length === 1) {
      return Array.from(parts[0]).slice(0, 2).join('').toUpperCase();
    }

    return parts
      .slice(0, 2)
      .map(part => Array.from(part)[0] || '')
      .join('')
      .toUpperCase();
  }

  getMatchCountryName(country: CreatedProjectProposalMatchCountry | null | undefined): string {
    if (!country) return '';

    const localizedName = country.names || (country.name && typeof country.name === 'object' ? country.name : null);
    const plainName = typeof country.name === 'string' ? country.name : '';

    if (this.lang === 'ar') {
      return localizedName?.ar || plainName || localizedName?.en || '';
    }

    return localizedName?.en || plainName || localizedName?.ar || '';
  }

  getMatchScorePercent(score: number | null | undefined): number {
    const numeric = Number(score ?? 0);
    if (!Number.isFinite(numeric)) return 0;
    return Math.round(Math.min(Math.max(numeric, 0), 1) * 100);
  }

  getMatchScoreStyle(score: number | null | undefined): Record<string, string> {
    const pct = this.getMatchScorePercent(score);
    const color = pct >= 80 ? '#16a34a' : pct >= 50 ? '#3b82f6' : '#d97706';

    return {
      '--match-score': `${pct}%`,
      '--match-score-color': color,
    };
  }

  getMatchCriteriaEntries(matches: Record<string, boolean | undefined> | null | undefined): MatchCriteriaEntry[] {
    if (!matches) return [];

    return Object.entries(matches)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => ({
        key,
        label: this.getMatchCriteriaLabel(key),
        matched: !!value,
      }));
  }

  getMatchStatusLabel(status: string | null | undefined): string {
    const normalized = this.normalizeValue(status);
    if (!normalized) return '';

    const labels: Record<string, { en: string; ar: string }> = {
      invited: { en: 'Invited', ar: 'تمت الدعوة' },
      pending: { en: 'Pending', ar: 'قيد الانتظار' },
      accepted: { en: 'Accepted', ar: 'مقبول' },
      rejected: { en: 'Rejected', ar: 'مرفوض' },
    };
    const match = labels[normalized];
    if (match) return this.lang === 'ar' ? match.ar : match.en;

    return this.humanizeValue(normalized);
  }

  getInsighterInitials(invite: CreatedProjectProposalInvite | null): string {
    const name = invite?.insighter?.name || '';
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return '?';
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return `${parts[0].charAt(0)}${parts[parts.length - 1].charAt(0)}`.toUpperCase();
  }

  getInvitedStatus(invite: CreatedProjectProposalInvite | null): string {
    if (!invite) return '';

    const actionStatus = (invite.action_status || '').toLowerCase();
    if (actionStatus) return actionStatus;

    const offerStatus = (invite.offer?.status || '').toLowerCase();
    if (offerStatus) return offerStatus;

    const submissionStatus = (invite.submission_status || '').toLowerCase();
    if (submissionStatus) return submissionStatus;

    const status = (invite.status || '').toLowerCase();
    if (status) return status;

    return 'pending';
  }

  getInviteActionStatus(invite: CreatedProjectProposalInvite | null): string {
    return this.normalizeValue(invite?.action_status) || 'pending';
  }

  getInviteStatus(invite: CreatedProjectProposalInvite | null): string {
    return this.normalizeValue(invite?.status) || 'invited';
  }

  getInviteActionStatusBadgeClass(invite: CreatedProjectProposalInvite | null): string {
    switch (this.getInviteActionStatus(invite)) {
      case 'pending':
      case 'viewed':
        return 'badge-light-warning';
      case 'submitted':
        return 'badge-light-primary';
      case 'accepted':
      case 'approved':
      case 'offered':
        return 'badge-light-success';
      case 'rejected':
      case 'declined':
      case 'cancelled':
      case 'expired':
        return 'badge-light-danger';
      case 'closed':
        return 'badge-light-info';
      default:
        return 'badge-light-info';
    }
  }

  getInviteStatusBadgeClass(invite: CreatedProjectProposalInvite | null): string {
    switch (this.getInviteStatus(invite)) {
      case 'invited':
      case 'pending':
        return 'badge-light-warning';
      case 'submitted':
        return 'badge-light-primary';
      case 'accepted':
      case 'approved':
      case 'closed':
        return 'badge-light-success';
      case 'rejected':
      case 'declined':
      case 'cancelled':
      case 'expired':
        return 'badge-light-danger';
      default:
        return 'badge-light-info';
    }
  }

  getInviteActionStatusLabel(invite: CreatedProjectProposalInvite | null): string {
    const labels: Record<string, { en: string; ar: string }> = {
      pending: { en: 'Pending', ar: 'قيد الانتظار' },
      viewed: { en: 'Viewed', ar: 'تمت المشاهدة' },
      offered: { en: 'Offered', ar: 'تم تقديم العرض' },
      submitted: { en: 'Submitted', ar: 'مُرسل' },
      accepted: { en: 'Accepted', ar: 'مقبول' },
      approved: { en: 'Approved', ar: 'موافق' },
      rejected: { en: 'Rejected', ar: 'مرفوض' },
      declined: { en: 'Declined', ar: 'مرفوض' },
      closed: { en: 'Closed', ar: 'مغلق' },
      cancelled: { en: 'Cancelled', ar: 'ملغي' },
      expired: { en: 'Expired', ar: 'منتهي' },
    };

    const key = this.getInviteActionStatus(invite);
    const match = labels[key];
    if (!match) return this.humanizeValue(key) || '-';
    return this.lang === 'ar' ? match.ar : match.en;
  }

  getInviteStatusLabel(invite: CreatedProjectProposalInvite | null): string {
    const labels: Record<string, { en: string; ar: string }> = {
      invited: { en: 'Invited', ar: 'مدعو' },
      pending: { en: 'Pending', ar: 'قيد الانتظار' },
      submitted: { en: 'Submitted', ar: 'مُرسل' },
      accepted: { en: 'Accepted', ar: 'مقبول' },
      approved: { en: 'Approved', ar: 'موافق' },
      rejected: { en: 'Rejected', ar: 'مرفوض' },
      declined: { en: 'Declined', ar: 'مرفوض' },
      closed: { en: 'Closed', ar: 'مغلق' },
      cancelled: { en: 'Cancelled', ar: 'ملغي' },
      expired: { en: 'Expired', ar: 'منتهي' },
    };

    const key = this.getInviteStatus(invite);
    const match = labels[key];
    if (!match) return this.humanizeValue(key) || '-';
    return this.lang === 'ar' ? match.ar : match.en;
  }

  getInvitedStatusBadgeClass(invite: CreatedProjectProposalInvite | null): string {
    switch (this.getInvitedStatus(invite)) {
      case 'pending':
      case 'invited':
      case 'viewed':
        return 'badge-light-warning';
      case 'submitted':
        return 'badge-light-primary';
      case 'accepted':
      case 'approved':
      case 'offered':
        return 'badge-light-success';
      case 'rejected':
      case 'declined':
      case 'cancelled':
      case 'expired':
        return 'badge-light-danger';
      case 'closed':
        return 'badge-light-info';
      default:
        return 'badge-light-info';
    }
  }

  getInvitedStatusLabel(invite: CreatedProjectProposalInvite | null): string {
    const labels: Record<string, { en: string; ar: string }> = {
      pending: { en: 'Pending', ar: 'قيد الانتظار' },
      invited: { en: 'Invited', ar: 'مدعو' },
      viewed: { en: 'Viewed', ar: 'تمت المشاهدة' },
      offered: { en: 'Offered', ar: 'تم تقديم العرض' },
      submitted: { en: 'Submitted', ar: 'مُرسل' },
      accepted: { en: 'Accepted', ar: 'مقبول' },
      approved: { en: 'Approved', ar: 'موافق' },
      rejected: { en: 'Rejected', ar: 'مرفوض' },
      declined: { en: 'Declined', ar: 'مرفوض' },
      closed: { en: 'Closed', ar: 'مغلق' },
      cancelled: { en: 'Cancelled', ar: 'ملغي' },
      expired: { en: 'Expired', ar: 'منتهي' },
    };

    const key = this.getInvitedStatus(invite);
    const match = labels[key];
    if (!match) return this.humanizeValue(key) || '-';
    return this.lang === 'ar' ? match.ar : match.en;
  }

  canViewSubmittedOffer(invite: CreatedProjectProposalInvite | null): boolean {
    return this.getInviteActionStatus(invite) === 'offered' && !!invite?.offer;
  }

  getOfferFiles(invite: CreatedProjectProposalInvite | null): CreatedProjectFile[] {
    const files = invite?.offer?.files;
    return Array.isArray(files) ? files : [];
  }

  getProjectDeliveryFiles(project: CreatedProject | null = this.project): CreatedProjectFile[] {
    const files = project?.file?.project;
    return Array.isArray(files) ? files : [];
  }

  getProjectFileTypeLabel(value: string | null | undefined): string {
    const normalized = this.normalizeValue(value);
    const option = this.projectFileTypeOptions.find(item => item.value === normalized);
    if (option) return this.lang === 'ar' ? option.labelAr : option.labelEn;
    const meta = PROJECT_FILE_GROUP_META[normalized];
    if (meta) return this.lang === 'ar' ? meta.labelAr : meta.labelEn;
    return this.humanizeValue(normalized);
  }

  getSortedReviewSubmissions(): ProjectReviewSubmission[] {
    const statusRank: Record<string, number> = {
      pending: 0,
      changes_requested: 1,
      approved: 2,
    };

    return [...this.reviewSubmissions].sort((a, b) => {
      const aRank = statusRank[this.normalizeValue(a.status)] ?? 9;
      const bRank = statusRank[this.normalizeValue(b.status)] ?? 9;
      if (aRank !== bRank) return aRank - bRank;

      return this.getDateTime(b.request_at) - this.getDateTime(a.request_at);
    });
  }

  getReviewType(review: ProjectReviewSubmission | null | undefined): string {
    return this.normalizeValue(
      review?.type
      || review?.second_identifier
      || review?.identifier
      || ''
    );
  }

  getReviewStatusLabel(status: string | null | undefined): string {
    const labels: Record<string, { en: string; ar: string }> = {
      pending: { en: 'Pending', ar: 'قيد الانتظار' },
      approved: { en: 'Approved', ar: 'تم الاعتماد' },
      changes_requested: { en: 'Changes Requested', ar: 'مطلوب تعديلات' },
      request_change: { en: 'Changes Requested', ar: 'مطلوب تعديلات' },
    };
    const normalized = this.normalizeValue(status);
    const match = labels[normalized];
    if (match) return this.lang === 'ar' ? match.ar : match.en;
    return this.humanizeValue(normalized) || '-';
  }

  getReviewStatusBadgeClass(status: string | null | undefined): string {
    switch (this.normalizeValue(status)) {
      case 'approved':
        return 'badge-light-success';
      case 'changes_requested':
      case 'request_change':
        return 'badge-light-warning';
      case 'pending':
        return 'badge-light-primary';
      default:
        return 'badge-light-info';
    }
  }

  getReviewMainText(review: ProjectReviewSubmission | null | undefined): string {
    const note = `${review?.note || ''}`.trim();
    if (note) return note;

    const type = this.getReviewType(review);
    return type
      ? this.getProjectFileTypeLabel(type)
      : (this.lang === 'ar' ? 'طلب مراجعة' : 'Review request');
  }

  getReviewResponseText(review: ProjectReviewSubmission | null | undefined): string {
    const response = `${review?.review_note || ''}`.trim();
    if (response) return response;

    return this.getReviewStatusLabel(review?.status);
  }

  isReviewPending(review: ProjectReviewSubmission | null | undefined): boolean {
    return this.normalizeValue(review?.status) === 'pending';
  }

  getReviewChangeNote(reviewUuid: string | null | undefined): string {
    return reviewUuid ? (this.reviewChangeNotes[reviewUuid] || '') : '';
  }

  setReviewChangeNote(reviewUuid: string | null | undefined, value: string): void {
    if (!reviewUuid) return;
    this.reviewChangeNotes = {
      ...this.reviewChangeNotes,
      [reviewUuid]: value,
    };
  }

  respondToReview(review: ProjectReviewSubmission, action: ProjectReviewAction): void {
    if (!review?.uuid || this.respondingReviewUuid) return;

    const reviewNote = action === 'request_change'
      ? this.getReviewChangeNote(review.uuid).trim()
      : null;

    if (action === 'request_change' && !reviewNote) {
      this.showError(
        this.lang === 'ar' ? 'الملاحظة مطلوبة' : 'Note required',
        this.lang === 'ar'
          ? 'اكتب ملاحظة توضح التعديلات المطلوبة.'
          : 'Write a note explaining the requested changes.'
      );
      return;
    }

    this.respondingReviewUuid = review.uuid;

    this.projectsCreatedService.respondToProjectReview(review.uuid, {
      action,
      review_note: reviewNote,
    })
      .pipe(
        takeUntil(this.unsubscribe$),
        finalize(() => (this.respondingReviewUuid = null))
      )
      .subscribe({
        next: () => {
          this.showSuccess(
            this.lang === 'ar' ? 'تم إرسال الرد' : 'Response sent',
            action === 'approve'
              ? (this.lang === 'ar' ? 'تم اعتماد طلب المراجعة.' : 'The review request was approved.')
              : (this.lang === 'ar' ? 'تم إرسال طلب التعديلات.' : 'The change request was sent.')
          );
          this.setReviewChangeNote(review.uuid, '');
          if (this.project?.uuid) {
            this.loadProjectReviewSubmissions(this.project.uuid, true);
          }
        },
        error: err => this.handleServerErrors(err),
      });
  }

  onProjectFilesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = input.files ? Array.from(input.files) : [];
    if (!files.length) return;

    this.selectedProjectFiles = [...this.selectedProjectFiles, ...files];
    input.value = '';
  }

  removeSelectedProjectFile(index: number): void {
    this.selectedProjectFiles = this.selectedProjectFiles.filter((_, fileIndex) => fileIndex !== index);
  }

  submitProjectFileUpload(): void {
    if (this.projectFilesUploading) return;

    const projectUuid = this.project?.uuid || '';
    const name = (this.projectFileName || '').trim();

    if (!projectUuid || !name || !this.selectedProjectFiles.length) {
      this.showError(
        this.lang === 'ar' ? 'تعذر رفع الملفات' : 'Cannot upload files',
        this.lang === 'ar'
          ? 'يرجى إدخال اسم واختيار ملف واحد على الأقل.'
          : 'Enter a name and attach at least one file.'
      );
      return;
    }

    const payload = new FormData();
    payload.append('name', name);
    payload.append('type', 'document');
    this.selectedProjectFiles.forEach(file => payload.append('file', file, file.name));

    this.projectFilesUploading = true;

    this.projectsCreatedService.uploadClientProjectFile(projectUuid, payload)
      .pipe(
        takeUntil(this.unsubscribe$),
        finalize(() => (this.projectFilesUploading = false))
      )
      .subscribe({
        next: () => {
          this.showSuccess(
            this.lang === 'ar' ? 'تم رفع الملفات' : 'Files uploaded',
            this.lang === 'ar'
              ? 'تم رفع ملفات المشروع بنجاح.'
              : 'Project files were uploaded successfully.'
          );
          this.projectFileName = '';
          this.selectedProjectFiles = [];
          this.loadProject(projectUuid);
        },
        error: err => this.handleServerErrors(err),
      });
  }

  hasInvitedInsighters(): boolean {
    return this.invitedInsighters.length > 0;
  }

  getEstimatedHours(value: string | number | null | undefined): string {
    const hours = Number(value ?? 0);
    if (!isFinite(hours) || hours <= 0) return '-';
    return `${hours} ${this.lang === 'ar' ? 'ساعة' : 'hrs'}`;
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

  getComponent(key: string): any | null {
    if (!this.project) return null;
    for (const item of this.project.components || []) {
      if (item && Object.prototype.hasOwnProperty.call(item, key)) return item[key];
    }
    return null;
  }

  getAddon(key: string): any | null {
    if (!this.project) return null;
    for (const item of this.project.addons || []) {
      if (item && Object.prototype.hasOwnProperty.call(item, key)) return item[key];
    }
    return null;
  }

  hasAddons(): boolean {
    return !!(this.project?.addons?.length);
  }

  getScopeLabel(scope: CreatedProjectScope | null | undefined): string {
    return this.getFormattedValue(scope?.scope);
  }

  getScopeDescription(scope: CreatedProjectScope | null | undefined): string {
    return scope?.description || '';
  }

  getScopeChildren(scope: CreatedProjectScope | null | undefined): CreatedProjectScope[] {
    const children = scope?.children;
    return Array.isArray(children) ? children : [];
  }

  getScopeFiles(scope: CreatedProjectScope | null | undefined): CreatedProjectFile[] {
    const files = scope?.files;
    return Array.isArray(files) ? files : [];
  }

  getDocumentGroups(project: CreatedProject | null = this.project): ProjectDocumentGroup[] {
    if (!project) return [];

    const proposal = project.file?.proposal;
    const groups: ProjectDocumentGroup[] = [
      ...this.getDeliveryDocumentGroups(project),
      {
        key: 'general',
        labelEn: 'General Documents',
        labelAr: 'المستندات العامة',
        descriptionEn: 'Files attached to the full project proposal.',
        descriptionAr: 'الملفات المرفقة بمقترح المشروع بالكامل.',
        files: this.uniqueFiles([
          ...(project.request_files || []),
          ...(proposal?.general || []),
        ]),
      },
      {
        key: 'scopes',
        labelEn: 'Scope Documents',
        labelAr: 'مستندات النطاقات',
        descriptionEn: 'Files mapped to scopes or sub-scopes.',
        descriptionAr: 'الملفات المرتبطة بالنطاقات أو النطاقات الفرعية.',
        files: this.uniqueFiles([
          ...(proposal?.scopes || []),
          ...this.collectScopeFiles(project.scopes || []),
        ]),
      },
      {
        key: 'offer',
        labelEn: 'Offer Documents',
        labelAr: 'مستندات العروض',
        descriptionEn: 'Files attached to submitted offers.',
        descriptionAr: 'الملفات المرفقة بالعروض المقدمة.',
        files: this.uniqueFiles(proposal?.offer || []),
      },
    ];

    return groups.filter(group => group.files.length > 0);
  }

  getDeliveryDocumentGroups(project: CreatedProject | null = this.project): ProjectDocumentGroup[] {
    if (!project) return [];

    const grouped = new Map<string, CreatedProjectFile[]>();
    this.getProjectDeliveryFiles(project).forEach(file => {
      const key = this.normalizeValue(file.second_identifier || file.type || file.identifier || 'unknown');
      const groupKey = PROJECT_FILE_GROUP_META[key] ? key : 'unknown';
      grouped.set(groupKey, [...(grouped.get(groupKey) || []), file]);
    });

    const orderedKeys = [
      ...PROJECT_FILE_GROUP_ORDER,
      ...Array.from(grouped.keys()).filter(key => !PROJECT_FILE_GROUP_ORDER.includes(key) && key !== 'unknown'),
      'unknown',
    ];

    return orderedKeys
      .filter(key => grouped.has(key))
      .map(key => ({
        ...(PROJECT_FILE_GROUP_META[key] || PROJECT_FILE_GROUP_META.unknown),
        key,
        files: this.uniqueFiles(grouped.get(key) || []),
      }));
  }

  getDocumentCount(project: CreatedProject | null = this.project): number {
    return this.getDocumentGroups(project).reduce((sum, group) => sum + group.files.length, 0);
  }

  hasDocuments(project: CreatedProject | null = this.project): boolean {
    return this.getDocumentCount(project) > 0;
  }

  getDocumentGroupLabel(group: ProjectDocumentGroup): string {
    return this.lang === 'ar' ? group.labelAr : group.labelEn;
  }

  getDocumentGroupDescription(group: ProjectDocumentGroup): string {
    return this.lang === 'ar' ? group.descriptionAr : group.descriptionEn;
  }

  getProjectFileName(file: CreatedProjectFile | null | undefined): string {
    if (file?.name) return file.name;
    const rawName = (file?.url || '').split('/').pop()?.split('?')[0];
    return rawName ? decodeURIComponent(rawName) : (this.lang === 'ar' ? 'ملف' : 'File');
  }

  getProjectFileScope(file: CreatedProjectFile | null | undefined): string {
    return file?.scope ? this.getFormattedValue(file.scope) : '';
  }

  getProjectFileExtension(file: CreatedProjectFile | null | undefined): string {
    const name = this.getProjectFileName(file);
    const extension = name.includes('.') ? name.split('.').pop() : '';
    return extension || '';
  }

  getProjectFileUploader(file: CreatedProjectFile | null | undefined): string {
    return file?.uploadBy || file?.uploaded_by || '';
  }

  getProjectFileUploadDate(file: CreatedProjectFile | null | undefined): string {
    return file?.upload_date ? this.formatDate(file.upload_date) : '';
  }

  openProjectFile(file: CreatedProjectFile | null | undefined): void {
    if (!file?.uuid) {
      this.showError(
        this.lang === 'ar' ? 'تعذر فتح الملف' : 'Cannot open file',
        this.lang === 'ar' ? 'لم يتم العثور على معرّف الملف.' : 'File identifier was not found.'
      );
      return;
    }

    const fileWindow = window.open('', '_blank');
    this.openingFileUuid = file.uuid;

    this.projectsCreatedService.getProjectFileUrl(file.uuid)
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
        },
        error: (err) => {
          this.openingFileUuid = null;
          if (fileWindow) fileWindow.close();
          this.handleServerErrors(err);
        },
      });
  }

  isOpeningFile(file: CreatedProjectFile | null | undefined): boolean {
    return !!file?.uuid && this.openingFileUuid === file.uuid;
  }

  formatFileSize(file: File): string {
    if (!file?.size) return '0 KB';
    const sizeInKb = file.size / 1024;
    if (sizeInKb < 1024) return `${sizeInKb.toFixed(sizeInKb >= 10 ? 0 : 1)} KB`;
    return `${(sizeInKb / 1024).toFixed(1)} MB`;
  }

  getBackIcon(): string {
    return this.lang === 'ar' ? 'ki-arrow-right' : 'ki-arrow-left';
  }

  trackByValue(_: number, value: string): string { return value; }
  trackByIndex(index: number): number { return index; }
  trackByScope(index: number, scope: CreatedProjectScope): string {
    return `${scope?.scope || 'scope'}-${index}`;
  }
  trackByFile(_: number, file: CreatedProjectFile): string {
    return file.uuid;
  }
  trackByDocumentGroup(_: number, group: ProjectDocumentGroup): string {
    return group.key;
  }
  trackByInvite(_: number, invite: CreatedProjectProposalInvite): string {
    return invite.uuid || `${invite.insighter?.uuid || 'invite'}-${invite.offer?.uuid || 'offer'}`;
  }
  trackByMatch(_: number, match: CreatedProjectProposalMatch): string {
    return match.uuid;
  }
  trackByReview(_: number, review: ProjectReviewSubmission): string {
    return review.uuid;
  }
  trackByFileOption(_: number, option: ProjectFileTypeOption): ProjectFileUploadType {
    return option.value;
  }

  private loadProject(uuid: string): void {
    this.project = null;
    this.invitedInsighters = [];
    this.reviewSubmissions = [];
    this.reviewChangeNotes = {};
    this.closeProposalDrawer();
    this.resetRematchState();
    this.resetProjectPaymentState();

    this.projectsCreatedService.getProject(uuid)
      .pipe(takeUntil(this.unsubscribe$))
      .pipe(
        tap(project => {
          this.project = project;
          this.invitedInsighters = project.invited || [];
          if (this.shouldShowProjectPayment(project)) {
            this.loadProjectWalletBalance(project);
          }
          this.loadProjectReviewSubmissions(project.uuid);
        })
      )
      .subscribe({
        next: () => undefined,
        error: (err) => this.handleServerErrors(err),
      });
  }

  private loadProjectReviewSubmissions(projectUuid: string, force = false): void {
    if (!projectUuid || this.reviewSubmissionsLoading) return;
    if (!force && this.reviewSubmissions.length) return;

    this.reviewSubmissionsLoading = true;

    this.projectsCreatedService.getProjectReviewSubmissions(projectUuid)
      .pipe(
        takeUntil(this.unsubscribe$),
        finalize(() => (this.reviewSubmissionsLoading = false))
      )
      .subscribe({
        next: reviews => {
          this.reviewSubmissions = reviews;
          this.reviewChangeNotes = reviews.reduce<Record<string, string>>((notes, review) => {
            notes[review.uuid] = notes[review.uuid] || '';
            return notes;
          }, this.reviewChangeNotes);
        },
        error: err => this.handleServerErrors(err),
      });
  }

  private waitThenLoadRematchMatches(proposalUuid: string): void {
    this.clearRematchMatchDelay();
    this.rematchPhase = 'loading';

    this.rematchMatchDelayTimer = setTimeout(() => {
      this.rematchMatchDelayTimer = null;
      this.loadRematchMatches(proposalUuid);
    }, 5000);
  }

  private loadRematchMatches(proposalUuid: string): void {
    this.rematchPhase = 'loading';

    this.projectsCreatedService.getProjectProposalMatches(proposalUuid)
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe({
        next: (matches: CreatedProjectProposalMatch[]) => {
          this.rematchMatches = matches;
          this.includePreviousInvited = !matches.some(match => !match.is_match_before);
          this.selectedRematchIds = [];
          this.expandedMatchIds = new Set<string>();
          this.rematchPhase = matches.length > 0 ? 'ready' : 'empty';
        },
        error: (err) => this.handleRematchError(
          err,
          this.lang === 'ar' ? 'تعذر تحميل المطابقات.' : 'Failed to load matches.'
        ),
      });
  }

  private handleRematchError(error: any, fallback: string): void {
    this.rematchPhase = 'error';
    this.rematchError = this.getServerErrorMessage(error, fallback);
    this.showError(
      this.lang === 'ar' ? 'حدث خطأ' : 'An error occurred',
      this.rematchError
    );
  }

  private handleRematchStartError(error: any, fallback: string): void {
    const message = this.getServerErrorMessage(error, fallback);
    this.resetRematchState();

    if (this.isWarningResponse(error)) {
      this.showWarn(
        this.lang === 'ar' ? 'تحذير' : 'Warning',
        message
      );
      return;
    }

    this.showError(
      this.lang === 'ar' ? 'حدث خطأ' : 'An error occurred',
      message
    );
  }

  private resetRematchState(): void {
    this.clearRematchMatchDelay();
    this.rematchDialogVisible = false;
    this.rematchStep = 'matches';
    this.rematchPhase = 'idle';
    this.rematchProposalUuid = '';
    this.rematchMatches = [];
    this.selectedRematchIds = [];
    this.includePreviousInvited = false;
    this.deadlineOfferDate = '';
    this.rematchError = null;
    this.expandedMatchIds = new Set<string>();
  }

  private clearRematchMatchDelay(): void {
    if (!this.rematchMatchDelayTimer) return;
    clearTimeout(this.rematchMatchDelayTimer);
    this.rematchMatchDelayTimer = null;
  }

  private loadProjectWalletBalance(project: CreatedProject | null = this.project): void {
    if (!this.shouldShowProjectPayment(project) || this.isProjectWalletBalanceLoading) return;

    this.isProjectWalletBalanceLoading = true;
    this.projectWalletBalanceLoadFailed = false;

    this.walletService.getBalance()
      .pipe(
        takeUntil(this.unsubscribe$),
        finalize(() => (this.isProjectWalletBalanceLoading = false))
      )
      .subscribe({
        next: balance => {
          this.projectWalletBalance = this.toNumber(balance);
          const requiredAmount = this.getRequiredProjectPaymentAmount(project?.order);
          if (this.selectedProjectPaymentMethod === 'manual' && this.projectWalletBalance < requiredAmount) {
            this.selectedProjectPaymentMethod = 'provider';
          }
        },
        error: () => {
          this.projectWalletBalance = null;
          this.projectWalletBalanceLoadFailed = true;
          if (this.selectedProjectPaymentMethod === 'manual') {
            this.selectedProjectPaymentMethod = 'provider';
          }
        },
      });
  }

  private handleProjectCheckoutResponse(
    response: any,
    paymentMethod: ProjectCheckoutPaymentMethod,
    projectUuid: string
  ): void {
    const responseData = this.extractCheckoutResponseData(response);

    if (paymentMethod === 'provider') {
      const redirectUrl = this.getProjectCheckoutRedirectUrl(responseData);
      if (redirectUrl) {
        window.location.href = redirectUrl;
        return;
      }

      const clientSecret = this.stringifyValue(
        responseData?.client_secret
          ?? responseData?.payment_intent_client_secret
          ?? responseData?.payment_intent?.client_secret
      );
      const orderUuid = this.stringifyValue(
        responseData?.order_uuid
          ?? responseData?.uuid
          ?? this.project?.order?.uuid
      );

      if (clientSecret && orderUuid) {
        this.redirectToProjectStripeCheckout(clientSecret, orderUuid);
        return;
      }
    }

    this.projectPaymentDialogVisible = false;
    this.showSuccess(
      this.lang === 'ar' ? 'تم بدء الدفع' : 'Payment started',
      paymentMethod === 'manual'
        ? (this.lang === 'ar' ? 'تم تنفيذ الدفع عبر المحفظة.' : 'The wallet payment was submitted successfully.')
        : (this.lang === 'ar' ? 'تم بدء جلسة الدفع. سيتم تحديث تفاصيل المشروع.' : 'The payment session was started. Project details will refresh.')
    );
    this.refreshProjectDetails(projectUuid);
  }

  private extractCheckoutResponseData(response: any): any {
    return response?.data ?? response ?? {};
  }

  private getProjectCheckoutRedirectUrl(responseData: any): string {
    return this.stringifyValue(
      responseData?.redirect_url
        ?? responseData?.payment_url
        ?? responseData?.checkout_url
        ?? responseData?.url
        ?? responseData?.stripe_url
    );
  }

  private redirectToProjectStripeCheckout(clientSecret: string, orderUuid: string): void {
    const locale = this.lang === 'ar' ? 'ar' : 'en';
    const params = new URLSearchParams({
      client_secret: clientSecret,
      order_uuid: orderUuid,
      amount: this.getRequiredProjectPaymentAmount(this.project?.order).toFixed(2),
      title: this.project?.title || 'Project Service',
      service: 'project',
      return_url: `${environment.subAppUrl}/app/insighter-dashboard/projects-created/${this.project?.uuid || ''}`,
    });

    const mainAppUrl = environment.mainAppUrl || this.clientBaseUrl;
    window.location.href = `${mainAppUrl}/${locale}/payment/stripe?${params.toString()}`;
  }

  private refreshProjectDetails(projectUuid: string): void {
    if (!projectUuid) return;
    this.loadProject(projectUuid);
  }

  private resetProjectPaymentState(): void {
    this.projectPaymentDialogVisible = false;
    this.selectedProjectPaymentMethod = null;
    this.projectCheckoutSubmitting = false;
    this.projectCheckoutError = null;
    this.projectWalletBalance = null;
    this.isProjectWalletBalanceLoading = false;
    this.projectWalletBalanceLoadFailed = false;
  }

  private isProjectPaymentStatus(project: CreatedProject | null | undefined): boolean {
    return this.normalizeValue(project?.status) === 'payment'
      || this.normalizeValue(project?.stage) === 'payment';
  }

  private isProjectFinalPaymentPlan(order: CreatedProjectOrder | null | undefined): boolean {
    const plan = this.getProjectOrderPaymentPlan(order);
    return plan === 'final_payment' || plan === 'full_at_end';
  }

  private getProjectOrderPaymentPlan(order: CreatedProjectOrder | null | undefined): string {
    return this.normalizeValue(order?.order_payment_plan ?? order?.payment_plan);
  }

  private getWorkflowTotalSteps(project: CreatedProject | null = this.project): number {
    let totalSteps = 1;
    if (this.shouldShowCompletedDownPayment(project)) totalSteps += 1;
    if (this.shouldShowPendingReviewStep(project)) totalSteps += 1;
    if (this.shouldShowPendingFinalPayment(project)) totalSteps += 1;
    if (this.isPaymentStatusOnly(project)) totalSteps += 1;
    return totalSteps;
  }

  private getWorkflowCompletedSteps(project: CreatedProject | null = this.project): number {
    let completedSteps = this.getContractStepState(project) === 'completed' ? 1 : 0;
    if (this.shouldShowCompletedDownPayment(project)) completedSteps += 1;
    return completedSteps;
  }

  private isProjectDownPaymentDue(order: CreatedProjectOrder | null | undefined): boolean {
    if (!order) return false;

    const plan = this.getProjectOrderPaymentPlan(order);
    if (['down_payment', 'partial', 'partial_payment'].includes(plan)) return true;

    const downPaymentAmount = this.toOptionalNumber(order.down_payment_amount ?? order.down_payment);
    if (downPaymentAmount !== null && downPaymentAmount > 0) return true;

    const downPaymentPercentage = this.toOptionalNumber(order.down_payment_percentage);
    if (downPaymentPercentage !== null && downPaymentPercentage > 0) return true;

    const startPaymentAmount = this.getProjectStartPaymentAmount(order);

    return plan.includes('partial') && startPaymentAmount !== null && startPaymentAmount > 0;
  }

  private getProjectDownPaymentAmount(order: CreatedProjectOrder | null | undefined): number {
    if (!order) return 0;

    const directDownPayment = this.toOptionalNumber(order.down_payment_amount ?? order.down_payment);
    if (directDownPayment !== null) return directDownPayment;

    const startPaymentAmount = this.getProjectStartPaymentAmount(order);
    if (startPaymentAmount !== null) return startPaymentAmount;

    const downPaymentPercentage = this.toOptionalNumber(order.down_payment_percentage);
    if (downPaymentPercentage !== null) {
      return this.toNumber(order.amount) * downPaymentPercentage / 100;
    }

    return 0;
  }

  private getProjectFinalPaymentAmount(order: CreatedProjectOrder | null | undefined): number {
    if (!order) return 0;

    const directFinalPayment = this.toOptionalNumber(order.final_payment);
    if (directFinalPayment !== null) return directFinalPayment;

    const finalPaymentPercentage = this.toOptionalNumber(order.final_payment_percentage);
    if (finalPaymentPercentage !== null) {
      return this.toNumber(order.amount) * finalPaymentPercentage / 100;
    }

    const downPaymentAmount = this.getProjectDownPaymentAmount(order);
    if (downPaymentAmount > 0) {
      return Math.max(this.toNumber(order.amount) - downPaymentAmount, 0);
    }

    return this.toNumber(order.amount);
  }

  private getProjectStartPaymentAmount(order: CreatedProjectOrder | null | undefined): number | null {
    if (!order) return null;

    return this.toOptionalNumber(
      (order as any).start_payment_amount
        ?? (order as any).start_payment
        ?? (order as any).start_amount
        ?? (order as any).upfront_payment_amount
    );
  }

  private getProjectContractUuid(project: CreatedProject | null | undefined): string {
    return project?.contract?.uuid || project?.contract_uuid || '';
  }

  private formatProjectCurrency(amount: string | number | null | undefined, currency: string | null | undefined): string {
    const numericAmount = this.toNumber(amount);
    const currencyCode = this.stringifyValue(currency) || 'USD';

    try {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currencyCode,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(numericAmount);
    } catch {
      return `${numericAmount.toLocaleString('en-US', { maximumFractionDigits: 2 })} ${currencyCode}`;
    }
  }

  private toNumber(value: unknown): number {
    const numericValue = Number(value ?? 0);
    return Number.isFinite(numericValue) ? numericValue : 0;
  }

  private toOptionalNumber(value: unknown): number | null {
    if (value === null || value === undefined || value === '') return null;
    const numericValue = Number(value);
    return Number.isFinite(numericValue) ? numericValue : null;
  }

  private stringifyValue(value: unknown): string {
    if (value === null || value === undefined) return '';
    return String(value).trim();
  }

  private getMatchCriteriaLabel(key: string): string {
    const label = MATCH_CRITERIA_LABELS[key];
    if (label) return this.lang === 'ar' ? label.ar : label.en;

    return this.humanizeValue(key.replace(/_MATCH$/i, ''));
  }

  private getServerErrorMessage(error: any, fallback: string): string {
    if (error instanceof Error && error.message === 'proposal_uuid_missing') {
      return this.lang === 'ar'
        ? 'لم يرجع الخادم معرّف المقترح.'
        : 'The server did not return a proposal identifier.';
    }

    const serverErrors = error?.error?.errors;
    if (serverErrors && typeof serverErrors === 'object') {
      for (const key of Object.keys(serverErrors)) {
        const messages = serverErrors[key];
        if (Array.isArray(messages) && messages.length > 0) {
          return messages.join(', ');
        }
        if (typeof messages === 'string' && messages.trim()) {
          return messages;
        }
      }
    }

    return error?.error?.message || error?.message || fallback;
  }

  private defaultOfferExpiryDate(projectType: string | null | undefined): string {
    return this.normalizeProjectType(projectType || null) === 'urgent_request'
      ? this.futureDateInputValue(1)
      : this.futureDateInputValue(7);
  }

  private normalizeProjectType(value: string | null): string | null {
    if (!value) return null;
    if (value === 'urgent' || value === 'urgent_request') return 'urgent_request';
    return value;
  }

  private futureDateInputValue(daysFromNow: number): string {
    const date = new Date();
    date.setDate(date.getDate() + daysFromNow);
    return this.toDateInputValue(date);
  }

  private toDateInputValue(date: Date): string {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  private formatDeadlineOffer(dateValue: string): string {
    const [yyyy, mm, dd] = dateValue.split('-');
    return `${dd}-${mm}-${yyyy} 23:59:59`;
  }

  private normalizeValue(value: unknown): string {
    return String(value || '').trim().toLowerCase();
  }

  private getDateTime(value: string | null | undefined): number {
    if (!value) return 0;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? 0 : date.getTime();
  }

  private isWarningResponse(error: any): boolean {
    return this.normalizeValue(error?.error?.type ?? error?.type) === 'warning';
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

  private getMappedLabel(
    value: string | null | undefined,
    labels: Record<string, { en: string; ar: string }>
  ): string {
    if (!value) return '-';
    const match = labels[value.toLowerCase()] ?? labels[value];
    if (!match) return this.humanizeValue(value);
    return this.lang === 'ar' ? match.ar : match.en;
  }

  private humanizeValue(value: string): string {
    return value.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim()
      .replace(/\b\w/g, l => l.toUpperCase());
  }

  private collectScopeFiles(scopes: CreatedProjectScope[]): CreatedProjectFile[] {
    return scopes.reduce<CreatedProjectFile[]>((files, scope) => {
      files.push(...this.getScopeFiles(scope));
      files.push(...this.collectScopeFiles(this.getScopeChildren(scope)));
      return files;
    }, []);
  }

  private uniqueFiles(files: CreatedProjectFile[]): CreatedProjectFile[] {
    const seen = new Set<string>();

    return files.filter(file => {
      if (!file?.uuid || seen.has(file.uuid)) return false;
      seen.add(file.uuid);
      return true;
    });
  }

  override ngOnDestroy(): void {
    this.clearRematchMatchDelay();
    super.ngOnDestroy();
  }
}
