/**
 * Project phase-2 shapes shared by the client ("projects created") and
 * insighter ("project offers" / "on work projects") dashboards.
 *
 * - A project owns one or more project services; scopes, service-level
 *   components and deliverables live on the project service.
 * - The schedule is relative: `planned_start_date` + `duration_days`. The
 *   backend returns `planned_close_date` calculated from
 *   `started_at ?? planned_start_date`.
 * - Deliverables and installments carry `period_days` (0 = project start) and a
 *   calculated `date` for display.
 * - Offers are priced hourly, daily or fixed; `proposed_price` is the total.
 */

export type ProjectPriceType = 'hourly' | 'daily' | 'fixed';
export type InstallmentDueType = 'contract' | 'date' | 'deliverable';
export type ProjectPaymentPlan = 'full' | 'partial';
export type DeliverableWay = 'on_platform' | 'session' | 'physical_workshop';

export interface ProjectScheduleFields {
  planned_start_date: string | null;
  duration_days: number | null;
  planned_close_date: string | null;
  started_at: string | null;
  closed_at: string | null;
}

export interface ProjectServiceRef {
  id: number | null;
  name: string;
  slug: string | null;
}

export interface ProjectDeliverable {
  id: number;
  title: string;
  position: number;
  period_days: number;
  /** Calculated planned date (Y-m-d), null until the project has a schedule. */
  date: string | null;
  report_type: string[];
  way: { selected: DeliverableWay | string | null; address: string | null };
  project_service_id: number | null;
  /** Name of the service the deliverable belongs to (for multi-service projects). */
  service_name: string | null;
}

export interface ProjectPhaseScope {
  scope: string | null;
  description?: string | null;
  project_service_id?: number | null;
  have_attachments?: boolean | null;
  files?: any[];
  children?: ProjectPhaseScope[];
  [key: string]: any;
}

export interface ProjectServiceDetails {
  id: number | null;
  uuid: string;
  position: number;
  title: string | null;
  service: ProjectServiceRef | null;
  prompt_ai: string | null;
  scopes: ProjectPhaseScope[];
  components: Array<Record<string, any>>;
  addons: Array<Record<string, any>>;
  deliverables: ProjectDeliverable[];
}

export interface ProjectInstallment {
  id: number | null;
  title: string;
  position: number;
  percentage: number;
  due_type: InstallmentDueType | string;
  period_days: number | null;
  /** Calculated planned date (Y-m-d). */
  date: string | null;
  project_service_deliverable_id: number | null;
  deliverable: { id: number; title: string; period_days: number | null; date: string | null } | null;
  /** Order installments only. */
  amount: number | null;
  status: string | null;
  paid_at: string | null;
}

export interface ProjectOfferPricing {
  price_type: ProjectPriceType;
  proposed_price: number | null;
  hourly_rate: number | null;
  estimated_hours: number | null;
  daily_rate: number | null;
  estimated_days: number | null;
  fixed_price: number | null;
  payment_plan: ProjectPaymentPlan | string | null;
  installments: ProjectInstallment[];
}

/** Array.prototype.flatMap is unavailable at this TS lib target. */
export function flatMapList<T, R>(list: T[], fn: (item: T) => R[]): R[] {
  return list.reduce<R[]>((acc, item) => acc.concat(fn(item)), []);
}

function toNumberOrNull(value: any): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function toStringOrNull(value: any): string | null {
  if (value === null || value === undefined) return null;
  const text = `${value}`.trim();
  return text ? text : null;
}

function dateOnly(value: any): string | null {
  const text = toStringOrNull(value);
  return text ? text.slice(0, 10) : null;
}

export function mapProjectSchedule(project: any): ProjectScheduleFields {
  return {
    planned_start_date: dateOnly(project?.planned_start_date),
    duration_days: toNumberOrNull(project?.duration_days),
    planned_close_date: dateOnly(project?.planned_close_date),
    started_at: toStringOrNull(project?.started_at),
    closed_at: toStringOrNull(project?.closed_at),
  };
}

function mapServiceRef(service: any): ProjectServiceRef | null {
  if (!service || typeof service !== 'object') return null;
  return {
    id: toNumberOrNull(service.id),
    name: toStringOrNull(service.name) ?? '',
    slug: toStringOrNull(service.slug),
  };
}

export function mapDeliverable(raw: any, serviceName: string | null = null): ProjectDeliverable | null {
  if (!raw || typeof raw !== 'object') return null;
  const id = toNumberOrNull(raw.id);
  if (id === null) return null;

  return {
    id,
    title: toStringOrNull(raw.title) ?? '',
    position: toNumberOrNull(raw.position) ?? 0,
    period_days: toNumberOrNull(raw.period_days) ?? 0,
    date: dateOnly(raw.calculated_date ?? raw.date),
    report_type: Array.isArray(raw.report_type)
      ? raw.report_type.map((type: any) => `${type}`.toLowerCase()).filter(Boolean)
      : [],
    way: {
      selected: toStringOrNull(raw.way?.selected),
      address: toStringOrNull(raw.way?.address),
    },
    project_service_id: toNumberOrNull(raw.project_service_id),
    service_name: serviceName,
  };
}

/** Service components arrive as `[{slug: value}, …]`, except deliverables (`{'deliverable-stage': {deliverables}}`). */
function extractDeliverables(components: any, serviceName: string | null, serviceId: number | null) {
  if (!Array.isArray(components)) return [];

  return flatMapList<any, any>(components, (block: any) => block?.['deliverable-stage']?.deliverables ?? [])
    .map((raw: any) => mapDeliverable(raw, serviceName))
    .filter((item: ProjectDeliverable | null): item is ProjectDeliverable => !!item)
    .map((item: ProjectDeliverable) => ({
      ...item,
      project_service_id: item.project_service_id ?? serviceId,
    }));
}

export function mapProjectServices(list: any): ProjectServiceDetails[] {
  if (!Array.isArray(list)) return [];

  return list
    .filter(item => item && typeof item === 'object')
    .map(item => {
      const service = mapServiceRef(item.service);
      const serviceName = toStringOrNull(item.title) ?? service?.name ?? null;
      const id = toNumberOrNull(item.id);
      const components = Array.isArray(item.components)
        ? item.components.filter((block: any) => block && typeof block === 'object' && !block['deliverable-stage'])
        : [];

      return {
        id,
        uuid: toStringOrNull(item.uuid) ?? '',
        position: toNumberOrNull(item.position) ?? 0,
        title: toStringOrNull(item.title),
        service,
        prompt_ai: toStringOrNull(item.prompt_ai),
        scopes: Array.isArray(item.scopes) ? item.scopes : [],
        components,
        addons: Array.isArray(item.addons) ? item.addons : [],
        deliverables: extractDeliverables(item.components, serviceName, id),
      };
    })
    .sort((a, b) => a.position - b.position);
}

/** All deliverables across services, ordered by their planned day. */
export function flattenDeliverables(services: ProjectServiceDetails[]): ProjectDeliverable[] {
  return flatMapList(services, service => service.deliverables)
    .sort((a, b) => a.period_days - b.period_days || a.position - b.position);
}

/** Scopes across services (each scope keeps its project_service_id). */
export function flattenScopes(services: ProjectServiceDetails[]): ProjectPhaseScope[] {
  return flatMapList(services, service => service.scopes);
}

/** Service-level components merged with project-level ones, for `getComponent(slug)` lookups. */
export function mergeComponents(projectComponents: any, services: ProjectServiceDetails[]) {
  const base = Array.isArray(projectComponents) ? projectComponents : [];
  return [...base, ...flatMapList(services, service => service.components)];
}

export function mapInstallment(raw: any): ProjectInstallment | null {
  if (!raw || typeof raw !== 'object') return null;
  const deliverable = raw.deliverable && typeof raw.deliverable === 'object' ? raw.deliverable : null;

  return {
    id: toNumberOrNull(raw.id),
    title: toStringOrNull(raw.title) ?? '',
    position: toNumberOrNull(raw.position) ?? 0,
    percentage: toNumberOrNull(raw.percentage) ?? 0,
    due_type: toStringOrNull(raw.due_type) ?? 'date',
    period_days: toNumberOrNull(raw.period_days),
    date: dateOnly(raw.calculated_date ?? raw.date),
    project_service_deliverable_id: toNumberOrNull(raw.project_service_deliverable_id),
    deliverable: deliverable
      ? {
          id: toNumberOrNull(deliverable.id) ?? 0,
          title: toStringOrNull(deliverable.title) ?? '',
          period_days: toNumberOrNull(deliverable.period_days),
          date: dateOnly(deliverable.calculated_date ?? deliverable.date),
        }
      : null,
    amount: toNumberOrNull(raw.amount),
    status: toStringOrNull(raw.status),
    paid_at: toStringOrNull(raw.paid_at),
  };
}

export function mapInstallments(list: any): ProjectInstallment[] {
  if (!Array.isArray(list)) return [];
  return list
    .map(mapInstallment)
    .filter((item): item is ProjectInstallment => !!item)
    .sort((a, b) => a.position - b.position);
}

export function mapOfferPricing(offer: any): ProjectOfferPricing {
  const priceType = toStringOrNull(offer?.price_type);
  return {
    price_type: priceType === 'daily' || priceType === 'fixed' ? priceType : 'hourly',
    proposed_price: toNumberOrNull(offer?.proposed_price),
    hourly_rate: toNumberOrNull(offer?.hourly_rate),
    estimated_hours: toNumberOrNull(offer?.estimated_hours),
    daily_rate: toNumberOrNull(offer?.daily_rate),
    estimated_days: toNumberOrNull(offer?.estimated_days),
    fixed_price: toNumberOrNull(offer?.fixed_price),
    payment_plan: toStringOrNull(offer?.payment_plan),
    installments: mapInstallments(offer?.installments),
  };
}

/** Adds whole days to a Y-m-d date (local calendar), returning Y-m-d. */
export function addDaysToDate(value: string | null | undefined, days: number): string | null {
  if (!value) return null;
  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  if (!year || !month || !day) return null;
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + days);
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${mm}-${dd}`;
}

/** Schedule base: the real start once the contract is signed, otherwise the planned start. */
export function scheduleBaseDate(schedule: ProjectScheduleFields): string | null {
  return dateOnly(schedule.started_at) ?? schedule.planned_start_date;
}

export function priceTypeLabel(type: string | null | undefined, lang: string): string {
  const labels: Record<string, { en: string; ar: string }> = {
    hourly: { en: 'Hourly', ar: 'بالساعة' },
    daily: { en: 'Daily', ar: 'باليوم' },
    fixed: { en: 'Fixed price', ar: 'سعر ثابت' },
  };
  const label = labels[type || ''];
  if (!label) return type || '-';
  return lang === 'ar' ? label.ar : label.en;
}

export function dueTypeLabel(type: string | null | undefined, lang: string): string {
  const labels: Record<string, { en: string; ar: string }> = {
    contract: { en: 'On contract signing', ar: 'عند توقيع العقد' },
    date: { en: 'After a duration', ar: 'بعد مدة من بدء المشروع' },
    deliverable: { en: 'On a deliverable', ar: 'عند تسليم مخرج' },
  };
  const label = labels[type || ''];
  if (!label) return type || '-';
  return lang === 'ar' ? label.ar : label.en;
}

export function periodDaysLabel(days: number | null | undefined, lang: string): string {
  if (days === null || days === undefined) return '-';
  if (lang === 'ar') {
    if (days === 0) return 'يوم البدء';
    if (days === 1) return 'بعد يوم من البدء';
    if (days === 2) return 'بعد يومين من البدء';
    return days <= 10 ? `بعد ${days} أيام من البدء` : `بعد ${days} يومًا من البدء`;
  }
  if (days === 0) return 'Start day';
  return days === 1 ? '1 day after start' : `${days} days after start`;
}

export function deliverableWayLabel(way: string | null | undefined, lang: string): string {
  const labels: Record<string, { en: string; ar: string }> = {
    on_platform: { en: 'On platform', ar: 'على المنصة' },
    session: { en: 'Session', ar: 'جلسة' },
    physical_workshop: { en: 'Physical workshop', ar: 'ورشة حضورية' },
  };
  const label = labels[way || ''];
  if (!label) return way || '-';
  return lang === 'ar' ? label.ar : label.en;
}

function money(value: number | null): string {
  if (value === null) return '-';
  return value.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });
}

/** One-line pricing basis, e.g. "10 hrs × $100.00/hr", "5 days × $250.00/day" or "Fixed price". */
export function offerPricingSummary(offer: any, lang: string): string {
  const pricing = mapOfferPricing(offer);
  const ar = lang === 'ar';

  if (pricing.price_type === 'fixed') {
    return ar ? 'سعر ثابت' : 'Fixed price';
  }

  if (pricing.price_type === 'daily') {
    const days = pricing.estimated_days ?? 0;
    return ar
      ? `${days} يوم × ${money(pricing.daily_rate)}/يوم`
      : `${days} ${days === 1 ? 'day' : 'days'} × ${money(pricing.daily_rate)}/day`;
  }

  const hours = pricing.estimated_hours ?? 0;
  return ar
    ? `${hours} ساعة × ${money(pricing.hourly_rate)}/ساعة`
    : `${hours} hrs × ${money(pricing.hourly_rate)}/hr`;
}
