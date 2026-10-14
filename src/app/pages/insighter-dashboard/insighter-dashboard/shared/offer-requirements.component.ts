import { Component, Input } from '@angular/core';
import { OfferScope, OfferComponent } from 'src/app/_fake/services/project-phase2/project-requirements.model';
import { ProjectServiceDetails, periodDaysLabel, deliverableWayLabel } from 'src/app/_fake/services/project-phase2/project-phase2.model';
@Component({
  selector: 'app-offer-requirements',
  template: `
    <section *ngIf="scopes.length || components.length" class="offer-requirements" [attr.dir]="ar ? 'rtl' : 'ltr'">
      <h3>{{ ar ? 'المتطلبات المقترحة من الإنسايتر' : 'Requirements proposed by the Insighter' }}</h3>
      <p class="intro">{{ ar ? 'راجع هذه المتطلبات قبل قبول العرض وترسيته. تصبح متطلبات المشروع عند ترسية هذا العرض.' : 'Review these requirements before accepting and awarding this offer. They become project requirements when this offer is awarded.' }}</p>
      <article *ngFor="let scope of scopes" class="requirement">
        <div class="context">{{ serviceLabel(scope.project_service_id) }} <span class="owner">{{ ar ? 'حدده الإنسايتر' : 'Defined by Insighter' }}</span></div>
        <strong>{{ scope.scope }}</strong><p *ngIf="scope.description">{{ scope.description }}</p>
        <ul *ngIf="scope.children?.length"><li *ngFor="let child of scope.children"><strong>{{ child.scope }}</strong><p *ngIf="child.description">{{ child.description }}</p></li></ul>
      </article>
      <article *ngFor="let item of components" class="requirement">
        <div class="context">{{ item.project_service_id === null ? (ar ? 'على مستوى المشروع' : 'Project requirement') : serviceLabel(item.project_service_id) }} <span class="owner">{{ ar ? 'حدده الإنسايتر' : 'Defined by Insighter' }}</span></div>
        <strong>{{ item.component?.name || (ar ? 'متطلب' : 'Requirement') }}</strong>
        <ng-container *ngIf="item.value?.deliverables; else componentValue"><ol><li *ngFor="let deliverable of item.value.deliverables"><strong>{{ deliverable.title }}</strong><p>{{ period(deliverable.period_days) }} · {{ method(deliverable.way?.selected) }}</p><p *ngIf="deliverable.report_type?.length">{{ deliverable.report_type.join(', ').toUpperCase() }}</p><p *ngIf="deliverable.way?.address">{{ deliverable.way.address }}</p></li></ol></ng-container>
        <ng-template #componentValue><p>{{ describe(item.value) }}</p></ng-template>
      </article>
    </section>`,
  styles: [`:host{display:block}.offer-requirements{padding:20px;border:1px solid #bae6fd;border-radius:12px;background:#f8fcff;margin:20px 0}h3{font-size:16px;color:#0f172a;margin:0 0 8px}p{margin:6px 0;line-height:1.6;white-space:pre-line;overflow-wrap:anywhere;color:#475569;font-size:13px}.intro{color:#64748b}.requirement{margin-top:16px;padding-top:16px;border-top:1px solid #e2e8f0}.context{font-size:12px;color:#64748b;margin-bottom:8px}.owner{display:inline-flex;border-radius:999px;padding:2px 8px;background:#e0f2fe;color:#0369a1;margin-inline-start:6px;font-size:11px}strong{font-size:14px;color:#0f172a}li{margin:10px 0}ul,ol{padding-inline-start:20px}`],
})
export class OfferRequirementsComponent {
  @Input() scopes: OfferScope[] = [];
  @Input() components: OfferComponent[] = [];
  @Input() services: ProjectServiceDetails[] = [];
  @Input() lang = 'en';
  get ar(): boolean { return this.lang === 'ar'; }
  serviceLabel(id: number): string {
    const service = this.services.find(item => item.id === id);
    return service ? `${this.ar ? 'الخدمة' : 'Service'} ${service.position}: ${service.title || service.service?.name || ''}` : (this.ar ? 'نطاق الخدمة' : 'Service scope');
  }
  period(value: number): string { return periodDaysLabel(value, this.lang); }
  method(value: string): string { return deliverableWayLabel(value, this.lang); }
  describe(value: any): string {
    const names: Record<string, [string, string]> = { primary_data: ['Primary data', 'بيانات أولية'], secondary_data: ['Secondary data', 'بيانات ثانوية'], both: ['Primary and secondary data', 'بيانات أولية وثانوية'], does_not_matter: ['No preference', 'لا تفضيل'], country: ['Countries', 'الدول'], region: ['Regions', 'المناطق'], economic: ['Economic blocs', 'التكتلات الاقتصادية'] };
    if (value === null || value === undefined) return '';
    if (typeof value !== 'object') return names[String(value)]?.[this.ar ? 1 : 0] ?? String(value);
    if (Array.isArray(value)) return value.map(item => this.describe(item)).filter(Boolean).join(' · ');
    if (value.name) return value.name;
    return Object.entries(value).filter(([key]) => !['filled_by_role', 'filled_by_user_id', 'source_project_proposal_offer_id'].includes(key)).map(([, item]) => this.describe(item)).filter(Boolean).join(' · ');
  }
}
