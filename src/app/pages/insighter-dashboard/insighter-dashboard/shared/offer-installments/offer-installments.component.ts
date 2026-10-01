import { Component, Input } from '@angular/core';
import {
  ProjectInstallment,
  periodDaysLabel,
} from 'src/app/_fake/services/project-phase2/project-phase2.model';

/**
 * Read-only payment schedule for an offer or an order. Offer installments
 * carry a percentage only (amount = total × percentage); order installments
 * carry their own amount and payment status.
 */
@Component({
  selector: 'app-offer-installments',
  templateUrl: './offer-installments.component.html',
  styleUrls: ['./offer-installments.component.scss'],
})
export class OfferInstallmentsComponent {
  @Input() installments: ProjectInstallment[] = [];
  /** Offer total, used when installments have no amount of their own. */
  @Input() total: number | string | null = null;
  @Input() lang: 'en' | 'ar' | string = 'en';
  @Input() showStatus = false;

  amountFor(item: ProjectInstallment): number | null {
    if (item.amount !== null) return item.amount;
    const total = Number(this.total);
    if (!isFinite(total) || total <= 0) return null;
    return Number(((total * item.percentage) / 100).toFixed(2));
  }

  dueLabel(item: ProjectInstallment): string {
    const ar = this.lang === 'ar';
    if (item.due_type === 'contract') return ar ? 'عند توقيع العقد' : 'On contract signing';
    if (item.due_type === 'deliverable') {
      const title = item.deliverable?.title;
      if (title) return ar ? `عند تسليم «${title}»` : `On delivery of “${title}”`;
      return ar ? 'عند تسليم مخرج' : 'On a deliverable';
    }
    return periodDaysLabel(item.period_days, this.lang);
  }

  statusLabel(status: string | null): string {
    const labels: Record<string, { en: string; ar: string }> = {
      unpaid: { en: 'Unpaid', ar: 'غير مدفوعة' },
      pending: { en: 'Processing', ar: 'قيد المعالجة' },
      paid: { en: 'Paid', ar: 'مدفوعة' },
      failed: { en: 'Failed', ar: 'فشلت' },
      refunded: { en: 'Refunded', ar: 'مستردة' },
    };
    const label = labels[status || ''];
    if (!label) return status || '';
    return this.lang === 'ar' ? label.ar : label.en;
  }

  statusClass(status: string | null): string {
    switch (status) {
      case 'paid': return 'badge-light-success';
      case 'pending': return 'badge-light-warning';
      case 'failed': return 'badge-light-danger';
      case 'refunded': return 'badge-light-info';
      default: return 'badge-light';
    }
  }

  formatPrice(value: number | null): string {
    if (value === null) return '-';
    return value.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
  }

  formatDate(value: string | null): string {
    if (!value) return '';
    const [year, month, day] = value.slice(0, 10).split('-').map(Number);
    if (!year || !month || !day) return value;
    return new Date(year, month - 1, day).toLocaleDateString(this.lang === 'ar' ? 'ar-EG' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }

  trackByPosition(_: number, item: ProjectInstallment): string {
    return `${item.id ?? ''}-${item.position}`;
  }
}
