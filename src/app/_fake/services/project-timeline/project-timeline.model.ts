/**
 * Shared model for the API-driven project timeline used on both the client
 * ("projects created") and insighter ("on work projects") sides.
 *
 * Backend source of truth:
 *  - Client:    GET {apiBaseUrl}/account/project/timeline/{uuid}
 *  - Insighter: GET {apiBaseUrl}/insighter/project/timeline/{uuid}
 *
 * Each step carries a fixed `key` (the behavioral contract), a `display` flag
 * (render or not), a `state` (progress bucket) and a `status` (granular state).
 */

/**
 * Step keys returned by the timeline API. Phase 2 replaced the fixed draft and
 * payment steps with one step per deliverable (`deliverable_{id}`) and one per
 * order installment (`payment_installment_{position}`); the legacy keys are
 * kept for older payloads.
 */
export const TIMELINE_STEP = {
  CONTRACTING: 'contracting',
  AWARDED_INSIGHTER: 'awarded_insighter',
  CLIENT_INFO: 'client_info',
  DOWN_PAYMENT: 'down_payment',
  FULL_PAYMENT_AT_START: 'full_payment_at_start',
  FIRST_DRAFT: 'first_draft',
  FINAL_DRAFT: 'final_draft',
  FINAL_PAYMENT: 'final_payment',
  FULL_PAYMENT_AT_END: 'full_payment_at_end',
  CLOSED_PROJECT: 'closed_project',
  CANCELLED_PROJECT: 'cancelled_project',
} as const;

export const DELIVERABLE_STEP_PREFIX = 'deliverable_';
export const INSTALLMENT_STEP_PREFIX = 'payment_installment_';

export type TimelineStepKey =
  | typeof TIMELINE_STEP[keyof typeof TIMELINE_STEP]
  | string;

/** High-level progress bucket assigned by the backend. */
export type TimelineStepState = 'completed' | 'in_progress' | 'locked' | null;

export type TimelineAudience = 'client' | 'insighter';

/** Actions a timeline step can request from its host component. */
export type TimelineActionType =
  | 'view_contract'
  | 'view_offer'
  | 'pay'
  | 'open_review'
  | 'view_reviews'
  | 'close_project';

export interface TimelineParty {
  uuid: string | null;
  name: string | null;
  legal_name: string | null;
  avatar: string | null;
  image?: string | null;
}

export interface ProjectTimelineStep {
  key: TimelineStepKey;
  step_no: number | null;
  title: string | null;
  display: boolean;
  status: string | null;
  state: TimelineStepState;
  amount: number | null;
  date: string | null;
  party: TimelineParty | null;
  meta: Record<string, any> | any[];
}

export interface ProjectTimeline {
  audience: TimelineAudience;
  project_uuid: string;
  steps: ProjectTimelineStep[];
}

/** Event emitted by the timeline component when a step's action is triggered. */
export interface TimelineStepActionEvent {
  key: TimelineStepKey;
  action: TimelineActionType;
  step: ProjectTimelineStep;
}

/** Payment steps — the only steps allowed to render an amount. */
export const PAYMENT_STEP_KEYS: TimelineStepKey[] = [
  TIMELINE_STEP.DOWN_PAYMENT,
  TIMELINE_STEP.FULL_PAYMENT_AT_START,
  TIMELINE_STEP.FINAL_PAYMENT,
  TIMELINE_STEP.FULL_PAYMENT_AT_END,
];

/** Draft/review steps — clickable on both audiences (open the reviews tab). */
export const DRAFT_STEP_KEYS: TimelineStepKey[] = [
  TIMELINE_STEP.FIRST_DRAFT,
  TIMELINE_STEP.FINAL_DRAFT,
];

/** Party steps — render the awarded insighter / client identity. */
export const PARTY_STEP_KEYS: TimelineStepKey[] = [
  TIMELINE_STEP.AWARDED_INSIGHTER,
  TIMELINE_STEP.CLIENT_INFO,
];

export function isInstallmentStep(key: TimelineStepKey): boolean {
  return `${key || ''}`.startsWith(INSTALLMENT_STEP_PREFIX);
}

export function isDeliverableStep(key: TimelineStepKey): boolean {
  return `${key || ''}`.startsWith(DELIVERABLE_STEP_PREFIX);
}

/** Deliverable id carried by a `deliverable_{id}` step (meta first, key as fallback). */
export function deliverableIdFromStep(step: ProjectTimelineStep | null | undefined): number | null {
  if (!step || !isDeliverableStep(step.key)) return null;
  const meta = step.meta as Record<string, any>;
  const fromMeta = Number(meta?.['project_service_deliverable_id'] ?? meta?.['deliverable_id']);
  if (Number.isFinite(fromMeta) && fromMeta > 0) return fromMeta;
  const fromKey = Number(`${step.key}`.slice(DELIVERABLE_STEP_PREFIX.length));
  return Number.isFinite(fromKey) && fromKey > 0 ? fromKey : null;
}

/** Order installment id carried by a `payment_installment_{n}` step. */
export function orderInstallmentIdFromStep(step: ProjectTimelineStep | null | undefined): number | null {
  if (!step || !isInstallmentStep(step.key)) return null;
  const id = Number((step.meta as Record<string, any>)?.['order_installment_id']);
  return Number.isFinite(id) && id > 0 ? id : null;
}

export function isPaymentStep(key: TimelineStepKey): boolean {
  return PAYMENT_STEP_KEYS.includes(key) || isInstallmentStep(key);
}

export function isDraftStep(key: TimelineStepKey): boolean {
  return DRAFT_STEP_KEYS.includes(key) || isDeliverableStep(key);
}

export function isPartyStep(key: TimelineStepKey): boolean {
  return PARTY_STEP_KEYS.includes(key);
}
