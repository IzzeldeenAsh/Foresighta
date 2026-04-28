import { Component, Injector, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Observable } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { BaseComponent } from 'src/app/modules/base.component';
import {
  CreatedProject,
  CreatedProjectType,
  CreatedProjectsFilters,
  CreatedProjectsPaginatedResponse,
  ProjectsCreatedService,
} from 'src/app/_fake/services/projects-created/projects-created.service';

type ViewMode = 'grid' | 'list';

interface ProjectTypeMeta {
  key: CreatedProjectType;
  labelEn: string;
  labelAr: string;
}

interface DropdownOption {
  label: string;
  value: string;
}

@Component({
  selector: 'app-projects-created',
  templateUrl: './projects-created.component.html',
  styleUrl: './projects-created.component.scss'
})
export class ProjectsCreatedComponent extends BaseComponent implements OnInit, OnDestroy {
  isLoading$: Observable<boolean>;

  projects: CreatedProject[] = [];
  viewMode: ViewMode = 'grid';
  selectedProjectStatus: string | null = null;

  currentPage: number = 1;
  rows: number = 10;
  first: number = 0;
  totalRecords: number = 0;

  projectTypeOptions: ProjectTypeMeta[] = [
    { key: 'ad_hoc', labelEn: 'Ad Hoc', labelAr: 'خاص' },
    { key: 'frame_work_agreement', labelEn: 'Framework Agreement', labelAr: 'اتفاقية إطارية' },
    { key: 'urgent_request', labelEn: 'Urgent Request', labelAr: 'طلب عاجل' },
  ];

  private projectStatusOptionsDef = [
    { value: 'proposal', labelEn: 'Proposal', labelAr: 'مقترح' },
    { value: 'submitted', labelEn: 'Submitted', labelAr: 'مُرسل' },
    { value: 'closed', labelEn: 'Closed', labelAr: 'مغلق' },
    { value: 'cancelled', labelEn: 'Cancelled', labelAr: 'ملغي' },
    { value: 'expired', labelEn: 'Expired', labelAr: 'منتهي' },
  ];

  constructor(
    injector: Injector,
    private projectsCreatedService: ProjectsCreatedService,
    private router: Router,
  ) {
    super(injector);
    this.isLoading$ = this.projectsCreatedService.isLoading$;
  }

  ngOnInit(): void {
    this.loadProjects(1);
  }

  get projectStatusDropdownOptions(): DropdownOption[] {
    return this.projectStatusOptionsDef.map(o => ({
      label: this.lang === 'ar' ? o.labelAr : o.labelEn,
      value: o.value,
    }));
  }

  loadProjects(page: number): void {
    const filters: CreatedProjectsFilters = {
      project_status: this.selectedProjectStatus,
    };
    this.projectsCreatedService.getProjects(page, filters)
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe({
        next: (res: CreatedProjectsPaginatedResponse) => {
          this.projects = res.data || [];
          this.totalRecords = res.meta?.total ?? 0;
          this.rows = res.meta?.per_page ?? 10;
          this.currentPage = res.meta?.current_page ?? page;
          this.first = (this.currentPage - 1) * this.rows;
        },
        error: (err) => this.handleServerErrors(err),
      });
  }

  onPageChange(event: any): void {
    const page = Math.floor(event.first / event.rows) + 1;
    this.first = event.first;
    this.rows = event.rows;
    this.loadProjects(page);
  }

  onProjectStatusChange(status: string | null): void {
    this.selectedProjectStatus = status;
    this.currentPage = 1;
    this.first = 0;
    this.loadProjects(1);
  }

  setViewMode(mode: ViewMode): void {
    this.viewMode = mode;
  }

  viewDetails(project: CreatedProject): void {
    this.router.navigate(['/app/insighter-dashboard/projects-created', project.uuid]);
  }

  getTypeMeta(key: CreatedProjectType): ProjectTypeMeta | undefined {
    return this.projectTypeOptions.find(o => o.key === key);
  }

  getTypeLabel(type: CreatedProjectType | null | undefined): string {
    if (!type) return '-';
    const meta = this.getTypeMeta(type);
    if (!meta) return this.humanizeValue(type);
    return this.lang === 'ar' ? meta.labelAr : meta.labelEn;
  }

  getStatusBadgeClass(status: string | null | undefined): string {
    switch ((status || '').toLowerCase()) {
      case 'proposal': return 'badge-light-warning';
      case 'submitted': return 'badge-light-primary';
      case 'closed': return 'badge-light-success';
      case 'cancelled': return 'badge-light-danger';
      case 'expired': return 'badge-light-danger';
      default: return 'badge-light-info';
    }
  }

  getStatusLabel(status: string | null | undefined): string {
    const labels: Record<string, { en: string; ar: string }> = {
      proposal: { en: 'Proposal', ar: 'مقترح' },
      submitted: { en: 'Submitted', ar: 'مُرسل' },
      closed: { en: 'Closed', ar: 'مغلق' },
      cancelled: { en: 'Cancelled', ar: 'ملغي' },
      expired: { en: 'Expired', ar: 'منتهي' },
    };
    const key = (status || '').toLowerCase();
    const match = labels[key];
    if (!match) return status || '-';
    return this.lang === 'ar' ? match.ar : match.en;
  }

  formatDate(value: string | null | undefined): string {
    if (!value) return '-';
    try {
      const d = new Date(value);
      return d.toLocaleDateString(this.lang === 'ar' ? 'ar-EG' : 'en-US', {
        year: 'numeric', month: 'short', day: 'numeric'
      });
    } catch {
      return value;
    }
  }

  getSummary(project: CreatedProject): string {
    return project.service_prompt || project.description || '-';
  }

  trackByProject(_: number, p: CreatedProject): string {
    return p.uuid;
  }

  private handleServerErrors(error: any): void {
    if (error?.error?.errors) {
      const serverErrors = error.error.errors;
      for (const key in serverErrors) {
        if (Object.prototype.hasOwnProperty.call(serverErrors, key)) {
          this.showError(
            this.lang === 'ar' ? 'حدث خطأ' : 'An error occurred',
            serverErrors[key].join(', ')
          );
        }
      }
    } else {
      this.showError(
        this.lang === 'ar' ? 'حدث خطأ' : 'An error occurred',
        this.lang === 'ar' ? 'حدث خطأ غير متوقع' : 'An unexpected error occurred.'
      );
    }
  }

  private humanizeValue(value: string): string {
    return value
      .replace(/[_-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/\b\w/g, l => l.toUpperCase());
  }

  override ngOnDestroy(): void {
    super.ngOnDestroy();
  }
}
