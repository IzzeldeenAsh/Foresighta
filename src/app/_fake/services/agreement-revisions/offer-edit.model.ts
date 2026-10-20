import { ProjectOffer } from '../project-offers/project-offers.service';
import { MissingOfferRequirements, OfferRequirementDraft } from '../project-phase2/project-requirements.model';
import { AgreementPatch, CommercialDraft, commercialDraft, deliverableDraft, scopeDraft, ScopeDraft, DeliverableDraft, AgreementGroup, offerDurationSuggestion, scopeEditorDraft, onlyChangedScopeFiles } from './agreement-revisions.model';

export interface OfferEditPatch extends AgreementPatch {
  /** Original offer records need their own API targets; their IDs are not project row IDs. */
  offer_scopes?: AgreementGroup<ScopeDraft>[];
  offer_deliverables?: AgreementGroup<DeliverableDraft>[];
}

function ownedProjectRow(row: any, userId: number | null): boolean {
  return row.filled_by_role === 'insighter' && !!userId && Number(row.filled_by_user_id) === userId;
}
export function editableOfferScopes(record: ProjectOffer, serviceId: number, userId: number | null): { source: 'project' | 'offer'; items: any[] } {
  const service = record.project.project_services.find(service => service.id === serviceId);
  const projectRows = (service?.scopes ?? []).filter(row => ownedProjectRow(row, userId) &&
    (row.children ?? row.subscopes ?? []).every((child: any) => ownedProjectRow(child, userId)));
  if (projectRows.length) return { source: 'project', items: projectRows };
  // The authenticated offer establishes authorship for older records without ownership metadata.
  const items = (record.offer?.offer_scopes ?? []).filter(row => row.project_service_id === serviceId && row.filled_by_role !== 'client' &&
    (row.children ?? row.subscopes ?? []).every((child: any) => child.filled_by_role !== 'client'));
  return { source: 'offer', items };
}
export function editableOfferDeliverables(record: ProjectOffer, serviceId: number, userId: number | null): { source: 'project' | 'offer'; items: any[] } {
  const service = record.project.project_services.find(service => service.id === serviceId);
  const projectRows = (service?.deliverables ?? []).filter(row => ownedProjectRow(row, userId));
  if (projectRows.length) return { source: 'project', items: projectRows };
  const items = (record.offer?.offer_components ?? []).filter(row => row.project_service_id === serviceId && row.filled_by_role !== 'client')
    .reduce<any[]>((all, row) => all.concat((row.value?.deliverables ?? []).filter((item: any) => item.filled_by_role !== 'client')), []);
  return { source: 'offer', items };
}

/** Adapt the insighter's saved answers while keeping original-offer and project identifiers separate. */
export function offerEditRequirements(record: ProjectOffer, userId: number | null): { requirements: MissingOfferRequirements; draft: OfferRequirementDraft } {
  const requirements: MissingOfferRequirements = { scopes: [], project_components: [], service_components: [] };
  const draft: OfferRequirementDraft = { offer_scopes: [], offer_components: [] };
  for (const service of record.project.project_services) {
    if (!service.id) continue;
    const scopes = editableOfferScopes(record, service.id, userId);
    const deliverables = editableOfferDeliverables(record, service.id, userId);
    if (scopes.items.length) {
      requirements.scopes.push({ project_service_id: service.id, title: service.title, required_in_offer: false });
      draft.offer_scopes.push(...scopes.items.map(row => ({ ...scopeEditorDraft(row), project_service_id: service.id! })));
    }
    if (deliverables.items.length) {
      // A local editor key only; revision requests use the project-service ID and deliverable row IDs.
      const componentId = -service.id;
      requirements.service_components.push({ project_service_id: service.id, component_id: componentId, ownership_level: 'project_service', required_in_offer: false, component: { id: componentId, name: service.title || 'Deliverables', slug: 'deliverable-stage' } });
      draft.offer_components.push({ project_service_id: service.id, component_id: componentId, value: { deliverables: deliverables.items.map(deliverableDraft) } });
    }
  }
  return { requirements, draft };
}

/** Cover letter, attachments and suggested duration as the insighter edits them. */
export interface OfferTermsDraft {
  coverLetter: string;
  /** Existing offer files to keep. */
  retainedAttachmentUuids: string[];
  newFileCount: number;
  suggestedDurationDays: number | null;
  /** The suggestion is fixed once the offer is awarded. */
  durationLocked: boolean;
}
export function offerTermsDraft(record: ProjectOffer, durationLocked: boolean): OfferTermsDraft {
  return {
    coverLetter: record.offer?.cover_letter ?? '',
    retainedAttachmentUuids: (record.offer?.files ?? []).map(file => file.uuid).filter(Boolean),
    newFileCount: 0,
    suggestedDurationDays: offerDurationSuggestion(record.offer, record.project.schedule?.duration_days),
    durationLocked,
  };
}
function applyOfferTerms(patch: OfferEditPatch, record: ProjectOffer, terms: OfferTermsDraft): void {
  const offer = record.offer;
  if (!offer) return;
  const coverLetter = terms.coverLetter.trim();
  if (coverLetter !== (offer.cover_letter ?? '').trim()) patch.cover_letter = coverLetter;
  // Attachments travel as the full list of files to keep, so an untouched file is resent rather than dropped.
  const saved = (offer.files ?? []).map(file => file.uuid).filter(Boolean);
  const retained = terms.retainedAttachmentUuids;
  if (terms.newFileCount > 0 || saved.length !== retained.length || saved.some(uuid => !retained.includes(uuid))) patch.attachment_uuids = [...retained];
  if (terms.durationLocked) return;
  const projectDays = record.project.schedule?.duration_days ?? null;
  const savedDays = offerDurationSuggestion(offer, projectDays);
  if (terms.suggestedDurationDays !== savedDays) {
    // Withdrawing a suggestion sends the current project duration: the API has no way to clear it.
    const days = terms.suggestedDurationDays ?? projectDays;
    if (days !== null) patch.suggested_duration_days = days;
  } else if (savedDays !== null && Object.keys(patch).length) {
    // The API checks deliverables and linked payments against the duration sent in the same request.
    patch.suggested_duration_days = savedDays;
  }
}

export function offerEditPatch(record: ProjectOffer, userId: number | null, draft: OfferRequirementDraft, commercial: CommercialDraft, terms?: OfferTermsDraft): OfferEditPatch {
  const before = offerEditRequirements(record, userId);
  const patch: OfferEditPatch = {};
  for (const group of before.requirements.scopes) {
    const items = draft.offer_scopes.filter(row => row.project_service_id === group.project_service_id).map(scopeDraft);
    const original = before.draft.offer_scopes.filter(row => row.project_service_id === group.project_service_id).map(scopeDraft);
    const target = editableOfferScopes(record, group.project_service_id, userId).source === 'offer' ? 'offer_scopes' : 'scopes';
    // New uploads are File objects, which JSON.stringify cannot tell apart, so their names join the comparison.
    const fingerprint = (rows: ScopeDraft[]) => JSON.stringify(rows.map(row => ({ ...row, subscopes: row.subscopes.map(child => ({ ...child, file: child.file?.map(file => [file.name, file.size]) })) })));
    if (fingerprint(items) !== fingerprint(original)) (patch[target] ??= []).push({ project_service_id: group.project_service_id, items: onlyChangedScopeFiles(items, original) });
  }
  for (const group of before.requirements.service_components) {
    const rows = draft.offer_components.find(row => row.component_id === group.component_id && row.project_service_id === group.project_service_id)?.value?.deliverables ?? [];
    const original = before.draft.offer_components.find(row => row.component_id === group.component_id && row.project_service_id === group.project_service_id)!.value.deliverables;
    const items = rows.map(deliverableDraft);
    const target = editableOfferDeliverables(record, group.project_service_id!, userId).source === 'offer' ? 'offer_deliverables' : 'deliverables';
    if (JSON.stringify(items) !== JSON.stringify(original)) (patch[target] ??= []).push({ project_service_id: group.project_service_id!, items });
  }
  if (record.offer && JSON.stringify(commercial) !== JSON.stringify(commercialDraft(record.offer))) Object.assign(patch, commercial);
  if (terms) applyOfferTerms(patch, record, terms);
  return patch;
}
export function offerEditFingerprint(record: ProjectOffer): string {
  return JSON.stringify([record.project.project_services, record.offer, record.contract, record.project.contract, record.order, record.project.status]);
}
