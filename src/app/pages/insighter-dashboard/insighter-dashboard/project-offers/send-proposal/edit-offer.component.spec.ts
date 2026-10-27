import Swal from 'sweetalert2';
import { Injector, QueryList } from '@angular/core';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';
import { TranslationService } from 'src/app/modules/i18n';
import { ProfileService } from 'src/app/_fake/services/get-profile/get-profile.service';
import { AgreementRevisionsService } from 'src/app/_fake/services/agreement-revisions/agreement-revisions.service';
import { commercialDraft } from 'src/app/_fake/services/agreement-revisions/agreement-revisions.model';
import { offerEditRequirements, offerEditPatch } from 'src/app/_fake/services/agreement-revisions/offer-edit.model';
import { SendProposalComponent } from './send-proposal.component';
import { OfferRequirementsEditorComponent } from '../../shared/offer-requirements-editor.component';

const own = { filled_by_role: 'insighter', filled_by_user_id: 32, source_project_proposal_offer_id: 80 };
/** An awarded offer: the project holds copies (10, 11, 15) of the insighter's offer rows (60, 61, 65). */
function fixture(): any {
  return { uuid: 'project', offer: { uuid: 'offer', cover_letter: null, price_type: 'fixed', fixed_price: 2500, proposed_price: 2500, payment_plan: 'partial', installments: [{ title: 'Contract', percentage: 40, due_type: 'contract' }, { title: 'Report', percentage: 60, due_type: 'deliverable', project_service_deliverable_id: 15, project_proposal_offer_deliverable_id: 65 }],
    offer_scopes: [{ id: 60, project_service_id: 44, scope: 'Market sizing', description: null, children: [{ id: 61, scope: 'TAM', description: null }] }],
    offer_deliverables: [{ id: 65, project_service_id: 44, title: 'Report', period_days: 20, report_type: ['pdf'], way: { selected: 'on_platform' } }] }, project: {
    uuid: 'project', status: 'submitted', definition_mode: 'simple', schedule: { duration_days: 30 }, deliverables: [{ id: 15, project_service_id: 44, title: 'Report', period_days: 20 }], project_services: [{ id: 44, title: 'Research', scopes: [{ id: 10, scope: 'Market sizing', description: null, ...own, children: [{ id: 11, scope: 'TAM', description: null, ...own }] }], deliverables: [{ id: 15, title: 'Report', period_days: 20, report_type: ['pdf'], way: { selected: 'on_platform' }, ...own }] }],
  } };
}
describe('Edit offer wizard', () => {
  let component: SendProposalComponent, record: any, api: any, offers: any, router: any;
  beforeEach(() => {
    record = fixture();
    api = { changed$: new Subject(), update: jasmine.createSpy().and.returnValue(of({ id: 9, revision_number: 9 })) };
    offers = { isLoading$: of(false), getProposalDetails: jasmine.createSpy().and.callFake(() => of(JSON.parse(JSON.stringify(record)))) };
    router = { navigate: jasmine.createSpy() };
    const translation = { getSelectedLanguage: () => 'en', onLanguageChange: () => of('en') };
    const injector = { get: (token: unknown) => token === TranslationService ? translation : token === ProfileService ? { getProfile: () => of({ id: 32 }) } : token === AgreementRevisionsService ? api : {} } as Injector;
    const route = { snapshot: { data: { editOffer: true }, queryParamMap: convertToParamMap({ from: 'offers' }) }, paramMap: of(convertToParamMap({ uuid: 'project' })) };
    component = new SendProposalComponent(injector, route as any as ActivatedRoute, router as Router, offers);
    spyOn(component, 'showSuccess'); spyOn(component, 'showError');
    const editors = new QueryList<OfferRequirementsEditorComponent>();
    editors.reset([{ section: 'scope', complete: true, revealFirstIncompleteRow: () => {} }, { section: 'deliverables', complete: true, revealFirstIncompleteRow: () => {} }] as any);
    (component as any).requirementEditors = editors;
    component.ngOnInit();
  });
  afterEach(() => component.ngOnDestroy());
  it('prefills the existing offer, opens on the technical proposal, and starts with no unsaved changes', () => {
    expect(component.editMode).toBeTrue(); expect(component.fixedPrice).toBe(2500);
    expect(component.installments.map(i => i.percentage)).toEqual([40, 60]);
    expect(component.tabs[0].key).toBe('cover'); expect(component.isEditTabReadOnly('cover')).toBeFalse();
    // An offer saved without a cover letter can still change its other terms.
    expect(component.isCoverLetterInvalid()).toBeFalse();
    expect(component.scopeSeed.offer_scopes[0].id).toBe(60);
    expect(component.scopeSeed.offer_scopes[0].subscopes![0]).toEqual(jasmine.objectContaining({ id: 61 }));
    expect(component.editPatch).toEqual({}); expect(component.canDeactivate()).toBeTrue();
  });
  it('edits original-offer scope and deliverable answers', () => {
    const basic = fixture(); basic.offer.cover_letter = 'My approach';
    basic.offer.payment_plan = 'full'; basic.offer.installments = [{ title: 'Contract', percentage: 100, due_type: 'contract' }];
    basic.offer.offer_scopes = [{ id: 701, project_service_id: 44, scope: 'Executive summary', children: [{ id: 702, scope: 'Financial outlook' }] }];
    basic.offer.offer_components = [{ project_service_id: 44, value: { deliverables: [{ id: 801, title: 'Business plan', period_days: 10, report_type: ['pdf'], way: { selected: 'on_platform' } }] } }];
    delete basic.offer.offer_deliverables;
    basic.project.project_services[0].scopes = []; basic.project.project_services[0].deliverables = [];
    record = basic; (component as any).loadEditedOffer('project');
    expect(component.tabs.map(t => t.key)).toEqual(['cover', 'scope', 'deliverables', 'pricing', 'payment', 'review']);
    expect(component.isEditTabReadOnly('scope')).toBeFalse(); expect(component.isEditTabReadOnly('deliverables')).toBeFalse();
    expect(component.readOnlyScopes).toEqual([]); expect(component.readOnlyDeliverables).toEqual([]);
    expect(component.scopeSeed.offer_scopes[0].id).toBe(701);
    expect(component.scopeSeed.offer_scopes[0].subscopes![0]).toEqual(jasmine.objectContaining({ id: 702 }));
    expect(component.editPatch).toEqual({});
    component.scopeDraft.offer_scopes[0].scope = 'Updated executive summary';
    component.deliverablesDraft.offer_components[0].value.deliverables[0].title = 'Updated business plan';
    expect(component.editPatch.scopes![0].items[0].id).toBe(701);
    expect(component.editPatch.deliverables![0].items[0].id).toBe(801);
    expect((component.editPatch as any).offer_scopes).toBeUndefined(); expect((component.editPatch as any).offer_deliverables).toBeUndefined();
    expect(component.editChangeSummary.length).toBe(2);
    // The same scopes / deliverables fields are sent before and after award; the backend picks the sync.
  });
  it('keeps client answers read only alongside the insighter original-offer answers for the same service', () => {
    const mixed = fixture();
    mixed.project.project_services[0].scopes.forEach((row: any) => { row.filled_by_role = 'client'; row.children.forEach((child: any) => child.filled_by_role = 'client'); });
    mixed.project.project_services[0].deliverables[0].filled_by_role = 'client';
    mixed.offer.offer_scopes = [{ id: 701, project_service_id: 44, scope: 'Insighter scope' }];
    mixed.offer.offer_components = [{ project_service_id: 44, value: { deliverables: [{ id: 801, title: 'Insighter report', period_days: 10, report_type: [], way: { selected: 'on_platform' } }] } }];
    delete mixed.offer.offer_deliverables;
    record = mixed; (component as any).loadEditedOffer('project');
    expect(component.readOnlyScopes[0].items[0].id).toBe(10);
    expect(component.readOnlyDeliverables[0].items[0].id).toBe(15);
    expect(component.scopeSeed.offer_scopes[0].id).toBe(701);
    expect(component.deliverablesSeed.offer_components[0].value.deliverables[0].id).toBe(801);
    record.contract = { insighter_sign_at: true }; (component as any).loadEditedOffer('project');
    expect(component.isEditTabReadOnly('scope')).toBeTrue(); expect(component.isEditTabReadOnly('deliverables')).toBeTrue();
    expect(component.scopeSeed.offer_scopes).toEqual([]); expect(component.deliverablesSeed.offer_components).toEqual([]);
    expect(component.readOnlyScopes[0].items.map(item => item.id)).toEqual([10, 701]);
    expect(component.readOnlyDeliverables[0].items.map(item => item.id)).toEqual([15, 801]);
  });
  it('keeps original-offer answers disabled when the agreement is locked', () => {
    record.project.project_services[0].scopes = []; record.project.project_services[0].deliverables = [];
    record.offer.offer_scopes = [{ id: 701, project_service_id: 44, scope: 'Insighter scope' }];
    record.offer.offer_components = [{ project_service_id: 44, value: { deliverables: [{ title: 'Report' }] } }];
    delete record.offer.offer_deliverables;
    record.contract = { user_sign_at: true }; (component as any).loadEditedOffer('project');
    expect(component.isEditTabReadOnly('scope')).toBeTrue(); expect(component.isEditTabReadOnly('deliverables')).toBeTrue();
    expect(component.readOnlyScopes[0].items[0].id).toBe(701);
    expect(component.readOnlyDeliverables[0].items[0].title).toBe('Report');
  });
  it('skips client-defined scopes and deliverables on advanced projects while pricing stays editable', () => {
    record.project.definition_mode = 'advanced';
    record.project.project_services[0].scopes.forEach((row: any) => { row.filled_by_role = 'client'; row.children.forEach((child: any) => child.filled_by_role = 'client'); });
    record.project.project_services[0].deliverables[0].filled_by_role = 'client';
    record.offer.offer_scopes = []; record.offer.offer_deliverables = [];
    record.offer.installments[1] = { title: 'Report', percentage: 60, due_type: 'deliverable', project_service_deliverable_id: 15 };
    (component as any).loadEditedOffer('project');
    expect(component.tabs.map(t => t.key)).toEqual(['cover', 'pricing', 'payment', 'review']);
    expect(component.requirementsValid).toBeTrue();
    component.fixedPrice = 3000;
    expect(component.editPatch.price_type).toBeDefined();
    expect(component.editPatch.scopes).toBeUndefined(); expect(component.editPatch.deliverables).toBeUndefined();
  });
  it('hides absent scope and deliverable tabs instead of showing empty read-only groups', () => {
    record.project.project_services[0].scopes = []; record.project.project_services[0].deliverables = [];
    record.offer.offer_scopes = []; record.offer.offer_deliverables = [];
    (component as any).loadEditedOffer('project');
    expect(component.tabs.map(t => t.key)).toEqual(['cover', 'pricing', 'payment', 'review']);
  });
  it('sends one revision with a full changed scope group and the complete commercial group', () => {
    component.scopeDraft.offer_scopes[0].scope = 'Updated sizing'; component.fixedPrice = 3000;
    component.activeTab = 'review'; component.submitProposal();
    expect(api.update).toHaveBeenCalledTimes(1);
    const [role, uuid, patch] = api.update.calls.mostRecent().args;
    expect(role).toBe('insighter'); expect(uuid).toBe('offer');
    expect(patch.scopes[0].items[0].id).toBe(60); expect(patch.scopes[0].items[0].subscopes[0].id).toBe(61);
    expect(patch.fixed_price).toBe(3000); expect(patch.installments.length).toBe(2); expect(patch.payment_plan).toBe('partial');
    expect(patch.deliverables).toBeUndefined(); expect(patch.offer_scopes).toBeUndefined();
    expect(router.navigate).toHaveBeenCalledWith(['/app/insighter-dashboard/project-offers/details', 'project'], { queryParams: { tab: 'revisions' } });
  });
  it('preserves the draft without saving when fresh details contain another change', () => {
    component.fixedPrice = 3000; component.activeTab = 'review'; record.offer.fixed_price = 4000;
    component.submitProposal(); expect(api.update).not.toHaveBeenCalled(); expect(component.editStale).toBeTrue(); expect(component.fixedPrice).toBe(3000);
  });
  it('blocks a percentage mismatch, no-op and a notification-invalidated draft', () => {
    const alert = spyOn(Swal, 'fire').and.resolveTo({} as any);
    component.activeTab = 'review'; component.submitProposal(); expect(api.update).not.toHaveBeenCalled();
    expect(alert).toHaveBeenCalledWith(jasmine.objectContaining({ title: 'No changes made' }));
    component.fixedPrice = 3000; component.installments[0].percentage = 50; component.submitProposal(); expect(api.update).not.toHaveBeenCalled();
    component.installments[0].percentage = 40; api.changed$.next({ projectUuid: 'project' }); component.submitProposal(); expect(api.update).not.toHaveBeenCalled();
  });
  it('preserves offer-deliverable links without treating their IDs as project deliverable IDs', () => {
    record.offer.installments[1] = { title: 'Offer report', percentage: 60, due_type: 'deliverable', project_proposal_offer_deliverable_id: 88 };
    (component as any).loadEditedOffer('project'); component.fixedPrice = 3000;
    expect(component.editPatch.installments![1].project_proposal_offer_deliverable_id).toBe(88);
    expect(component.editPatch.installments![1].project_service_deliverable_id).toBeUndefined();
  });
  it('retains data and gives a retry path after the server rejects a revision', () => {
    api.update.and.returnValue(throwError(() => ({ error: { message: 'Unavailable' } })));
    component.fixedPrice = 3000; component.activeTab = 'review'; component.submitProposal();
    expect(component.fixedPrice).toBe(3000); expect(component.editSaved).toBeFalse(); expect(component.isSubmitting).toBeFalse(); expect(component.editError).toContain('retry');
  });
  it('shows commercial data as read only after payment starts and all data as read only after first signature', () => {
    record.order = { installments: [{ status: 'paid' }] }; (component as any).loadEditedOffer('project');
    expect(component.tabs.map(t => t.key)).toContain('pricing'); expect(component.isEditTabReadOnly('pricing')).toBeTrue(); expect(component.isEditTabReadOnly('payment')).toBeTrue();
    record.contract = { user_sign_at: true }; (component as any).loadEditedOffer('project');
    expect(component.tabs.map(t => t.key)).not.toContain('review'); expect(component.isEditTabReadOnly('scope')).toBeTrue();
    component.fixedPrice = 3000; component.submitProposal(); expect(api.update).not.toHaveBeenCalled();
  });
  it('sends a changed cover letter alone, without attachment fields', () => {
    record.offer.cover_letter = 'Original approach'; record.offer.files = [{ uuid: 'file-a', name: 'a.pdf' }];
    (component as any).loadEditedOffer('project');
    expect(component.editPatch).toEqual({});
    component.coverLetter = '  Updated approach  ';
    expect(component.editPatch).toEqual({ cover_letter: 'Updated approach' });
    component.coverLetter = '';
    expect(component.isCoverLetterInvalid()).toBeTrue();
  });
  it('resends every kept file UUID with new uploads and a removal', () => {
    record.offer.files = [{ uuid: 'file-a', name: 'a.pdf' }, { uuid: 'file-b', name: 'b.pdf' }];
    (component as any).loadEditedOffer('project');
    const upload = new File(['x'], 'revised-pricing.pdf', { type: 'application/pdf' });
    component.selectedAttachments = [upload];
    expect(component.editPatch.attachment_uuids).toEqual(['file-a', 'file-b']);
    component.toggleExistingAttachment(record.offer.files[1]);
    expect(component.editPatch.attachment_uuids).toEqual(['file-a']);
    component.activeTab = 'review'; component.submitProposal();
    const [, , patch, files] = api.update.calls.mostRecent().args;
    expect(patch.attachment_uuids).toEqual(['file-a']); expect(files).toEqual([upload]);
  });
  it('removes every attachment with an empty kept list when nothing is uploaded', () => {
    record.offer.files = [{ uuid: 'file-a', name: 'a.pdf' }];
    (component as any).loadEditedOffer('project');
    component.toggleExistingAttachment(record.offer.files[0]);
    component.activeTab = 'review'; component.submitProposal();
    const [, , patch, files] = api.update.calls.mostRecent().args;
    expect(patch.attachment_uuids).toEqual([]); expect(files).toEqual([]);
  });
  it('rejects unsupported files before they reach the request', () => {
    component.onAttachmentsSelected({ target: { files: [new File(['x'], 'tool.exe'), new File(['x'], 'plan.docx')], value: 'x' } } as any);
    expect(component.selectedAttachments.map(file => file.name)).toEqual(['plan.docx']);
    expect(component.attachmentErrors.length).toBe(1);
  });
  it('asks for a longer duration when a deliverable runs past the project end', () => {
    component.deliverablesDraft.offer_components[0].value.deliverables[0].period_days = 45;
    expect(component.durationOverflowDays).toBe(45);
    component.activeTab = 'review'; component.submitProposal();
    expect(api.update).not.toHaveBeenCalled(); expect(component.activeTab).toBe('deliverables');
    component.suggestDurationForDeliverables();
    expect(component.suggestedDurationDays).toBe(45); expect(component.durationOverflowDays).toBeNull();
    expect(component.effectiveDurationDays).toBe(45);
    expect(component.editPatch.suggested_duration_days).toBe(45);
  });
  it('only keeps a suggestion longer than the project duration, and drops it once no deliverable needs it', () => {
    component.setSuggestedDuration(30); expect(component.suggestedDurationError).toContain('30');
    const deliverable = component.deliverablesDraft.offer_components[0].value.deliverables[0];
    deliverable.period_days = 40; component.suggestDurationForDeliverables();
    expect(component.suggestedDurationDays).toBe(40); expect(component.suggestedDurationError).toBeNull(); expect(component.suggestionNeeded).toBeTrue();
    deliverable.period_days = 20;
    expect(component.suggestionNeeded).toBeFalse(); expect(component.durationOverflowDays).toBeNull();
    component.clearSuggestedDuration();
    expect(component.editPatch).toEqual({});
  });
  it('resends a saved suggestion with other changes and withdraws it with the project duration', () => {
    record.offer.suggested_duration_days = 45;
    (component as any).loadEditedOffer('project');
    expect(component.suggestedDurationDays).toBe(45); expect(component.editPatch).toEqual({});
    component.fixedPrice = 3000;
    expect(component.editPatch.suggested_duration_days).toBe(45);
    component.fixedPrice = 2500; component.clearSuggestedDuration();
    expect(component.editPatch).toEqual({ suggested_duration_days: 30 });
  });
  it('lets an awarded offer extend the project duration until the client signs', () => {
    record.offer.status = 'awarded'; record.offer.suggested_duration_days = 45; record.project.schedule.duration_days = 45;
    (component as any).loadEditedOffer('project');
    expect(component.durationLocked).toBeFalse(); expect(component.suggestedDurationDays).toBeNull(); expect(component.durationSuggestionHint).toContain('becomes the project duration');
    component.setSuggestedDuration(60);
    expect(component.editPatch.suggested_duration_days).toBe(60);
    record.contract = { user_sign_at: true }; (component as any).loadEditedOffer('project');
    expect(component.durationLocked).toBeTrue();
    component.fixedPrice = 3000;
    expect(component.editPatch.suggested_duration_days).toBeUndefined();
  });
  it('does not edit client-filled offer rows and sends an emptied scope group in full', () => {
    const original = fixture(); original.offer.offer_scopes[0].filled_by_role = 'client';
    expect(offerEditRequirements(original).requirements.scopes).toEqual([]);
    const before = fixture(), draft = offerEditRequirements(before).draft;
    draft.offer_scopes = [];
    const patch = offerEditPatch(before, draft, commercialDraft(before.offer));
    expect(patch.scopes).toEqual([{ project_service_id: 44, items: [] }]);
  });
  it('edits an awarded offer through its offer rows, hiding the project copies and linking payments by offer ID', () => {
    expect(component.readOnlyScopes).toEqual([]); expect(component.readOnlyDeliverables).toEqual([]);
    expect(component.paymentDeliverables.map(row => row.reference)).toEqual(['offer:65']);
    component.deliverablesDraft.offer_components[0].value.deliverables[0].title = 'Final report'; component.fixedPrice = 3000;
    const patch = component.editPatch;
    expect(patch.deliverables).toEqual([{ project_service_id: 44, items: [jasmine.objectContaining({ id: 65, title: 'Final report' })] }]);
    expect(patch.installments![1]).toEqual(jasmine.objectContaining({ project_proposal_offer_deliverable_id: 65 }));
    expect(patch.installments![1].project_service_deliverable_id).toBeUndefined();
  });
  it('links a payment to a deliverable created in the same request by its key', () => {
    const key = 'frontend-deliverable-3';
    component.deliverablesDraft.offer_components[0].value.deliverables.push({ key, title: 'Implementation report', period_days: 25, report_type: ['pdf'], way: { selected: 'on_platform', address: null } });
    expect(component.paymentDeliverables.some(row => row.reference === key)).toBeTrue();
    component.selectInstallmentDeliverable(component.installments[1], key);
    const patch = component.editPatch;
    expect(patch.deliverables![0].items[1]).toEqual(jasmine.objectContaining({ key, title: 'Implementation report' }));
    expect(patch.deliverables![0].items[1].id).toBeUndefined();
    expect(patch.installments![1]).toEqual(jasmine.objectContaining({ deliverable_key: key }));
    expect(patch.installments![1].project_proposal_offer_deliverable_id).toBeUndefined();
  });
});
