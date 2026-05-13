import { Component, Injector, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Observable } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import {
  ProjectContract,
  ProjectOfferFile,
  ProjectOffer,
  ProjectOffersPaginatedResponse,
  ProjectOffersService,
  ProjectOfferScope,
  ProjectOfferType,
} from 'src/app/_fake/services/project-offers/project-offers.service';
import { BaseComponent } from 'src/app/modules/base.component';

type ViewMode = 'grid' | 'list';
type DrawerTab = 'overview' | 'documents' | 'contract';

interface ProjectTypeMeta {
  key: ProjectOfferType;
  labelEn: string;
  labelAr: string;
}

interface DrawerTabOption {
  value: DrawerTab;
  labelEn: string;
  labelAr: string;
}

@Component({
  selector: 'app-on-work-projects',
  templateUrl: './on-work-projects.component.html',
  styleUrls: [
    '../project-offers/project-offers.component.scss',
    './on-work-projects.component.scss',
  ],
})
export class OnWorkProjectsComponent extends BaseComponent implements OnInit {
  isLoading$: Observable<boolean>;
  projects: ProjectOffer[] = [];
  viewMode: ViewMode = 'list';
  drawerVisible = false;
  selectedProject: ProjectOffer | null = null;
  activeDrawerTab: DrawerTab = 'overview';
  openingFileUuid: string | null = null;
  contractDetails: ProjectContract | null = null;
  contractDetailsLoading = false;
  contractDetailsError = false;

  currentPage = 1;
  rows = 10;
  first = 0;
  totalRecords = 0;
  private contractDetailsRequestId = 0;
  private loadedContractUuid: string | null = null;

  projectTypeOptions: ProjectTypeMeta[] = [
    { key: 'ad_hoc', labelEn: 'Ad Hoc', labelAr: 'خاص' },
    { key: 'frame_work_agreement', labelEn: 'Framework Agreement', labelAr: 'اتفاقية إطارية' },
    { key: 'urgent_request', labelEn: 'Urgent Request', labelAr: 'طلب عاجل' },
  ];
  drawerTabOptions: DrawerTabOption[] = [
    { value: 'overview', labelEn: 'Overview', labelAr: 'نظرة عامة' },
    { value: 'documents', labelEn: 'Documents', labelAr: 'المستندات' },
    { value: 'contract', labelEn: 'Contract', labelAr: 'العقد' },
  ];

  constructor(
    injector: Injector,
    private projectOffersService: ProjectOffersService,
    private router: Router,
  ) {
    super(injector);
    this.isLoading$ = this.projectOffersService.isLoading$;
  }

  ngOnInit(): void {
    this.loadProjects(1);
  }

  loadProjects(page: number): void {
    this.projectOffersService.getOnWorkProjects(page)
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe({
        next: (res: ProjectOffersPaginatedResponse) => {
          this.projects = res.data || [];
          this.totalRecords = res.meta?.total ?? 0;
          this.rows = res.meta?.per_page ?? 10;
          this.currentPage = res.meta?.current_page ?? page;
          this.first = (this.currentPage - 1) * this.rows;
        },
        error: err => this.handleServerErrors(err),
      });
  }

  onPageChange(event: any): void {
    const page = Math.floor(event.first / event.rows) + 1;
    this.first = event.first;
    this.rows = event.rows;
    this.loadProjects(page);
  }

  setViewMode(mode: ViewMode): void {
    this.viewMode = mode;
  }

  openDrawer(project: ProjectOffer): void {
    this.selectedProject = project;
    this.drawerVisible = true;
    this.activeDrawerTab = 'overview';
    this.setEmbeddedContractDetails(project);
  }

  closeDrawer(): void {
    this.drawerVisible = false;
    this.selectedProject = null;
    this.activeDrawerTab = 'overview';
    this.resetContractDetails();
    this.contractDetailsRequestId++;
  }

  setDrawerTab(tab: DrawerTab): void {
    this.activeDrawerTab = tab;

    if (tab === 'contract') {
      this.loadContractDetails();
    }
  }

  viewContract(project: ProjectOffer | null | undefined = this.selectedProject): void {
    const contractUuid = this.getContractUuid(project);
    if (!contractUuid) {
      this.showError(
        this.lang === 'ar' ? 'تعذر فتح العقد' : 'Cannot open contract',
        this.lang === 'ar' ? 'لم يتم العثور على معرّف العقد.' : 'Contract identifier was not found.'
      );
      return;
    }

    this.router.navigate(
      ['/app/insighter-dashboard/project-offers/contract', contractUuid],
      { queryParams: { returnUrl: '/app/insighter-dashboard/on-work-projects' } }
    );
  }

  hasContract(project: ProjectOffer | null | undefined): boolean {
    return !!(this.getEmbeddedContract(project) || this.getContractUuid(project));
  }

  canOpenContract(project: ProjectOffer | null | undefined): boolean {
    return !!this.getContractUuid(project);
  }

  getTypeMeta(key: ProjectOfferType): ProjectTypeMeta | undefined {
    return this.projectTypeOptions.find(o => o.key === key);
  }

  getTypeLabel(type: ProjectOfferType | null | undefined): string {
    if (!type) return '-';
    const meta = this.getTypeMeta(type);
    if (!meta) return this.humanizeValue(type);
    return this.lang === 'ar' ? meta.labelAr : meta.labelEn;
  }

  getSummary(project: ProjectOffer): string {
    return project.project?.service_prompt || project.project?.description || '-';
  }

  getDrawerBackIcon(): string {
    return this.lang === 'ar' ? 'ki-arrow-right' : 'ki-arrow-left';
  }

  getLanguageLabel(value: string | null | undefined): string {
    return this.getMappedLabel(value, {
      arabic: { en: 'Arabic', ar: 'العربية' },
      english: { en: 'English', ar: 'الإنجليزية' },
    });
  }

  getPhaseLabel(value: string | null | undefined): string {
    return this.getMappedLabel(value, {
      idea_stage: { en: 'Idea Stage', ar: 'مرحلة الفكرة' },
      'idea stage': { en: 'Idea Stage', ar: 'مرحلة الفكرة' },
      validation_stage: { en: 'Validation Stage', ar: 'مرحلة التحقق' },
      growth_stage: { en: 'Growth Stage', ar: 'مرحلة النمو' },
      expansion: { en: 'Expansion', ar: 'مرحلة التوسع' },
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

  getFormattedValue(value: any): string {
    if (value === null || value === undefined || value === '') return '-';
    if (Array.isArray(value)) {
      return value.map(item => this.getFormattedValue(item)).filter(item => item !== '-').join(', ') || '-';
    }
    if (typeof value === 'string') return this.humanizeValue(value);
    if (typeof value === 'number' || typeof value === 'boolean') return `${value}`;
    return '-';
  }

  getComponent(project: ProjectOffer | null | undefined, key: string): any | null {
    if (!project) return null;
    for (const item of project.project?.components || []) {
      if (item && Object.prototype.hasOwnProperty.call(item, key)) {
        return item[key];
      }
    }
    return null;
  }

  getAddon(project: ProjectOffer | null | undefined, key: string): any | null {
    if (!project) return null;
    for (const item of project.project?.addons || []) {
      if (item && Object.prototype.hasOwnProperty.call(item, key)) {
        return item[key];
      }
    }
    return null;
  }

  hasAddons(project: ProjectOffer | null | undefined): boolean {
    return !!project?.project?.addons?.length;
  }

  getScopeLabel(scope: ProjectOfferScope | null | undefined): string {
    return this.getFormattedValue(scope?.scope);
  }

  getScopeDescription(scope: ProjectOfferScope | null | undefined): string {
    return scope?.description || '';
  }

  getScopeChildren(scope: ProjectOfferScope | null | undefined): ProjectOfferScope[] {
    const children = scope?.children;
    return Array.isArray(children) ? children : [];
  }

  getScopeFiles(scope: ProjectOfferScope | null | undefined): ProjectOfferFile[] {
    const files = scope?.files;
    return Array.isArray(files) ? files : [];
  }

  getRequestFiles(project: ProjectOffer | null | undefined): ProjectOfferFile[] {
    const files = project?.project?.request_files;
    return Array.isArray(files) ? files : [];
  }

  getProposalFiles(
    project: ProjectOffer | null | undefined,
    type: 'general' | 'scopes' | 'offer'
  ): ProjectOfferFile[] {
    const files = project?.project?.file?.proposal?.[type];
    return Array.isArray(files) ? files : [];
  }

  getAllProposalFiles(project: ProjectOffer | null | undefined): ProjectOfferFile[] {
    return [
      ...this.getProposalFiles(project, 'general'),
      ...this.getProposalFiles(project, 'scopes'),
      ...this.getProposalFiles(project, 'offer'),
    ];
  }

  getProjectFileName(file: ProjectOfferFile | null | undefined): string {
    const rawName = file?.name || (file?.url || '').split('/').pop()?.split('?')[0];
    return rawName ? decodeURIComponent(rawName) : (this.lang === 'ar' ? 'ملف' : 'File');
  }

  openProjectFile(file: ProjectOfferFile | null | undefined): void {
    if (!file?.uuid) {
      this.showError(
        this.lang === 'ar' ? 'تعذر فتح الملف' : 'Cannot open file',
        this.lang === 'ar' ? 'لم يتم العثور على معرّف الملف.' : 'File identifier was not found.'
      );
      return;
    }

    const fileWindow = window.open('', '_blank');
    this.openingFileUuid = file.uuid;

    this.projectOffersService.getProjectFileUrl(file.uuid)
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe({
        next: (url: string) => {
          this.openingFileUuid = null;
          if (!url) {
            if (fileWindow) fileWindow.close();
            this.showError(
              this.lang === 'ar' ? 'تعذر فتح الملف' : 'Cannot open file',
              this.lang === 'ar' ? 'لم يرجع الخادم رابط الملف.' : 'The server did not return a file URL.'
            );
            return;
          }

          if (fileWindow) {
            fileWindow.location.href = url;
          } else {
            window.open(url, '_blank');
          }
        },
        error: (err) => {
          this.openingFileUuid = null;
          if (fileWindow) fileWindow.close();
          this.handleServerErrors(err);
        },
      });
  }

  isOpeningFile(file: ProjectOfferFile | null | undefined): boolean {
    return !!file?.uuid && this.openingFileUuid === file.uuid;
  }

  getFileTypeIconPath(extension: string | null | undefined): string {
    if (!extension) return 'assets/media/svg/files/default.svg';

    const iconMap: Record<string, string> = {
      pdf: 'pdf',
      doc: 'doc',
      docx: 'docx',
      ppt: 'ppt',
      pptx: 'ppt',
      csv: 'csv',
      xlsx: 'csv',
      xml: 'xml',
      jpg: 'jpg',
      jpeg: 'jpeg',
      png: 'png',
      svg: 'SVG',
    };

    return `assets/media/svg/files/${iconMap[extension.toLowerCase()] || 'default'}.svg`;
  }

  getProjectFileExtension(file: ProjectOfferFile | null | undefined): string {
    const name = this.getProjectFileName(file);
    if (name.includes('.')) return (name.split('.').pop() || '').toLowerCase();

    const urlPath = (file?.url || '').split('?')[0];
    return urlPath.includes('.') ? (urlPath.split('.').pop() || '').toLowerCase() : '';
  }

  getCountryFlagPath(flag: string | null | undefined): string {
    return flag ? `assets/media/flags/${flag}.svg` : 'assets/media/flags/default.svg';
  }

  onFlagLoadError(event: Event): void {
    const target = event.target as HTMLImageElement | null;
    if (target) target.src = 'assets/media/flags/default.svg';
  }

  onFileIconLoadError(event: Event): void {
    const target = event.target as HTMLImageElement | null;
    if (target) target.src = 'assets/media/svg/files/default.svg';
  }

  getContractStatusLabel(project: ProjectOffer | null | undefined = this.selectedProject): string {
    if (!this.hasContract(project)) {
      return this.lang === 'ar' ? 'العقد غير متاح' : 'Contract unavailable';
    }

    const contract = this.getResolvedContract(project);
    if (!contract) {
      return this.lang === 'ar' ? 'العقد جاهز' : 'Contract ready';
    }

    if (!contract.user_sign_at) {
      return this.lang === 'ar' ? 'بانتظار توقيع العميل' : 'Waiting for client signature';
    }

    if (contract.user_sign_at && contract.insighter_sign_at) {
      return this.lang === 'ar' ? 'تم التوقيع' : 'Signed';
    }

    return this.lang === 'ar' ? 'بانتظار توقيعك' : 'Waiting your sign';
  }

  getContractStatusClass(project: ProjectOffer | null | undefined = this.selectedProject): string {
    if (!this.hasContract(project)) return 'badge-light-warning';
    const contract = this.getResolvedContract(project);
    if (!contract) return 'badge-light-primary';
    if (!contract.user_sign_at) return 'badge-light-warning';
    if (contract.user_sign_at && contract.insighter_sign_at) return 'badge-light-success';
    return 'badge-light-warning';
  }

  isContractSigned(project: ProjectOffer | null | undefined = this.selectedProject): boolean {
    const contract = this.getResolvedContract(project);
    return !!(contract?.user_sign_at && contract?.insighter_sign_at);
  }

  isClientSigned(project: ProjectOffer | null | undefined = this.selectedProject): boolean {
    return !!this.getResolvedContract(project)?.user_sign_at;
  }

  isInsighterSigned(project: ProjectOffer | null | undefined = this.selectedProject): boolean {
    const contract = this.getResolvedContract(project);
    return !!(contract?.user_sign_at && contract?.insighter_sign_at);
  }

  isContractWaiting(project: ProjectOffer | null | undefined = this.selectedProject): boolean {
    return this.hasContract(project) && !this.isContractSigned(project);
  }

  getSignatureSummaryLabel(project: ProjectOffer | null | undefined = this.selectedProject): string {
    if (!this.hasContract(project)) return this.lang === 'ar' ? 'غير متاح' : 'Unavailable';

    const contract = this.getResolvedContract(project);
    if (!contract?.user_sign_at) {
      return this.lang === 'ar' ? 'بانتظار توقيع العميل' : 'Waiting client sign';
    }

    if (contract.insighter_sign_at) {
      return this.lang === 'ar' ? 'تم التوقيع' : 'Signed';
    }

    return this.lang === 'ar' ? 'بانتظار توقيعك' : 'Waiting your sign';
  }

  getSignatureSummaryClass(project: ProjectOffer | null | undefined = this.selectedProject): string {
    if (!this.hasContract(project)) return 'owp-signature-pill--muted';
    return this.isContractSigned(project) ? 'owp-signature-pill--success' : 'owp-signature-pill--warning';
  }

  getSignatureSummaryIcon(project: ProjectOffer | null | undefined = this.selectedProject): string {
    return this.isContractSigned(project) ? 'ki-check-circle' : 'ki-time';
  }

  getClientSignatureLabel(project: ProjectOffer | null | undefined = this.selectedProject): string {
    if (!this.hasContract(project)) return this.lang === 'ar' ? 'غير متاح' : 'Unavailable';
    return this.isClientSigned(project)
      ? (this.lang === 'ar' ? 'تم التوقيع' : 'Signed')
      : (this.lang === 'ar' ? 'بانتظار العميل' : 'Waiting');
  }

  getInsighterSignatureLabel(project: ProjectOffer | null | undefined = this.selectedProject): string {
    if (!this.hasContract(project)) return this.lang === 'ar' ? 'غير متاح' : 'Unavailable';
    const contract = this.getResolvedContract(project);
    if (!contract?.user_sign_at) {
      return this.lang === 'ar' ? 'بعد العميل' : 'After client';
    }

    return contract.insighter_sign_at
      ? (this.lang === 'ar' ? 'تم التوقيع' : 'Signed')
      : (this.lang === 'ar' ? 'بانتظارك' : 'Waiting');
  }

  getClientSignatureClass(project: ProjectOffer | null | undefined = this.selectedProject): string {
    if (!this.hasContract(project)) return 'owp-signature-pill--muted';
    return this.isClientSigned(project) ? 'owp-signature-pill--success' : 'owp-signature-pill--warning';
  }

  getInsighterSignatureClass(project: ProjectOffer | null | undefined = this.selectedProject): string {
    if (!this.hasContract(project)) return 'owp-signature-pill--muted';
    return this.isInsighterSigned(project) ? 'owp-signature-pill--success' : 'owp-signature-pill--warning';
  }

  getClientSignatureIcon(project: ProjectOffer | null | undefined = this.selectedProject): string {
    return this.isClientSigned(project) ? 'ki-check-circle' : 'ki-time';
  }

  getInsighterSignatureIcon(project: ProjectOffer | null | undefined = this.selectedProject): string {
    return this.isInsighterSigned(project) ? 'ki-check-circle' : 'ki-time';
  }

  getContractTypeLabel(contract: ProjectContract | null | undefined = this.contractDetails): string {
    if (!contract) return '-';
    return contract.is_attach_type
      ? (this.lang === 'ar' ? 'عقد مخصص' : 'Custom Contract')
      : (this.lang === 'ar' ? 'عقد المنصة' : 'Platform Contract');
  }

  getDeadlineLabel(project: ProjectOffer): string {
    return this.formatDate(project.project?.deadline);
  }

  formatDate(value: string | null | undefined): string {
    if (!value) return '-';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;

    return d.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }

  trackByProject(index: number, project: ProjectOffer): string {
    return project.uuid || this.getContractUuid(project) || `${index}`;
  }

  trackByDrawerTab(_: number, tab: DrawerTabOption): DrawerTab {
    return tab.value;
  }

  trackByValue(_: number, value: string): string {
    return value;
  }

  trackByIndex(index: number): number {
    return index;
  }

  trackByScope(index: number, scope: ProjectOfferScope): string {
    return `${scope?.scope || 'scope'}-${index}`;
  }

  trackByFile(_: number, file: ProjectOfferFile): string {
    return file.uuid;
  }

  private loadContractDetails(project: ProjectOffer | null | undefined = this.selectedProject): void {
    const contractUuid = this.getContractUuid(project);
    if (!contractUuid || this.contractDetailsLoading) return;

    if (this.isLoadedContractForProject(project) && this.loadedContractUuid === contractUuid) {
      return;
    }

    const embeddedContract = this.getEmbeddedContract(project);
    const requestId = ++this.contractDetailsRequestId;
    this.contractDetailsLoading = true;
    this.contractDetailsError = false;
    this.contractDetails = embeddedContract;

    this.projectOffersService.getProjectContract(contractUuid)
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe({
        next: (contract) => {
          if (requestId !== this.contractDetailsRequestId) return;
          this.contractDetails = contract;
          this.loadedContractUuid = contractUuid;
          this.contractDetailsLoading = false;
        },
        error: (err) => {
          if (requestId !== this.contractDetailsRequestId) return;
          this.contractDetailsLoading = false;
          this.contractDetailsError = true;
          this.handleServerErrors(err);
        },
      });
  }

  private resetContractDetails(): void {
    this.contractDetails = null;
    this.contractDetailsLoading = false;
    this.contractDetailsError = false;
    this.loadedContractUuid = null;
  }

  private getContractUuid(project: ProjectOffer | null | undefined): string {
    return this.getEmbeddedContract(project)?.uuid
      || project?.contract_uuid
      || project?.project?.contract_uuid
      || project?.offer?.contract_uuid
      || '';
  }

  private isLoadedContractForProject(project: ProjectOffer | null | undefined): boolean {
    if (!this.contractDetails) return false;
    const contractUuid = this.getContractUuid(project);
    return !contractUuid || !this.contractDetails.uuid || this.contractDetails.uuid === contractUuid;
  }

  private setEmbeddedContractDetails(project: ProjectOffer | null | undefined): void {
    this.resetContractDetails();
    this.contractDetails = this.getEmbeddedContract(project);
  }

  private getResolvedContract(project: ProjectOffer | null | undefined): ProjectContract | null {
    if (this.contractDetails && this.isLoadedContractForProject(project)) {
      return this.contractDetails;
    }

    return this.getEmbeddedContract(project);
  }

  private getEmbeddedContract(project: ProjectOffer | null | undefined): ProjectContract | null {
    return project?.contract
      || project?.project?.contract
      || project?.offer?.contract
      || null;
  }

  private humanizeValue(value: string): string {
    return value
      .replace(/[_-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/\b\w/g, c => c.toUpperCase());
  }

  private getMappedLabel(
    value: string | null | undefined,
    labels: Record<string, { en: string; ar: string }>
  ): string {
    if (!value) return '-';
    const normalized = value.toLowerCase();
    const match = labels[normalized] ?? labels[value];
    if (!match) return this.humanizeValue(value);
    return this.lang === 'ar' ? match.ar : match.en;
  }

  private handleServerErrors(error: any): void {
    const message = error?.error?.message
      || error?.message
      || (this.lang === 'ar' ? 'حدث خطأ غير متوقع.' : 'An unexpected error occurred.');

    this.showError(
      this.lang === 'ar' ? 'حدث خطأ' : 'An error occurred',
      message
    );
  }
}
