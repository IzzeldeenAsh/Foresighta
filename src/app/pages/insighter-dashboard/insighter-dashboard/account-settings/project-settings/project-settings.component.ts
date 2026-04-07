import { Component, Injector, OnInit } from '@angular/core';
import { BehaviorSubject, catchError, finalize, forkJoin, of } from 'rxjs';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ProfileService } from 'src/app/_fake/services/get-profile/get-profile.service';
import { BaseComponent } from 'src/app/modules/base.component';
import {
  ProjectAccountCheckResults,
  ProjectAccountProperties,
  ProjectAccountProjectType,
  ProjectServiceOption,
  ProjectSettingsService,
  SyncProjectAccountPropertiesPayload,
} from './project-settings.service';

interface ProjectChecklistItem {
  key: 'publish_insights' | 'whatsapp' | 'profile';
  title: string;
  details: string[];
  route: string;
  passed: boolean;
  insightRequirements?: {
    paid: number;
    free: number;
  };
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

  checklist: ProjectChecklistItem[] = [];
  availableServices: ProjectServiceOption[] = [];
  errorMessage = '';
  servicesErrorMessage = '';
  settingsForm: FormGroup;
  private roles: string[] = [];
  private lastResults: ProjectAccountCheckResults = {};

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
    private readonly profileService: ProfileService
  ) {
    super(injector);

    this.settingsForm = this.fb.group({
      project_status: [true],
      project_languages: [[], Validators.required],
      hourly_rate: [null, [Validators.required, Validators.min(0.1)]],
      services: [[], Validators.required],
      project_types: [[], Validators.required],
    });
  }

  ngOnInit(): void {
    this.initializeRoles();

    const langSub = this.translate.onLanguageChange().subscribe(() => {
      this.checklist = this.buildChecklist(this.lastResults);
      if (this.errorMessage) {
        this.errorMessage =
          this.lang === 'ar'
            ? 'تعذر تحميل حالة إعدادات المشروع الآن.'
            : 'Unable to load the project settings checklist right now.';
      }

      if (this.allChecksPassed) {
        this.loadServices();
      }
    });
    this.unsubscribe.push(langSub);

    this.loadChecklist();
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
    const currentValue = !!this.settingsForm.get('project_status')?.value;
    this.settingsForm.patchValue({ project_status: !currentValue });
    this.settingsForm.markAsDirty();
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
      project_status: this.settingsForm.get('project_status')?.value ? 'active' : 'inactive',
      project_languages: this.mapProjectLanguagesForPayload(),
      hourly_rate: String(this.settingsForm.get('hourly_rate')?.value ?? '').trim(),
      services: this.getSelectedServices(),
      project_types: this.getSelectedProjectTypes(),
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
          this.availableServices = services;
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
    })
      .pipe(
        finalize(() => {
          this.servicesLoadingSubject.next(false);
          this.loadingSubject.next(false);
        })
      )
      .subscribe({
        next: ({ services, properties }) => {
          this.availableServices = services;
          this.patchSettingsForm(properties);
        },
      });

    this.unsubscribe.push(sub);
  }

  private initializeRoles(): void {
    this.roles = this.profileService.getCurrentUser()?.roles || [];

    const sub = this.profileService.getProfile().subscribe({
      next: (profile) => {
        this.roles = profile?.roles || [];
        this.checklist = this.buildChecklist(this.lastResults);
      },
    });

    this.unsubscribe.push(sub);
  }

  private buildChecklist(results: ProjectAccountCheckResults): ProjectChecklistItem[] {
    return [
      {
        key: 'publish_insights',
        title: this.lang === 'ar' ? 'نشر الرؤى' : 'Publish Insight',
        details: [
          this.lang === 'ar'
            ? 'استوفِ شرط نشر الرؤى.'
            : 'Meet the insight publishing requirement.',
        ],
        route: '/app/add-knowledge/stepper',
        passed: !!results.publish_insights?.pass,
        insightRequirements: {
          paid: results.publish_insights?.required?.paid ?? 0,
          free: results.publish_insights?.required?.free ?? 0,
        },
      },

      {
        key: 'profile',
        title: this.lang === 'ar' ? 'إكمال الملف الشخصي' : 'Complete Profile',
        details: this.getProfileDetails(results),
        route: '/app/profile/overview',
        passed: this.isProfileComplete(results),
      },
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

  private isProfileComplete(results: ProjectAccountCheckResults): boolean {
    const required = results.profile?.required;

    if (required) {
      return (
        this.isRequiredFieldComplete(required, 'profile_photo') &&
        this.isRequiredFieldComplete(required, 'country') &&
        (this.isCompanyAccount()
          ? this.isRequiredFieldComplete(required, 'about_us')
          : this.isRequiredFieldComplete(required, 'bio')) &&
        this.isExperienceComplete(results)
      );
    }

    return !!results.profile?.pass && this.isExperienceComplete(results);
  }

  private isExperienceComplete(results: ProjectAccountCheckResults): boolean {
    const experiencePass = results.experience?.pass;
    return experiencePass !== false &&
      experiencePass !== null &&
      experiencePass !== undefined &&
      experiencePass !== '';
  }

  private isRequiredFieldComplete(
    required: NonNullable<ProjectAccountCheckResults['profile']>['required'],
    fieldName: 'profile_photo' | 'bio' | 'about_us' | 'country'
  ): boolean {
    if (!required || !Object.prototype.hasOwnProperty.call(required, fieldName)) {
      return true;
    }

    return required[fieldName] === true;
  }

  private getProfileDetails(results: ProjectAccountCheckResults): string[] {
    const required = results.profile?.required;
    const missingFieldsEn: string[] = [];
    const missingFieldsAr: string[] = [];

    if (required) {
      if (!this.isRequiredFieldComplete(required, 'profile_photo')) {
        missingFieldsEn.push('Add profile picture');
        missingFieldsAr.push('أضف صورة شخصية');
      }

      if (this.isCompanyAccount()) {
        if (!this.isRequiredFieldComplete(required, 'about_us')) {
          missingFieldsEn.push('Add company about us');
          missingFieldsAr.push('أضف نبذة عن الشركة');
        }
      } else if (!this.isRequiredFieldComplete(required, 'bio')) {
        missingFieldsEn.push('Add bio');
        missingFieldsAr.push('أضف النبذة الشخصية');
      }

      if (!this.isRequiredFieldComplete(required, 'country')) {
        missingFieldsEn.push('Add country');
        missingFieldsAr.push('أضف البلد');
      }

      if (!this.isExperienceComplete(results)) {
        missingFieldsEn.push('Add years of experience');
        missingFieldsAr.push('أضف سنوات الخبرة');
      }
    } else if (!this.isExperienceComplete(results)) {
      missingFieldsEn.push('Add years of experience');
      missingFieldsAr.push('أضف سنوات الخبرة');
    }

    if (missingFieldsAr.length || missingFieldsEn.length) {
      return this.lang === 'ar' ? missingFieldsAr : missingFieldsEn;
    }

    return [
      this.lang === 'ar'
        ? 'تم استيفاء متطلبات الملف الشخصي.'
        : 'Profile requirement completed.',
    ];
  }

  private isCompanyAccount(): boolean {
    return this.roles.includes('company') || this.roles.includes('company-insighter');
  }

  private patchSettingsForm(properties: ProjectAccountProperties): void {
    const serviceIds = (properties.services || [])
      .map((service) => (typeof service === 'number' ? service : service?.id))
      .filter((id): id is number => typeof id === 'number');

    this.settingsForm.patchValue({
      project_status: properties.project_status !== 'inactive',
      project_languages: this.mapProjectLanguagesToSelection(properties.project_languages),
      hourly_rate:
        properties.hourly_rate == null || properties.hourly_rate === ''
          ? null
          : Number(properties.hourly_rate),
      services: serviceIds,
      project_types: this.mapProjectTypesToSelection(properties.project_types),
    });

    this.settingsForm.markAsPristine();
    this.settingsForm.markAsUntouched();
  }

  private getSelectedProjectLanguages(): Array<'english' | 'arabic'> {
    return (this.projectLanguagesControl?.value || []) as Array<'english' | 'arabic'>;
  }

  private getSelectedProjectTypes(): ProjectAccountProjectType[] {
    return (this.projectTypesControl?.value || []) as ProjectAccountProjectType[];
  }

  private getSelectedServices(): number[] {
    return (this.servicesControl?.value || []) as number[];
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
    projectTypes?: Array<ProjectAccountProjectType | 'framework' | 'urgent'>
  ): ProjectAccountProjectType[] {
    const normalizedTypes = (projectTypes || [])
      .map((projectType) => this.normalizeProjectType(projectType))
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
