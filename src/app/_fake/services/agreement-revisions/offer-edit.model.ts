import { ProjectOffer } from '../project-offers/project-offers.service';
import { MissingOfferRequirements, OfferRequirementDraft } from '../project-phase2/project-requirements.model';
import { AgreementPatch, CommercialDraft, commercialDraft, deliverableDraft, scopeDraft, ScopeDraft, DeliverableDraft, AgreementGroup, offerDurationSuggestion, scopeEditorDraft, onlyChangedScopeFiles } from './agreement-revisions.model';

/**
 * One request shape before and after award: `scopes` / `deliverables` always carry offer row IDs,
 * and the backend syncs an awarded offer into the project itself.
 */
export type OfferEditPatch = AgreementPatch;

/** A project row the insighter filled; after award these are copies of the offer rows. */
export function insighterOwnsProjectRow(row: any, userId: number | null): boolean {
  return row.filled_by_role === 'insighter' && !!userId && Number(row.filled_by_user_id) === userId;
}
/** Insighter offer scopes; their IDs stay stable while project-side copies are rebuilt on every awarded edit. */
export function editableOfferScopes(record: ProjectOffer, serviceId: number): any[] {
  return (record.offer?.offer_scopes ?? []).filter(row => row.project_service_id === serviceId && row.filled_by_role !== 'client' &&
    (row.children ?? row.subscopes ?? []).every((child: any) => child.filled_by_role !== 'client'));
}
export function editableOfferDeliverables(record: ProjectOffer, serviceId: number): any[] {
  // offer_deliverables carry the persisted IDs that installments and revisions link to.
  if (record.offer?.offer_deliverables) return record.offer.offer_deliverables.filter(row => row.project_service_id === serviceId);
  return (record.offer?.offer_components ?? []).filter(row => row.project_service_id === serviceId && row.filled_by_role !== 'client')
    .reduce<any[]>((all, row) => all.concat((row.value?.deliverables ?? []).filter((item: any) => item.filled_by_role !== 'client')), []);
}

/** Adapt the insighter's saved offer answers for the editor. */
export function offerEditRequirements(record: ProjectOffer): { requirements: MissingOfferRequirements; draft: OfferRequirementDraft } {
  const requirements: MissingOfferRequirements = { scopes: [], project_components: [], service_components: [] };
  const draft: OfferRequirementDraft = { offer_scopes: [], offer_components: [] };
  for (const service of record.project.project_services) {
    if (!service.id) continue;
    const scopes = editableOfferScopes(record, service.id);
    const deliverables = editableOfferDeliverables(record, service.id);
    if (scopes.length) {
      requirements.scopes.push({ project_service_id: service.id, title: service.title, required_in_offer: false });
      draft.offer_scopes.push(...scopes.map(row => ({ ...scopeEditorDraft(row), project_service_id: service.id! })));
    }
    if (deliverables.length) {
      // A local editor key only; revision requests use the project-service ID and offer deliverable IDs.
      const componentId = -service.id;
      requirements.service_components.push({ project_service_id: service.id, component_id: componentId, ownership_level: 'project_service', required_in_offer: false, component: { id: componentId, name: service.title || 'Deliverables', slug: 'deliverable-stage' } });
      draft.offer_components.push({ project_service_id: service.id, component_id: componentId, value: { deliverables: deliverables.map(deliverableDraft) } });
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

export function offerEditPatch(record: ProjectOffer, draft: OfferRequirementDraft, commercial: CommercialDraft, terms?: OfferTermsDraft): OfferEditPatch {
  const before = offerEditRequirements(record);
  const patch: OfferEditPatch = {};
  for (const group of before.requirements.scopes) {
    const items = draft.offer_scopes.filter(row => row.project_service_id === group.project_service_id).map(scopeDraft);
    const original = before.draft.offer_scopes.filter(row => row.project_service_id === group.project_service_id).map(scopeDraft);
    // New uploads are File objects, which JSON.stringify cannot tell apart, so their names join the comparison.
    const fingerprint = (rows: ScopeDraft[]) => JSON.stringify(rows.map(row => ({ ...row, subscopes: row.subscopes.map(child => ({ ...child, file: child.file?.map(file => [file.name, file.size]) })) })));
    if (fingerprint(items) !== fingerprint(original)) (patch.scopes ??= []).push({ project_service_id: group.project_service_id, items: onlyChangedScopeFiles(items, original) });
  }
  for (const group of before.requirements.service_components) {
    const rows = draft.offer_components.find(row => row.component_id === group.component_id && row.project_service_id === group.project_service_id)?.value?.deliverables ?? [];
    const original = before.draft.offer_components.find(row => row.component_id === group.component_id && row.project_service_id === group.project_service_id)!.value.deliverables;
    const items: DeliverableDraft[] = rows.map(deliverableDraft);
    if (JSON.stringify(items) !== JSON.stringify(original)) {
      // A new deliverable keeps its frontend key so an installment in the same request can link to it.
      (patch.deliverables ??= []).push({ project_service_id: group.project_service_id!, items: items.map((item, index) => !item.id && rows[index].key ? { ...item, key: rows[index].key } : item) });
    }
  }
  if (record.offer && JSON.stringify(commercial) !== JSON.stringify(commercialDraft(record.offer))) Object.assign(patch, commercial);
  if (terms) applyOfferTerms(patch, record, terms);
  return patch;
}
export function offerEditFingerprint(record: ProjectOffer): string {
  return JSON.stringify([record.project.project_services, record.offer, record.contract, record.project.contract, record.order, record.project.status]);
}
