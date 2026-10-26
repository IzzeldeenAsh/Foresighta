import { ProjectServiceDetails } from '../project-phase2/project-phase2.model';
import { RequirementOwnership } from '../project-phase2/project-requirements.model';

export type AgreementRole = 'client' | 'insighter';
export interface AgreementRevision {
  id: number;
  revision_number: number;
  project_id?: number | null;
  /** Set for proposal-level changes (offer deadline) shared by every invited Insighter. */
  project_proposal_id?: number | null;
  project_proposal_match_id?: number | null;
  project_proposal_offer_id?: number | null;
  is_seen?: boolean;
  seen_at?: string | null;
  changed_by_role: AgreementRole;
  changed_by_user?: { id: number; name: string; profile_photo_url?: string | null };
  system_summary: string;
  user_note?: string;
  changed_target_types: string[];
  items_count: number;
  created_at: string;
  items?: AgreementRevisionItem[];
}
export interface AgreementRevisionItem {
  id: number;
  action: 'created' | 'updated' | 'deleted';
  target_type: string;
  target_label: string;
  project_service?: { title: string };
  /** Set for requirement (component) items. */
  component?: { id: number; name: string; slug: string } | null;
  before_value: unknown;
  after_value: unknown;
  /** Backend-built comparison rows; preferred over diffing the raw values. */
  changes?: AgreementRevisionChange[];
}
/** A target-market option from the country, region or economic-bloc lists; only countries carry a flag. */
export interface MarketOption { id: number; name: string; flag?: string | null; }
export interface AgreementRevisionChange { field: string; label: string; before: unknown; after: unknown; }
export interface AgreementRevisionList { data: AgreementRevision[]; meta?: { last_page?: number; unseen_count?: number }; }
/** Proposal-level revisions (the offer deadline) apply to every Insighter invited under the proposal. */
export function isSharedRevision(revision: AgreementRevision): boolean {
  return (revision.changed_target_types ?? []).includes('proposal_property') ||
    (!!revision.project_proposal_id && !revision.project_proposal_match_id && !revision.project_proposal_offer_id);
}
export interface ScopeDraft {
  id?: number;
  scope: string;
  description: string | null;
  subscopes: ScopeDraft[];
  /** Sub-scope only: the complete list of existing files to keep; sent with attachment changes only. */
  file_uuids?: string[];
  /** Sub-scope only: new uploads, which switch the request to multipart. */
  file?: File[];
}
export interface DeliverableDraft {
  id?: number;
  title: string;
  period_days: number;
  report_type: string[];
  way: { selected: string | null; address: string | null };
  /** New offer deliverable only: a request-scoped key an installment's `deliverable_key` can point at. */
  key?: string;
}
export interface AgreementGroup<T> { project_service_id: number; items: T[]; }
export interface CommercialDraft {
  price_type: string;
  fixed_price: number | null;
  hourly_rate?: number | null;
  estimated_hours?: number | null;
  daily_rate?: number | null;
  estimated_days?: number | null;
  payment_plan: string;
  installments: Array<{
    title: string; percentage: number; due_type: string; period_days?: number | null;
    project_service_deliverable_id?: number | null;
    project_proposal_offer_deliverable_id?: number | null;
    /** Links a deliverable created in the same request by its `key`. */
    deliverable_key?: string | null;
  }>;
}
export interface AgreementPatch extends Partial<CommercialDraft> {
  user_note?: string;
  scopes?: AgreementGroup<ScopeDraft>[];
  deliverables?: AgreementGroup<DeliverableDraft>[];
  /** Pivot row `id` (not `component_id`) with the raw stored value. */
  project_components?: Array<{ id: number; value: unknown }>;
  service_components?: Array<{ id: number; value: unknown }>;
  /** Insighter offer terms. */
  cover_letter?: string;
  /** The complete list of existing offer files to keep; omitted files are removed. New files travel as `files[]`. */
  attachment_uuids?: string[];
  suggested_duration_days?: number;
}

/** Offer files the backend accepts (`files.*` rule), shared by the add-offer and edit-offer requests. */
export const OFFER_FILE_EXTENSIONS = ['pdf', 'jpg', 'jpeg', 'png', 'doc', 'docx', 'xls', 'xlsx', 'csv', 'txt', 'ppt', 'pptx', 'odt'];
export const OFFER_FILE_MAX_BYTES = 50 * 1024 * 1024;
export const COVER_LETTER_MAX_LENGTH = 2000;

/** Why a picked offer file would be rejected, or null when it is accepted. */
export function offerFileError(file: File, ar: boolean): string | null {
  const extension = (file.name.split('.').pop() || '').toLowerCase();
  if (!OFFER_FILE_EXTENSIONS.includes(extension))
    return ar ? `«${file.name}»: نوع الملف غير مدعوم.` : `“${file.name}” is not a supported file type.`;
  if (file.size > OFFER_FILE_MAX_BYTES)
    return ar ? `«${file.name}»: الحد الأقصى لحجم الملف 50 ميغابايت.` : `“${file.name}” is larger than 50 MB.`;
  return null;
}

/**
 * The insighter's suggested duration, only when it actually extends the project.
 * Once an award applies it, the project duration catches up and the suggestion reads as settled.
 */
export function offerDurationSuggestion(offer: { suggested_duration_days?: number | null } | null | undefined, projectDurationDays: number | null | undefined): number | null {
  const days = Number(offer?.suggested_duration_days);
  if (!Number.isInteger(days) || days < 1) return null;
  return projectDurationDays == null || days > Number(projectDurationDays) ? days : null;
}

/**
 * Multipart body for a revision that uploads files (offer `files` and any nested sub-scope `file` lists).
 * Nulls become empty strings (the API reads them as null), empty arrays cannot be sent and are left out,
 * so callers must not rely on an empty list here.
 */
export function agreementFormData(payload: AgreementPatch, files: File[]): FormData {
  const form = new FormData();
  const append = (key: string, value: unknown): void => {
    if (value === undefined) return;
    if (value === null) form.append(key, '');
    else if (value instanceof Blob) form.append(key, value, value instanceof File ? value.name : 'file');
    else if (Array.isArray(value)) value.forEach((item, index) => append(`${key}[${index}]`, item));
    else if (typeof value === 'object') Object.entries(value as Record<string, unknown>).forEach(([field, item]) => append(`${key}[${field}]`, item));
    else if (typeof value === 'boolean') form.append(key, value ? '1' : '0');
    else form.append(key, String(value));
  };
  Object.entries(payload).forEach(([key, value]) => append(key, value));
  files.forEach((file, index) => form.append(`files[${index}]`, file, file.name));
  form.append('_method', 'PATCH');
  return form;
}

/** Requirement groups emptied in this patch: a multipart body cannot carry their empty `items` list. */
export function emptyAgreementGroups(payload: AgreementPatch): boolean {
  return [...(payload.scopes ?? []), ...(payload.deliverables ?? [])].some(group => !group.items?.length);
}

/** Only these component values are returned by the API, so only these can be edited safely. */
export type EditableComponentSlug = 'target-market' | 'data-sources-expected';
export const EDITABLE_COMPONENT_SLUGS: EditableComponentSlug[] = ['target-market', 'data-sources-expected'];
export interface ComponentDraft {
  id: number;
  level: 'project' | 'service';
  projectServiceId: number | null;
  slug: EditableComponentSlug;
  name: string;
  /** target-market: `{ type, ids }`; data-sources-expected: a string option. */
  value: any;
}

/** Map a component block from the project resource back to the raw value shape the backend stores. */
export function componentDraft(block: any, level: ComponentDraft['level'], projectServiceId: number | null): ComponentDraft | null {
  const slug = block?.component_slug as EditableComponentSlug;
  const id = Number(block?.id);
  if (!EDITABLE_COMPONENT_SLUGS.includes(slug) || !(id > 0)) return null;
  const raw = block[slug];
  const value = slug === 'target-market'
    ? { type: raw?.type || 'country', ids: (raw?.objects ?? []).map((row: any) => Number(row.id)).filter((rowId: number) => rowId > 0) }
    : typeof raw === 'string' ? raw : '';
  return { id, level, projectServiceId, slug, name: block.component_name || slug, value };
}

/** Components the current actor filled, split by project level and service level. */
export function editableComponents(project: any, role: AgreementRole, userId: number | null): ComponentDraft[] {
  const services: ProjectServiceDetails[] = project?.project_services ?? [];
  const serviceBlocks = new Set<any>(services.reduce<any[]>((all, s) => all.concat(s.components ?? []), []));
  const owned = (block: any) => block?.filled_by_role === role && (role === 'client' || (!!userId && Number(block.filled_by_user_id) === userId));
  const projectLevel = (project?.components ?? []).filter((block: any) => !serviceBlocks.has(block) && owned(block))
    .map((block: any) => componentDraft(block, 'project', null));
  const serviceLevel = services.reduce<Array<ComponentDraft | null>>((all, s) => all.concat((s.components ?? []).filter(owned)
    .map(block => componentDraft(block, 'service', s.id ?? null))), []);
  return [...projectLevel, ...serviceLevel].filter((row): row is ComponentDraft => !!row);
}

export function agreementIsLocked(contract: any, status?: string | null): boolean {
  const signed = (v: unknown) => !!v && v !== '0' && v !== 'false';
  return signed(contract?.user_sign_at) || signed(contract?.insighter_sign_at) ||
    ['payment', 'in_progress', 'in_review', 'closed', 'cancelled', 'completed'].includes(status || '');
}

/** Unknown or mixed ownership stays readonly, including an empty group without metadata. */
export function ownsAgreementGroup(rows: RequirementOwnership[], role: AgreementRole, userId: number | null): boolean {
  return rows.length > 0 && rows.every(row => row.filled_by_role === role &&
    (role === 'client' || (!!userId && Number(row.filled_by_user_id) === userId)));
}

export function scopeDraft(row: any): ScopeDraft {
  return {
    // An emptied description and a missing one both read as null, so clearing a field is not a change.
    ...(row.id ? { id: row.id } : {}), scope: row.scope ?? '', description: row.description || null,
    subscopes: (row.children ?? row.subscopes ?? []).map((child: any) => ({
      ...(child.id ? { id: child.id } : {}), scope: child.scope ?? '', description: child.description || null, subscopes: [],
      // Known files travel as the retained list; rows whose files the API did not list keep theirs untouched.
      ...(Array.isArray(child.files) && !child.files_locked ? { file_uuids: child.files.map((file: ScopeFile) => file.uuid) } : {}),
      ...(child.new_files?.length ? { file: [...child.new_files] } : {}),
    })),
  };
}

/** A file attached to a sub-scope, as the offer and project resources list it. */
export interface ScopeFile { uuid: string; name?: string | null; size?: number | null; }
/** Editor state for a sub-scope's files: kept existing files, new uploads, or locked when the API only says files exist. */
export interface SubscopeFilesState { files?: ScopeFile[]; files_locked?: boolean; new_files?: File[]; }
export function subscopeFilesState(row: any): SubscopeFilesState {
  if (Array.isArray(row?.files)) return { files: row.files.filter((file: any) => file?.uuid).map((file: any) => ({ uuid: String(file.uuid), name: file.name ?? null, size: file.size ?? null })) };
  return row?.have_attachments ? { files_locked: true } : { files: [] };
}
/** Saved scopes for the editor, keeping sub-scope file names that the request payload reduces to UUIDs. */
export function scopeEditorDraft(row: any): any {
  return {
    ...(row.id ? { id: row.id } : {}), scope: row.scope ?? '', description: row.description ?? null,
    subscopes: (row.children ?? row.subscopes ?? []).map((child: any) => ({
      ...(child.id ? { id: child.id } : {}), scope: child.scope ?? '', description: child.description ?? null, ...subscopeFilesState(child),
    })),
  };
}
/** Keep sub-scope file fields only where the attachments changed, as the API expects. */
export function onlyChangedScopeFiles(items: ScopeDraft[], original: ScopeDraft[]): ScopeDraft[] {
  const saved = new Map<number, ScopeDraft>();
  original.forEach(scope => scope.subscopes.forEach(child => { if (child.id) saved.set(child.id, child); }));
  return items.map(scope => ({
    ...scope,
    subscopes: scope.subscopes.map(child => {
      const before = child.id ? saved.get(child.id)?.file_uuids ?? [] : [];
      const kept = child.file_uuids ?? before;
      const changed = !!child.file?.length || kept.length !== before.length || kept.some(uuid => !before.includes(uuid));
      if (changed) return { ...child, file_uuids: kept };
      const { file_uuids, file, ...rest } = child;
      return rest;
    }),
  }));
}
/** Whether any value in a payload is a file, so it has to go as multipart. */
export function payloadHasFiles(value: unknown): boolean {
  if (typeof Blob !== 'undefined' && value instanceof Blob) return true;
  if (Array.isArray(value)) return value.some(payloadHasFiles);
  return !!value && typeof value === 'object' && Object.values(value as Record<string, unknown>).some(payloadHasFiles);
}
/** A sub-scope whose files are all removed with nothing uploaded: multipart cannot send its empty `file_uuids` list. */
export function emptiedScopeFiles(payload: AgreementPatch): boolean {
  return (payload.scopes ?? []).some(group =>
    (group.items ?? []).some(scope => (scope.subscopes ?? []).some(child => Array.isArray(child.file_uuids) && !child.file_uuids.length && !child.file?.length)));
}
export function deliverableDraft(row: any): DeliverableDraft {
  return {
    ...(row.id ? { id: row.id } : {}), title: row.title ?? '', period_days: row.period_days ?? 0,
    report_type: [...(row.report_type ?? [])],
    way: { selected: row.way?.selected ?? null, address: row.way?.address ?? null },
  };
}
export function commercialDraft(offer: any): CommercialDraft {
  return {
    price_type: offer.price_type || 'fixed', fixed_price: offer.fixed_price == null ? null : Number(offer.fixed_price),
    hourly_rate: offer.hourly_rate == null ? null : Number(offer.hourly_rate), estimated_hours: offer.estimated_hours == null ? null : Number(offer.estimated_hours),
    daily_rate: offer.daily_rate == null ? null : Number(offer.daily_rate), estimated_days: offer.estimated_days == null ? null : Number(offer.estimated_days),
    payment_plan: offer.payment_plan || 'full',
    installments: (offer.installments ?? []).map((row: any) => ({
      title: row.title, percentage: Number(row.percentage), due_type: row.due_type,
      ...(row.due_type === 'date' ? { period_days: row.period_days } : {}),
      // Offer deliverable IDs survive an awarded sync; the project-side copy they map to is recreated by it.
      ...(row.due_type === 'deliverable' && row.project_proposal_offer_deliverable_id ? { project_proposal_offer_deliverable_id: row.project_proposal_offer_deliverable_id }
        : row.due_type === 'deliverable' && row.project_service_deliverable_id ? { project_service_deliverable_id: row.project_service_deliverable_id } : {}),
      ...(row.due_type === 'deliverable' && row.deliverable_key && !row.project_proposal_offer_deliverable_id && !row.project_service_deliverable_id ? { deliverable_key: row.deliverable_key } : {}),
    })),
  };
}
export function linkedDeliverableIds(installments: any[]): Set<number> {
  return new Set(installments.map(row => Number(row.project_service_deliverable_id ?? (row.project_proposal_offer_deliverable_id ? null : row.deliverable?.id))).filter(id => id > 0));
}
export function editableScopes(service: ProjectServiceDetails, role: AgreementRole, userId: number | null): boolean {
  const rows = service.scopes.reduce<any[]>((all, row) => all.concat(row, row.children ?? row.subscopes ?? []), []);
  return ownsAgreementGroup(rows, role, userId);
}

/** Whether the insighter may open the edit-offer page for a proposal record (`{ project, offer, contract, ... }`). */
export function insighterCanEditOffer(record: any, userId: number | null): boolean {
  const project = record?.project;
  const contract = record?.contract ?? project?.contract ?? record?.offer?.contract;
  const locked = agreementIsLocked(contract, project?.status ?? record?.project_status) || (!!(record?.contract_uuid || project?.contract_uuid) && !contract);
  if (!record?.offer?.uuid || locked) return false;
  if (!!userId && !agreementPaymentStarted(project?.order ?? record?.order)) return true;
  return editableComponents(project, 'insighter', userId).length > 0 || (project?.project_services ?? []).some((s: ProjectServiceDetails) =>
    editableScopes(s, 'insighter', userId) || ownsAgreementGroup(s.deliverables, 'insighter', userId));
}

export function agreementPaymentStarted(order: any): boolean {
  return (order?.installments ?? []).some((row: any) => row.paid_at || ['pending', 'paid', 'refunded'].includes(row.status)) ||
    (order?.payments ?? []).some((row: any) => ['pending', 'awaiting_charge', 'paid', 'refunded'].includes(row.status));
}
