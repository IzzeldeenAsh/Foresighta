import { Component, EventEmitter, HostListener, Input, OnChanges, Output } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from 'src/environments/environment';
import { MissingOfferRequirements, MissingComponentRequirement, MissingScopeRequirement, OfferRequirementDraft, OfferScope, OfferComponent, mapMissingOfferRequirements, offerRequirementsAreComplete, requirementValueIsFilled } from 'src/app/_fake/services/project-phase2/project-requirements.model';
import { ProjectServiceDetails, addDaysToDate, flatMapList } from'src/app/_fake/services/project-phase2/project-phase2.model';

/** One accordion row: a service's scope, or a component the insighter must fill. */
interface RequirementRow { key: string; scope?: MissingScopeRequirement; component?: MissingComponentRequirement; }
/** A catalog scope from `common/setting/service/scope/{service}`; children are its sub-scopes. */
interface ScopeOption { id: number; name: string; description?: string | null; children: ScopeOption[]; }
/** A picked scope (catalog `c{id}` or custom `m{n}`) and the sub-scopes picked under it, like the client stepper. */
interface ScopePick { id?: number; savedChildren?: any[]; key: string; name: string; description?: string | null; children: ScopeOption[]; childIds: number[]; customChildren: string[]; }
interface ServiceScopeState { catalogId: number | null; options: ScopeOption[]; loading: boolean; error: boolean; picks: ScopePick[]; customCount: number; }

// Deliverable card options, matching the client wizard's deliverables step (Next.js DeliverablesPlanQuestion).
const MAX_DELIVERABLES = 10;
/** Upper bound for a due day when deliverables may run past the project end (about ten years). */
const MAX_DUE_DAY = 3650;
const REPORT_TYPES = [
  { value: 'pdf', en: 'PDF Report', ar: 'ملف PDF', icon: 'https://res.cloudinary.com/dsiku9ipv/image/upload/v1781525110/pdf_136522_urotaw.png' },
  { value: 'docx', en: 'Word Document', ar: 'مستند Word', icon: 'https://res.cloudinary.com/dsiku9ipv/image/upload/v1781104177/Microsoft_Office_Word__2025_present_1_sywxfd.png' },
  { value: 'xlsx', en: 'Excel Sheet', ar: 'جدول Excel', icon: 'https://res.cloudinary.com/dsiku9ipv/image/upload/v1781104176/Microsoft_Office_Excel__2025_present_1_scjtip.png' },
  { value: 'pptx', en: 'Power Point', ar: 'عرض Power Point', icon: 'https://res.cloudinary.com/dsiku9ipv/image/upload/v1781104175/Microsoft_Office_PowerPoint__2025_present_1_ofrkfx.png' },
];
const DELIVERY_WAYS = [
  { value: 'on_platform', en: 'On platform', ar: 'على المنصة', icon: 'ki-cloud-add', tone: 'sky' },
  { value: 'session', en: 'Online session', ar: 'جلسة أونلاين', icon: 'ki-screen', tone: 'violet' },
  { value: 'physical_workshop', en: 'In-person workshop', ar: 'ورشة حضورية', icon: 'ki-geolocation', tone: 'amber' },
];

@Component({
  selector: 'app-offer-requirements-editor',
  templateUrl: './offer-requirements-editor.component.html',
  styleUrls: ['./offer-requirements-editor.component.scss'],
})
export class OfferRequirementsEditorComponent implements OnChanges {
  @Input() requirements?: MissingOfferRequirements;
  @Input() services: ProjectServiceDetails[] = [];
  @Input() lang = 'en';
  @Input() attempted = false;
  @Input() initialDraft?: OfferRequirementDraft;
  @Input() revisionMode = false;
  @Input() readOnly = false;
  @Input() showHeading = true;
  get controlPrefix(): string { return this.section + (this.readOnly ? '-readonly' : ''); }
  @Input() linkedDeliverableIds = new Set<number>();
  @Input() linkedOfferDeliverableIds = new Set<number>();
  @Input() offerDeliverableServiceIds = new Set<number>();
  @Input() section: 'scope' | 'deliverables' = 'scope';
  /** Project schedule, so deliverable due days show real dates and stay inside the duration. */
  @Input() plannedStartDate: string | null = null;
  @Input() durationDays: number | null = null;
  /** Let due days run past `durationDays`; the offer then suggests a longer project duration. */
  @Input() allowPastEnd = false;
  @Output() draftChange = new EventEmitter<OfferRequirementDraft>();
  @Output() validityChange = new EventEmitter<boolean>();
  missing: MissingOfferRequirements = mapMissingOfferRequirements(null);
  draft: OfferRequirementDraft = { offer_scopes: [], offer_components: [] };
  readonly maxDeliverables = MAX_DELIVERABLES;
  readonly reportTypes = REPORT_TYPES;
  readonly ways = DELIVERY_WAYS;
  /** The open deliverable dropdown (due / format / way), keyed `${row}-${deliverable}-${kind}`. */
  openMenu: string | null = null;
  marketOptions: Record<string, Array<{ id: number; name: string }>> = {};
  marketError = '';
  rows: RequirementRow[] = [];
  openRows = new Set<string>();
  scopeState: Record<number, ServiceScopeState> = {};
  pendingScope: Record<number, string | null> = {};
  pendingChild: Record<string, string | null> = {};
  private catalogs: Record<number, ScopeOption[] | undefined> = {};
  private catalogsLoading = new Set<number>();
  constructor(private http: HttpClient) {}
  get ar(): boolean { return this.lang === 'ar'; }
  get componentRequirements(): MissingComponentRequirement[] { return [...this.missing.project_components, ...this.missing.service_components]; }
  get hasRequirements(): boolean { return !!(this.missing.scopes.length || this.componentRequirements.length); }
  get complete(): boolean {
    if (this.readOnly) return true;
    if (!this.revisionMode) return offerRequirementsAreComplete(this.missing, this.draft);
    return this.rows.every(row => this.isDone(row));
  }
  ngOnChanges(changes: any): void {
    // On failed navigation or submission, open the first incomplete row.
    if (changes.attempted && this.attempted) {
      this.revealFirstIncompleteRow();
    }
    if (!changes.requirements) return;
    this.missing = mapMissingOfferRequirements(this.requirements);
    this.draft = {
      offer_scopes: [],
      offer_components: this.componentRequirements.map(req => ({ project_service_id: req.project_service_id, component_id: req.component_id, value: req.component.slug === 'deliverable-stage' ? { deliverables: [this.newDeliverable()] } : req.component.slug === 'target-market' ? { type: 'country', ids: [] } : '' })),
    };
    this.rows = [
      ...this.missing.scopes.map(scope => ({ key: `scope-${scope.project_service_id}`, scope })),
      ...this.componentRequirements.map(component => ({ key: `component-${component.component_id}-${component.project_service_id ?? 'project'}`, component })),
    ];
    this.openRows = new Set(this.rows.slice(0, 1).map(row => row.key));
    this.scopeState = {};
    this.pendingScope = {};
    this.pendingChild = {};
    this.missing.scopes.forEach(req => {
      const catalogId = this.services.find(s => s.id === req.project_service_id)?.service?.id ?? req.service?.id ?? null;
      this.scopeState[req.project_service_id] = { catalogId, options: [], loading: false, error: false, picks: [], customCount: 0 };
      if (!this.readOnly) this.loadScopeCatalog(req.project_service_id);
    });
    if (this.initialDraft) {
      this.draft = JSON.parse(JSON.stringify(this.initialDraft));
      this.missing.scopes.forEach(req => {
        const state = this.scopeState[req.project_service_id];
        state.picks = this.scopesFor(req.project_service_id).map(scope => ({ key: `m${++state.customCount}`, id: scope.id, name: scope.scope, description: scope.description, children: [], childIds: [], savedChildren: scope.subscopes ?? scope.children ?? [], customChildren: (scope.subscopes ?? scope.children ?? []).map(child => child.scope) }));
      });
    }
    if (this.componentRequirements.some(req => req.component.slug === 'target-market')) this.loadMarkets('country');
    // Notify the parent after Angular has finished checking input changes.
    Promise.resolve().then(() => this.emit());
  }
  serviceTitle(id: number): string {
    const service = this.services.find(s => s.id === id), scope = this.missing.scopes.find(s => s.project_service_id === id);
    return service?.title || service?.service?.name || scope?.title || scope?.service?.name || (this.ar ? 'الخدمة' : 'Service');
  }
  serviceLabel(id: number): string {
    const position = this.services.find(s => s.id === id)?.position || this.missing.scopes.findIndex(s => s.project_service_id === id) + 1;
    return `${this.ar ? 'الخدمة' : 'Service'} ${position}`;
  }
  rowName(row: RequirementRow): string {
    const id = row.scope ? row.scope.project_service_id : row.component!.project_service_id;
    return id === null ? row.component!.component.name : this.serviceTitle(id);
  }
  rowContext(row: RequirementRow): string {
    if (row.scope) return `${this.serviceLabel(row.scope.project_service_id)} · ${this.ar ? 'نطاق الخدمة' : 'Service scope'}`;
    const id = row.component!.project_service_id;
    return id === null ? (this.ar ? 'متطلب على مستوى المشروع' : 'Project requirement') : `${this.serviceLabel(id)} · ${row.component!.component.name}`;
  }
  isDone(row: RequirementRow): boolean {
    if (this.readOnly) return true;
    if (row.component) {
      const value = this.componentDraft(row.component)?.value;
      if (this.revisionMode && row.component.component.slug === 'deliverable-stage') {
        return Array.isArray(value?.deliverables) && value.deliverables.every((deliverable: any) => this.deliverableValidationErrors(deliverable).length === 0);
      }
      return requirementValueIsFilled(value);
    }
    const scopes = this.scopesFor(row.scope!.project_service_id);
    if (this.revisionMode) return scopes.every(scope => !!scope.scope?.trim() && scope.scope.length <= 255 && (scope.description?.length ?? 0) <= 2500 &&
      (scope.subscopes ?? []).every(child => !!child.scope?.trim() && (child.description?.length ?? 0) <= 2500));
    return offerRequirementsAreComplete({ scopes: [row.scope!], project_components: [], service_components: [] }, { offer_scopes: scopes, offer_components: [] });
  }

  get doneCount(): number { return this.rows.filter(row => this.isDone(row)).length; }
  isOpen(row: RequirementRow): boolean { return this.openRows.has(row.key); }
  /** Accordion: opening a row collapses the others so the insighter focuses on one service at a time. */
  toggle(row: RequirementRow, index: number): void {
    if (this.openRows.has(row.key)) this.openRows.delete(row.key);
    else this.openOnly(index);
  }
  private openOnly(index: number): void {
    this.openRows = new Set([this.rows[index].key]);
    // Collapsing a row above shifts the opened one; bring its header back into view once rendered.
    setTimeout(() => document.getElementById(`${this.section}-sw-toggle-${index}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }));
  }
  revealFirstIncompleteRow(): void {
    const index = this.rows.findIndex(row => !this.isDone(row));
    if (index >= 0) this.openOnly(index);
  }
  showError(value: string | null | undefined): boolean { return this.attempted && !value?.trim(); }
  scopesFor(id: number): OfferScope[] { return this.draft.offer_scopes.filter(scope => scope.project_service_id === id); }
  componentDraft(req: MissingComponentRequirement): OfferComponent { return this.draft.offer_components.find(c => c.component_id === req.component_id && c.project_service_id === req.project_service_id)!; }

  // ---- Scope picker (same flow as the client wizard's scope + sub-scope steps) ----
  loadScopeCatalog(serviceId: number): void {
    const state = this.scopeState[serviceId];
    if (!state) return;
    if (!state.catalogId) { state.options = []; return; }
    const cached = this.catalogs[state.catalogId];
    if (cached) { state.options = cached; state.error = false; return; }
    const catalogId = state.catalogId;
    // Service instances can share a catalog service; one request fills all of them.
    const sharing = () => Object.values(this.scopeState).filter(s => s.catalogId === catalogId);
    sharing().forEach(s => { s.loading = true; s.error = false; });
    if (this.catalogsLoading.has(catalogId)) return;
    this.catalogsLoading.add(catalogId);
    // Insighters need the full scope catalog for missing offer requirements.
    // The simple filter hides client scopes; it does not describe the offer editor.
    const url = `${environment.apiBaseUrl.replace(/\/account\/?$/, '')}/common/setting/service/scope/${catalogId}`;
    this.http.get<any>(url, { headers: { 'Accept-Language': this.lang } }).subscribe({
      next: response => {
        this.catalogsLoading.delete(catalogId);
        const options = this.toScopeOptions(response?.data);
        this.catalogs[catalogId] = options;
        sharing().forEach(s => { s.options = options; s.loading = false; });
      },
      error: () => {
        this.catalogsLoading.delete(catalogId);
        sharing().forEach(s => { s.loading = false; s.error = true; });
      },
    });
  }
  private toScopeOptions(raw: any): ScopeOption[] {
    return (Array.isArray(raw) ? raw : [])
      .filter(item => item?.id != null && String(item?.name ?? '').trim())
      .map(item => ({ id: Number(item.id), name: String(item.name).trim(), description: item.description ?? null, children: this.toScopeOptions(item.children) }));
  }
  pick(serviceId: number, key: string): ScopePick | undefined { return this.scopeState[serviceId]?.picks.find(p => p.key === key); }
  isPicked(serviceId: number, option: ScopeOption): boolean { return !!this.pick(serviceId, `c${option.id}`); }
  trackChildIndex(index: number): number { return index; }
  customPicks(serviceId: number): ScopePick[] { return (this.scopeState[serviceId]?.picks ?? []).filter(p => p.key.startsWith('m')); }
  /** Picked scopes in display order: catalog order first, then custom scopes in the order added. */
  orderedPicks(serviceId: number): ScopePick[] {
    const state = this.scopeState[serviceId];
    if (!state) return [];
    const catalog = state.options.map(o => this.pick(serviceId, `c${o.id}`)).filter((p): p is ScopePick => !!p);
    return [...catalog, ...this.customPicks(serviceId)];
  }
  availableScopeOptions(serviceId: number): ScopeOption[] {
    const custom = this.customPicks(serviceId).map(pick => pick.name.trim().toLowerCase());
    return (this.scopeState[serviceId]?.options ?? []).filter(option => !custom.includes(option.name.trim().toLowerCase()));
  }
  allScopesPicked(serviceId: number): boolean {
    const state = this.scopeState[serviceId];
    const options = this.availableScopeOptions(serviceId);
    return !!options.length && options.every(o => this.isPicked(serviceId, o));
  }
  toggleScope(serviceId: number, option: ScopeOption): void {
    const state = this.scopeState[serviceId];
    const key = `c${option.id}`;
    state.picks = this.pick(serviceId, key)
      ? state.picks.filter(p => p.key !== key)
      : [...state.picks, { key, name: option.name, description: option.description, children: option.children, childIds: [], customChildren: [] }];
    this.syncScopes();
  }
  toggleAllScopes(serviceId: number): void {
    const state = this.scopeState[serviceId];
    if (this.allScopesPicked(serviceId)) state.picks = this.customPicks(serviceId);
    else this.availableScopeOptions(serviceId).filter(o => !this.isPicked(serviceId, o)).forEach(o => state.picks.push({ key: `c${o.id}`, name: o.name, description: o.description, children: o.children, childIds: [], customChildren: [] }));
    this.syncScopes();
  }
  isPendingScope(serviceId: number): boolean { return typeof this.pendingScope[serviceId] === 'string'; }
  isPendingChild(serviceId: number, pick: ScopePick): boolean { return typeof this.pendingChild[this.childKey(serviceId, pick)] === 'string'; }
  startCustomScope(serviceId: number): void { this.pendingScope[serviceId] = ''; this.focusSoon(`scope-new-${serviceId}`); }
  cancelCustomScope(serviceId: number): void { this.pendingScope[serviceId] = null; }
  commitCustomScope(serviceId: number): void {
    const name = (this.pendingScope[serviceId] ?? '').trim();
    this.pendingScope[serviceId] = null;
    const state = this.scopeState[serviceId];
    if (!name || state.picks.some(p => p.name.toLowerCase() === name.toLowerCase())) return;
    state.picks.push({ key: `m${++state.customCount}`, name, children: [], childIds: [], customChildren: [] });
    this.syncScopes();
  }
  removeScopePick(serviceId: number, pick: ScopePick): void {
    this.scopeState[serviceId].picks = this.scopeState[serviceId].picks.filter(p => p !== pick);
    this.syncScopes();
  }
  isChildPicked(pick: ScopePick, child: ScopeOption): boolean { return pick.childIds.includes(child.id); }
  toggleChild(pick: ScopePick, child: ScopeOption): void {
    pick.childIds = pick.childIds.includes(child.id) ? pick.childIds.filter(id => id !== child.id) : [...pick.childIds, child.id];
    this.syncScopes();
  }
  allChildrenPicked(pick: ScopePick): boolean { return pick.children.length > 0 && pick.children.every(c => pick.childIds.includes(c.id)); }
  toggleAllChildren(pick: ScopePick): void {
    pick.childIds = this.allChildrenPicked(pick) ? [] : pick.children.map(c => c.id);
    this.syncScopes();
  }
  childKey(serviceId: number, pick: ScopePick): string { return `${serviceId}:${pick.key}`; }
  startCustomChild(serviceId: number, pick: ScopePick): void { this.pendingChild[this.childKey(serviceId, pick)] = ''; this.focusSoon(`subscope-new-${this.childKey(serviceId, pick)}`); }
  /** Focus an inline "add" input once Angular has rendered it. */
  private focusSoon(id: string): void { setTimeout(() => document.getElementById(id)?.focus()); }
  cancelCustomChild(serviceId: number, pick: ScopePick): void { this.pendingChild[this.childKey(serviceId, pick)] = null; }
  commitCustomChild(serviceId: number, pick: ScopePick): void {
    const key = this.childKey(serviceId, pick);
    const name = (this.pendingChild[key] ?? '').trim();
    this.pendingChild[key] = null;
    const taken = [...pick.customChildren, ...pick.children.map(c => c.name)].some(n => n.toLowerCase() === name.toLowerCase());
    if (!name || taken) return;
    pick.customChildren = [...pick.customChildren, name];
    this.syncScopes();
  }
  renameCustomChild(pick: ScopePick, index: number, value: string): void {
    const saved = pick.savedChildren?.find(child => child.scope === pick.customChildren[index]);
    if (saved) saved.scope = value;
    pick.customChildren[index] = value;
    this.syncScopes();
  }
  removeCustomChild(pick: ScopePick, index: number): void {
    pick.customChildren = pick.customChildren.filter((_, i) => i !== index);
    this.syncScopes();
  }
  /** Rebuild the offer_scopes payload from the picks; the API stores scope names, not catalog ids. */
  syncScopes(): void {
    this.draft.offer_scopes = flatMapList(this.missing.scopes, req => this.orderedPicks(req.project_service_id).map(pick => ({
      ...(pick.id ? { id: pick.id } : {}),
      project_service_id: req.project_service_id,
      scope: pick.name,
      description: this.revisionMode ? pick.description ?? null : pick.description || '',
      subscopes: [
        ...pick.children.filter(c => pick.childIds.includes(c.id)).map(c => ({ scope: c.name, description: c.description || '' })),
        ...pick.customChildren.map(name => ({ ...pick.savedChildren?.find(child => child.scope === name), scope: name, description: this.revisionMode ? pick.savedChildren?.find(child => child.scope === name)?.description ?? null : pick.savedChildren?.find(child => child.scope === name)?.description || '' })),
      ],
    })));
    this.emit();
  }
  // ---- Deliverables (same card as the client wizard's deliverables step) ----
  get maxDay(): number { return this.allowPastEnd ? MAX_DUE_DAY : this.durationDays ?? Number.MAX_SAFE_INTEGER; }
  isPastEnd(days: number | null | undefined): boolean {
    return this.allowPastEnd && this.durationDays !== null && days !== null && days !== undefined && Number(days) > this.durationDays;
  }
  /** Due day, formats and delivery method start unset; the insighter picks each one. */
  newDeliverable(): any { return { key: `frontend-deliverable-${crypto.randomUUID()}`, title: '', period_days: null, report_type: [], way: { selected: null, address: '' } }; }
  addDeliverable(req: MissingComponentRequirement): void {
    const list = this.componentDraft(req).value.deliverables;
    if (list.length >= MAX_DELIVERABLES) return;
    list.push(this.newDeliverable());
    this.focusSoon(`${this.section}-deliverable-title-${this.rows.findIndex(row => row.component === req)}-${list.length - 1}`);
    this.emit();
  }
  isDeliverableLinked(req: MissingComponentRequirement, deliverable: any): boolean {
    return (this.offerDeliverableServiceIds.has(req.project_service_id!) ? this.linkedOfferDeliverableIds : this.linkedDeliverableIds).has(deliverable?.id);
  }
  removeDeliverable(req: MissingComponentRequirement, index: number): void { if (this.isDeliverableLinked(req, this.componentDraft(req).value.deliverables[index])) return; this.componentDraft(req).value.deliverables.splice(index, 1); this.openMenu = null; this.emit(); }
  toggleFormat(deliverable: any, format: string): void { deliverable.report_type = deliverable.report_type.includes(format) ? deliverable.report_type.filter((f: string) => f !== format) : [...deliverable.report_type, format]; this.emit(); }
  setWay(deliverable: any, selected: string): void {
    deliverable.way = { selected, address: selected === 'physical_workshop' ? deliverable.way.address || '' : '' };
    this.openMenu = null;
    this.emit();
  }
  setDay(deliverable: any, value: number | string | null): void {
    deliverable.period_days = value === null || value === '' ? null : Math.min(this.maxDay, Math.max(0, Math.round(Number(value)) || 0));
    this.emit();
  }
  get quickDays(): number[] {
    const presets = [7, 14, 30, 60].filter(day => day < (this.durationDays ?? this.maxDay));
    return this.durationDays !== null ? [...presets, this.durationDays] : presets;
  }
  quickDayLabel(day: number): string {
    if (this.durationDays !== null && day === this.durationDays) return this.ar ? 'نهاية المشروع' : 'At the end';
    const labels: Record<number, [string, string]> = { 7: ['1 week', 'أسبوع'], 14: ['2 weeks', 'أسبوعان'], 30: ['1 month', 'شهر'], 60: ['2 months', 'شهران'] };
    return labels[day][this.ar ? 1 : 0];
  }
  dayLabel(days: number): string {
    if (this.ar) return days === 0 ? 'يوم البدء' : days === 1 ? 'بعد يوم' : days === 2 ? 'بعد يومين' : days <= 10 ? `بعد ${days} أيام` : `بعد ${days} يومًا`;
    return days === 0 ? 'Start day' : days === 1 ? '1 Day' : `${days} Days`;
  }
  /** Calendar date for a day offset, or '' when the project has no planned start. */
  dueDate(days: number, options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }): string {
    const value = addDaysToDate(this.plannedStartDate, Number(days) || 0);
    if (!value) return '';
    const [y, m, d] = value.split('-').map(Number);
    return new Intl.DateTimeFormat(this.ar ? 'ar' : 'en', options).format(new Date(y, m - 1, d));
  }
  formatSummary(types: string[]): string {
    const first = REPORT_TYPES.find(type => type.value === types[0]);
    if (!first) return this.ar ? 'اختر صيغة الملف' : 'Choose file format';
    const label = this.ar ? first.ar : first.en;
    return types.length > 1 ? `${label} +${types.length - 1}` : label;
  }
  formatIcons(types: string[]): string[] { return types.map(t => REPORT_TYPES.find(type => type.value === t)?.icon).filter((src): src is string => !!src).slice(0, 3); }
  wayOption(value: string | null) { return DELIVERY_WAYS.find(way => way.value === value); }
  deliverableErrors(deliverable: any): string[] {
    return this.attempted && !this.readOnly ? this.deliverableValidationErrors(deliverable) : [];
  }
  private deliverableValidationErrors(deliverable: any): string[] {
    const errors: string[] = [];
    if (!deliverable.title?.trim()) errors.push(this.ar ? 'أدخل اسم المخرج.' : 'Enter a name for this deliverable.');
    const days = deliverable.period_days;
    if (days === null || days === undefined || days === '') errors.push(this.ar ? 'اختر موعد التسليم.' : 'Choose when it’s due.');
    else if (!Number.isInteger(Number(days)) || Number(days) < 0) errors.push(this.ar ? 'أدخل عدد أيام صحيحًا يساوي صفرًا أو أكثر.' : 'Enter a whole number of days, zero or greater.');
    if (!['on_platform', 'session', 'physical_workshop'].includes(deliverable.way?.selected)) errors.push(this.ar ? 'اختر طريقة التسليم.' : 'Choose how it’s delivered.');
    if (deliverable.way?.selected === 'physical_workshop' && !deliverable.way.address?.trim()) errors.push(this.ar ? 'أدخل عنوان الورشة.' : 'Enter the workshop address.');
    return errors;
  }

  isMenuOpen(key: string): boolean { return this.openMenu === key; }
  toggleMenu(key: string, event: Event): void { event.stopPropagation(); this.openMenu = this.openMenu === key ? null : key; }
  @HostListener('document:click')
  @HostListener('document:keydown.escape')
  closeMenu(): void { this.openMenu = null; }
  changeMarketType(req: MissingComponentRequirement): void { this.componentDraft(req).value.ids = []; this.loadMarkets(this.componentDraft(req).value.type); this.emit(); }
  loadMarkets(type: string): void {
    if (this.marketOptions[type]) return;
    const endpoint: Record<string, string> = { country: 'country/list', region: 'region/list', economic: 'economic-bloc/list' };
    this.http.get<any>(`${environment.apiBaseUrl.replace(/\/account\/?$/, '')}/common/setting/${endpoint[type]}`, { headers: { 'Accept-Language': this.lang } }).subscribe({
      next: response => { this.marketOptions[type] = response?.data ?? []; this.marketError = ''; },
      error: () => { this.marketError = this.ar ? 'تعذر تحميل الأسواق.' : 'Could not load markets.'; },
    });
  }
  emit(): void { this.draftChange.emit(this.draft); this.validityChange.emit(this.complete); }
}
