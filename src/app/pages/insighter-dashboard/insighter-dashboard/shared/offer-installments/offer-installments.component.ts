import { Component, Input } from '@angular/core';
import { OfferInstallment, ProjectDeliverable } from 'src/app/_fake/services/project-offers/project-workflow';
@Component({
  selector: 'app-offer-installments',
  template: `<section *ngIf="rows.length"><h4>{{ ar ? 'جدول دفعات العميل' : 'Client payment schedule' }}</h4>
    <div class="scroll"><table><thead><tr><th>#</th><th>{{ ar ? 'الدفعة' : 'Payment' }}</th><th>%</th><th>{{ ar ? 'المبلغ' : 'Amount' }}</th><th>{{ ar ? 'الاستحقاق' : 'Due condition' }}</th></tr></thead>
    <tbody><tr *ngFor="let row of rows; let i = index"><td>{{ row.position || i + 1 }}</td><td>{{ row.title }}</td><td>{{ row.percentage }}</td><td>{{ amount(row) | currency:'USD' }}</td><td>{{ dueLabel(row) }}</td></tr></tbody></table></div>
    <p>{{ ar ? 'المبالغ المعروضة هي دفعات العميل وليست صافي أرباح الخبير.' : 'Amounts shown are client payments, before any deductions from insighter earnings.' }}</p></section>`,
  styles: [`section{margin:20px 0}h4{font-size:16px}.scroll{overflow:auto}table{width:100%;font-size:13px}th,td{text-align:start;padding:12px 8px;border-bottom:1px solid #e7edf3}th,p{color:#63758a}p{font-size:12px;margin-top:10px}`],
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
    if (row.due_type === 'date') return row.due_date || (this.ar ? 'بعد المخرجات في الجدول' : 'After deliverables in the timeline');
    const title = row.deliverable?.title || this.deliverables.find(item => item.id === row.project_service_deliverable_id)?.title || `#${row.project_service_deliverable_id}`;
    return this.ar ? `بعد اعتماد ${title}` : `After approval: ${title}`;
  }
}
