import Swal from 'sweetalert2';
import { Component, EventEmitter, HostListener, Input, OnChanges, OnDestroy, OnInit, Output } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Observable, Subject, Subscription, from, of } from 'rxjs';
import { takeUntil, catchError, concatMap, filter, take, defaultIfEmpty, map } from 'rxjs/operators';
import { ProfileService } from 'src/app/_fake/services/get-profile/get-profile.service';
import { ProjectsCreatedService } from 'src/app/_fake/services/projects-created/projects-created.service';
import { ProjectOffersService } from 'src/app/_fake/services/project-offers/project-offers.service';
import { ProjectServiceDetails } from 'src/app/_fake/services/project-phase2/project-phase2.model';
import { AgreementRevisionsService } from 'src/app/_fake/services/agreement-revisions/agreement-revisions.service';
import { AgreementPatch, AgreementRevision, AgreementRevisionChange, AgreementRevisionItem, AgreementRole, isSharedRevision, CommercialDraft, ComponentDraft, DeliverableDraft, ScopeDraft, agreementPaymentStarted, editableComponents, agreementIsLocked, commercialDraft, deliverableDraft, editableScopes, linkedDeliverableIds, ownsAgreementGroup, scopeDraft } from 'src/app/_fake/services/agreement-revisions/agreement-revisions.model';

interface ServiceDraft {
  id: number; title: string; scopes: ScopeDraft[]; deliverables: DeliverableDraft[];
  editScopes: boolean; editDeliverables: boolean;
}
interface ChangeRow { label: string; before: string; after: string; delta?: string }
interface RecordRow { label: string; before: string; after: string; changed: boolean }
/** A revision item's changed fields and its full before/after record, as the details dialog shows them. */
interface RevisionTable { rows: ChangeRow[]; hasDelta: boolean; record: RecordRow[]; showRecord: boolean; hasBefore: boolean; hasAfter: boolean }
type InstallmentStatus = 'same' | 'changed' | 'added' | 'removed';
/** A payment value; `was` is set only when the revision changed it. */
interface InstallmentCell { text: string; was?: string }
interface InstallmentRow { status: InstallmentStatus; mark: string; statusLabel: string; order: number; title: InstallmentCell; share: InstallmentCell; due: InstallmentCell }
interface InstallmentSegment { status: InstallmentStatus; share: number; hint: string }
/** The payment schedule before and after a revision, matched payment by payment. */
interface InstallmentDiff { summary: string; rows: InstallmentRow[]; bars: Array<{ label: string; segments: InstallmentSegment[] }>; total: number; totalOk: boolean }
/** One offer file a revision added or removed; only files still on the offer can be opened. */
interface AttachmentChange { action: 'created' | 'deleted'; uuid: string; name: string; size: string; active: boolean }
const MONEY_FIELDS = ['fixed_price', 'proposed_price', 'hourly_rate', 'daily_rate'];
@Component({
  selector: 'app-agreement-revisions',
  templateUrl: './agreement-revisions.component.html',
  styleUrls: ['./agreement-revisions.component.scss'],
})
export class AgreementRevisionsComponent implements OnInit, OnChanges, OnDestroy {
  @Input() record: any;
  @Input() role: AgreementRole = 'client';
  @Input() lang = 'en';
  @Input() proposalContext = false;
  /** Proposal details show the edit action on the Offer tab instead. */
  @Input() showEditAction = true;
  /** The client's submitted matches (proposal match list): the project payload drops `invited` once the project is awarded. */
  @Input() matchList: any[] = [];
  @Output() refreshed = new EventEmitter<any>();
  /** A revision was marked seen, so the parent can lower its Revisions tab badge. */
  @Output() revisionSeen = new EventEmitter<number>();
  revisions: AgreementRevision[] = [];
  unseenCount = 0;
  expandedItems = new Set<AgreementRevisionItem>();
  private tables = new WeakMap<AgreementRevisionItem, RevisionTable>();
  private installmentDiffs = new WeakMap<AgreementRevisionItem, InstallmentDiff | null>();
  private attachmentChangeLists = new WeakMap<AgreementRevision, AttachmentChange[]>();
  openingFileUuid = '';
  detail: AgreementRevision | null = null;
  detailVisible = false;
  detailLoading = false;
  detailError = '';
  loading = false;
  error = '';
  success = '';
  page = 0;
  lastPage = 1;
  matchUuid = '';
  editorVisible = false;
  saving = false;
  preparing = false;
  stale = false;
  confirmDiscard = false;
  userId: number | null = null;
  groups: ServiceDraft[] = [];
  components: ComponentDraft[] = [];
  originalComponents: ComponentDraft[] = [];
  marketOptions: Record<string, Array<{ id: number; name: string }>> = {};
  marketError = '';
  commercial: CommercialDraft | null = null;
  originalCommercial: CommercialDraft | null = null;
  originalGroups: ServiceDraft[] = [];
  note = '';
  formError = '';
  validationErrors: string[] = [];
  private contextKey = '';
  private snapshot = '';
  private listRequest?: Subscription;
  private detailRequest?: Subscription;
  private destroy$ = new Subject<void>();
  private requestedRevision = 0;
  private lastSavedRevisionId: number | null = null;

  constructor(private api: AgreementRevisionsService, private clients: ProjectsCreatedService,
    private insighters: ProjectOffersService, private profile: ProfileService, private route: ActivatedRoute, private router?: Router) {}
  ngOnInit(): void {
    this.profile.currentUser$.pipe(takeUntil(this.destroy$)).subscribe(user => this.userId = user?.id ? Number(user.id) : null);
    this.profile.getProfile().pipe(takeUntil(this.destroy$)).subscribe({ error: () => {} });
    this.route.queryParamMap.pipe(takeUntil(this.destroy$)).subscribe(params => {
      this.requestedRevision = Number(params.get('revision')) || 0;
      if (this.requestedRevision) this.resolveRevision(this.requestedRevision);
    });
    this.api.changed$.pipe(takeUntil(this.destroy$)).subscribe(event => {
      if (event.projectUuid !== this.project?.uuid || event.revisionId === this.lastSavedRevisionId) return;
      this.stale = true;
      this.load();
    });
  }
  ngOnChanges(): void {
    if (this.role === 'client' && !this.matches.some((m: any) => m.uuid === this.matchUuid)) {
      const awarded = this.matches.find((m: any) => m.offer?.uuid && m.offer.uuid === this.project?.offer?.uuid);
      this.matchUuid = awarded?.uuid || (this.matches.length === 1 ? this.matches[0].uuid : '');
    }
    const key = `${this.role}:${this.project?.uuid}:${this.contextUuid}`;
    if (key !== this.contextKey) {
      this.contextKey = key;
      this.detailVisible = false;
      this.load();
      if (this.requestedRevision) this.resolveRevision(this.requestedRevision);
    }
  }
  ngOnDestroy(): void { this.destroy$.next(); this.destroy$.complete(); this.listRequest?.unsubscribe(); this.detailRequest?.unsubscribe(); }
  text(en: string, ar: string): string { return this.lang === 'ar' ? ar : en; }
  get project(): any { return this.role === 'client' ? this.record : this.record?.project; }
  get matches(): any[] {
    const seen = new Set<string>();
    return [...(this.project?.invited ?? []), ...(this.matchList ?? [])]
      .filter((m: any) => !!m.agreement_match_uuid && !seen.has(m.agreement_match_uuid) && !!seen.add(m.agreement_match_uuid))
      .map((m: any) => ({ ...m, uuid: m.agreement_match_uuid }));
  }
  get contextUuid(): string { return this.role === 'client' ? this.matchUuid : this.record?.offer?.uuid || ''; }
  get services(): ProjectServiceDetails[] { return this.project?.project_services ?? []; }
  get contract(): any { return this.record?.contract ?? this.project?.contract ?? this.record?.offer?.contract; }
  get locked(): boolean {
    return agreementIsLocked(this.contract, this.project?.status ?? this.record?.project_status) ||
      (!!(this.record?.contract_uuid || this.project?.contract_uuid) && !this.contract);
  }
  get canEditCommercial(): boolean {
    return this.role === 'insighter' && !!this.record?.offer?.uuid && !!this.userId && !this.locked &&
      !agreementPaymentStarted(this.project?.order ?? this.record?.order);
  }
  get canEdit(): boolean {
    return !!this.contextUuid && !this.locked && (this.canEditCommercial || this.ownedComponents.length > 0 || this.services.some(s =>
      editableScopes(s, this.role, this.userId) || ownsAgreementGroup(s.deliverables, this.role, this.userId)));
  }
  get ownedComponents(): ComponentDraft[] { return editableComponents(this.project, this.role, this.userId); }
  get projectComponents(): ComponentDraft[] { return this.components.filter(c => c.level === 'project'); }
  serviceComponents(serviceId: number): ComponentDraft[] { return this.components.filter(c => c.level === 'service' && c.projectServiceId === serviceId); }
  changeMarketType(component: ComponentDraft): void { component.value.ids = []; this.loadMarkets(component.value.type); }
  loadMarkets(type: string): void {
    if (this.marketOptions[type]) return;
    this.marketError = '';
    this.api.markets(type).pipe(takeUntil(this.destroy$)).subscribe({
      next: options => this.marketOptions = { ...this.marketOptions, [type]: options },
      error: () => this.marketError = this.text('Could not load markets.', 'تعذر تحميل الأسواق.'),
    });
  }
  get linkedIds(): Set<number> {
    // Include every visible offer: a deliverable may be linked to another invited insighter's payment.
    const installments = [
      ...(this.record?.offer?.installments ?? []), ...(this.project?.order?.installments ?? []),
      ...(this.record?.order?.installments ?? []),
      ...this.matches.reduce((all: any[], m: any) => all.concat(m.offer?.installments ?? []), []),
    ];
    return linkedDeliverableIds(installments);
  }
  trackMatch(_: number, match: any): string { return match.uuid; }
  changeMatch(): void { this.success = ''; this.requestedRevision = 0; this.detailRequest?.unsubscribe(); this.ngOnChanges(); }
  load(more = false): void {
    this.listRequest?.unsubscribe();
    if (!more) { this.revisions = []; this.page = 0; this.lastPage = 1; }
    this.error = '';
    if (!this.contextUuid) { this.loading = false; return; }
    this.loading = true;
    const page = more ? this.page + 1 : 1;
    this.listRequest = this.api.list(this.role, this.contextUuid, page).subscribe({
      next: res => {
        this.revisions = more ? [...this.revisions, ...res.data] : res.data; this.page = page; this.lastPage = res.meta?.last_page ?? page; this.loading = false;
        if (!more) this.unseenCount = res.meta?.unseen_count ?? res.data.filter(r => r.is_seen === false).length;
      },
      error: err => { this.error = this.serverError(err); this.loading = false; },
    });
  }
  private resolveRevision(id: number): void {
    if (this.role !== 'client' || this.matches.length < 2) {
      if (this.contextUuid) this.openRevision(id);
      return;
    }
    this.detailRequest?.unsubscribe();
    this.detailVisible = true; this.detailLoading = true; this.detail = null; this.detailError = '';
    this.detailRequest = from(this.matches).pipe(
      concatMap(match => this.api.show(this.role, match.uuid, id).pipe(
        // Only a missing revision means "try the next invitation"; surface auth/network failures.
        catchError(err => { if (err.status === 404) return of(null); throw err; }),
        filter((revision): revision is AgreementRevision => !!revision),
        concatMap(revision => of({ match, revision })),
      )), take(1), defaultIfEmpty(null),
    ).subscribe({
      next: result => {
        this.detailLoading = false;
        if (!result) { this.detailError = this.text('This revision is not available for these invitations.', 'هذه المراجعة غير متاحة ضمن الدعوات الحالية.'); return; }
        this.matchUuid = result.match.uuid; this.contextKey = `${this.role}:${this.project?.uuid}:${this.contextUuid}`;
        this.detail = result.revision; this.load(); this.markSeen(result.revision);
      }, error: err => { this.detailLoading = false; this.detailError = this.serverError(err); },
    });
  }
  openRevision(id: number): void {
    this.detailRequest?.unsubscribe(); this.detail = null; this.detailError = ''; this.detailVisible = true; this.detailLoading = true;
    this.requestedRevision = id;
    this.expandedItems = new Set(); this.tables = new WeakMap(); this.attachmentChangeLists = new WeakMap();
    this.detailRequest = this.api.show(this.role, this.contextUuid, id).subscribe({
      next: detail => { this.detail = detail; this.detailLoading = false; this.markSeen(detail); },
      error: err => { this.detailError = this.serverError(err); this.detailLoading = false; },
    });
  }
  /** Opening a revision marks it seen (and its bell notification read). Failures stay silent. */
  private markSeen(revision: AgreementRevision): void {
    const listed = this.revisions.find(r => r.id === revision.id);
    if (revision.is_seen !== false && listed?.is_seen !== false) return;
    const contextUuid = this.contextUuid;
    if (!contextUuid) return;
    this.api.markSeen(this.role, contextUuid, revision.id).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        const seenAt = new Date().toISOString();
        [revision, listed].forEach(r => { if (r) { r.is_seen = true; r.seen_at = r.seen_at ?? seenAt; } });
        if (contextUuid !== this.contextUuid) return;
        this.unseenCount = Math.max(0, this.unseenCount - 1);
        this.revisionSeen.emit(revision.id);
        this.api.seen$.next({ projectUuid: this.project?.uuid, revisionId: revision.id });
      },
      error: () => {},
    });
  }
  shared(revision: AgreementRevision): boolean { return isSharedRevision(revision); }
  initials(name?: string): string {
    return (name || '').trim().split(/\s+/).slice(0, 2).map(part => part.charAt(0).toUpperCase()).join('') || '?';
  }
  toggleRecord(item: AgreementRevisionItem): void {
    if (this.expandedItems.has(item)) this.expandedItems.delete(item); else this.expandedItems.add(item);
  }
  retryDetail(): void { this.resolveRevision(this.requestedRevision); }
  private fetchRecord(): Observable<any> {
    return this.role === 'client' ? this.clients.getProject(this.project.uuid) :
      this.proposalContext ? this.insighters.getProposalDetails(this.project.uuid) : this.insighters.getInsighterProjectDetails(this.project.uuid);
  }
  private fingerprint(record: any): string {
    const project = this.role === 'client' ? record : record.project;
    return JSON.stringify([project?.project_services, project?.components, record?.offer, project?.contract, record?.contract, project?.order, project?.status]);
  }
  startEditing(): void {
    if (!this.canEdit || this.preparing) return;
    if (this.role === 'insighter') {
      this.router?.navigate(['/app/insighter-dashboard/project-offers/edit-offer', this.project.uuid], { queryParams: { from: this.proposalContext ? 'offers' : 'projects' } });
      return;
    }
    this.preparing = true; this.error = ''; this.success = '';
    this.fetchRecord().pipe(takeUntil(this.destroy$)).subscribe({
      next: record => {
        this.record = record; this.refreshed.emit(record); this.preparing = false;
        if (!this.canEdit) { this.error = this.text('This agreement is no longer editable. The details have been refreshed.', 'لم يعد هذا الاتفاق قابلاً للتعديل. تم تحديث التفاصيل.'); return; }
        this.snapshot = this.fingerprint(record); this.stale = false;
        this.groups = this.services.filter(s => !!s.id).map(s => ({
          id: s.id!, title: s.title || s.service?.name || this.text('Service', 'الخدمة'),
          scopes: s.scopes.map(scopeDraft), deliverables: s.deliverables.map(deliverableDraft),
          editScopes: editableScopes(s, this.role, this.userId), editDeliverables: ownsAgreementGroup(s.deliverables, this.role, this.userId),
        }));
        this.originalGroups = JSON.parse(JSON.stringify(this.groups));
        this.components = this.ownedComponents;
        this.originalComponents = JSON.parse(JSON.stringify(this.components));
        this.components.filter(c => c.slug === 'target-market').forEach(c => this.loadMarkets(c.value.type));
        this.commercial = this.canEditCommercial ? commercialDraft(this.record.offer) : null;
        this.originalCommercial = this.commercial ? JSON.parse(JSON.stringify(this.commercial)) : null;
        this.note = ''; this.formError = ''; this.validationErrors = []; this.confirmDiscard = false; this.editorVisible = true;
      },
      error: err => { this.error = this.serverError(err); this.preparing = false; },
    });
  }
  get payload(): AgreementPatch {
    const patch: AgreementPatch = {};
    this.groups.forEach((group, index) => {
      const before = this.originalGroups[index];
      if (group.editScopes && JSON.stringify(group.scopes) !== JSON.stringify(before.scopes))
        (patch.scopes ??= []).push({ project_service_id: group.id, items: group.scopes });
      if (group.editDeliverables && JSON.stringify(group.deliverables) !== JSON.stringify(before.deliverables))
        (patch.deliverables ??= []).push({ project_service_id: group.id, items: group.deliverables });
    });
    this.components.forEach((component, index) => {
      if (JSON.stringify(component.value) === JSON.stringify(this.originalComponents[index]?.value)) return;
      (component.level === 'project' ? (patch.project_components ??= []) : (patch.service_components ??= [])).push({ id: component.id, value: component.value });
    });
    if (this.commercial && JSON.stringify(this.commercial) !== JSON.stringify(this.originalCommercial)) Object.assign(patch, this.commercial);
    return patch;
  }
  get dirty(): boolean { return Object.keys(this.payload).length > 0; }
  get totalPercentage(): number { return (this.commercial?.installments ?? []).reduce((sum, i) => sum + Number(i.percentage || 0), 0); }
  get savedDeliverables(): DeliverableDraft[] { return this.groups.reduce<DeliverableDraft[]>((all, g) => all.concat(g.deliverables.filter(d => !!d.id)), []); }
  addScope(group: ServiceDraft): void { group.scopes.push({ scope: '', description: '', subscopes: [] }); }
  addSubscope(scope: ScopeDraft): void { scope.subscopes.push({ scope: '', description: '', subscopes: [] }); }
  addDeliverable(group: ServiceDraft): void { group.deliverables.push({ title: '', period_days: 0, report_type: [], way: { selected: 'on_platform', address: null } }); }
  removeDeliverable(group: ServiceDraft, index: number): void {
    if (group.deliverables[index].id && this.linkedIds.has(group.deliverables[index].id!)) return;
    group.deliverables.splice(index, 1);
  }
  setFormats(item: DeliverableDraft, value: string): void { item.report_type = value.split(',').map(v => v.trim().toLowerCase()).filter(Boolean); }
  addInstallment(): void { this.commercial?.installments.push({ title: '', percentage: Math.max(0, 100 - this.totalPercentage), due_type: 'date', period_days: 0 }); }
  changeDueType(item: CommercialDraft['installments'][number]): void {
    delete item.project_service_deliverable_id; delete item.project_proposal_offer_deliverable_id; delete item.period_days;
    if (item.due_type === 'date') item.period_days = 0;
  }
  cancel(): void {
    if (this.saving) return;
    if (this.dirty || this.note.trim()) this.confirmDiscard = true;
    else this.editorVisible = false;
  }
  canDeactivate(): boolean | Observable<boolean> {
    if (this.saving) return false;
    if (!this.editorVisible || (!this.dirty && !this.note.trim())) return true;
    return from(Swal.fire({
      title: this.text('Discard unsaved changes?', 'تجاهل التغييرات غير المحفوظة؟'),
      text: this.text('Your draft has not been saved as a revision.', 'لم يتم حفظ مسودتك كمراجعة.'),
      icon: 'warning', showCancelButton: true,
      didOpen: popup => { if (popup.parentElement) popup.parentElement.style.zIndex = '10000'; },
      confirmButtonText: this.text('Discard changes', 'تجاهل التغييرات'), cancelButtonText: this.text('Keep editing', 'متابعة التعديل'),
    })).pipe(map(result => result.isConfirmed));
  }
  @HostListener('window:beforeunload', ['$event']) beforeUnload(event: BeforeUnloadEvent): void {
    if (this.editorVisible && (this.dirty || !!this.note.trim())) { event.preventDefault(); event.returnValue = ''; }
  }
  validate(): string[] {
    const errors: string[] = [];
    const validDay = (v: any) => v !== null && v !== '' && Number.isInteger(Number(v)) && Number(v) >= 0;
    const validTitle = (v: string) => !!v?.trim() && v.length <= 255;
    const changes = this.payload;
    this.groups.forEach(group => {
      if (changes.scopes?.some(g => g.project_service_id === group.id) && group.editScopes && group.scopes.some(s => !validTitle(s.scope) || (s.description?.length ?? 0) > 2500 || s.subscopes.some(c => !validTitle(c.scope) || (c.description?.length ?? 0) > 2500)))
        errors.push(this.text(`${group.title}: add a title to every scope and subscope (up to 255 characters). Descriptions can contain up to 2,500 characters.`, `${group.title}: أدخل عنواناً لكل نطاق ونطاق فرعي (حتى 255 حرفاً)، ووصفاً لا يتجاوز 2500 حرف.`));
      if (changes.deliverables?.some(g => g.project_service_id === group.id) && group.editDeliverables && group.deliverables.some(d => !validTitle(d.title) || !validDay(d.period_days) || (d.way.selected === 'physical_workshop' && !d.way.address?.trim())))
        errors.push(this.text(`${group.title}: complete deliverable titles, valid delivery days and workshop addresses.`, `${group.title}: أكمل عناوين المخرجات وأيام التسليم وعناوين الورش الحضورية.`));
    });
    const changedComponents = [...(changes.project_components ?? []), ...(changes.service_components ?? [])].map(row => row.id);
    this.components.filter(c => changedComponents.includes(c.id)).forEach(c => {
      if (c.slug === 'target-market' && !c.value.ids.length) errors.push(this.text(`${c.name}: choose at least one target market.`, `${c.name}: اختر سوقاً مستهدفاً واحداً على الأقل.`));
      if (c.slug === 'data-sources-expected' && !c.value) errors.push(this.text(`${c.name}: choose the data sources.`, `${c.name}: اختر مصادر البيانات.`));
    });
    if (this.payload.price_type && this.commercial) {
      const c = this.commercial;
      const price = c.price_type === 'fixed' ? c.fixed_price : c.price_type === 'hourly' ? c.hourly_rate : c.daily_rate;
      const units = c.price_type === 'hourly' ? c.estimated_hours : c.estimated_days;
      if (price == null || !Number.isFinite(Number(price)) || Number(price) < 0 || (c.price_type !== 'fixed' && (!Number.isInteger(Number(units)) || Number(units) < 1)))
        errors.push(this.text('Enter a valid price and, when applicable, at least one hour or day.', 'أدخل سعراً صحيحاً وعدد ساعات أو أيام لا يقل عن واحد عند الحاجة.'));
      if (Math.abs(this.totalPercentage - 100) > 0.00001 || (c.payment_plan === 'full' ? c.installments.length !== 1 : c.installments.length < 2))
        errors.push(this.text('Installments must total 100%. Full payment needs one installment; partial payment needs at least two.', 'يجب أن يكون مجموع الدفعات 100%. الدفع الكامل يحتاج دفعة واحدة، والجزئي دفعتين على الأقل.'));
      if (c.installments.filter(i => i.due_type === 'contract').length > 1 || c.installments.some(i => !validTitle(i.title) || Number(i.percentage) < 1 || Number(i.percentage) > 100 || !Number.isFinite(Number(i.percentage)) ||
        (i.due_type === 'date' && !validDay(i.period_days)) || (i.due_type === 'deliverable' && !i.project_service_deliverable_id && !i.project_proposal_offer_deliverable_id)))
        errors.push(this.text('Complete every payment title, percentage and due condition. Only one payment can be due on signing.', 'أكمل عنوان ونسبة وموعد كل دفعة. يُسمح بدفعة واحدة فقط عند التوقيع.'));
    }
    return errors;
  }
  save(): void {
    if (this.saving || !this.dirty || this.locked || this.stale) return;
    this.validationErrors = this.validate(); this.formError = '';
    if (this.validationErrors.length) return;
    this.saving = true;
    const patch = { ...this.payload, user_note: this.note.trim() || undefined };
    this.fetchRecord().pipe(takeUntil(this.destroy$)).subscribe({
      next: latest => {
        if (this.fingerprint(latest) !== this.snapshot) {
          this.saving = false; this.stale = true;
          this.formError = this.text('The agreement changed while you were editing. Your draft is still visible. Close it and refresh before trying again.', 'تغيّر الاتفاق أثناء التعديل. مسودتك ما زالت ظاهرة. أغلقها وحدّث التفاصيل قبل المحاولة مجدداً.');
          return;
        }
        this.api.update(this.role, this.contextUuid, patch).pipe(takeUntil(this.destroy$)).subscribe({
          next: revision => {
            this.lastSavedRevisionId = revision.id;
            this.editorVisible = false; this.saving = false;
            this.success = this.text(`Revision #${revision.revision_number} saved. The other party will be notified.`, `تم حفظ المراجعة #${revision.revision_number}. سيتم إشعار الطرف الآخر.`);
            this.load(); this.refreshDetails();
            this.api.changed$.next({ projectUuid: this.project.uuid, revisionId: revision.id });
          },
          error: err => { this.saving = false; this.formError = this.serverError(err); },
        });
      },
      error: err => { this.saving = false; this.formError = this.serverError(err); },
    });
  }
  refreshDetails(): void {
    this.fetchRecord().pipe(takeUntil(this.destroy$)).subscribe({
      next: record => { this.record = record; this.refreshed.emit(record); this.stale = false; },
      error: () => { this.stale = true; this.error = this.text('Your revision was saved, but details could not refresh. Please retry.', 'تم حفظ المراجعة، لكن تعذر تحديث التفاصيل. أعد المحاولة.'); },
    });
  }
  serverError(err: any): string {
    const errors = err?.error?.errors;
    return errors ? Object.values(errors).map((v: any) => Array.isArray(v) ? v.join(' ') : String(v)).join(' ') :
      err?.error?.message || this.text('Could not load or save the agreement. Please try again.', 'تعذر تحميل أو حفظ الاتفاق. يرجى المحاولة مجدداً.');
  }
  label(value: string): string {
    const labels: Record<string, [string, string]> = {
      scope: ['Scope', 'النطاق'], component: ['Component', 'المكوّن'], deliverable: ['Deliverable', 'المخرج'], installment: ['Installment', 'الدفعة'], offer_price: ['Price', 'السعر'],
      project_property: ['Schedule', 'الجدول الزمني'], proposal_property: ['Offer deadline', 'موعد انتهاء العرض'],
      created: ['Added', 'أُضيف'], updated: ['Updated', 'عُدّل'], deleted: ['Removed', 'حُذف'], client: ['Client', 'العميل'], insighter: ['Insighter', 'الخبير'],
      title: ['Title', 'العنوان'], description: ['Description', 'الوصف'], period_days: ['Days after start', 'أيام بعد البدء'], report_type: ['Formats', 'الصيغ'],
      delivery_method: ['Delivery method', 'طريقة التسليم'], delivery_address: ['Address', 'العنوان'], percentage: ['Percentage', 'النسبة'], due_type: ['Due', 'الاستحقاق'],
      price_type: ['Pricing', 'التسعير'], fixed_price: ['Fixed price', 'السعر الثابت'], proposed_price: ['Total price', 'السعر الإجمالي'], payment_plan: ['Payment plan', 'خطة الدفع'],
      hourly_rate: ['Hourly rate', 'السعر بالساعة'], daily_rate: ['Daily rate', 'السعر اليومي'], estimated_hours: ['Hours', 'الساعات'], estimated_days: ['Days', 'الأيام'],
      contract: ['On signing', 'عند التوقيع'], date: ['After project start', 'بعد بدء المشروع'], fixed: ['Fixed price', 'سعر ثابت'], hourly: ['Hourly', 'بالساعة'], daily: ['Daily', 'باليوم'],
      full: ['Full payment', 'دفع كامل'], partial: ['Installments', 'دفعات'], on_platform: ['On platform', 'على المنصة'], session: ['Session', 'جلسة'], physical_workshop: ['In-person workshop', 'ورشة حضورية'],
      position: ['Order', 'الترتيب'], value: ['Value', 'القيمة'], selected: ['Method', 'الطريقة'], way: ['Delivery', 'التسليم'], address: ['Address', 'العنوان'],
      cover_letter: ['Technical proposal', 'نص العرض الفني'], suggested_duration_days: ['Suggested project duration', 'مدة المشروع المقترحة'],
      offer_cover_letter: ['Technical proposal', 'نص العرض الفني'], offer_attachment: ['Offer attachments', 'مرفقات العرض'], offer_duration_days: ['Suggested project duration', 'مدة المشروع المقترحة'],
    };
    return labels[value] ? this.text(...labels[value]) : value.replace(/_/g, ' ');
  }
  /** Icon, tone and plural label for each changed area in the revisions list. */
  typeMeta(type: string): { icon: string; tone: string; label: string } {
    const meta: Record<string, [string, string, string, string]> = {
      offer_price: ['ki-dollar', 'price', 'Price', 'السعر'],
      installment: ['ki-calendar', 'price', 'Payments', 'الدفعات'],
      scope: ['ki-questionnaire-tablet', 'scope', 'Scopes', 'النطاقات'],
      deliverable: ['ki-cube-2', 'deliverable', 'Deliverables', 'المخرجات'],
      component: ['ki-element-11', 'component', 'Requirements', 'المتطلبات'],
      project_property: ['ki-calendar-8', 'deliverable', 'Schedule', 'الجدول الزمني'],
      proposal_property: ['ki-time', 'scope', 'Offer deadline', 'موعد انتهاء العرض'],
      offer_cover_letter: ['ki-document', 'component', 'Technical proposal', 'العرض الفني'],
      offer_attachment: ['ki-paper-clip', 'component', 'Attachments', 'المرفقات'],
      offer_duration_days: ['ki-time', 'deliverable', 'Suggested duration', 'المدة المقترحة'],
    };
    const [icon, tone, en, ar] = meta[type] ?? ['ki-notepad-edit', 'component', this.label(type), this.label(type)];
    return { icon, tone, label: this.text(en, ar) };
  }
  revisionTitle(revision: AgreementRevision): string {
    return (revision.changed_target_types ?? []).map(type => this.typeMeta(type).label).join(this.text(' and ', ' و'));
  }
  /** Updated items list only the fields that changed; added/removed items get a one-line summary. */
  changeRows(item: AgreementRevisionItem): ChangeRow[] {
    // Backend-built rows win; the raw diff below is the fallback for older revisions.
    if (Array.isArray(item.changes) && item.changes.length) return item.changes.map(change => this.backendRow(item, change));
    const before = this.plain(item.before_value), after = this.plain(item.after_value);
    if (item.action !== 'updated' || !before || !after) return [];
    // Schedule and offer-deadline items carry a single { value }; the header already names it.
    if (this.isProperty(item))
      return [{ label: this.text('Changed', 'تغيّر'), before: this.propertyValue(item, before['value']), after: this.propertyValue(item, after['value']) }];
    return Array.from(new Set([...Object.keys(before), ...Object.keys(after)]))
      .filter(key => !this.hiddenKey(key) && this.describe(before[key]) !== this.describe(after[key]))
      .map(key => this.row(this.label(key), key, before[key], after[key]));
  }
  /** Computed once per item: the template reads it many times per change detection. */
  table(item: AgreementRevisionItem): RevisionTable {
    let table = this.tables.get(item);
    if (!table) {
      const rows = item.action === 'updated' ? this.changeRows(item) : [];
      const record = this.recordRows(item);
      // An updated item whose every field changed would only repeat the change table above.
      table = { rows, hasDelta: rows.some(row => row.delta), record,
        showRecord: record.length > 0 && (item.action !== 'updated' || record.some(row => !row.changed)),
        hasBefore: item.before_value != null, hasAfter: item.after_value != null };
      this.tables.set(item, table);
    }
    return table;
  }
  /** Attachment items render together as one list of added and removed files. */
  detailItems(revision: AgreementRevision): AgreementRevisionItem[] {
    return (revision.items ?? []).filter(item => item.target_type !== 'offer_attachment');
  }
  attachmentChanges(revision: AgreementRevision): AttachmentChange[] {
    let list = this.attachmentChangeLists.get(revision);
    if (!list) {
      const active = new Set(this.activeOfferFiles.map((file: any) => file?.uuid).filter(Boolean));
      list = (revision.items ?? []).filter(item => item.target_type === 'offer_attachment').map(item => {
        const file = this.plain(item.action === 'deleted' ? item.before_value : item.after_value) ?? {};
        const uuid = String(file['file_uuid'] ?? file['uuid'] ?? '');
        return { action: item.action === 'deleted' ? 'deleted' : 'created', uuid, name: String(file['name'] || this.text('File', 'ملف')),
          size: this.fileSize(file['size']), active: item.action !== 'deleted' && !!uuid && active.has(uuid) } as AttachmentChange;
      }).sort((a, b) => (a.action === b.action ? 0 : a.action === 'deleted' ? -1 : 1));
      this.attachmentChangeLists.set(revision, list);
    }
    return list;
  }
  /** The offer's files as they are now, which is what an added file in a revision can still open. */
  private get activeOfferFiles(): any[] {
    if (this.role === 'insighter') return this.record?.offer?.files ?? [];
    const match = this.matches.find((m: any) => m.uuid === this.matchUuid);
    return match?.offer?.files ?? this.project?.offer?.files ?? [];
  }
  openAttachment(change: AttachmentChange): void {
    if (!change.active || this.openingFileUuid) return;
    const tab = window.open('', '_blank');
    this.openingFileUuid = change.uuid;
    const request = this.role === 'client' ? this.clients.getProjectFileUrl(change.uuid) : this.insighters.getProjectFileUrl(change.uuid);
    request.pipe(takeUntil(this.destroy$)).subscribe({
      next: url => {
        this.openingFileUuid = '';
        if (!url) { tab?.close(); this.detailError = this.text('The file link is not available.', 'رابط الملف غير متاح.'); return; }
        if (tab) tab.location.href = url; else window.open(url, '_blank');
      },
      error: err => { this.openingFileUuid = ''; tab?.close(); this.detailError = this.serverError(err); },
    });
  }
  private fileSize(value: unknown): string {
    const bytes = Number(value);
    if (!Number.isFinite(bytes) || bytes <= 0) return '';
    return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  /** The cover letter before or after a technical-proposal item. */
  coverLetter(value: unknown): string {
    const text = this.plain(value)?.['cover_letter'];
    return typeof text === 'string' && text.trim() ? text : '';
  }
  /** Suggested duration items are proposals: they reach the project only when the client awards this offer. */
  durationNote(item: AgreementRevisionItem): string {
    const days = Number(this.plain(item.after_value)?.['suggested_duration_days']);
    if (!Number.isFinite(days) || days < 1) return '';
    if (this.role === 'insighter')
      return this.text(`A proposal to the client. The project duration becomes ${days} days only if they award your offer.`, `اقتراح للعميل. تصبح مدة المشروع ${days} يومًا فقط إذا رسّى عرضك.`);
    return this.text(`A proposal from the Insighter. Awarding this offer will set the project duration to ${days} days.`, `اقتراح من الخبير. ترسية هذا العرض ستجعل مدة المشروع ${days} يومًا.`);
  }

  /**
   * Payment schedule items store the whole list before and after. Installments are recreated on every save, so
   * payments are matched by title, then a leftover pair in the same slot that still shares its amount or due date.
   */
  installmentDiff(item: AgreementRevisionItem): InstallmentDiff | null {
    if (this.installmentDiffs.has(item)) return this.installmentDiffs.get(item)!;
    const list = (value: unknown): any[] => {
      const rows = Array.isArray(value) ? value : this.plain(value)?.['installments'];
      return Array.isArray(rows) ? [...rows].sort((a, b) => Number(a?.position ?? 0) - Number(b?.position ?? 0)) : [];
    };
    const before = list(item.before_value), after = list(item.after_value);
    if (item.target_type !== 'installment' || (!before.length && !after.length)) {
      this.installmentDiffs.set(item, null);
      return null;
    }
    const title = (row: any) => String(row?.title ?? '').trim();
    const pairs = new Array<number>(after.length).fill(-1), used = new Set<number>();
    const match = (test: (old: any, b: number, row: any, a: number) => boolean) => after.forEach((row, a) => {
      if (pairs[a] >= 0) return;
      const b = before.findIndex((old, i) => !used.has(i) && test(old, i, row, a));
      if (b >= 0) { pairs[a] = b; used.add(b); }
    });
    match((old, _b, row) => !!title(row) && title(old).toLowerCase() === title(row).toLowerCase());
    match((old, b, row, a) => b === a && (this.share(old) === this.share(row) || this.installmentDue(old) === this.installmentDue(row)));

    const cell = (now: string, was?: string): InstallmentCell => was !== undefined && was !== now ? { text: now, was } : { text: now };
    const meta: Record<InstallmentStatus, [string, string]> = {
      same: ['', this.text('Unchanged', 'بدون تغيير')], changed: ['~', this.text('Changed', 'معدّلة')],
      added: ['+', this.text('Added', 'مضافة')], removed: ['−', this.text('Removed', 'محذوفة')],
    };
    const build = (status: InstallmentStatus, order: number, row: any, old?: any): InstallmentRow => {
      const titleCell = cell(title(row) || '—', old ? title(old) || '—' : undefined);
      const shareCell = cell(`${this.share(row)}%`, old ? `${this.share(old)}%` : undefined);
      const dueCell = cell(this.installmentDue(row), old ? this.installmentDue(old) : undefined);
      const final = status === 'same' && (titleCell.was || shareCell.was || dueCell.was) ? 'changed' : status;
      return { status: final, mark: meta[final][0], statusLabel: meta[final][1], order, title: titleCell, share: shareCell, due: dueCell };
    };
    const afterRows = after.map((row, a) => build(pairs[a] >= 0 ? 'same' : 'added', a + 1, row, pairs[a] >= 0 ? before[pairs[a]] : undefined));
    // A removed payment sits right after the payment that preceded it in the old schedule.
    const placed = afterRows.map((row, a) => ({ key: a, row }));
    before.forEach((row, b) => {
      if (used.has(b)) return;
      const previous = pairs.reduce((best, pb, a) => pb >= 0 && pb < b && (best < 0 || pb > pairs[best]) ? a : best, -1);
      placed.push({ key: previous + 0.5, row: build('removed', b + 1, row) });
    });
    const rows = placed.sort((x, y) => x.key - y.key).map(entry => entry.row);

    const hint = (row: InstallmentRow) => `${row.order}. ${row.title.text} · ${row.share.text}`;
    const beforeSegments = before.map((row, b): InstallmentSegment => {
      const a = pairs.indexOf(b);
      const status = a < 0 ? 'removed' : afterRows[a].status;
      return { status, share: this.share(row), hint: `${b + 1}. ${title(row) || '—'} · ${this.share(row)}%` };
    });
    const total = Math.round(after.reduce((sum, row) => sum + this.share(row), 0) * 100) / 100;
    const count = (status: InstallmentStatus) => rows.filter(row => row.status === status).length;
    const summary = (['changed', 'added', 'removed'] as InstallmentStatus[]).filter(status => count(status))
      .map(status => `${count(status)} ${meta[status][1].toLowerCase()}`).join(' · ');
    const diff: InstallmentDiff = {
      summary, rows, total, totalOk: Math.abs(total - 100) < 0.01,
      bars: [
        { label: this.text('Before', 'قبل'), segments: beforeSegments },
        { label: this.text('After', 'بعد'), segments: afterRows.map(row => ({ status: row.status, share: this.share(after[row.order - 1]), hint: hint(row) })) },
      ],
    };
    this.installmentDiffs.set(item, diff);
    return diff;
  }
  /** "20.0000" reads as 20, "12.5" as 12.5. */
  private share(row: any): number {
    const value = Number(row?.percentage);
    return Number.isFinite(value) ? Math.round(value * 100) / 100 : 0;
  }
  private installmentDue(row: any): string {
    const days = row?.period_days === null || row?.period_days === undefined || row?.period_days === '' ? null : Number(row.period_days);
    switch (row?.due_type) {
      case 'contract': return this.text('On signing', 'عند التوقيع');
      case 'date': return days === null ? this.text('After project start', 'بعد بدء المشروع') : this.text(`Day ${days} after start`, `اليوم ${days} بعد البدء`);
      case 'deliverable': {
        const name = this.linkedDeliverableTitle(row);
        const base = name ? this.text(`On delivery of “${name}”`, `عند تسليم «${name}»`) : this.text('On delivery', 'عند التسليم');
        return days === null ? base : `${base} · ${this.text('day', 'اليوم')} ${days}`;
      }
      default: return this.describe(row?.due_type);
    }
  }
  /** Revisions store deliverable IDs only; the record in view supplies their titles. */
  private linkedDeliverableTitle(row: any): string {
    const serviceId = Number(row?.project_service_deliverable_id), offerId = Number(row?.project_proposal_offer_deliverable_id);
    if (serviceId > 0)
      return this.services.reduce<any[]>((all, s) => all.concat(s.deliverables ?? []), []).find(d => Number(d?.id) === serviceId)?.title || '';
    if (offerId > 0) {
      const offer = this.record?.offer ?? this.project?.offer;
      return (offer?.offer_components ?? []).reduce((all: any[], c: any) => all.concat(c?.value?.deliverables ?? []), [])
        .find((d: any) => Number(d?.id) === offerId)?.title || '';
    }
    return '';
  }
  /** "2 fields changed" / "8 fields", with Arabic dual and plural forms. */
  fieldCount(count: number, changed = false): string {
    if (changed) return this.text(`${count} ${count === 1 ? 'field' : 'fields'} changed`,
      count === 1 ? 'تغيّر حقل واحد' : count === 2 ? 'تغيّر حقلان' : `تغيّرت ${count} حقول`);
    return this.text(`${count} ${count === 1 ? 'field' : 'fields'}`, count === 1 ? 'حقل واحد' : count === 2 ? 'حقلان' : `${count} حقول`);
  }
  /** Every field of the item side by side, before and after, marking the ones that changed. */
  private recordRows(item: AgreementRevisionItem): RecordRow[] {
    const side = (value: unknown): Record<string, any> => this.plain(value) ?? (value == null ? {} : { value });
    const before = side(item.before_value), after = side(item.after_value);
    const format = (key: string, value: unknown) => this.isProperty(item) && key === 'value' ? this.propertyValue(item, value) : this.formatField(key, value);
    return Array.from(new Set([...Object.keys(before), ...Object.keys(after)]))
      .filter(key => !this.hiddenKey(key))
      .map(key => ({ label: this.label(key), before: format(key, before[key]), after: format(key, after[key]),
        changed: item.action === 'updated' && this.describe(before[key]) !== this.describe(after[key]) }));
  }
  private row(label: string, key: string, before: unknown, after: unknown): ChangeRow {
    const delta = this.delta(key, before, after);
    return { label, before: this.formatField(key, before), after: this.formatField(key, after), ...(delta ? { delta } : {}) };
  }
  private delta(key: string, before: unknown, after: unknown): string {
    if (!MONEY_FIELDS.includes(key) || before == null || after == null || before === '' || after === '') return '';
    const diff = Number(after) - Number(before);
    if (!Number.isFinite(diff) || diff === 0) return '';
    return `${diff > 0 ? '+' : '−'}${this.money(Math.abs(diff))}`;
  }
  private money(value: number): string {
    return `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  changeSummary(item: AgreementRevisionItem, value: unknown): string {
    const object = this.plain(value);
    if (!object) return this.describe(value);
    return Object.entries(object)
      .filter(([key, val]) => !this.hiddenKey(key) && this.describe(val) !== '—' && String(val) !== item.target_label)
      .map(([key, val]) => this.formatField(key, val)).join(' · ');
  }
  private formatField(key: string, value: unknown): string {
    const text = this.describe(value);
    if (text === '—') return text;
    if (MONEY_FIELDS.includes(key) && Number.isFinite(Number(value))) return this.money(Number(value));
    if (key === 'percentage') return `${text}%`;
    if (key === 'period_days') return `${this.text('Day', 'اليوم')} ${text}`;
    if (key === 'suggested_duration_days') return this.text(`${text} ${Number(value) === 1 ? 'day' : 'days'}`, `${text} يوم`);
    return text;
  }
  private backendRow(item: AgreementRevisionItem, change: AgreementRevisionChange): ChangeRow {
    if (this.isProperty(item) && change.field === 'value')
      return { label: this.text('Changed', 'تغيّر'), before: this.propertyValue(item, change.before), after: this.propertyValue(item, change.after) };
    return this.row(change.label || this.label(change.field), change.field, change.before, change.after);
  }
  private isProperty(item: AgreementRevisionItem): boolean {
    return item.target_type === 'project_property' || item.target_type === 'proposal_property';
  }
  /** Dates read as "15 Nov 2026"; the duration reads as days. */
  private propertyValue(item: AgreementRevisionItem, value: unknown): string {
    if (value === null || value === undefined || value === '') return '—';
    const raw = String(value);
    const date = /^\d{4}-\d{2}-\d{2}/.test(raw) ? new Date(`${raw.slice(0, 10)}T00:00:00`) : null;
    if (date && !Number.isNaN(date.getTime()))
      return date.toLocaleDateString(this.lang === 'ar' ? 'ar-u-nu-latn' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    // The only numeric schedule property is the duration (labels arrive localized).
    if (item.target_type === 'project_property' && Number.isFinite(Number(value)))
      return `${raw} ${this.text(Number(value) === 1 ? 'day' : 'days', 'يوم')}`;
    return this.describe(value);
  }
  private plain(value: unknown): Record<string, any> | null {
    return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, any> : null;
  }
  private hiddenKey(key: string): boolean { return key === 'id' || key === 'position' || key.endsWith('_id'); }
  describe(value: any): string {
    if (value === null || value === undefined || value === '') return '—';
    if (Array.isArray(value)) return value.map(v => this.describe(v)).join(' · ');
    if (typeof value === 'object') return Object.entries(value).map(([k, v]) => `${this.label(k)}: ${this.describe(v)}`).join(' · ');
    return typeof value === 'string' ? this.label(value) : String(value);
  }
}
