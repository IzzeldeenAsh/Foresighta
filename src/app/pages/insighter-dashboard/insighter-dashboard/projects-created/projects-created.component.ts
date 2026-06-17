import { Component, HostListener, Injector, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Observable } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { BaseComponent } from 'src/app/modules/base.component';
import {
  CreatedProject,
  CreatedProjectReadStatus,
  CreatedProjectStatistics,
  CreatedProjectStatus,
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

interface StatusFilterOption<T> {
  value: T;
  labelEn: string;
  labelAr: string;
  iconClass: string;
}

@Component({
  selector: 'app-projects-created',
  templateUrl: './projects-created.component.html',
  styleUrl: './projects-created.component.scss'
})
export class ProjectsCreatedComponent extends BaseComponent implements OnInit, OnDestroy {
  isLoading$: Observable<boolean>;

  projects: CreatedProject[] = [];
  viewMode: ViewMode = 'list';
  private hasUserSelectedViewMode = false;
  projectReadImageUrl = 'https://res.cloudinary.com/dsiku9ipv/image/upload/v1779196120/project_18669661_o5xc3a_copy_ue7w6e.jpg';
  projectUnreadImageUrl = 'https://res.cloudinary.com/dsiku9ipv/image/upload/v1779196441/project_18669661_o5xc3a_codsdpy_qmneyt.png';
  selectedProjectStatus: CreatedProjectStatus | null = null;
  selectedReadStatus: CreatedProjectReadStatus | null = null;
  projectStatistics: CreatedProjectStatistics = { total: 0, statuses: [] };
  projectStatisticsLoaded = false;
  markingReadProjectUuids = new Set<string>();

  currentPage: number = 1;
  rows: number = 10;
  first: number = 0;
  totalRecords: number = 0;

  projectTypeOptions: ProjectTypeMeta[] = [
    { key: 'ad_hoc', labelEn: 'Ad Hoc', labelAr: 'خاص' },
    { key: 'frame_work_agreement', labelEn: 'Framework Agreement', labelAr: 'اتفاقية إطارية' },
    { key: 'urgent_request', labelEn: 'Urgent Request', labelAr: 'طلب عاجل' },
  ];

  projectStatusOptions: StatusFilterOption<CreatedProjectStatus>[] = [
    { value: 'expired', labelEn: 'Expired', labelAr: 'منتهي', iconClass: 'ki-timer' },
    { value: 'cancelled', labelEn: 'Cancelled', labelAr: 'ملغي', iconClass: 'ki-cross-circle' },
    { value: 'submitted', labelEn: 'Submitted', labelAr: 'مُرسل', iconClass: 'ki-send' },
    { value: 'contracting', labelEn: 'Contracting', labelAr: 'العقد', iconClass: 'ki-document' },
    { value: 'payment', labelEn: 'Payment', labelAr: 'الدفع', iconClass: 'ki-wallet' },
    { value: 'in_progress', labelEn: 'In Progress', labelAr: 'قيد التنفيذ', iconClass: 'ki-arrows-circle' },
    { value: 'in_review', labelEn: 'In Review', labelAr: 'قيد المراجعة', iconClass: 'ki-eye' },
    { value: 'closed', labelEn: 'Closed', labelAr: 'مغلق', iconClass: 'ki-check-circle' },
  ];
  readStatusOptions: StatusFilterOption<CreatedProjectReadStatus>[] = [
    { value: 'not_read', labelEn: 'Unread', labelAr: 'غير مقروء', iconClass: 'ki-notification-on' },
    { value: 'read', labelEn: 'Read', labelAr: 'مقروء', iconClass: 'ki-eye' },
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
    this.syncResponsiveViewMode();
    this.loadProjectStatistics();
    this.loadProjects(1);
  }

  @HostListener('window:resize')
  onWindowResize(): void {
    this.syncResponsiveViewMode();
  }

  loadProjects(page: number): void {
    const filters: CreatedProjectsFilters = {
      project_status: this.selectedProjectStatus,
      read_status: this.selectedReadStatus,
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

  onProjectStatusChange(status: CreatedProjectStatus | null): void {
    this.selectedProjectStatus = status;
    this.currentPage = 1;
    this.first = 0;
    this.loadProjects(1);
  }

  onReadStatusChange(status: CreatedProjectReadStatus | null): void {
    this.selectedReadStatus = this.selectedReadStatus === status ? null : status;
    this.currentPage = 1;
    this.first = 0;
    this.loadProjects(1);
  }

  setViewMode(mode: ViewMode): void {
    this.hasUserSelectedViewMode = true;
    this.viewMode = mode;
  }

  viewDetails(project: CreatedProject): void {
    this.markProjectAsRead(project);
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

  hasProjectStatus(): boolean {
    return this.projects.some(project => !!project.status);
  }

  getStatusBadgeClass(status: CreatedProjectStatus | null | undefined): string {
    switch ((status || '').toLowerCase()) {
      case 'draft': return 'badge-light-draft';
      case 'submitted': return 'badge-light-submitted';
      case 'contract':
      case 'contracting': return 'badge-light-info';
      case 'payment': return 'badge-light-warning';
      case 'in_progress': return 'badge-light-progress';
      case 'in_review': return 'badge-light-warning';
      case 'closed': return 'badge-light-success';
      case 'cancelled': return 'badge-light-cancelled';
      case 'expired': return 'badge-light-expired';
      default: return 'badge-light-info';
    }
  }

  getStatusIconClass(status: CreatedProjectStatus | null | undefined): string {
    switch ((status || '').toLowerCase()) {
      case 'draft': return 'ki-notepad-edit';
      case 'expired': return 'ki-timer';
      case 'cancelled': return 'ki-cross-circle';
      case 'submitted': return 'ki-send';
      case 'contract':
      case 'contracting': return 'ki-document';
      case 'payment': return 'ki-wallet';
      case 'in_progress': return 'ki-arrows-circle';
      case 'in_review': return 'ki-eye';
      case 'closed': return 'ki-check-circle';
      default: return 'ki-information-5';
    }
  }

  getStatusLabel(status: CreatedProjectStatus | null | undefined): string {
    const labels: Record<string, { en: string; ar: string }> = {
      draft: { en: 'Draft', ar: 'مسودة' },
      expired: { en: 'Expired', ar: 'منتهي' },
      cancelled: { en: 'Cancelled', ar: 'ملغي' },
      submitted: { en: 'Submitted', ar: 'مُرسل' },
      contract: { en: 'Contracting', ar: 'العقد' },
      contracting: { en: 'Contracting', ar: 'العقد' },
      payment: { en: 'Payment', ar: 'الدفع' },
      in_progress: { en: 'In Progress', ar: 'قيد التنفيذ' },
      in_review: { en: 'In Review', ar: 'قيد المراجعة' },
      closed: { en: 'Closed', ar: 'مغلق' },
    };
    const key = (status || '').toLowerCase();
    const match = labels[key];
    if (!match) return this.humanizeValue(key) || '-';
    return this.lang === 'ar' ? match.ar : match.en;
  }

  getAllProjectsCount(): number {
    return this.projectStatisticsLoaded ? this.projectStatistics.total : this.totalRecords;
  }

  getProjectStatusCount(status: CreatedProjectStatus | null | undefined): number {
    if (!status || !this.projectStatisticsLoaded) return 0;
    const key = this.normalizeStatusKey(status);
    const match = this.projectStatistics.statuses.find(item => this.normalizeStatusKey(item.status) === key);
    return match?.total ?? 0;
  }

  formatDate(value: string | null | undefined): string {
    if (!value) return '-';
    try {
      const d = new Date(value);
      return d.toLocaleDateString('en-US', {
        year: 'numeric', month: 'short', day: 'numeric'
      });
    } catch {
      return value;
    }
  }

  getSummary(project: CreatedProject): string {
    return project.service_prompt || project.description || '-';
  }

  isClientUnread(project: CreatedProject): boolean {
    return project.is_read === false;
  }

  getProjectImageUrl(project: CreatedProject): string {
    return this.isClientUnread(project) ? this.projectUnreadImageUrl : this.projectReadImageUrl;
  }

  trackByProject(_: number, p: CreatedProject): string {
    return p.uuid;
  }

  private markProjectAsRead(project: CreatedProject): void {
    if (!project?.uuid || !this.isClientUnread(project) || this.markingReadProjectUuids.has(project.uuid)) {
      return;
    }

    this.markingReadProjectUuids.add(project.uuid);

    this.projectsCreatedService.markProjectAsRead(project.uuid)
      .subscribe({
        next: () => {
          this.projects = this.projects.map(item =>
            item.uuid === project.uuid
              ? { ...item, is_read: true, read_at: item.read_at ?? new Date().toISOString() }
              : item
          );
        },
        error: () => {
          this.markingReadProjectUuids.delete(project.uuid);
        },
        complete: () => {
          this.markingReadProjectUuids.delete(project.uuid);
        },
      });
  }

  private loadProjectStatistics(): void {
    this.projectsCreatedService.getProjectStatistics()
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe({
        next: statistics => {
          this.projectStatistics = statistics;
          this.projectStatisticsLoaded = true;
        },
        error: () => {
          this.projectStatisticsLoaded = false;
        },
      });
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

  private normalizeStatusKey(value: string): string {
    return (value || '').toLowerCase().replace(/[-\s]+/g, '_');
  }

  private syncResponsiveViewMode(): void {
    if (this.hasUserSelectedViewMode || typeof window === 'undefined') {
      return;
    }

    this.viewMode = window.innerWidth <= 767 ? 'grid' : 'list';
  }

  override ngOnDestroy(): void {
    super.ngOnDestroy();
  }
}
