import { Component, Input } from '@angular/core';
import { OfferInstallment, ProjectDeliverable, offerTimelinePreview } from 'src/app/_fake/services/project-offers/project-workflow';
@Component({
  selector: 'app-offer-installments',
  template: `<section *ngIf="rows.length"><h4>{{ ar ? 'جدول دفعات العميل' : 'Client payment schedule' }}</h4>
    <div class="table-wrap"><table><thead><tr><th>#</th><th>{{ ar ? 'الدفعة' : 'Payment' }}</th><th>%</th><th>{{ ar ? 'المبلغ' : 'Amount' }}</th><th>{{ ar ? 'الاستحقاق' : 'Due condition' }}</th></tr></thead>
    <tbody><tr *ngFor="let row of rows; let i = index"><td class="muted">{{ row.position || i + 1 }}</td><td class="strong">{{ row.title }}</td><td>{{ row.percentage | number:'1.0-2' }}%</td><td class="strong">{{ amount(row) | currency:'USD' }}</td><td class="due">{{ dueLabel(row) }}</td></tr></tbody></table></div>
    <p>{{ ar ? 'المبالغ المعروضة هي دفعات العميل وليست صافي أرباح الخبير.' : 'Amounts shown are client payments, before any deductions from insighter earnings.' }}</p></section>`,
  styles: [`:host{display:block}section{margin:20px 0;border:1px solid #e5e7eb;border-radius:8px;background:#fff;overflow:hidden}h4{margin:0;padding:16px 22px;border-bottom:1px solid #e5e7eb;color:#111827;font-size:15px;font-weight:700}.table-wrap{overflow-x:auto}table{width:100%;border-collapse:collapse;font-size:13px}th,td{text-align:start;padding:12px 14px;border-bottom:1px solid #eef1f5;vertical-align:top;white-space:nowrap}th:first-child,td:first-child{padding-inline-start:22px}th:last-child,td:last-child{padding-inline-end:22px}th{background:#f9fafb;color:#667085;font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase}td{color:#344054}td.strong{color:#111827;font-weight:600}td.muted{color:#98a2b3}td.due{min-width:200px;white-space:normal}tbody tr:last-child td{border-bottom:0}p{margin:0;padding:12px 22px;border-top:1px solid #eef1f5;background:#f9fafb;color:#667085;font-size:12px}`],
})
export class OfferInstallmentsComponent {
  @Input() rows: OfferInstallment[] = [];
  @Input() price: string | number | null = null;
  @Input() deliverables: ProjectDeliverable[] = [];
  @Input() lang = 'en';
  get ar(): boolean { return this.lang === 'ar'; }
  amount(row: OfferInstallment): number { return Number(this.price || 0) * Number(row.percentage) / 100; }
  dueLabel(row: OfferInstallment): string {
    if (row.due_type === 'contract') return this.ar ? 'عند توقيع العقد' : 'On contract signing';
    if (row.due_type === 'date' && row.due_date) return row.due_date;
    if (row.due_type === 'date') {
      // Undated rows (the API's full-payment row) sit after the last deliverable in the timeline.
      const last = offerTimelinePreview(this.deliverables, []).slice(-1)[0]?.title;
      if (this.ar) return last ? `بعد المخرج الأخير: ${last}` : 'بعد المخرج الأخير';
      return last ? `After the final deliverable: ${last}` : 'After the final deliverable';
    }
    const title = row.deliverable?.title || this.deliverables.find(item => item.id === row.project_service_deliverable_id)?.title || `#${row.project_service_deliverable_id}`;
    return this.ar ? `بعد اعتماد ${title}` : `After approval: ${title}`;
  }
}
