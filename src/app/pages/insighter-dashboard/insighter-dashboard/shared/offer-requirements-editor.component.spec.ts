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
      { project_service_id: 44, scope: 'Market sizing', description: 'Estimate the opportunity.', subscopes: [{ scope: 'Growth drivers', description: '' }, { scope: 'Pricing benchmarks', description: '' }] },
      { project_service_id: 44, scope: 'Competitor analysis', description: '', subscopes: [] },
      { project_service_id: 44, scope: 'Regulatory review', description: '', subscopes: [] },
    ]);
    editor.toggleScope(44, sizing);
    expect(editor.scopesFor(44).map(s => s.scope)).toEqual(['Competitor analysis', 'Regulatory review']);
    expect(editor.scopesFor(45)).toEqual([]);
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
});
