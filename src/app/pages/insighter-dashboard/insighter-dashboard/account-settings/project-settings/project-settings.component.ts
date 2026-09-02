import { Component, Injector, Input, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable, catchError, concatMap, finalize, forkJoin, map, of } from 'rxjs';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { GuidelineDetail, GuidelinesService } from 'src/app/_fake/services/guidelines/guidelines.service';
import { ProfileService } from 'src/app/_fake/services/get-profile/get-profile.service';
import { BaseComponent } from 'src/app/modules/base.component';
import {
  ProjectAccountCheckResults,
  ProjectAccountProperties,
  ProjectAccountProjectType,
  ProjectAccountTypeOption,
  ProjectServiceOption,
  ProjectSettingsService,
  SyncProjectAccountPropertiesPayload,
} from './project-settings.service';

interface ProjectChecklistItem {
  key: 'whatsapp';
  title: string;
  details: string[];
  route: string;
  passed: boolean;
}

interface ProjectTypeOption {
  key: ProjectAccountProjectType;
  labelEn: string;
  labelAr: string;
  descriptionEn: string;
  descriptionAr: string;
}

@Component({
  selector: 'app-project-settings',
  templateUrl: './project-settings.component.html',
  styleUrls: ['./project-settings.component.scss']
})
export class ProjectSettingsComponent extends BaseComponent implements OnInit {
  readonly heroImageUrl =
    'https://res.cloudinary.com/dsiku9ipv/image/upload/v1774534037/closeup-businessmen-shaking-hands-after-successful-agreement_rzar4j.webp';
  readonly projectLanguageOptions = [
    {
      key: 'english',
      labelEn: 'English',
      labelAr: 'الإنجليزية',
    },
    {
      key: 'arabic',
      labelEn: 'Arabic',
      labelAr: 'العربية',
    },
  ] as const;
  readonly projectTypeOptions: ReadonlyArray<ProjectTypeOption> = [
    {
      key: 'ad_hoc',
      labelEn: 'Ad hoc (single request)',
      labelAr: 'Ad hoc (طلب واحد)',
      descriptionEn: 'Single request with a clear scope and delivery.',
      descriptionAr: 'طلب واحد بنطاق واضح ومخرجات محددة.',
    },
    {
      key: 'frame_work_agreement',
      labelEn: 'Framework (multi-request)',
      labelAr: 'Framework (طلبات متعددة)',
      descriptionEn: 'Ongoing collaboration with repeated work orders.',
      descriptionAr: 'تعاون مستمر مع أوامر عمل متعددة عند الحاجة.',
    },
    {
      key: 'urgent_request',
      labelEn: 'Within 24 hours',
      labelAr: 'خلال 24 ساعة',
      descriptionEn: 'Priority handling for urgent and time-sensitive requests.',
      descriptionAr: 'أولوية للطلبات العاجلة والحساسة زمنيًا.',
    },
  ];

  /**
   * When true the component is rendered inside the become-Insighter onboarding
   * wizard: the setup checklist and the receive-offers activation toggle are
   * hidden, the preferences form is shown directly, and the wizard drives save
   * via saveForOnboarding().
   */
  @Input() embedded = false;

  checklist: ProjectChecklistItem[] = [];
  availableServices: ProjectServiceOption[] = [];
  errorMessage = '';
  servicesErrorMessage = '';
  agreementErrorMessage = '';
  projectServiceAgreement: GuidelineDetail | null = null;
  projectServiceAgreementHtml: SafeHtml | null = null;
  isAgreementLoading = false;
  isAgreementDialogVisible = false;
  isProjectStatusUpdating = false;
  settingsForm: FormGroup;
  private lastResults: ProjectAccountCheckResults = {};
  private readonly hiddenServiceSlugs = new Set(['other']);
  private projectServiceAgreementAccepted = false;

  private readonly loadingSubject = new BehaviorSubject<boolean>(true);
  private readonly servicesLoadingSubject = new BehaviorSubject<boolean>(false);
  private readonly savingSubject = new BehaviorSubject<boolean>(false);
  readonly isLoading$ = this.loadingSubject.asObservable();
  readonly isServicesLoading$ = this.servicesLoadingSubject.asObservable();
  readonly isSaving$ = this.savingSubject.asObservable();

  constructor(
    injector: Injector,
    private readonly fb: FormBuilder,
    private readonly projectSettingsService: ProjectSettingsService,
    private readonly profileService: ProfileService,
    private readonly router: Router,
    private readonly guidelinesService: GuidelinesService,
    private readonly sanitizer: DomSanitizer
  ) {
    super(injector);

    this.settingsForm = this.fb.group({
      project_status: [true],
      project_languages: [[], Validators.required],
      hourly_rate: [null, [Validators.required, Validators.min(0.1)]],
      services: [[], Validators.required],
      service_match_ai: [false],
      project_types: [[], Validators.required],
    });
  }

  ngOnInit(): void {
    const langSub = this.translate.onLanguageChange().subscribe(() => {
      this.checklist = this.buildChecklist(this.lastResults);
      if (this.errorMessage) {
        this.errorMessage =
          this.lang === 'ar'
            ? 'تعذر تحميل حالة إعدادات المشروع الآن.'
            : 'Unable to load the project settings checklist right now.';
      }

      if (this.allChecksPassed || this.embedded) {
        this.loadServices();
        this.loadProjectServiceAgreement();
      }
    });
    this.unsubscribe.push(langSub);

    if (this.embedded) {
      // Onboarding: skip the checklist gate and load the preferences form directly.
      this.loadProjectSettingsData();
    } else {
      this.loadChecklist();
    }
  }

  /**
   * Save used by the onboarding wizard. Reuses the same validation and payload
   * as submitProjectSettings() but returns whether the save succeeded so the
   * wizard can advance to the next step.
   */
  saveForOnboarding(): Observable<boolean> {
    if (this.settingsForm.invalid) {
      this.settingsForm.markAllAsTouched();
      this.showError(
        '',
        this.lang === 'ar'
          ? 'يرجى تعبئة جميع الحقول المطلوبة.'
          : 'Please complete all required fields.'
      );
      return of(false);
    }

    const payload: SyncProjectAccountPropertiesPayload = {
      languages: this.mapProjectLanguagesForPayload(),
      hourly_rate: String(this.settingsForm.get('hourly_rate')?.value ?? '').trim(),
      services: this.getSelectedServices(),
      service_match_ai: !!this.settingsForm.get('service_match_ai')?.value,
      types: this.getSelectedProjectTypes(),
    };

    this.savingSubject.next(true);

    return this.projectSettingsService.syncProjectAccountProperties(payload).pipe(
      map(() => {
        this.settingsForm.markAsPristine();
        this.showSuccess(
          '',
          this.lang === 'ar'
            ? 'تم تحديث إعدادات المشروع بنجاح.'
            : 'Project settings updated successfully.'
        );
        return true;
      }),
      catchError((error) => {
        this.showError('', this.extractErrorMessage(error));
        return of(false);
      }),
      finalize(() => this.savingSubject.next(false))
    );
  }

  get completedCount(): number {
    return this.checklist.filter((item) => item.passed).length;
  }

  get allChecksPassed(): boolean {
    return this.checklist.length > 0 && this.checklist.every((item) => item.passed);
  }

  get isRtl(): boolean {
    return this.lang === 'ar';
  }

  get projectLanguagesControl() {
    return this.settingsForm.get('project_languages');
  }

  get hourlyRateControl() {
    return this.settingsForm.get('hourly_rate');
  }

  get projectTypesControl() {
    return this.settingsForm.get('project_types');
  }

  get servicesControl() {
    return this.settingsForm.get('services');
  }

  toggleProjectStatus(): void {
    if (this.isProjectStatusUpdating) {
      return;
    }

    const currentValue = !!this.settingsForm.get('project_status')?.value;
    const nextValue = !currentValue;

    if (nextValue) {
      this.openProjectServiceAgreementDialog();
      return;
    }

    this.updateProjectStatus(nextValue);
  }

  agreeAndActivateProjectOffers(): void {
    if (
      this.isProjectStatusUpdating ||
      this.isAgreementLoading ||
      this.agreementErrorMessage ||
      !this.projectServiceAgreement
    ) {
      return;
    }

    this.updateProjectStatus(true, !this.projectServiceAgreementAccepted);
  }

  private updateProjectStatus(nextValue: boolean, acceptAgreement = false): void {
    this.isProjectStatusUpdating = true;

    const request$ = nextValue
      ? acceptAgreement
        ? this.projectSettingsService.acceptProjectServiceAgreement().pipe(
            concatMap(() => this.projectSettingsService.activateReceivingProjectService())
          )
        : this.projectSettingsService.activateReceivingProjectService()
      : this.projectSettingsService.deactivateReceivingProjectService();

    const sub = request$
      .pipe(finalize(() => (this.isProjectStatusUpdating = false)))
      .subscribe({
        next: () => {
          this.settingsForm.patchValue({ project_status: nextValue }, { emitEvent: false });
          this.settingsForm.get('project_status')?.markAsPristine();

          if (acceptAgreement) {
            this.projectServiceAgreementAccepted = true;
          }

          if (nextValue) {
            this.isAgreementDialogVisible = false;
          }

          this.refreshProfile();

          this.showSuccess(
            '',
            nextValue
              ? this.lang === 'ar'
                ? 'تم تفعيل استقبال عروض المشاريع.'
                : 'Receiving project offers activated.'
              : this.lang === 'ar'
                ? 'تم إيقاف استقبال عروض المشاريع.'
                : 'Receiving project offers deactivated.'
          );
        },
        error: (error) => {
          this.showError('', this.extractErrorMessage(error));
        },
      });

    this.unsubscribe.push(sub);
  }

  private refreshProfile(): void {
    const sub = this.profileService.refreshProfile().subscribe({
      error: () => undefined,
    });

    this.unsubscribe.push(sub);
  }

  toggleProjectLanguage(language: 'english' | 'arabic'): void {
    const currentValues = this.getSelectedProjectLanguages();
    const nextValues = currentValues.includes(language)
      ? currentValues.filter((value) => value !== language)
      : [...currentValues, language];

    this.projectLanguagesControl?.setValue(nextValues);
    this.projectLanguagesControl?.markAsTouched();
    this.projectLanguagesControl?.markAsDirty();
  }

  isProjectLanguageSelected(language: 'english' | 'arabic'): boolean {
    return this.getSelectedProjectLanguages().includes(language);
  }

  toggleProjectType(projectType: ProjectAccountProjectType): void {
    const currentValues = this.getSelectedProjectTypes();
    const nextValues = currentValues.includes(projectType)
      ? currentValues.filter((value) => value !== projectType)
      : [...currentValues, projectType];

    this.projectTypesControl?.setValue(nextValues);
    this.projectTypesControl?.markAsTouched();
    this.projectTypesControl?.markAsDirty();
  }

  isProjectTypeSelected(projectType: ProjectAccountProjectType): boolean {
    return this.getSelectedProjectTypes().includes(projectType);
  }

  toggleService(serviceId: number): void {
    const currentValues = this.getSelectedServices();
    const nextValues = currentValues.includes(serviceId)
      ? currentValues.filter((id) => id !== serviceId)
      : [...currentValues, serviceId];

    this.servicesControl?.setValue(nextValues);
    this.servicesControl?.markAsTouched();
    this.servicesControl?.markAsDirty();
  }

  isServiceSelected(serviceId: number): boolean {
    return this.getSelectedServices().includes(serviceId);
  }

  toggleServiceMatchAi(): void {
    const current = !!this.settingsForm.get('service_match_ai')?.value;
    this.settingsForm.patchValue({ service_match_ai: !current });
    this.settingsForm.markAsDirty();
  }

  submitProjectSettings(): void {
    if (this.settingsForm.invalid) {
      this.settingsForm.markAllAsTouched();
      this.showError(
        '',
        this.lang === 'ar'
          ? 'يرجى تعبئة جميع الحقول المطلوبة.'
          : 'Please complete all required fields.'
      );
      return;
    }

    const payload: SyncProjectAccountPropertiesPayload = {
      languages: this.mapProjectLanguagesForPayload(),
      hourly_rate: String(this.settingsForm.get('hourly_rate')?.value ?? '').trim(),
      services: this.getSelectedServices(),
      service_match_ai: !!this.settingsForm.get('service_match_ai')?.value,
      types: this.getSelectedProjectTypes(),
    };

    this.savingSubject.next(true);

    const sub = this.projectSettingsService
      .syncProjectAccountProperties(payload)
      .pipe(finalize(() => this.savingSubject.next(false)))
      .subscribe({
        next: () => {
          this.settingsForm.markAsPristine();
          this.showSuccess(
            '',
            this.lang === 'ar'
              ? 'تم تحديث إعدادات المشروع بنجاح.'
              : 'Project settings updated successfully.'
          );
        },
        error: (error) => {
          this.showError('', this.extractErrorMessage(error));
        },
      });

    this.unsubscribe.push(sub);
  }

  private loadChecklist(): void {
    this.loadingSubject.next(true);
    this.errorMessage = '';

    const sub = this.projectSettingsService
      .getProjectAccountCheck()
      .subscribe({
        next: (results) => {
          this.lastResults = results;
          this.checklist = this.buildChecklist(results);

          if (this.allChecksPassed) {
            this.loadProjectSettingsData();
          } else {
            this.availableServices = [];
            this.servicesErrorMessage = '';
            this.loadingSubject.next(false);
          }
        },
        error: () => {
          this.lastResults = {};
          this.checklist = this.buildChecklist({});
          this.errorMessage =
            this.lang === 'ar'
              ? 'تعذر تحميل حالة إعدادات المشروع الآن.'
              : 'Unable to load the project settings checklist right now.';
          this.loadingSubject.next(false);
        },
      });

    this.unsubscribe.push(sub);
  }

  private loadServices(): void {
    this.servicesLoadingSubject.next(true);
    this.servicesErrorMessage = '';

    const sub = this.projectSettingsService
      .getProjectServices()
      .pipe(finalize(() => this.servicesLoadingSubject.next(false)))
      .subscribe({
        next: (services) => {
          this.availableServices = this.filterVisibleServices(services);
        },
        error: (error) => {
          this.availableServices = [];
          this.servicesErrorMessage = this.extractErrorMessage(
            error,
            this.lang === 'ar'
              ? 'تعذر تحميل قائمة الخدمات الآن.'
              : 'Unable to load the services list right now.'
          );
        },
      });

    this.unsubscribe.push(sub);
  }

  private loadProjectSettingsData(): void {
    this.servicesLoadingSubject.next(true);
    this.servicesErrorMessage = '';
    this.isAgreementLoading = true;
    this.agreementErrorMessage = '';

    const sub = forkJoin({
      services: this.projectSettingsService.getProjectServices().pipe(
        catchError((error) => {
          this.servicesErrorMessage = this.extractErrorMessage(
            error,
            this.lang === 'ar'
              ? 'تعذر تحميل قائمة الخدمات الآن.'
              : 'Unable to load the services list right now.'
          );

          return of([] as ProjectServiceOption[]);
        })
      ),
      properties: this.projectSettingsService.getProjectAccountProperties().pipe(
        catchError(() => of({} as ProjectAccountProperties))
      ),
      agreement: this.guidelinesService.getCurrentGuidelineByType('project_service_agreement').pipe(
        catchError((error) => {
          this.agreementErrorMessage = this.extractErrorMessage(
            error,
            this.lang === 'ar'
              ? 'تعذر تحميل اتفاقية خدمات المشاريع الآن.'
              : 'Unable to load the project services agreement right now.'
          );

          return of(null as GuidelineDetail | null);
        })
      ),
    })
      .pipe(
        finalize(() => {
          this.servicesLoadingSubject.next(false);
          this.isAgreementLoading = false;
          this.loadingSubject.next(false);
        })
      )
      .subscribe({
        next: ({ services, properties, agreement }) => {
          this.availableServices = this.filterVisibleServices(services);
          this.setProjectServiceAgreement(agreement);
          this.patchSettingsForm(properties);
        },
      });

    this.unsubscribe.push(sub);
  }

  private loadProjectServiceAgreement(): void {
    this.isAgreementLoading = true;
    this.agreementErrorMessage = '';

    const sub = this.guidelinesService
      .getCurrentGuidelineByType('project_service_agreement')
      .pipe(finalize(() => (this.isAgreementLoading = false)))
      .subscribe({
        next: (agreement) => this.setProjectServiceAgreement(agreement),
        error: (error) => {
          this.setProjectServiceAgreement(null);
          this.agreementErrorMessage = this.extractErrorMessage(
            error,
            this.lang === 'ar'
              ? 'تعذر تحميل اتفاقية خدمات المشاريع الآن.'
              : 'Unable to load the project services agreement right now.'
          );
        },
      });

    this.unsubscribe.push(sub);
  }

  /** WhatsApp is the only requirement gating project offers. */
  private buildChecklist(results: ProjectAccountCheckResults): ProjectChecklistItem[] {
    return [
      {
        key: 'whatsapp',
        title: this.lang === 'ar' ? 'تفعيل واتساب' : 'Enable WhatsApp',
        details: [
          this.lang === 'ar'
            ? 'أضف رقم واتساب لتصلك الإشعارات بسرعة.'
            : 'Add your WhatsApp number for faster notifications.',
        ],
        route: '/app/insighter-dashboard/account-settings/notification-settings',
        passed: !!results.whatsapp?.pass,
      },
    ];
  }

  openChecklistRoute(event: Event, route: string): void {
    event.preventDefault();

    if (/^https?:\/\//.test(route)) {
      window.location.href = route;
      return;
    }

    void this.router.navigateByUrl(route);
  }

  openProjectServiceAgreementDialog(): void {
    this.isAgreementDialogVisible = true;

    if (!this.projectServiceAgreement && !this.isAgreementLoading) {
      this.loadProjectServiceAgreement();
    }
  }

  private patchSettingsForm(properties: ProjectAccountProperties): void {
    const serviceIds = (properties.services || [])
      .map((service) => (typeof service === 'number' ? service : service?.id))
      .filter((id): id is number => typeof id === 'number')
      .filter((id) => this.isVisibleServiceId(id));

    const projectStatus = this.mapReceiveProjectServicesStatus(properties);
    this.projectServiceAgreementAccepted =
      projectStatus || this.isProjectServiceAgreementAccepted(properties);

    this.settingsForm.patchValue({
      project_status: projectStatus,
      project_languages: this.mapProjectLanguagesToSelection(properties.languages),
      hourly_rate:
        properties.hourly_rate == null || properties.hourly_rate === ''
          ? null
          : Number(properties.hourly_rate),
      services: serviceIds,
      service_match_ai: !!properties.service_match_ai,
      project_types: this.mapProjectTypesToSelection(properties.types),
    });

    this.settingsForm.markAsPristine();
    this.settingsForm.markAsUntouched();
  }

  private setProjectServiceAgreement(agreement: GuidelineDetail | null): void {
    this.projectServiceAgreement = agreement;
    this.projectServiceAgreementHtml = agreement
      ? this.sanitizer.bypassSecurityTrustHtml(agreement.guideline || '')
      : null;
  }

  private mapReceiveProjectServicesStatus(properties: ProjectAccountProperties): boolean {
    const status = properties.receive_project_services ?? properties.status;
    return status !== 'inactive';
  }

  private isProjectServiceAgreementAccepted(properties: ProjectAccountProperties): boolean {
    return !!(
      properties.project_service_agreement_accepted ||
      properties.project_service_agreement ||
      properties.accept_agreement ||
      properties.agreement
    );
  }

  private getSelectedProjectLanguages(): Array<'english' | 'arabic'> {
    return (this.projectLanguagesControl?.value || []) as Array<'english' | 'arabic'>;
  }

  private getSelectedProjectTypes(): ProjectAccountProjectType[] {
    return (this.projectTypesControl?.value || []) as ProjectAccountProjectType[];
  }

  private getSelectedServices(): number[] {
    const selectedServices = (this.servicesControl?.value || []) as number[];

    if (!this.availableServices.length) {
      return selectedServices;
    }

    return selectedServices.filter((id) => this.isVisibleServiceId(id));
  }

  private filterVisibleServices(services: ProjectServiceOption[]): ProjectServiceOption[] {
    return services.filter(
      (service) => !this.hiddenServiceSlugs.has((service.slug || '').toLowerCase())
    );
  }

  private isVisibleServiceId(serviceId: number): boolean {
    if (!this.availableServices.length) {
      return true;
    }

    return this.availableServices.some((service) => service.id === serviceId);
  }

  private mapProjectLanguagesForPayload(): 'english' | 'arabic' | 'both' {
    const selectedLanguages = this.getSelectedProjectLanguages();

    if (selectedLanguages.length === 2) {
      return 'both';
    }

    return selectedLanguages[0] === 'arabic' ? 'arabic' : 'english';
  }

  private mapProjectLanguagesToSelection(
    projectLanguage?: 'english' | 'arabic' | 'both'
  ): Array<'english' | 'arabic'> {
    if (projectLanguage === 'both') {
      return ['english', 'arabic'];
    }

    if (projectLanguage === 'arabic') {
      return ['arabic'];
    }

    if (projectLanguage === 'english') {
      return ['english'];
    }

    return [];
  }

  private mapProjectTypesToSelection(
    projectTypes?: Array<ProjectAccountTypeOption | ProjectAccountProjectType | 'framework' | 'urgent'>
  ): ProjectAccountProjectType[] {
    const normalizedTypes = (projectTypes || [])
      .map((entry) => {
        const raw = typeof entry === 'object' && entry !== null
          ? (entry as ProjectAccountTypeOption).project_type
          : entry as ProjectAccountProjectType | 'framework' | 'urgent';
        return this.normalizeProjectType(raw);
      })
      .filter((projectType): projectType is ProjectAccountProjectType => !!projectType);

    return normalizedTypes.filter(
      (projectType, index) => normalizedTypes.indexOf(projectType) === index
    );
  }

  private normalizeProjectType(
    projectType?: ProjectAccountProjectType | 'framework' | 'urgent' | null
  ): ProjectAccountProjectType | null {
    if (projectType === 'ad_hoc') {
      return 'ad_hoc';
    }

    if (projectType === 'frame_work_agreement' || projectType === 'framework') {
      return 'frame_work_agreement';
    }

    if (projectType === 'urgent_request' || projectType === 'urgent') {
      return 'urgent_request';
    }

    return null;
  }

  private extractErrorMessage(error: any, fallback?: string): string {
    const defaultMessage =
      fallback ||
      (this.lang === 'ar'
        ? 'حدث خطأ غير متوقع. يرجى المحاولة مرة أخرى.'
        : 'An unexpected error occurred. Please try again.');

    const message = error?.error?.message;
    if (typeof message === 'string' && message.trim()) {
      return message;
    }

    const errors = error?.error?.errors;
    if (Array.isArray(errors) && errors.length) {
      return errors.join(', ');
    }

    if (errors && typeof errors === 'object') {
      const flattenedMessages = Object.values(errors)
        .reduce<string[]>((messages, value) => {
          if (Array.isArray(value)) {
            return [...messages, ...value.filter(Boolean).map(String)];
          }

          if (value) {
            messages.push(String(value));
          }

          return messages;
        }, [])
        .join(', ');

      if (flattenedMessages) {
        return flattenedMessages;
      }
    }

    return defaultMessage;
  }
}
