import { Component, EventEmitter, Input, Output } from '@angular/core';
import { ProjectDeliverable, ProjectServiceDetails, periodDaysLabel } from 'src/app/_fake/services/project-phase2/project-phase2.model';

// Mirrors the Next.js project wizard review step (ProjectReviewStep / DeliverablesReviewTable).
const REPORT_TYPES: { value: string; icon: string }[] = [
  { value: 'pdf', icon: 'https://res.cloudinary.com/dsiku9ipv/image/upload/v1781525110/pdf_136522_urotaw.png' },
  { value: 'docx', icon: 'https://res.cloudinary.com/dsiku9ipv/image/upload/v1781104177/Microsoft_Office_Word__2025_present_1_sywxfd.png' },
  { value: 'xlsx', icon: 'https://res.cloudinary.com/dsiku9ipv/image/upload/v1781104176/Microsoft_Office_Excel__2025_present_1_scjtip.png' },
  { value: 'pptx', icon: 'https://res.cloudinary.com/dsiku9ipv/image/upload/v1781104175/Microsoft_Office_PowerPoint__2025_present_1_ofrkfx.png' },
];
const METHOD_COLORS: Record<string, [string, string]> = {
  on_platform: ['#E5F5EE', '#0E7A4E'], session: ['#E6F1FA', '#1C6FA8'], physical_workshop: ['#FDF1E3', '#A85A0C'],
};

@Component({
  selector: 'app-project-services',
  template: `
    <section *ngFor="let service of services" class="service-card">
      <header class="service-head"><span>{{ ar ? 'الخدمة' : 'Service' }} {{ service.position }}</span><h3>{{ service.title || service.service?.name }}</h3></header>

      <div *ngIf="service.prompt_ai" class="block">
        <div class="label">{{ ar ? 'وصف الخدمة' : 'Service description' }}</div>
        <p class="prompt">{{ service.prompt_ai }}</p>
      </div>

      <div *ngIf="service.scopes?.length" class="block">
        <div class="label">{{ ar ? 'النطاقات والنطاقات الفرعية' : 'Scopes and sub-scopes' }}</div>
        <div class="scopes">
          <ng-container *ngFor="let scope of service.scopes">
            <div class="scope">
              <strong>{{ scope.scope }}</strong>
              <p *ngIf="scope.description">{{ scope.description }}</p>
              <div *ngIf="scope.files?.length" class="files">
                <button *ngFor="let file of scope.files" type="button" class="file" (click)="openFile.emit(file)"><i class="ki-outline ki-paper-clip"></i>{{ file.name || (ar ? 'مرفق' : 'Attachment') }}</button>
              </div>
            </div>
            <div *ngFor="let child of scope.children" class="child">
              <span>{{ child.scope }}</span>
              <p *ngIf="child.description">{{ child.description }}</p>
              <div *ngIf="child.files?.length" class="files">
                <button *ngFor="let file of child.files" type="button" class="file" (click)="openFile.emit(file)"><i class="ki-outline ki-paper-clip"></i>{{ file.name || (ar ? 'مرفق' : 'Attachment') }}</button>
              </div>
            </div>
          </ng-container>
        </div>
      </div>

      <div class="facts" *ngIf="component(service, 'data-sources-expected') || component(service, 'target-market')">
        <div *ngIf="component(service, 'data-sources-expected') as sources">
          <div class="label">{{ ar ? 'مصادر البيانات' : 'Data sources' }}</div>
          <div class="value">{{ label(sources) }}</div>
        </div>
        <div *ngIf="component(service, 'target-market') as market">
          <div class="label">{{ ar ? 'السوق المستهدف' : 'Target market' }}</div>
          <div class="chips"><span *ngFor="let item of market.objects" class="chip">{{ item.name }}</span></div>
        </div>
      </div>

      <div *ngIf="service.deliverables.length" class="block">
        <div class="label">{{ ar ? 'المخرجات المطلوبة' : 'Required deliverables' }}</div>

        <ol class="dl-timeline">
          <li *ngFor="let item of timeline(service); trackBy: trackDeliverable" class="dl-item">
            <span class="dl-node" aria-hidden="true"></span>
            <div class="dl-body">
              <span class="dl-date">{{ item.date ? formatDate(item.date) : periodLabel(item.period_days) }}</span>
              <strong class="dl-title">{{ deliverableTitle(item) }}</strong>
              <div class="dl-meta">
                <ng-container *ngTemplateOutlet="methodPill; context: { $implicit: item }"></ng-container>
              </div>
              <div class="dl-meta">
                <span class="dl-meta__label">{{ ar ? 'صيغ الملفات:' : 'File formats:' }}</span>
                <ng-container *ngTemplateOutlet="formatChips; context: { $implicit: item }"></ng-container>
              </div>
              <span class="dl-address" *ngIf="item.way?.selected === 'physical_workshop' && item.way?.address"><i class="ki-outline ki-geolocation"></i>{{ item.way?.address }}</span>
            </div>
          </li>
        </ol>
      </div>

      <div *ngIf="service.addons.length" class="block">
        <div class="label">{{ ar ? 'إضافات الخدمة' : 'Service add-ons' }}</div>
        <ng-container *ngFor="let block of service.addons"><div *ngFor="let entry of block | keyvalue" class="addon"><span class="chip">{{ label(entry.key) }}</span><p *ngIf="describe(entry.value)">{{ describe(entry.value) }}</p></div></ng-container>
      </div>
    </section>

    <ng-template #formatChips let-item>
      <span *ngFor="let format of formatsOf(item)" class="format"><img [src]="format.icon" alt="" />{{ format.value.toUpperCase() }}</span>
      <span *ngIf="!formatsOf(item).length" class="muted">—</span>
    </ng-template>
    <ng-template #methodPill let-item>
      <span class="pill" [style.background]="methodColor(item)[0]" [style.color]="methodColor(item)[1]">{{ label(item.way?.selected || 'on_platform') }}</span>
    </ng-template>
`,
  styles: [`
    :host{display:block;container-type:inline-size}
    .service-card{min-width:0}
    .service-card+.service-card{margin-top:28px;padding-top:28px;border-top:1px solid #e2e8f0}
    .service-head span{font-size:12px;font-weight:500;color:#64748b}
    .service-head h3{font-size:18px;font-weight:600;color:#0f172a;margin:4px 0 0}
    .block,.facts{margin-top:22px}
    .label{font-size:12px;font-weight:600;color:#64748b;margin-bottom:8px}
    p{white-space:pre-line;overflow-wrap:anywhere;margin:4px 0 0;font-size:13px;line-height:1.6;color:#64748b}
    .prompt{font-size:14px;color:#1e293b;margin:0}
    .scopes{border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;font-size:14px;background:#fff}
    .scope{background:#fff;padding:12px 16px}
    .scope strong{font-weight:600;color:#0f172a}
    .scopes>*+*{border-top:1px solid #e2e8f0}
    .child{padding:10px 16px;color:#334155;line-height:1.5}
    .files{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}
    .file{display:inline-flex;align-items:center;gap:6px;border:1px solid #e2e8f0;background:#fff;border-radius:8px;padding:4px 10px;font-size:12px;font-weight:500;color:#334155;cursor:pointer}
    .file:hover{border-color:#bae6fd;background:#f0f9ff;color:#0369a1}
    .facts{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:20px 32px}
    .value{font-size:14px;color:#1e293b}
    .chips{display:flex;flex-wrap:wrap;gap:8px}
    .chip{display:inline-flex;border-radius:999px;background:#f0f9ff;color:#0369a1;padding:4px 12px;font-size:12px;font-weight:500}
    .addon+.addon{margin-top:10px}
    .muted{color:#C3C6D4}
    .dl-timeline{list-style:none;margin:0;padding:0}
    .dl-item{position:relative;display:grid;grid-template-columns:12px minmax(0,1fr);column-gap:14px;padding-bottom:20px}
    .dl-item:last-child{padding-bottom:0}
    .dl-item:not(:last-child)::before{content:'';position:absolute;inset-inline-start:5px;top:32px;bottom:-14px;width:2px;border-radius:2px;background:#b3cdfb}
    .dl-node{width:12px;height:12px;margin-top:18px;border-radius:50%;background:#2f6fed}
    .dl-body{min-width:0;padding:14px 16px;border:1px solid #eaecf0;border-radius:10px;background:#fff}
    .dl-date{display:block;font-size:12px;font-weight:600;color:#2f6fed}
    .dl-title{display:block;margin-top:3px;font-size:14px;font-weight:600;color:#0b1220;overflow-wrap:anywhere}
    .dl-meta{display:flex;flex-wrap:wrap;align-items:center;gap:6px;margin-top:10px}
    .dl-meta__label{font-size:12px;font-weight:500;color:#667085}
    .dl-address{display:inline-flex;align-items:center;gap:4px;margin-top:10px;font-size:12px;color:#667085;overflow-wrap:anywhere}
    .format{display:inline-flex;align-items:center;gap:5px;height:24px;padding:0 7px;border:1px solid #e4e7ec;border-radius:6px;background:#fff;font-size:11.5px;font-weight:500;color:#323338}
    .format img{width:14px;height:14px;object-fit:contain}
    .pill{display:inline-flex;align-items:center;height:24px;border-radius:999px;padding:0 10px;font-size:12px;font-weight:500;white-space:nowrap}
    @container (max-width:560px){
      .service-card+.service-card{margin-top:20px;padding-top:20px}
      .block,.facts{margin-top:18px}
      .facts{grid-template-columns:1fr}
      .scope,.child{padding-inline:12px}
      .dl-item{column-gap:10px;padding-bottom:14px}
      .dl-item:not(:last-child)::before{bottom:-8px}
      .dl-node{margin-top:15px}
      .dl-item:not(:last-child)::before{top:29px}
      .dl-body{padding:12px}
    }
  `],
})
export class ProjectServicesComponent {
  @Input() services: ProjectServiceDetails[] = [];
  @Input() lang = 'en';
  @Output() openFile = new EventEmitter<any>();
  get ar(): boolean { return this.lang === 'ar'; }
  component(service: ProjectServiceDetails, key: string): any { return service.components.find(block => key in block)?.[key]; }
  // Relative due periods remain sortable before the backend calculates dates.
  timeline(service: ProjectServiceDetails): ProjectDeliverable[] {
    return [...service.deliverables].sort((a, b) => a.period_days - b.period_days || a.position - b.position);
  }
  periodLabel(days: number): string { return periodDaysLabel(days, this.lang); }
  trackDeliverable(_: number, item: ProjectDeliverable): number { return item.id ?? item.position; }
  deliverableTitle(item: ProjectDeliverable): string { return item.title || (this.ar ? 'المخرج ' : 'Deliverable ') + item.position; }
  formatsOf(item: ProjectDeliverable): { value: string; icon: string }[] {
    const selected = (item.report_type ?? []).map(type => String(type).toLowerCase());
    return REPORT_TYPES.filter(type => selected.includes(type.value));
  }
  methodColor(item: ProjectDeliverable): [string, string] { return METHOD_COLORS[item.way?.selected || 'on_platform'] ?? ['#F1F5F9', '#334155']; }
  formatDate(value: string | null | undefined): string {
    if (!value) return '—';
    const date = new Date(`${value}T00:00:00`);
    if (isNaN(date.getTime())) return value;
    return this.ar ? date.toLocaleDateString('ar-u-nu-latn', { day: 'numeric', month: 'short', year: 'numeric' }) : `${date.getDate()} ${date.toLocaleDateString('en-US', { month: 'short' })} ${date.getFullYear()}`;
  }
  label(value: string): string {
    const labels: Record<string, [string, string]> = {
      both: ['Primary and secondary data', 'بيانات أولية وثانوية'], primary_data: ['Primary data', 'بيانات أولية'], secondary_data: ['Secondary data', 'بيانات ثانوية'], does_not_matter: ['No preference', 'لا تفضيل'],
      on_platform: ['On the platform', 'على المنصة'], session: ['Session', 'جلسة'], physical_workshop: ['In-person workshop', 'ورشة حضورية'],
      'kickoff-meeting': ['Kickoff meeting', 'اجتماع انطلاق'], 'consulting-sessions': ['Consulting sessions', 'جلسات استشارية'], 'third-party-consultant': ['Third-party consultant', 'مستشار طرف ثالث'], 'survey-conduct': ['Survey', 'استبيان'],
    };
    return labels[value]?.[this.ar ? 1 : 0] ?? value.replace(/[_-]/g, ' ');
  }
  describe(value: any): string {
    if (value == null) return '';
    if (Array.isArray(value)) return value.map(item => this.describe(item)).filter(Boolean).join(' · ');
    if (typeof value !== 'object') return String(value);
    if (value.name || value.legal_name) return value.legal_name || value.name;
    return Object.entries(value).filter(([key]) => !['id', 'uuid', 'avatar', 'image', 'url', 'template'].includes(key)).map(([, item]) => this.describe(item)).filter(Boolean).join(' · ');
  }
}
