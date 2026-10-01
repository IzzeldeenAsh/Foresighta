import { Component, Input } from '@angular/core';
import {
  ProjectDeliverable,
  deliverableWayLabel,
  periodDaysLabel,
} from 'src/app/_fake/services/project-phase2/project-phase2.model';

/**
 * Read-only list of project deliverables. Each deliverable is scheduled
 * relative to the project start (`period_days`) and carries its calculated
 * planned date.
 */
@Component({
  selector: 'app-project-deliverables',
  templateUrl: './project-deliverables.component.html',
  styleUrls: ['./project-deliverables.component.scss'],
})
export class ProjectDeliverablesComponent {
  @Input() deliverables: ProjectDeliverable[] = [];
  @Input() lang: 'en' | 'ar' | string = 'en';

  /** Service names only matter when the project spans more than one service. */
  get showServiceNames(): boolean {
    const names = new Set(this.deliverables.map(item => item.service_name).filter(Boolean));
    return names.size > 1;
  }

  periodLabel(days: number): string {
    return periodDaysLabel(days, this.lang);
  }

  wayLabel(way: string | null): string {
    return deliverableWayLabel(way, this.lang);
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

  fileIcon(type: string): string {
    const icons: Record<string, string> = { pdf: 'pdf', docx: 'docx', doc: 'doc', pptx: 'ppt', xlsx: 'csv' };
    return `assets/media/svg/files/${icons[type] || 'default'}.svg`;
  }

  onFileIconError(event: Event): void {
    const target = event.target as HTMLImageElement | null;
    if (target) target.src = 'assets/media/svg/files/default.svg';
  }

  trackById(_: number, item: ProjectDeliverable): number {
    return item.id;
  }
}
