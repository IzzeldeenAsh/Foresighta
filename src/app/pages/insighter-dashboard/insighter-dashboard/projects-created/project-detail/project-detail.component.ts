import { Component, Injector, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { switchMap, takeUntil, tap } from 'rxjs/operators';
import { BaseComponent } from 'src/app/modules/base.component';
import {
  CreatedProject,
  CreatedProjectBlock,
  CreatedProjectProposalInvite,
  CreatedProjectType,
  ProjectsCreatedService,
} from 'src/app/_fake/services/projects-created/projects-created.service';

@Component({
  selector: 'app-project-detail',
  templateUrl: './project-detail.component.html',
  styleUrl: './project-detail.component.scss'
})
export class ProjectDetailComponent extends BaseComponent implements OnInit, OnDestroy {
  project: CreatedProject | null = null;
  invitedInsighters: CreatedProjectProposalInvite[] = [];
  isLoading: boolean = false;
  proposalDrawerVisible: boolean = false;
  selectedInvite: CreatedProjectProposalInvite | null = null;

  private projectTypeOptions = [
    { key: 'ad_hoc', labelEn: 'Ad Hoc', labelAr: 'خاص' },
    { key: 'frame_work_agreement', labelEn: 'Framework Agreement', labelAr: 'اتفاقية إطارية' },
    { key: 'urgent_request', labelEn: 'Urgent Request', labelAr: 'طلب عاجل' },
  ];

  constructor(
    injector: Injector,
    private route: ActivatedRoute,
    private router: Router,
    private projectsCreatedService: ProjectsCreatedService,
  ) {
    super(injector);
  }

  ngOnInit(): void {
    this.projectsCreatedService.isLoading$
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe(loading => this.isLoading = loading);

    this.route.paramMap
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe(params => {
        const uuid = params.get('uuid');
        if (uuid) this.loadProject(uuid);
      });
  }

  goBack(): void {
    this.router.navigate(['/app/insighter-dashboard/projects-created']);
  }

  onRematch(): void {
    // No action for now
  }

  openProposalDrawer(invite: CreatedProjectProposalInvite): void {
    if (!this.canViewSubmittedOffer(invite)) return;
    this.selectedInvite = invite;
    this.proposalDrawerVisible = true;
  }

  closeProposalDrawer(): void {
    this.proposalDrawerVisible = false;
    this.selectedInvite = null;
  }

  getTypeLabel(type: CreatedProjectType | null | undefined): string {
    if (!type) return '-';
    const meta = this.projectTypeOptions.find(o => o.key === type);
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

  getLanguageLabel(value: string | null | undefined): string {
    if (!value) return '-';
    const labels: Record<string, { en: string; ar: string }> = {
      arabic: { en: 'Arabic', ar: 'العربية' },
      english: { en: 'English', ar: 'الإنجليزية' },
    };
    const match = labels[value.toLowerCase()];
    return match ? (this.lang === 'ar' ? match.ar : match.en) : this.humanizeValue(value);
  }

  getPhaseLabel(value: string | null | undefined): string {
    return this.getMappedLabel(value, {
      idea_stage: { en: 'Idea Stage', ar: 'مرحلة الفكرة' },
      'idea stage': { en: 'Idea Stage', ar: 'مرحلة الفكرة' },
      validation_stage: { en: 'Validation Stage', ar: 'مرحلة التحقق' },
      growth_stage: { en: 'Growth Stage', ar: 'مرحلة النمو' },
      operating_stage: { en: 'Operating Stage', ar: 'مرحلة التشغيل' },
    });
  }

  getBusinessTypeLabel(value: string | null | undefined): string {
    return this.getMappedLabel(value, {
      entrepreneur: { en: 'Entrepreneur', ar: 'رائد أعمال' },
      startup: { en: 'Startup', ar: 'شركة ناشئة' },
      sme: { en: 'SME', ar: 'منشأة صغيرة أو متوسطة' },
      enterprise: { en: 'Enterprise', ar: 'شركة كبيرة' },
    });
  }

  getDataSourceLabel(value: string | null | undefined): string {
    return this.getMappedLabel(value, {
      primary_data: { en: 'Primary Data', ar: 'بيانات أولية' },
      secondary_data: { en: 'Secondary Data', ar: 'بيانات ثانوية' },
      mixed_data: { en: 'Mixed Data', ar: 'بيانات مختلطة' },
    });
  }

  getWayLabel(value: string | null | undefined): string {
    return this.getMappedLabel(value, {
      physical_workshop: { en: 'Physical Workshop', ar: 'ورشة حضورية' },
      on_platform: { en: 'On Platform', ar: 'على المنصة' },
      online_meeting: { en: 'Online Meeting', ar: 'اجتماع عبر الإنترنت' },
      hybrid: { en: 'Hybrid', ar: 'هجينة' },
    });
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

  formatPrice(value: string | number | null | undefined): string {
    const n = Number(value ?? 0);
    if (!isFinite(n)) return '$0.00';
    return n.toLocaleString(this.lang === 'ar' ? 'ar-EG' : 'en-US', {
      style: 'currency',
      currency: 'USD',
    });
  }

  getProfileUrl(insighterUuid: string | null | undefined): string {
    if (!insighterUuid) return '#';
    const locale = this.lang === 'ar' ? 'ar' : 'en';
    return `https://insightabusiness.com/${locale}/profile/${insighterUuid}?entity=insighter`;
  }

  getInsighterInitials(invite: CreatedProjectProposalInvite | null): string {
    const name = invite?.insighter?.name || '';
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return '?';
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return `${parts[0].charAt(0)}${parts[parts.length - 1].charAt(0)}`.toUpperCase();
  }

  getInvitedStatus(invite: CreatedProjectProposalInvite | null): string {
    if (!invite) return '';

    const actionStatus = (invite.action_status || '').toLowerCase();
    if (actionStatus) return actionStatus;

    const offerStatus = (invite.offer?.status || '').toLowerCase();
    if (offerStatus) return offerStatus;

    const submissionStatus = (invite.submission_status || '').toLowerCase();
    if (submissionStatus) return submissionStatus;

    return 'pending';
  }

  getInvitedStatusBadgeClass(invite: CreatedProjectProposalInvite | null): string {
    switch (this.getInvitedStatus(invite)) {
      case 'pending':
      case 'invited':
      case 'viewed':
        return 'badge-light-warning';
      case 'submitted':
        return 'badge-light-primary';
      case 'accepted':
      case 'approved':
      case 'offered':
        return 'badge-light-success';
      case 'rejected':
      case 'declined':
      case 'cancelled':
      case 'expired':
        return 'badge-light-danger';
      case 'closed':
        return 'badge-light-info';
      default:
        return 'badge-light-info';
    }
  }

  getInvitedStatusLabel(invite: CreatedProjectProposalInvite | null): string {
    const labels: Record<string, { en: string; ar: string }> = {
      pending: { en: 'Pending', ar: 'قيد الانتظار' },
      invited: { en: 'Invited', ar: 'مدعو' },
      viewed: { en: 'Viewed', ar: 'تمت المشاهدة' },
      offered: { en: 'Offered', ar: 'تم تقديم العرض' },
      submitted: { en: 'Submitted', ar: 'مُرسل' },
      accepted: { en: 'Accepted', ar: 'مقبول' },
      approved: { en: 'Approved', ar: 'موافق' },
      rejected: { en: 'Rejected', ar: 'مرفوض' },
      declined: { en: 'Declined', ar: 'مرفوض' },
      closed: { en: 'Closed', ar: 'مغلق' },
      cancelled: { en: 'Cancelled', ar: 'ملغي' },
      expired: { en: 'Expired', ar: 'منتهي' },
    };

    const key = this.getInvitedStatus(invite);
    const match = labels[key];
    if (!match) return key || '-';
    return this.lang === 'ar' ? match.ar : match.en;
  }

  canViewSubmittedOffer(invite: CreatedProjectProposalInvite | null): boolean {
    return !!invite?.offer;
  }

  hasInvitedInsighters(): boolean {
    return this.invitedInsighters.length > 0;
  }

  getEstimatedHours(value: string | number | null | undefined): string {
    const hours = Number(value ?? 0);
    if (!isFinite(hours) || hours <= 0) return '-';
    return `${hours} ${this.lang === 'ar' ? 'ساعة' : 'hrs'}`;
  }

  getFormattedValue(value: any): string {
    if (value === null || value === undefined || value === '') return '-';
    if (Array.isArray(value)) {
      return value.map(v => this.getFormattedValue(v)).filter(v => v !== '-').join(', ') || '-';
    }
    if (typeof value === 'string') return this.humanizeValue(value);
    if (typeof value === 'number' || typeof value === 'boolean') return `${value}`;
    return '-';
  }

  getCountryFlagPath(flag: string | null | undefined): string {
    return flag ? `assets/media/flags/${flag}.svg` : 'assets/media/flags/default.svg';
  }

  getFileTypeIconPath(extension: string | null | undefined): string {
    if (!extension) return 'assets/media/svg/files/default.svg';
    const iconMap: Record<string, string> = {
      pdf: 'pdf', doc: 'doc', docx: 'docx',
      ppt: 'ppt', pptx: 'ppt', csv: 'csv',
      xml: 'xml', xlsx: 'csv',
    };
    return `assets/media/svg/files/${iconMap[extension.toLowerCase()] || 'default'}.svg`;
  }

  onFlagLoadError(event: Event): void {
    const t = event.target as HTMLImageElement | null;
    if (t) t.src = 'assets/media/flags/default.svg';
  }

  onFileIconLoadError(event: Event): void {
    const t = event.target as HTMLImageElement | null;
    if (t) t.src = 'assets/media/svg/files/default.svg';
  }

  getComponent(key: string): any | null {
    if (!this.project) return null;
    for (const item of this.project.components || []) {
      if (item && Object.prototype.hasOwnProperty.call(item, key)) return item[key];
    }
    return null;
  }

  getAddon(key: string): any | null {
    if (!this.project) return null;
    for (const item of this.project.addons || []) {
      if (item && Object.prototype.hasOwnProperty.call(item, key)) return item[key];
    }
    return null;
  }

  hasAddons(): boolean {
    return !!(this.project?.addons?.length);
  }

  getBackIcon(): string {
    return this.lang === 'ar' ? 'ki-arrow-right' : 'ki-arrow-left';
  }

  trackByValue(_: number, value: string): string { return value; }
  trackByIndex(index: number): number { return index; }
  trackByInvite(_: number, invite: CreatedProjectProposalInvite): string {
    return invite.uuid || `${invite.insighter?.uuid || 'invite'}-${invite.offer?.uuid || 'offer'}`;
  }

  private loadProject(uuid: string): void {
    this.project = null;
    this.invitedInsighters = [];
    this.closeProposalDrawer();

    this.projectsCreatedService.getProject(uuid)
      .pipe(takeUntil(this.unsubscribe$))
      .pipe(
        tap(project => {
          this.project = project;
        }),
        switchMap(() => this.projectsCreatedService.getProjectProposalInvites(uuid))
      )
      .subscribe({
        next: (invites) => {
          this.invitedInsighters = invites;
        },
        error: (err) => this.handleServerErrors(err),
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

  private getMappedLabel(
    value: string | null | undefined,
    labels: Record<string, { en: string; ar: string }>
  ): string {
    if (!value) return '-';
    const match = labels[value.toLowerCase()] ?? labels[value];
    if (!match) return this.humanizeValue(value);
    return this.lang === 'ar' ? match.ar : match.en;
  }

  private humanizeValue(value: string): string {
    return value.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim()
      .replace(/\b\w/g, l => l.toUpperCase());
  }

  override ngOnDestroy(): void {
    super.ngOnDestroy();
  }
}
