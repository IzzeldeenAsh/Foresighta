export type DefinitionMode = 'simple' | 'advanced';
export interface RequirementOwnership {
  filled_by_role?: 'client' | 'insighter' | null;
  filled_by_user_id?: number | null;
  source_project_proposal_offer_id?: number | null;
}
export interface RequirementComponent {
  id: number;
  name: string;
  slug: string;
  ownership_level?: 'project' | 'project_service';
  is_required?: boolean;
  definition_mode_visibility?: 'simple' | 'advanced' | 'both';
  fillable_by_insighter?: boolean;
}
export interface MissingScopeRequirement {
  project_service_id: number;
  project_service_uuid?: string;
  title?: string | null;
  service?: { id?: number | null; name?: string } | null;
  required_in_offer: boolean;
}
export interface MissingComponentRequirement {
  project_service_id: number | null;
  component_id: number;
  component: RequirementComponent;
  ownership_level: 'project' | 'project_service';
  required_in_offer: boolean;
}
export interface MissingOfferRequirements {
  scopes: MissingScopeRequirement[];
  project_components: MissingComponentRequirement[];
  service_components: MissingComponentRequirement[];
}
export interface OfferScope extends RequirementOwnership {
  id?: number;
  project_service_id: number;
  scope: string;
  description?: string | null;
  children?: OfferScope[];
  subscopes?: OfferSubscope[];
}
/** A sub-scope with its optional description and files (`files` kept, `new_files` to upload). */
export interface OfferSubscope {
  id?: number;
  scope: string;
  description?: string | null;
  files?: Array<{ uuid: string; name?: string | null; size?: number | null }>;
  files_locked?: boolean;
  new_files?: File[];
}
export interface OfferComponent extends RequirementOwnership {
  project_service_id: number | null;
  component_id: number;
  component?: RequirementComponent;
  value: any;
}
export interface OfferRequirementDraft { offer_scopes: OfferScope[]; offer_components: OfferComponent[]; }
export function mapMissingOfferRequirements(raw: any): MissingOfferRequirements {
  return {
    scopes: Array.isArray(raw?.scopes) ? raw.scopes : [],
    project_components: Array.isArray(raw?.project_components) ? raw.project_components : [],
    service_components: Array.isArray(raw?.service_components) ? raw.service_components : [],
  };
}
/** Laravel expects nested multipart fields, not JSON strings for arrays/objects. */
export function appendRequirementFormData(form: FormData, key: string, value: any): void {
  if (value === null || value === undefined) return;
  if (typeof value === 'object') {
    Object.keys(value).forEach(child => appendRequirementFormData(form, `${key}[${child}]`, value[child]));
  } else form.append(key, typeof value === 'boolean' ? (value ? '1' : '0') : String(value));
}
export function requirementValueIsFilled(value: any): boolean {
  if (typeof value === 'string') return !!value.trim();
  if (value === null || value === undefined) return false;
  if (Array.isArray(value)) return value.length > 0 && value.every(requirementValueIsFilled);
  if (typeof value === 'object') {
    if ('deliverables' in value) return Array.isArray(value.deliverables) && value.deliverables.length > 0 && value.deliverables.every((d: any) =>
      !!d.title?.trim() && Number.isInteger(Number(d.period_days)) && Number(d.period_days) >= 0 && d.period_days !== null && d.period_days !== '' &&
      ['on_platform', 'session', 'physical_workshop'].includes(d.way?.selected) && (d.way?.selected !== 'physical_workshop' || !!d.way?.address?.trim()));
    if ('ids' in value) return !!value.type && Array.isArray(value.ids) && value.ids.length > 0;
    return Object.keys(value).length > 0;
  }
  return true;
}
export function offerRequirementsAreComplete(requirements: MissingOfferRequirements, draft: OfferRequirementDraft): boolean {
  return requirements.scopes.every(req => draft.offer_scopes.some(s => s.project_service_id === req.project_service_id && !!s.scope.trim())) &&
    draft.offer_scopes.every(s => !!s.scope.trim() && s.scope.trim().length <= 255 && (s.description?.length ?? 0) <= 5000 &&
      (s.subscopes ?? []).every(child => !!child.scope.trim() && child.scope.trim().length <= 255 && (child.description?.length ?? 0) <= 5000)) &&
    [...requirements.project_components, ...requirements.service_components].every(req => draft.offer_components.some(c =>
      c.component_id === req.component_id && c.project_service_id === req.project_service_id && requirementValueIsFilled(c.value)));
}
