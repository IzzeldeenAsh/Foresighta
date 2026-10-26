import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { OfferRequirementsEditorComponent } from './offer-requirements-editor.component';
import { appendRequirementFormData, mapMissingOfferRequirements, offerRequirementsAreComplete } from 'src/app/_fake/services/project-phase2/project-requirements.model';

describe('Offer requirement completion', () => {
  let fixture: ComponentFixture<OfferRequirementsEditorComponent>;
  let editor: OfferRequirementsEditorComponent;
  let http: HttpTestingController;
  const catalog = [
    { id: 1, name: 'Market sizing', description: 'Estimate the opportunity.', children: [{ id: 11, name: 'TAM/SAM/SOM', description: null }, { id: 12, name: 'Growth drivers', description: null }] },
    { id: 2, name: 'Competitor analysis', description: null, children: [] },
  ];
  beforeEach(async () => {
    await TestBed.configureTestingModule({ declarations: [OfferRequirementsEditorComponent], imports: [CommonModule, FormsModule, HttpClientTestingModule] }).compileComponents();
    fixture = TestBed.createComponent(OfferRequirementsEditorComponent);
    editor = fixture.componentInstance;
    editor.services = [44, 45].map((id, index) => ({ id, uuid: `service-${id}`, position: index + 1, title: null, service: { id: 12, name: 'Market research', slug: 'market-research' }, prompt_ai: null, scopes: [], components: [], addons: [], deliverables: [] }));
    fixture.componentRef.setInput('requirements', {
      scopes: [44, 45].map(id => ({ project_service_id: id, required_in_offer: true })),
      project_components: [{ project_service_id: null, component_id: 3, component: { id: 3, name: 'Data sources', slug: 'data-sources-expected' }, ownership_level: 'project', required_in_offer: true }],
      service_components: [44, 45].map(id => ({ project_service_id: id, component_id: 6, component: { id: 6, name: 'Deliverables', slug: 'deliverable-stage' }, ownership_level: 'project_service', required_in_offer: true })),
    });
    fixture.detectChanges();
    http = TestBed.inject(HttpTestingController);
    // Both service instances share catalog service 12, so the scope list is fetched once.
    http.expectOne(req => req.url.endsWith('/common/setting/service/scope/12') && !req.params.has('definition_mode')).flush({ data: catalog });
    await fixture.whenStable();
  });
  it('keeps the create-offer deliverable controls disabled while allowing read-only sections to expand', async () => {
    fixture.componentRef.setInput('readOnly', true);
    fixture.componentRef.setInput('section', 'deliverables');
    fixture.componentRef.setInput('requirements', { scopes: [], project_components: [], service_components: [
      { project_service_id: 44, component_id: 6, component: { id: 6, name: 'Deliverables', slug: 'deliverable-stage' }, ownership_level: 'project_service', required_in_offer: false },
    ] });
    fixture.componentRef.setInput('initialDraft', { offer_scopes: [], offer_components: [
      { project_service_id: 44, component_id: 6, value: { deliverables: [{ title: 'Market analysis report', period_days: 7, report_type: ['pdf'], way: { selected: 'on_platform' } }] } },
    ] });
    fixture.detectChanges();
    await fixture.whenStable();
    const element: HTMLElement = fixture.nativeElement;
    expect((element.querySelector('.sw-dlv__title') as HTMLInputElement).value).toBe('Market analysis report');
    expect(element.querySelector('.sw-dlv__title')!.matches(':disabled')).toBeTrue();
    element.querySelectorAll('.sw-pill').forEach(pill => expect(pill.matches(':disabled')).toBeTrue());
    const toggle = element.querySelector('.sw-row__toggle') as HTMLButtonElement;
    expect(toggle.disabled).toBeFalse();
    toggle.click(); fixture.detectChanges();
    expect(element.querySelector('.sw-row__panel')).toBeNull();
  });
  it('requires each service instance even when both reference the same catalog service', () => {
    expect(editor.complete).toBeFalse();
    editor.toggleScope(44, editor.scopeState[44].options[0]);
    editor.draft.offer_components[0].value = 'both';
    // New deliverables start without a due day or delivery method.
    Object.assign(editor.draft.offer_components[1].value.deliverables[0], { title: 'Jordan report', period_days: 30, way: { selected: 'on_platform', address: '' } });
    expect(editor.complete).toBeFalse();
    editor.pendingScope[45] = 'UAE market';
    editor.commitCustomScope(45);
    editor.draft.offer_components[2].value.deliverables[0].title = 'UAE report';
    expect(editor.complete).toBeFalse();
    editor.draft.offer_components[2].value.deliverables[0].period_days = 14;
    expect(editor.complete).toBeFalse();
    editor.draft.offer_components[2].value.deliverables[0].way.selected = 'session';
    expect(editor.complete).toBeTrue();
    editor.draft.offer_components[2].value.deliverables[0].way.selected = 'physical_workshop';
    expect(editor.complete).toBeFalse();
    editor.draft.offer_components[2].value.deliverables[0].way.address = 'Amman';
    expect(editor.complete).toBeTrue();
  });
  it('builds offer scopes from picked catalog scopes, sub-scopes and custom entries', () => {
    const [sizing, competitors] = editor.scopeState[44].options;
    editor.toggleScope(44, competitors);
    editor.toggleScope(44, sizing);
    const pick = editor.pick(44, 'c1')!;
    editor.toggleChild(pick, sizing.children[1]);
    editor.pendingChild[editor.childKey(44, pick)] = 'Pricing benchmarks';
    editor.commitCustomChild(44, pick);
    editor.pendingScope[44] = 'Regulatory review';
    editor.commitCustomScope(44);
    expect(editor.scopesFor(44)).toEqual([
      { project_service_id: 44, scope: 'Market sizing', description: 'Estimate the opportunity.', subscopes: [{ scope: 'Growth drivers', description: '', files: [], new_files: [] }, { scope: 'Pricing benchmarks', description: '', files: [], new_files: [] }] },
      { project_service_id: 44, scope: 'Competitor analysis', description: '', subscopes: [] },
      { project_service_id: 44, scope: 'Regulatory review', description: '', subscopes: [] },
    ]);
    editor.toggleScope(44, sizing);
    expect(editor.scopesFor(44).map(s => s.scope)).toEqual(['Competitor analysis', 'Regulatory review']);
    expect(editor.scopesFor(45)).toEqual([]);
  });
  it('adds a description and files to a picked sub-scope', () => {
    const [sizing] = editor.scopeState[44].options;
    editor.toggleScope(44, sizing);
    const pick = editor.pick(44, 'c1')!;
    editor.pendingChild[editor.childKey(44, pick)] = 'Pricing benchmarks';
    editor.commitCustomChild(44, pick);
    const detail = editor.subscopeDetail(pick, 'Pricing benchmarks');
    detail.description = 'Compare list prices';
    const pdf = new File(['x'], 'prices.pdf', { type: 'application/pdf' });
    const exe = new File(['x'], 'tool.exe');
    editor.addSubscopeFiles(pick, 'Pricing benchmarks', { target: { files: [pdf, exe], value: '' } } as any);
    expect(detail.newFiles).toEqual([pdf]);
    expect(detail.errors.length).toBe(1);
    const child = editor.scopesFor(44)[0].subscopes![0];
    expect(child).toEqual(jasmine.objectContaining({ scope: 'Pricing benchmarks', description: 'Compare list prices', files: [], new_files: [pdf] }));
    // Renaming keeps the details with the sub-scope.
    editor.renameCustomChild(pick, 0, 'Price benchmarks');
    expect(editor.scopesFor(44)[0].subscopes![0]).toEqual(jasmine.objectContaining({ scope: 'Price benchmarks', description: 'Compare list prices', new_files: [pdf] }));
  });
  it('renders the backend-listed fields only and serializes service instances in nested multipart fields', () => {
    const headings = fixture.nativeElement.querySelectorAll('h3');
    expect(headings.length).toBe(5);
    expect(headings[0].textContent).toContain('Service 1');
    expect(headings[1].textContent).toContain('Service 2');
    expect(editor.draft.offer_components.map(component => component.component_id)).toEqual([3, 6, 6]);
    const form = new FormData();
    editor.toggleScope(44, editor.scopeState[44].options[0]);
    editor.toggleScope(45, editor.scopeState[45].options[1]);
    appendRequirementFormData(form, 'offer_scopes', editor.draft.offer_scopes);
    editor.draft.offer_components[1].value.deliverables[0].way.selected = 'on_platform';
    appendRequirementFormData(form, 'offer_components', editor.draft.offer_components);
    expect(form.get('offer_scopes[0][project_service_id]')).toBe('44');
    expect(form.get('offer_scopes[1][project_service_id]')).toBe('45');
    expect(form.get('offer_components[0][project_service_id]')).toBeNull();
    expect(form.get('offer_components[1][project_service_id]')).toBe('44');
    expect(form.get('offer_components[2][project_service_id]')).toBe('45');
    expect(form.has('offer_components[1][value][deliverables][0][way][selected]')).toBeTrue();
    expect(form.has('offer_components[1][filled_by_role]')).toBeFalse();
  });
  it('preserves advanced-only missing fields returned for a simple request', () => {
    fixture.componentRef.setInput('requirements', { scopes: [], project_components: [], service_components: [{ project_service_id: 44, component_id: 6, ownership_level: 'project_service', required_in_offer: true, component: { id: 6, name: 'Deliverables', slug: 'deliverable-stage', definition_mode_visibility: 'advanced', fillable_by_insighter: true } }] });
    fixture.detectChanges();
    expect(editor.draft.offer_components.length).toBe(1);
    expect(editor.complete).toBeFalse();
  });
  it('allows historical projects without missing requirements', () => {
    expect(offerRequirementsAreComplete(mapMissingOfferRequirements(undefined), { offer_scopes: [], offer_components: [] })).toBeTrue();
  });
  it('reveals all missing deliverable messages and clears them as required fields are completed', () => {
    const req = editor.componentRequirements.find(req => req.component.slug === 'deliverable-stage')!;
    const deliverable = editor.componentDraft(req).value.deliverables[0];
    expect(editor.deliverableErrors(deliverable)).toEqual([]);
    fixture.componentRef.setInput('attempted', true);
    fixture.detectChanges();
    expect(editor.deliverableErrors(deliverable)).toEqual(['Enter a name for this deliverable.', 'Choose when it’s due.', 'Choose how it’s delivered.']);
    const rowIndex = editor.rows.findIndex(row => row.component === req);
    editor.toggle(editor.rows[rowIndex], rowIndex);
    fixture.detectChanges();
    for (const message of editor.deliverableErrors(deliverable)) expect(fixture.nativeElement.textContent).toContain(message);
    deliverable.title = 'Final report';
    editor.setDay(deliverable, 0);
    editor.setWay(deliverable, 'physical_workshop');
    expect(editor.deliverableErrors(deliverable)).toEqual(['Enter the workshop address.']);
    deliverable.way.address = 'Amman';
    expect(editor.deliverableErrors(deliverable)).toEqual([]);
    expect(editor.isDone(editor.rows[rowIndex])).toBeTrue();
  });
  it('enters due dates in days, weeks or months and saves them as days', () => {
    const req = editor.componentRequirements.find(req => req.component.slug === 'deliverable-stage')!;
    const deliverable = editor.componentDraft(req).value.deliverables[0];
    editor.setDay(deliverable, 14);
    expect(editor.dueUnit(deliverable)).toBe('weeks'); expect(editor.dueAmount(deliverable)).toBe(2); expect(editor.dueLabel(deliverable)).toBe('2 Weeks');
    editor.setDueUnit(deliverable, 'months');
    expect(deliverable.period_days).toBe(30); expect(editor.dueLabel(deliverable)).toBe('1 Month');
    editor.stepDue(deliverable, 1); expect(deliverable.period_days).toBe(60);
    editor.setDueUnit(deliverable, 'days'); editor.setDueAmount(deliverable, 45);
    expect(deliverable.period_days).toBe(45); expect(editor.dueLabel(deliverable)).toBe('45 Days');
    editor.setDueAmount(deliverable, null); expect(deliverable.period_days).toBeNull();
  });
  it('uses the same completion rule for saved deliverables, progress and validation when days arrive as text', async () => {
    const req = editor.missing.service_components[0];
    fixture.componentRef.setInput('section', 'deliverables');
    fixture.componentRef.setInput('revisionMode', true);
    fixture.componentRef.setInput('attempted', true);
    fixture.componentRef.setInput('requirements', { scopes: [], project_components: [], service_components: [req] });
    fixture.componentRef.setInput('initialDraft', { offer_scopes: [], offer_components: [{ project_service_id: req.project_service_id, component_id: req.component_id, value: { deliverables: [
      { title: 'Report', period_days: '7', report_type: ['pdf'], way: { selected: 'on_platform' } },
      { title: 'Workbook', period_days: '14', report_type: ['xlsx'], way: { selected: 'on_platform' } },
    ] } }] });
    fixture.detectChanges(); await fixture.whenStable();
    expect(editor.complete).toBeTrue(); expect(editor.doneCount).toBe(1);
    expect(fixture.nativeElement.querySelector('.sw-error')).toBeNull();
    const deliverable = editor.draft.offer_components[0].value.deliverables[0];
    deliverable.title = ''; fixture.detectChanges();
    expect(editor.complete).toBeFalse(); expect(editor.doneCount).toBe(0);
    expect(fixture.nativeElement.textContent).toContain('Enter a name for this deliverable.');
    expect(fixture.nativeElement.textContent).toContain('Complete the required deliverable fields to continue.');
    expect(fixture.nativeElement.textContent).not.toContain('before submitting your offer');
    deliverable.title = 'Report'; deliverable.period_days = 'invalid'; fixture.detectChanges();
    expect(editor.complete).toBeFalse(); expect(editor.doneCount).toBe(0);
    expect(fixture.nativeElement.textContent).toContain('Enter a whole number of days, zero or greater.');
    deliverable.period_days = '7'; fixture.detectChanges();
    expect(editor.complete).toBeTrue(); expect(editor.doneCount).toBe(1);
    expect(fixture.nativeElement.querySelector('.sw-error')).toBeNull();
  });
  it('reopens the first missing section after repeated failed navigation', () => {
    editor.attempted = true;
    editor.revealFirstIncompleteRow();
    expect(editor.isOpen(editor.rows[0])).toBeTrue();
    editor.toggle(editor.rows[0], 0);
    expect(editor.isOpen(editor.rows[0])).toBeFalse();
    editor.revealFirstIncompleteRow();
    expect(editor.isOpen(editor.rows[0])).toBeTrue();
  });
  it('keeps unique deliverable keys across services, edits, removals and serialization', () => {
    const requirements = editor.componentRequirements.filter(req => req.component.slug === 'deliverable-stage');
    const first = editor.componentDraft(requirements[0]).value.deliverables[0];
    const otherService = editor.componentDraft(requirements[1]).value.deliverables[0];
    const firstKey = first.key;
    editor.addDeliverable(requirements[0]);
    const second = editor.componentDraft(requirements[0]).value.deliverables[1];
    expect(new Set([firstKey, second.key, otherService.key]).size).toBe(3);
    first.title = 'Renamed report';
    editor.setDay(first, 14);
    editor.setWay(first, 'session');
    expect(first.key).toBe(firstKey);
    editor.removeDeliverable(requirements[0], 0);
    editor.addDeliverable(requirements[0]);
    const list = editor.componentDraft(requirements[0]).value.deliverables;
    expect(list[0].key).toBe(second.key);
    expect(list[1].key).not.toBe(firstKey);
    const form = new FormData();
    appendRequirementFormData(form, 'offer_components', editor.draft.offer_components);
    expect(form.get('offer_components[1][value][deliverables][0][key]')).toBe(second.key);
  });
  it('prefills revision scopes and preserves parent and child IDs across title edits', async () => {
    const initial = { offer_scopes: [{ id: 101, project_service_id: 44, scope: 'Existing scope', description: null, subscopes: [{ id: 102, scope: 'Existing child', description: null }] }], offer_components: [] };
    fixture.componentRef.setInput('revisionMode', true);
    fixture.componentRef.setInput('initialDraft', initial);
    fixture.componentRef.setInput('requirements', { scopes: [{ project_service_id: 44, required_in_offer: false }], project_components: [], service_components: [] });
    fixture.detectChanges(); await fixture.whenStable();
    expect(editor.draft.offer_scopes).toEqual(initial.offer_scopes);
    const pick = editor.scopeState[44].picks[0];
    pick.name = 'Renamed scope'; editor.syncScopes();
    editor.renameCustomChild(pick, 0, 'Renamed child');
    expect(editor.draft.offer_scopes[0].id).toBe(101);
    expect(editor.draft.offer_scopes[0].subscopes![0]).toEqual(jasmine.objectContaining({ id: 102, scope: 'Renamed child' }));
    expect(initial.offer_scopes[0].scope).toBe('Existing scope');
    editor.removeScopePick(44, pick);
    expect(editor.draft.offer_scopes).toEqual([]);
    expect(editor.complete).toBeTrue();
  });
  it('keeps original-offer payment links separate from project deliverables with the same ID', () => {
    const requirement = editor.missing.service_components[0];
    editor.offerDeliverableServiceIds = new Set([requirement.project_service_id!]);
    editor.linkedDeliverableIds = new Set([88]);
    expect(editor.isDeliverableLinked(requirement, { id: 88 })).toBeFalse();
    editor.linkedOfferDeliverableIds = new Set([88]);
    expect(editor.isDeliverableLinked(requirement, { id: 88 })).toBeTrue();
    editor.offerDeliverableServiceIds = new Set(); editor.linkedDeliverableIds = new Set();
    expect(editor.isDeliverableLinked(requirement, { id: 88 })).toBeFalse();
  });
  it('guards linked deliverable deletion in the wizard handler and keeps saved IDs', async () => {
    const requirement = editor.missing.service_components[0];
    fixture.componentRef.setInput('revisionMode', true);
    fixture.componentRef.setInput('linkedDeliverableIds', new Set([88]));
    fixture.componentRef.setInput('initialDraft', { offer_scopes: [], offer_components: [{ component_id: requirement.component_id, project_service_id: requirement.project_service_id, value: { deliverables: [{ id: 88, title: 'Linked report', period_days: 20, report_type: ['pdf'], way: { selected: 'on_platform' } }] } }] });
    fixture.componentRef.setInput('requirements', { scopes: [], project_components: [], service_components: [requirement] });
    fixture.detectChanges(); await fixture.whenStable();
    editor.removeDeliverable(editor.missing.service_components[0], 0);
    expect(editor.draft.offer_components[0].value.deliverables[0].id).toBe(88);
    fixture.componentRef.setInput('linkedDeliverableIds', new Set()); fixture.detectChanges();
    editor.removeDeliverable(editor.missing.service_components[0], 0);
    expect(editor.draft.offer_components[0].value.deliverables).toEqual([]);
    expect(editor.complete).toBeTrue();
  });
  it('keeps a new deliverable while an unsaved installment links to it', () => {
    const requirement = editor.missing.service_components[0];
    const list = editor.componentDraft(requirement).value.deliverables;
    editor.addDeliverable(requirement);
    const linked = list[1];
    editor.draftLinkedDeliverables = new Set([linked.key]);
    expect(editor.isDeliverableLinked(requirement, linked)).toBeTrue();
    expect(editor.savedLinkBlocksDelete(requirement, linked)).toBeFalse();
    editor.removeDeliverable(requirement, 1);
    expect(list.length).toBe(2);
    editor.draftLinkedDeliverables = new Set();
    editor.removeDeliverable(requirement, 1);
    expect(list.length).toBe(1);
  });
  it('matches unsaved links to saved deliverables by their own ID kind', () => {
    const requirement = editor.missing.service_components[0];
    editor.draftLinkedDeliverables = new Set<number | string>(['offer:88']);
    expect(editor.isDeliverableLinked(requirement, { id: 88 })).toBeFalse();
    editor.offerDeliverableServiceIds = new Set([requirement.project_service_id!]);
    expect(editor.isDeliverableLinked(requirement, { id: 88 })).toBeTrue();
    editor.offerDeliverableServiceIds = new Set(); editor.draftLinkedDeliverables = new Set([88]);
    expect(editor.isDeliverableLinked(requirement, { id: 88 })).toBeTrue();
  });

});
