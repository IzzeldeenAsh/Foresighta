export type InstallmentDueType = 'contract' | 'date' | 'deliverable';
export interface OfferInstallment {
  id?: number;
  position?: number;
  title: string;
  percentage: number | string;
  due_type: InstallmentDueType;
  due_date?: string | null;
  project_service_deliverable_id?: number | null;
  deliverable?: { id: number; title: string; project_service_id?: number } | null;
}
export interface ProjectDeliverable {
  id: number;
  title: string;
  position: number;
  project_service_id?: number;
  service_title?: string;
  date: string | null;
  report_type: string[];
  way: { selected?: string | null; address?: string | null };
}
export interface ProjectServiceDetails {
  id: number;
  uuid?: string;
  position: number;
  title: string;
  service?: { id: number; name: string; slug: string } | null;
  prompt_ai?: string | null;
  scopes: any[];
  components: Record<string, any>[];
  addons: Record<string, any>[];
  deliverables: ProjectDeliverable[];
}
export function calendarDate(value: string | null | undefined): string {
  return value?.match(/^\d{4}-\d{2}-\d{2}/)?.[0] ?? '';
}
export function mapProjectServices(value: any): ProjectServiceDetails[] {
  return (Array.isArray(value) ? value : []).map(service => ({
    ...service,
    scopes: Array.isArray(service.scopes) ? service.scopes : [],
    components: Array.isArray(service.components) ? service.components : [],
    addons: Array.isArray(service.addons) ? service.addons : [],
    deliverables: (service.components ?? []).flatMap((block: any) => block?.['deliverable-stage']?.deliverables ?? [])
      .map((item: any) => ({ ...item, project_service_id: service.id, service_title: service.title || service.service?.name,
        date: calendarDate(item.date), report_type: item.report_type ?? [], way: item.way ?? {} }))
      .sort((a: ProjectDeliverable, b: ProjectDeliverable) => a.position - b.position),
  })).sort((a, b) => a.position - b.position);
}
export function contractFirst(rows: OfferInstallment[]): OfferInstallment[] {
  return [...rows.filter(row => row.due_type === 'contract'), ...rows.filter(row => row.due_type !== 'contract')];
}
export function installmentTotal(rows: OfferInstallment[]): number {
  return Math.round(rows.reduce((sum, row) => sum + Number(row.percentage), 0) * 10000) / 10000;
}
export function validCalendarDate(value: string | null | undefined): boolean {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
export function validInstallments(rows: OfferInstallment[], deliverables: ProjectDeliverable[]): boolean {
  return rows.length >= 2 && installmentTotal(rows) === 100
    && rows.filter(row => row.due_type === 'contract').length <= 1
    && rows.every(row => row.title.trim().length > 0 && row.title.trim().length <= 255
      && Number.isFinite(Number(row.percentage)) && Number(row.percentage) >= 1 && Number(row.percentage) <= 100
      && (row.due_type === 'contract'
        || (row.due_type === 'date' && validCalendarDate(row.due_date))
        || (row.due_type === 'deliverable' && deliverables.some(item => item.id === Number(row.project_service_deliverable_id)))));
}
export function appendInstallments(data: FormData, rows: OfferInstallment[]): void {
  contractFirst(rows).forEach((row, index) => {
    const key = `installments[${index}]`;
    data.append(`${key}[title]`, row.title.trim());
    data.append(`${key}[percentage]`, String(row.percentage));
    data.append(`${key}[due_type]`, row.due_type);
    if (row.due_type === 'date') data.append(`${key}[due_date]`, row.due_date!);
    if (row.due_type === 'deliverable') data.append(`${key}[project_service_deliverable_id]`, String(row.project_service_deliverable_id));
  });
}
export const PROJECT_FILE_ACCEPT = '.pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx,.csv,.txt,.ppt,.pptx,.odt';
export function validProjectFile(file: { name: string; size: number }): boolean {
  return file.size <= 50 * 1024 * 1024 && PROJECT_FILE_ACCEPT.split(',').includes('.' + file.name.split('.').pop()?.toLowerCase());
}
export function canRespondToProposal(offer: any, now = Date.now()): boolean {
  const deadline = offer?.project?.deadline_offer;
  const timestamp = deadline ? Date.parse(deadline.replace(' ', 'T')) : null;
  return !!offer && offer.stage !== 'project'
    && !['cancelled', 'closed', 'expired', 'contracting', 'payment', 'scheduled', 'in_progress', 'in_review'].includes(offer.project_status ?? offer.project?.status)
    && !['cancelled', 'expired', 'closed'].includes(offer.proposal_status)
    && (!deadline || (Number.isFinite(timestamp) && timestamp! > now))
    && ['pending', 'viewed', 'interested'].includes(offer.action_status);
}

export interface OfferTimelinePreviewStep {
  kind: 'deliverable' | 'payment';
  title: string;
  id?: number;
  position?: number;
  date?: string | null;
  installment?: OfferInstallment;
}
/** Mirrors the server's work-step ordering; the saved timeline remains authoritative. */
export function offerTimelinePreview(deliverables: ProjectDeliverable[], rows: OfferInstallment[]): OfferTimelinePreviewStep[] {
  const work: OfferTimelinePreviewStep[] = [...deliverables]
    .sort((a, b) => (a.project_service_id ?? 0) - (b.project_service_id ?? 0) || a.position - b.position)
    .map(item => ({ kind: 'deliverable', title: item.title, id: item.id, date: item.date }));
  const group = (row: OfferInstallment): number => {
    if (row.due_type === 'contract') return -10;
    if (row.due_type === 'deliverable') {
      const index = work.findIndex(item => item.id === Number(row.project_service_deliverable_id));
      return index < 0 ? Number.MAX_SAFE_INTEGER : (index + 1) * 10 + 1;
    }
    const index = work.findIndex(item => !!row.due_date && !!item.date && item.date >= row.due_date);
    return index < 0 ? work.length * 10 : index * 10;
  };
  const payments = contractFirst(rows).map((installment, index) => ({ installment, position: index + 1 }))
    .sort((a, b) => group(a.installment) - group(b.installment)
      || (a.installment.due_date || '9999').localeCompare(b.installment.due_date || '9999') || a.position - b.position);
  const result = [...work];
  for (const { installment, position } of payments) {
    let index = result.length;
    if (installment.due_type === 'contract') index = 0;
    else if (installment.due_type === 'deliverable') {
      const linked = result.findIndex(item => item.kind === 'deliverable' && item.id === Number(installment.project_service_deliverable_id));
      if (linked >= 0) {
        index = linked + 1;
      }
    } else {
      const next = result.findIndex(item => item.kind === 'deliverable' && !!item.date && !!installment.due_date && item.date >= installment.due_date);
      if (next >= 0) index = next;
    }
    result.splice(index, 0, { kind: 'payment', title: installment.title, position, installment, date: installment.due_date });
  }
  return result;
}
