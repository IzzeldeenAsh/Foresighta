import { Component, Injector, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Observable } from 'rxjs';
import { finalize, takeUntil } from 'rxjs/operators';
import {
  ProjectContract,
  ProjectFileUploadType,
  ProjectOfferFile,
  ProjectOffer,
  ProjectOffersPaginatedResponse,
  ProjectOffersService,
  ProjectOfferScope,
  ProjectOfferType,
  ProjectReviewSubmission,
  ProjectReviewSubmissionType,
} from 'src/app/_fake/services/project-offers/project-offers.service';
import { BaseComponent } from 'src/app/modules/base.component';

type ViewMode = 'grid' | 'list';
type DrawerTab = 'overview' | 'documents' | 'reviews' | 'contract';

interface ProjectFileTypeOption {
  value: ProjectFileUploadType;
  labelEn: string;
  labelAr: string;
}

interface ProjectReviewTypeOption {
  value: ProjectReviewSubmissionType;
  labelEn: string;
  labelAr: string;
}

interface ProjectDeliveryDocumentGroup {
  key: string;
  labelEn: string;
  labelAr: string;
  descriptionEn: string;
  descriptionAr: string;
  files: ProjectOfferFile[];
}

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

const PROJECT_FILE_GROUP_META: Record<string, Omit<ProjectDeliveryDocumentGroup, 'files'>> = {
  first_draft: {
    key: 'first_draft',
    labelEn: 'First Draft',
    labelAr: 'المسودة الأولى',
    descriptionEn: 'Initial deliverables uploaded for client review.',
    descriptionAr: 'المخرجات الأولية المرفوعة لمراجعة العميل.',
  },
  final_draft: {
    key: 'final_draft',
    labelEn: 'Final Draft',
    labelAr: 'المسودة النهائية',
    descriptionEn: 'Final delivery files prepared for acceptance.',
    descriptionAr: 'ملفات التسليم النهائية الجاهزة للاعتماد.',
  },
  samples: {
    key: 'samples',
    labelEn: 'Samples',
    labelAr: 'عينات',
    descriptionEn: 'Sample materials and partial outputs.',
    descriptionAr: 'مواد عينة ومخرجات جزئية.',
  },
  document: {
    key: 'document',
    labelEn: 'Documents',
    labelAr: 'مستندات',
    descriptionEn: 'Supporting documents and working files.',
    descriptionAr: 'المستندات الداعمة وملفات العمل.',
  },
  other: {
    key: 'other',
    labelEn: 'Other',
    labelAr: 'أخرى',
    descriptionEn: 'Additional project materials.',
    descriptionAr: 'مواد إضافية للمشروع.',
  },
  unknown: {
    key: 'unknown',
    labelEn: 'Uncategorized',
    labelAr: 'غير مصنفة',
    descriptionEn: 'Files without a delivery category.',
    descriptionAr: 'ملفات بدون تصنيف تسليم.',
  },
};

const PROJECT_FILE_GROUP_ORDER = ['first_draft', 'final_draft', 'samples', 'document', 'other'];

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
  projectDetailsLoading = false;
  projectDetailsError = false;
  reviewSubmissionsLoading = false;
  reviewSubmissions: ProjectReviewSubmission[] = [];
  projectFileName = '';
  projectFileType: ProjectFileUploadType = 'first_draft';
  selectedProjectFiles: File[] = [];
  projectFilesUploading = false;
  reviewRequestType: ProjectReviewSubmissionType = 'first_draft';
  reviewRequestNote = '';
  reviewRequestSubmitting = false;

  currentPage = 1;
  rows = 10;
  first = 0;
  totalRecords = 0;
  private contractDetailsRequestId = 0;
  private projectDetailsRequestId = 0;
  private reviewSubmissionsRequestId = 0;
  private loadedContractUuid: string | null = null;
  private loadedProjectDetailsUuid: string | null = null;
  private loadedReviewProjectUuid: string | null = null;

  projectTypeOptions: ProjectTypeMeta[] = [
    { key: 'ad_hoc', labelEn: 'Ad Hoc', labelAr: 'خاص' },
    { key: 'frame_work_agreement', labelEn: 'Framework Agreement', labelAr: 'اتفاقية إطارية' },
    { key: 'urgent_request', labelEn: 'Urgent Request', labelAr: 'طلب عاجل' },
  ];
  drawerTabOptions: DrawerTabOption[] = [
    { value: 'overview', labelEn: 'Overview', labelAr: 'نظرة عامة' },
    { value: 'documents', labelEn: 'Documents', labelAr: 'المستندات' },
    { value: 'reviews', labelEn: 'Review Request', labelAr: 'طلب المراجعة' },
    { value: 'contract', labelEn: 'Contract', labelAr: 'العقد' },
  ];
  projectFileTypeOptions: ProjectFileTypeOption[] = [
    { value: 'first_draft', labelEn: 'First Draft', labelAr: 'المسودة الأولى' },
    { value: 'final_draft', labelEn: 'Final Draft', labelAr: 'المسودة النهائية' },
    { value: 'samples', labelEn: 'Samples', labelAr: 'عينات' },
    { value: 'document', labelEn: 'Documents', labelAr: 'مستندات' },
    { value: 'other', labelEn: 'Other', labelAr: 'أخرى' },
  ];
  reviewRequestTypeOptions: ProjectReviewTypeOption[] = [
    { value: 'first_draft', labelEn: 'First Draft', labelAr: 'المسودة الأولى' },
    { value: 'final_draft', labelEn: 'Final Draft', labelAr: 'المسودة النهائية' },
    { value: 'session_completed', labelEn: 'Session Completed', labelAr: 'اكتمال الجلسة' },
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
    this.resetDocumentsWorkspace();
  }

  closeDrawer(): void {
    this.drawerVisible = false;
    this.selectedProject = null;
    this.activeDrawerTab = 'overview';
    this.resetContractDetails();
    this.resetDocumentsWorkspace();
    this.contractDetailsRequestId++;
    this.projectDetailsRequestId++;
    this.reviewSubmissionsRequestId++;
  }

  setDrawerTab(tab: DrawerTab): void {
    this.activeDrawerTab = tab;

    if (tab === 'contract') {
      this.loadContractDetails();
    } else if (tab === 'documents') {
      this.loadDocumentsWorkspace();
    } else if (tab === 'reviews') {
      this.loadReviewWorkspace();
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

  getProjectDeliveryFiles(project: ProjectOffer | null | undefined = this.selectedProject): ProjectOfferFile[] {
    const files = project?.project?.file?.project;
    return Array.isArray(files) ? files : [];
  }

  getDeliveryDocumentGroups(project: ProjectOffer | null | undefined = this.selectedProject): ProjectDeliveryDocumentGroup[] {
    const grouped = new Map<string, ProjectOfferFile[]>();

    this.getProjectDeliveryFiles(project).forEach(file => {
      const key = this.normalizeProjectFileType(file.second_identifier || file.type || file.identifier || 'unknown');
      const groupKey = PROJECT_FILE_GROUP_META[key] ? key : 'unknown';
      grouped.set(groupKey, [...(grouped.get(groupKey) || []), file]);
    });

    const orderedKeys = [
      ...PROJECT_FILE_GROUP_ORDER,
      ...Array.from(grouped.keys()).filter(key => !PROJECT_FILE_GROUP_ORDER.includes(key) && key !== 'unknown'),
      'unknown',
    ];

    return orderedKeys
      .filter(key => grouped.has(key))
      .map(key => ({
        ...(PROJECT_FILE_GROUP_META[key] || PROJECT_FILE_GROUP_META.unknown),
        key,
        files: grouped.get(key) || [],
      }));
  }

  getDeliveryDocumentCount(project: ProjectOffer | null | undefined = this.selectedProject): number {
    return this.getProjectDeliveryFiles(project).length;
  }

  hasAnyProjectDocuments(project: ProjectOffer | null | undefined = this.selectedProject): boolean {
    return !!(
      this.getDeliveryDocumentCount(project)
      || this.getAllProposalFiles(project).length
      || this.getRequestFiles(project).length
    );
  }

  getDocumentGroupLabel(group: ProjectDeliveryDocumentGroup): string {
    return this.lang === 'ar' ? group.labelAr : group.labelEn;
  }

  getDocumentGroupDescription(group: ProjectDeliveryDocumentGroup): string {
    return this.lang === 'ar' ? group.descriptionAr : group.descriptionEn;
  }

  getProjectFileTypeLabel(value: string | null | undefined): string {
    const normalized = this.normalizeProjectFileType(value || '');
    const option = this.projectFileTypeOptions.find(item => item.value === normalized);
    if (option) return this.lang === 'ar' ? option.labelAr : option.labelEn;
    const meta = PROJECT_FILE_GROUP_META[normalized];
    if (meta) return this.lang === 'ar' ? meta.labelAr : meta.labelEn;
    return this.humanizeValue(value || '');
  }

  getReviewTypeLabel(value: string | null | undefined): string {
    const normalized = this.normalizeProjectFileType(value || '');
    const option = this.reviewRequestTypeOptions.find(item => item.value === normalized);
    if (option) return this.lang === 'ar' ? option.labelAr : option.labelEn;
    return this.getProjectFileTypeLabel(value);
  }

  getSortedReviewSubmissions(): ProjectReviewSubmission[] {
    const statusRank: Record<string, number> = {
      pending: 0,
      changes_requested: 1,
      approved: 2,
    };

    return [...this.reviewSubmissions].sort((a, b) => {
      const aRank = statusRank[this.normalizeProjectFileType(a.status || '')] ?? 9;
      const bRank = statusRank[this.normalizeProjectFileType(b.status || '')] ?? 9;
      if (aRank !== bRank) return aRank - bRank;

      return this.getDateTime(b.request_at) - this.getDateTime(a.request_at);
    });
  }

  getReviewStatusLabel(status: string | null | undefined): string {
    const labels: Record<string, { en: string; ar: string }> = {
      pending: { en: 'Pending', ar: 'قيد الانتظار' },
      approved: { en: 'Approved', ar: 'تم الاعتماد' },
      changes_requested: { en: 'Changes Requested', ar: 'مطلوب تعديلات' },
      request_change: { en: 'Changes Requested', ar: 'مطلوب تعديلات' },
    };
    const normalized = this.normalizeProjectFileType(status || '');
    const match = labels[normalized];
    if (match) return this.lang === 'ar' ? match.ar : match.en;
    return this.humanizeValue(status || '');
  }

  getReviewStatusClass(status: string | null | undefined): string {
    switch (this.normalizeProjectFileType(status || '')) {
      case 'approved':
        return 'badge-light-success';
      case 'changes_requested':
      case 'request_change':
        return 'badge-light-warning';
      case 'pending':
        return 'badge-light-primary';
      default:
        return 'badge-light-info';
    }
  }

  getReviewType(review: ProjectReviewSubmission | null | undefined): string {
    return this.normalizeProjectFileType(
      review?.type
      || review?.second_identifier
      || review?.identifier
      || ''
    );
  }

  hasPendingReviewForType(type: ProjectReviewSubmissionType = this.reviewRequestType): boolean {
    const normalizedType = this.normalizeProjectFileType(type);
    return this.reviewSubmissions.some(review => (
      this.normalizeProjectFileType(review.status || '') === 'pending'
      && this.getReviewType(review) === normalizedType
    ));
  }

  canSubmitReviewRequest(): boolean {
    return !!(
      this.selectedProject
      && !this.reviewRequestSubmitting
      && (this.reviewRequestNote || '').trim()
      && !this.hasPendingReviewForType(this.reviewRequestType)
    );
  }

  onProjectFilesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = input.files ? Array.from(input.files) : [];
    if (!files.length) return;

    this.selectedProjectFiles = [...this.selectedProjectFiles, ...files];
    input.value = '';
  }

  removeSelectedProjectFile(index: number): void {
    this.selectedProjectFiles = this.selectedProjectFiles.filter((_, fileIndex) => fileIndex !== index);
  }

  submitProjectFileUpload(): void {
    if (this.projectFilesUploading) return;

    const projectUuid = this.getProjectUuid(this.selectedProject);
    const name = (this.projectFileName || '').trim();

    if (!projectUuid || !name || !this.projectFileType || !this.selectedProjectFiles.length) {
      this.showError(
        this.lang === 'ar' ? 'تعذر رفع الملفات' : 'Cannot upload files',
        this.lang === 'ar'
          ? 'يرجى إدخال اسم واختيار نوع وملف واحد على الأقل.'
          : 'Enter a name, choose a type, and attach at least one file.'
      );
      return;
    }

    const payload = new FormData();
    payload.append('name', name);
    payload.append('type', this.projectFileType);
    this.selectedProjectFiles.forEach(file => payload.append('file', file, file.name));

    this.projectFilesUploading = true;
    this.projectOffersService.uploadInsighterProjectFile(projectUuid, payload)
      .pipe(
        takeUntil(this.unsubscribe$),
        finalize(() => (this.projectFilesUploading = false))
      )
      .subscribe({
        next: () => {
          this.showSuccess(
            this.lang === 'ar' ? 'تم رفع الملفات' : 'Files uploaded',
            this.lang === 'ar'
              ? 'تم رفع ملفات المشروع بنجاح.'
              : 'Project files were uploaded successfully.'
          );
          this.projectFileName = '';
          this.selectedProjectFiles = [];
          this.loadInsighterProjectDetails(true);
        },
        error: err => this.handleServerErrors(err),
      });
  }

  submitReviewRequest(): void {
    if (this.reviewRequestSubmitting) return;

    const projectUuid = this.getProjectUuid(this.selectedProject);
    const note = (this.reviewRequestNote || '').trim();

    if (!projectUuid || !note || this.hasPendingReviewForType(this.reviewRequestType)) {
      this.showError(
        this.lang === 'ar' ? 'تعذر إرسال طلب المراجعة' : 'Cannot request review',
        this.lang === 'ar'
          ? 'يرجى كتابة ملاحظة والتأكد من عدم وجود طلب معلق لنفس النوع.'
          : 'Add a note and make sure there is no pending request for the same type.'
      );
      return;
    }

    this.reviewRequestSubmitting = true;
    this.projectOffersService.requestProjectReview(projectUuid, {
      type: this.reviewRequestType,
      note,
    })
      .pipe(
        takeUntil(this.unsubscribe$),
        finalize(() => (this.reviewRequestSubmitting = false))
      )
      .subscribe({
        next: () => {
          this.showSuccess(
            this.lang === 'ar' ? 'تم إرسال الطلب' : 'Review requested',
            this.lang === 'ar'
              ? 'تم إرسال طلب المراجعة إلى العميل.'
              : 'The review request was sent to the client.'
          );
          this.reviewRequestNote = '';
          this.loadProjectReviewSubmissions(true);
        },
        error: err => this.handleServerErrors(err),
      });
  }

  formatFileSize(file: File): string {
    if (!file?.size) return '0 KB';
    const sizeInKb = file.size / 1024;
    if (sizeInKb < 1024) return `${sizeInKb.toFixed(sizeInKb >= 10 ? 0 : 1)} KB`;
    return `${(sizeInKb / 1024).toFixed(1)} MB`;
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

  trackByDocumentGroup(_: number, group: ProjectDeliveryDocumentGroup): string {
    return group.key;
  }

  trackByReview(_: number, review: ProjectReviewSubmission): string {
    return review.uuid;
  }

  trackByFileOption(_: number, option: ProjectFileTypeOption): ProjectFileUploadType {
    return option.value;
  }

  trackByReviewTypeOption(_: number, option: ProjectReviewTypeOption): ProjectReviewSubmissionType {
    return option.value;
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

  private loadDocumentsWorkspace(): void {
    this.loadInsighterProjectDetails();
  }

  private loadReviewWorkspace(): void {
    this.loadProjectReviewSubmissions();
  }

  private loadInsighterProjectDetails(force = false): void {
    const projectUuid = this.getProjectUuid(this.selectedProject);
    if (!projectUuid || this.projectDetailsLoading) return;
    if (!force && this.loadedProjectDetailsUuid === projectUuid) return;

    const requestId = ++this.projectDetailsRequestId;
    this.projectDetailsLoading = true;
    this.projectDetailsError = false;

    this.projectOffersService.getInsighterProjectDetails(projectUuid)
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe({
        next: project => {
          if (requestId !== this.projectDetailsRequestId) return;
          this.selectedProject = project;
          this.replaceProjectInList(project);
          this.setEmbeddedContractDetails(project);
          this.loadedProjectDetailsUuid = projectUuid;
          this.projectDetailsLoading = false;
        },
        error: err => {
          if (requestId !== this.projectDetailsRequestId) return;
          this.projectDetailsLoading = false;
          this.projectDetailsError = true;
          this.handleServerErrors(err);
        },
      });
  }

  private loadProjectReviewSubmissions(force = false): void {
    const projectUuid = this.getProjectUuid(this.selectedProject);
    if (!projectUuid || this.reviewSubmissionsLoading) return;
    if (!force && this.loadedReviewProjectUuid === projectUuid) return;

    const requestId = ++this.reviewSubmissionsRequestId;
    this.reviewSubmissionsLoading = true;

    this.projectOffersService.getProjectReviewSubmissions(projectUuid)
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe({
        next: reviews => {
          if (requestId !== this.reviewSubmissionsRequestId) return;
          this.reviewSubmissions = reviews;
          this.loadedReviewProjectUuid = projectUuid;
          this.reviewSubmissionsLoading = false;
        },
        error: err => {
          if (requestId !== this.reviewSubmissionsRequestId) return;
          this.reviewSubmissionsLoading = false;
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

  private resetDocumentsWorkspace(clearSelections = true): void {
    this.projectDetailsLoading = false;
    this.projectDetailsError = false;
    this.reviewSubmissionsLoading = false;
    this.reviewSubmissions = [];
    this.loadedProjectDetailsUuid = null;
    this.loadedReviewProjectUuid = null;

    if (clearSelections) {
      this.projectFileName = '';
      this.projectFileType = 'first_draft';
      this.selectedProjectFiles = [];
      this.projectFilesUploading = false;
      this.reviewRequestType = 'first_draft';
      this.reviewRequestNote = '';
      this.reviewRequestSubmitting = false;
    }
  }

  private replaceProjectInList(project: ProjectOffer): void {
    const projectUuid = this.getProjectUuid(project);
    if (!projectUuid) return;

    this.projects = this.projects.map(item => (
      this.getProjectUuid(item) === projectUuid ? project : item
    ));
  }

  private getContractUuid(project: ProjectOffer | null | undefined): string {
    return this.getEmbeddedContract(project)?.uuid
      || project?.contract_uuid
      || project?.project?.contract_uuid
      || project?.offer?.contract_uuid
      || '';
  }

  private getProjectUuid(project: ProjectOffer | null | undefined): string {
    return project?.project?.uuid || project?.uuid || '';
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

  private normalizeProjectFileType(value: string): string {
    return (value || '').trim().toLowerCase().replace(/[-\s]+/g, '_');
  }

  private getDateTime(value: string | null | undefined): number {
    if (!value) return 0;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? 0 : date.getTime();
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
