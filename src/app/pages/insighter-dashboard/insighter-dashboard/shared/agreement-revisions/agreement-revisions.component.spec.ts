import { of, Subject, throwError } from 'rxjs';
import { AgreementRevisionsComponent } from './agreement-revisions.component';
import { agreementIsLocked, ownsAgreementGroup, scopeDraft, linkedDeliverableIds, commercialDraft } from 'src/app/_fake/services/agreement-revisions/agreement-revisions.model';
import { mapProjectServices } from 'src/app/_fake/services/project-phase2/project-phase2.model';

const service = () => ({ id: 44, uuid: 'service-uuid', title: 'Market research', position: 1,
  scopes: [{ id: 10, scope: 'Market sizing', description: null, filled_by_role: 'client', filled_by_user_id: 31, children: [{ id: 11, scope: 'TAM', filled_by_role: 'client', filled_by_user_id: 31 }] }],
  components: [{ 'deliverable-stage': { deliverables: [{ id: 15, title: 'Report', period_days: 20, report_type: ['pdf'], way: { selected: 'on_platform' }, filled_by_role: 'client', filled_by_user_id: 31 }] } }],
});
describe('Agreement revisions safeguards', () => {
  let component: AgreementRevisionsComponent;
  let api: any;
  let clients: any;
  let record: any;
  beforeEach(() => {
    record = { uuid: 'project-uuid', status: 'submitted', project_services: mapProjectServices([service()]), invited: [{ uuid: 'match-uuid', agreement_match_uuid: 'match-uuid', offer: { installments: [{ project_service_deliverable_id: 15 }] } }] };
    api = { list: jasmine.createSpy().and.returnValue(of({ data: [] })), update: jasmine.createSpy().and.returnValue(of({ id: 7, revision_number: 7 })), changed$: new Subject() };
    clients = { getProject: jasmine.createSpy().and.callFake(() => of(JSON.parse(JSON.stringify(record)))) };
    component = new AgreementRevisionsComponent(api, clients, {} as any, {} as any, {} as any);
    component.record = record; component.role = 'client'; component.userId = 31; component.ngOnChanges();
  });
  it('groups offer attachment changes and only opens files still on the offer', () => {
    component.record.invited[0].offer.files = [{ uuid: 'new-file-uuid' }];
    const revision: any = { id: 42, revision_number: 7, changed_by_role: 'insighter', changed_target_types: ['offer_cover_letter', 'offer_duration_days', 'offer_attachment'], items: [
      { action: 'updated', target_type: 'offer_cover_letter', target_label: 'Cover letter', before_value: { cover_letter: 'Original' }, after_value: { cover_letter: 'Updated' } },
      { action: 'updated', target_type: 'offer_duration_days', target_label: 'Suggested project duration', before_value: { suggested_duration_days: null }, after_value: { suggested_duration_days: 45 } },
      { action: 'created', target_type: 'offer_attachment', before_value: null, after_value: { file_uuid: 'new-file-uuid', name: 'revised-pricing.pdf', size: 245000 } },
      { action: 'deleted', target_type: 'offer_attachment', before_value: { file_uuid: 'old-file-uuid', name: 'old-pricing.pdf', size: 210000 }, after_value: null },
    ] };
    expect(component.detailItems(revision).map(item => item.target_type)).toEqual(['offer_cover_letter', 'offer_duration_days']);
    const files = component.attachmentChanges(revision);
    expect(files.map(file => [file.action, file.name, file.active])).toEqual([['deleted', 'old-pricing.pdf', false], ['created', 'revised-pricing.pdf', true]]);
    expect(component.coverLetter(revision.items[0].after_value)).toBe('Updated');
    expect(component.changeRows(revision.items[1])[0]).toEqual(jasmine.objectContaining({ before: '—', after: '45 days' }));
    expect(component.durationNote(revision.items[1])).toContain('45 days');
    expect(component.revisionTitle(revision)).toBe('Technical proposal and Suggested duration and Attachments');
  });
  it('locks on either first signature, including timestamps, but not false flags', () => {
    expect(agreementIsLocked({ user_sign_at: true, insighter_sign_at: false })).toBeTrue();
    expect(agreementIsLocked({ user_sign_at: false, insighter_sign_at: '2026-10-15' })).toBeTrue();
    expect(agreementIsLocked({ user_sign_at: '0', insighter_sign_at: false })).toBeFalse();
  });
  it('denies missing, mixed and another Insighter ownership', () => {
    expect(ownsAgreementGroup([], 'client', 31)).toBeFalse();
    expect(ownsAgreementGroup([{}], 'client', 31)).toBeFalse();
    expect(ownsAgreementGroup([{ filled_by_role: 'client' }, { filled_by_role: 'insighter' }], 'client', 31)).toBeFalse();
    expect(ownsAgreementGroup([{ filled_by_role: 'insighter', filled_by_user_id: 32 }], 'insighter', 31)).toBeFalse();
    expect(ownsAgreementGroup([{ filled_by_role: 'insighter', filled_by_user_id: 31 }], 'insighter', 31)).toBeTrue();
  });
  it('preserves existing scope and child identifiers and omits IDs for new scopes', () => {
    expect(scopeDraft(service().scopes[0]).subscopes[0].id).toBe(11);
    expect(scopeDraft({ scope: 'New scope' }).id).toBeUndefined();
  });
  it('sends the full service group while omitting untouched groups', () => {
    component.startEditing();
    component.addScope(component.groups[0]); component.groups[0].scopes[1].scope = 'Competitors';
    expect(component.payload.scopes![0].project_service_id).toBe(44);
    expect(component.payload.scopes![0].items.length).toBe(2);
    expect(component.payload.scopes![0].items[0].subscopes[0].id).toBe(11);
    expect(component.payload.deliverables).toBeUndefined();
    component.save();
    expect(api.update.calls.mostRecent().args[1]).toBe('match-uuid');
    expect(api.update.calls.count()).toBe(1);
  });
  it('prevents deleting an installment-linked deliverable even by calling the handler directly', () => {
    component.startEditing(); component.removeDeliverable(component.groups[0], 0);
    expect(component.groups[0].deliverables.length).toBe(1);
  });
  it('submits an explicit empty list when removing the last owned scope', () => {
    component.startEditing(); component.groups[0].scopes = [];
    expect(component.payload.scopes).toEqual([{ project_service_id: 44, items: [] }]);
  });
  it('does not save a note without changes', () => {
    component.startEditing(); component.note = 'A note'; component.save(); expect(api.update).not.toHaveBeenCalled();
  });
  it('preserves the draft and does not PATCH after a concurrent change', () => {
    component.startEditing(); component.groups[0].scopes[0].scope = 'My edit';
    record.project_services[0].scopes[0].scope = 'Another edit'; component.save();
    expect(api.update).not.toHaveBeenCalled(); expect(component.stale).toBeTrue(); expect(component.groups[0].scopes[0].scope).toBe('My edit');
  });
  it('retains edits and displays validation messages on server rejection', () => {
    component.startEditing(); component.groups[0].scopes[0].scope = 'Updated';
    api.update.and.returnValue(throwError(() => ({ error: { errors: { common: ['Agreement locked'] } } })));
    component.save(); expect(component.editorVisible).toBeTrue(); expect(component.formError).toBe('Agreement locked'); expect(component.saving).toBeFalse();
  });
  it('preserves offer-deliverable links in commercial requests', () => {
    expect(commercialDraft({ installments: [{ title: 'Final', percentage: 100, due_type: 'deliverable', project_proposal_offer_deliverable_id: 88 }] }).installments[0].project_proposal_offer_deliverable_id).toBe(88);
    expect(linkedDeliverableIds([{ project_service_deliverable_id: 15 }]).has(15)).toBeTrue();
    expect(linkedDeliverableIds([{ project_proposal_offer_deliverable_id: 15, deliverable: { id: 15 } }]).has(15)).toBeFalse();
  });
  it('validates complete commercial groups and percentage totals', () => {
    component.role = 'insighter'; component.record = { project: record, offer: { uuid: 'offer-uuid', price_type: 'fixed', fixed_price: 2500, payment_plan: 'full', installments: [{ title: 'Contract', percentage: 100, due_type: 'contract' }] } };
    const draft = commercialDraft(component.record.offer);
    component.commercial = draft; component.originalCommercial = JSON.parse(JSON.stringify(draft)); component.commercial.fixed_price = 3000;
    expect(component.payload.installments!.length).toBe(1); expect(component.payload.payment_plan).toBe('full'); expect(component.validate()).toEqual([]);
    component.commercial.installments[0].percentage = 90; expect(component.validate().length).toBeGreaterThan(0);
  });
  it('marks an unseen revision seen once and lowers the unseen count', () => {
    const revision: any = { id: 9, revision_number: 2, is_seen: false, changed_by_role: 'insighter', changed_target_types: ['scope'], items_count: 1, items: [] };
    api.list.and.returnValue(of({ data: [{ ...revision }], meta: { unseen_count: 1 } }));
    api.show = jasmine.createSpy().and.returnValue(of(revision));
    api.markSeen = jasmine.createSpy().and.returnValue(of({}));
    api.seen$ = new Subject();
    const seen: number[] = []; component.revisionSeen.subscribe((id: number) => seen.push(id));
    component.load();
    expect(component.unseenCount).toBe(1);
    component.openRevision(9);
    expect(api.markSeen).toHaveBeenCalledOnceWith('client', 'match-uuid', 9);
    expect(component.unseenCount).toBe(0);
    expect(component.revisions[0].is_seen).toBeTrue();
    expect(seen).toEqual([9]);
    component.openRevision(9);
    expect(api.markSeen).toHaveBeenCalledTimes(1);
  });
  it('renders backend change rows and formats schedule properties', () => {
    const rows = component.changeRows({ id: 1, action: 'updated', target_type: 'project_property', target_label: 'Planned start date',
      before_value: { value: '2026-11-01' }, after_value: { value: '2026-11-15' },
      changes: [{ field: 'value', label: 'Value', before: '2026-11-01', after: '2026-11-15' }] } as any);
    expect(rows).toEqual([{ label: 'Changed', before: '1 Nov 2026', after: '15 Nov 2026' }]);
    const duration = component.changeRows({ id: 3, action: 'updated', target_type: 'project_property', target_label: 'عدد أيام المدة',
      before_value: { value: 30 }, after_value: { value: 45 }, changes: [{ field: 'value', label: 'Value', before: 30, after: 45 }] } as any);
    expect(duration).toEqual([{ label: 'Changed', before: '30 days', after: '45 days' }]);
    const priced = component.changeRows({ id: 2, action: 'updated', target_type: 'offer_price', target_label: 'Price', before_value: {}, after_value: {},
      changes: [{ field: 'fixed_price', label: 'Fixed price', before: 2500, after: 5555 }] } as any);
    expect(priced).toEqual([{ label: 'Fixed price', before: '$2,500.00', after: '$5,555.00', delta: '+$3,055.00' }]);
  });
  it('fails closed when a contract identifier exists without signature information', () => {
    record.contract_uuid = 'contract-uuid'; expect(component.canEdit).toBeFalse();
  });
  it('opens the offer wizard edit route for Insighters instead of the agreement modal', () => {
    const router = { navigate: jasmine.createSpy() };
    component = new AgreementRevisionsComponent(api, clients, {} as any, {} as any, {} as any, router as any);
    component.role = 'insighter'; component.userId = 32; component.proposalContext = true;
    component.record = { project: record, offer: { uuid: 'offer-uuid' } };
    component.startEditing();
    expect(router.navigate).toHaveBeenCalledWith(['/app/insighter-dashboard/project-offers/edit-offer', 'project-uuid'], { queryParams: { from: 'offers' } });
    expect(component.editorVisible).toBeFalse();
  });

  it('matches payment schedule rows across a revision and reads linked deliverables by title', () => {
    const pay = (title: string, position: number, percentage: string, due_type: string, period_days: number | null, deliverable?: number) =>
      ({ title, position, percentage, due_type, period_days, project_service_deliverable_id: deliverable ?? null, project_proposal_offer_deliverable_id: null });
    const item: any = { id: 9, action: 'updated', target_type: 'installment', target_label: 'Payment schedule',
      before_value: { installments: [pay('Advance', 0, '20.0000', 'contract', null), pay('Mid-project', 1, '30.0000', 'date', 21),
        pay('Workshop', 2, '25.0000', 'deliverable', 30, 15), pay('Final report', 3, '25.0000', 'date', 60)] },
      after_value: { installments: [pay('Advance', 0, '20.0000', 'contract', null), pay('Mid-project', 1, '30.0000', 'date', 21),
        pay('Workshop', 2, '20.0000', 'deliverable', 45, 15), pay('Handover', 3, '30.0000', 'date', 90)] } };
    const diff = component.installmentDiff(item)!;
    expect(diff.rows.map(row => `${row.status}:${row.title.text}`)).toEqual(['same:Advance', 'same:Mid-project', 'changed:Workshop', 'removed:Final report', 'added:Handover']);
    expect(diff.rows[2].share).toEqual({ text: '20%', was: '25%' });
    expect(diff.rows[2].due).toEqual({ text: 'On delivery of “Report” · day 45', was: 'On delivery of “Report” · day 30' });
    expect(diff.rows[0].due.text).toBe('On signing');
    expect(diff.summary).toBe('1 changed · 1 added · 1 removed');
    expect(diff.bars[0].segments.map(s => s.status)).toEqual(['same', 'same', 'changed', 'removed']);
    expect(diff.totalOk).toBeTrue();
    expect(component.installmentDiff({ ...item, target_type: 'offer_price' })).toBeNull();
  });
  it('treats a renamed payment in the same slot as a change, not a swap', () => {
    const item: any = { id: 10, action: 'updated', target_type: 'installment', target_label: 'Payment schedule',
      before_value: { installments: [{ title: 'Kick-off', position: 0, percentage: '100.0000', due_type: 'contract' }] },
      after_value: { installments: [{ title: 'Signing payment', position: 0, percentage: '100.0000', due_type: 'contract' }] } };
    const [row] = component.installmentDiff(item)!.rows;
    expect(row.status).toBe('changed');
    expect(row.title).toEqual({ text: 'Signing payment', was: 'Kick-off' });
  });
});
