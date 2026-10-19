import { Component, Input, OnChanges } from '@angular/core';
import { ProjectOfferDetails } from 'src/app/_fake/services/project-offers/project-offers.service';
import { OfferComponent } from 'src/app/_fake/services/project-phase2/project-requirements.model';
import { ProjectDeliverable, ProjectServiceDetails, addDaysToDate, deliverableWayLabel, periodDaysLabel } from 'src/app/_fake/services/project-phase2/project-phase2.model';
import { offerDurationSuggestion } from 'src/app/_fake/services/agreement-revisions/agreement-revisions.model';

interface OverviewDeliverable {
  title: string;
  period_days: number | null;
  date?: string | null;
  report_type?: string[];
  way?: ProjectDeliverable['way'];
}
interface OverviewScope {
  scope: string | null;
  description?: string | null;
  children?: OverviewScope[];
}
interface ServiceGroup {
  id: number | null;
  position: number;
  name: string;
  scopes: OverviewScope[];
  deliverables: OverviewDeliverable[];
}

@Component({
  selector: 'app-offer-overview',
  templateUrl: './offer-overview.component.html',
  styleUrls: ['./offer-overview.component.scss'],
})
export class OfferOverviewComponent implements OnChanges {
  @Input({ required: true }) offer!: Pick<ProjectOfferDetails, 'proposed_price' | 'cover_letter' | 'status' | 'installments' | 'offer_scopes' | 'offer_components' | 'suggested_duration_days'>;
  /** The project's current duration, so a longer suggestion in the offer can be shown next to it. */
  @Input() projectDurationDays: number | null = null;
  @Input() context: 'insighter' | 'client' = 'insighter';
  @Input() services: ProjectServiceDetails[] = [];
  @Input() baseDate: string | null = null;
  @Input() lang = 'en';
  @Input() statusLabel = '';
  @Input() statusClass = '';
  @Input() pricingSummary = '';
  groups: ServiceGroup[] = [];
  otherComponents: OfferComponent[] = [];
  get ar(): boolean { return this.lang === 'ar'; }

  ngOnChanges(): void {
    if (!this.offer) return;
    const scopes = this.offer.offer_scopes ?? [];
    const components = this.offer.offer_components ?? [];
    const ids = new Set<number | null>([
      ...this.services.map(service => service.id),
      ...scopes.map(scope => scope.project_service_id),
      ...components.filter(item => Array.isArray(item.value?.deliverables)).map(item => item.project_service_id),
    ]);
    this.groups = Array.from(ids).map((id, index) => {
      const service = this.services.find(item => item.id === id);
      const proposedScopes = scopes.filter(scope => scope.project_service_id === id);
      const proposedDeliverables = components.filter(item => item.project_service_id === id && Array.isArray(item.value?.deliverables));
      return {
        id,
        position: service?.position ?? index + 1,
        name: service?.title || service?.service?.name || (id === null ? (this.ar ? 'المشروع' : 'Project') : (this.ar ? 'الخدمة' : 'Service')),
        scopes: proposedScopes.length ? proposedScopes : service?.scopes ?? [],
        deliverables: proposedDeliverables.length
          ? proposedDeliverables.reduce<OverviewDeliverable[]>((list, item) => list.concat(item.value.deliverables), [])
          : service?.deliverables ?? [],
      };
    }).filter(group => group.scopes.length || group.deliverables.length);
    this.otherComponents = components.filter(item => !Array.isArray(item.value?.deliverables));
  }

  price(): string {
    const value = this.offer.proposed_price;
    return value === null || value === '' || !Number.isFinite(Number(value)) ? '—' : `$${Number(value).toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
  }
  dayLabel(days: number | null): string {
    return days === null || days === undefined ? '' : `${this.ar ? 'اليوم' : 'Day'} ${days}`;
  }
  dueDate(deliverable: OverviewDeliverable): string {
    const days = Number(deliverable.period_days);
    const date = deliverable.date || (deliverable.period_days !== null && deliverable.period_days !== undefined && Number.isFinite(days) ? addDaysToDate(this.baseDate, days) : null);
    if (!date) return '';
    const [year, month, day] = date.slice(0, 10).split('-').map(Number);
    return new Date(year, month - 1, day).toLocaleDateString(this.ar ? 'ar' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' });
  }
  period(days: number | null): string { return periodDaysLabel(days, this.lang); }
  method(value?: string | null): string { return deliverableWayLabel(value, this.lang); }
  wayIcon(value?: string | null): string {
    return value === 'session' ? 'pi-video' : value === 'physical_workshop' ? 'pi-map-marker' : 'pi-desktop';
  }
  trackService(_: number, group: ServiceGroup): number | null { return group.id; }
  get suggestedDurationDays(): number | null { return offerDurationSuggestion(this.offer, this.projectDurationDays); }
  get suggestedEndDate(): string {
    const days = this.suggestedDurationDays;
    const date = days === null ? null : addDaysToDate(this.baseDate, days);
    if (!date) return '';
    const [year, month, day] = date.slice(0, 10).split('-').map(Number);
    return new Date(year, month - 1, day).toLocaleDateString(this.ar ? 'ar' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' });
  }
}
