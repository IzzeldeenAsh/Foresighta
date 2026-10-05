import { Component, Input, OnChanges } from '@angular/core';

// Compact project schedule shown under project titles.
@Component({
  selector: 'app-project-dates',
  template: `
    <div class="tl" *ngIf="startDate || endDate" [attr.title]="durationLabel || null">
      <div class="side" *ngIf="startDate">
        <span class="label">{{ actualStart ? (ar ? 'تاريخ البدء الفعلي' : 'Actual start date') : (ar ? 'تاريخ البدء المتوقع' : 'Expected start date') }}</span>
        <span class="pill pill--start"><i class="ki-outline ki-calendar"></i>{{ format(startDate) }}</span>
      </div>

      <div class="rail" *ngIf="startDate && endDate">
        <span class="duration" *ngIf="durationLabel">{{ durationLabel }}</span>
        <span class="fill" [style.width.%]="progress"></span>
        <span class="node node--start"></span>
        <span class="node node--end"></span>
      </div>

      <div class="side" *ngIf="endDate">
        <span class="label">{{ actualEnd ? (ar ? 'تاريخ الإغلاق الفعلي' : 'Actual close date') : (ar ? 'تاريخ الإغلاق المتوقع' : 'Expected close date') }}</span>
        <span class="pill pill--end"><i class="ki-outline ki-calendar"></i>{{ format(endDate) }}</span>
      </div>
    </div>`,
  styles: [`
    :host{display:block;flex:1 1 100%;min-width:0;margin-top:4px;padding-top:16px;border-top:1px solid #eaecf0;container-type:inline-size}
    .tl{display:flex;align-items:flex-end;gap:14px;max-width:100%}
    .side{display:flex;flex-direction:column;gap:6px;flex-shrink:0}
    .label{font-size:12px;font-weight:500;color:#667085;padding-inline-start:4px}
    .pill{display:inline-flex;align-items:center;gap:8px;height:34px;padding:0 14px;border-radius:999px;font-size:13px;font-weight:600;color:#0b1220;white-space:nowrap}
    .pill i{font-size:16px}
    .pill--start{background:#e7f6ee}.pill--start i{color:#12a150}
    .pill--end{background:#eaf1fe}.pill--end i{color:#2f6fed}
    .rail{position:relative;flex:1 1 auto;width:150px;min-width:65px;height:3px;margin:0 5px 15.5px;border-radius:999px;background:#d0d5dd}
    .duration{position:absolute;bottom:12px;inset-inline:0;text-align:center;white-space:nowrap;font-size:12px;font-weight:600;color:#667085}
    .fill{position:absolute;inset-block:0;inset-inline-start:0;border-radius:999px;background:#12a150}
    .node{position:absolute;top:50%;width:10px;height:10px;margin-top:-5px;margin-inline-start:-5px;border-radius:50%}
    .node--start{inset-inline-start:0;background:#12a150}
    .node--end{inset-inline-start:100%;background:#2f6fed}
    @container (max-width:400px){.tl{gap:8px}.pill{gap:6px;height:30px;padding:0 10px;font-size:12px}.pill i{font-size:14px}.label{font-size:11px}.rail{margin-bottom:13.5px}}
    @container (max-width:340px){.tl{flex-wrap:wrap;row-gap:10px}.rail{flex:1 1 100%;order:3;margin:28px 5px 5px}.tl{justify-content:space-between}.side{flex-shrink:1}.label{padding-inline-start:0}}
  `],
})
export class ProjectDatesComponent implements OnChanges {
  @Input() startDate: string | null | undefined;
  @Input() endDate: string | null | undefined;
  @Input() durationDays: number | null | undefined;
  @Input() lang = 'en';
  @Input() actualStart = false;
  @Input() actualEnd = false;
  get ar(): boolean { return this.lang === 'ar'; }

  private parse(value: string | null | undefined): Date | null {
    if (!value) return null;
    const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00` : value);
    return isNaN(date.getTime()) ? null : date;
  }
  format(value: string | null | undefined): string {
    const date = this.parse(value);
    if (!date) return value || '';
    if (this.ar) return date.toLocaleDateString('ar-u-nu-latn', { day: '2-digit', month: 'short', year: 'numeric' });
    return `${String(date.getDate()).padStart(2, '0')} ${date.toLocaleDateString('en-US', { month: 'short' })} ${date.getFullYear()}`;
  }
  private get range(): [Date, Date] | null {
    const start = this.parse(this.startDate), end = this.parse(this.endDate);
    return start && end && end > start ? [start, end] : null;
  }
  get durationLabel(): string {
    const range = this.range;
    const days = this.durationDays ?? (range ? Math.round((range[1].getTime() - range[0].getTime()) / 86400000) : null);
    if (days === null || !Number.isFinite(days) || days < 0) return '';
    return this.ar ? `${days} يوم` : `${days} ${days === 1 ? 'day' : 'days'}`;
  }
  // Share of the start → deadline window that has already elapsed. Computed on input
  // changes, not in a getter: Date.now() differs between change-detection passes (NG0100).
  progress = 0;
  ngOnChanges(): void {
    const range = this.range;
    if (!range) { this.progress = 0; return; }
    const [start, end] = range;
    this.progress = Math.min(100, Math.max(0, ((Date.now() - start.getTime()) / (end.getTime() - start.getTime())) * 100));
  }
}
