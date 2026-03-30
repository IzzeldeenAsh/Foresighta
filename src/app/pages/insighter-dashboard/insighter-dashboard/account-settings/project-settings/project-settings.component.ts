import { Component, Injector, OnInit } from '@angular/core';
import { BehaviorSubject, catchError, finalize, forkJoin, of } from 'rxjs';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ProfileService } from 'src/app/_fake/services/get-profile/get-profile.service';
import { BaseComponent } from 'src/app/modules/base.component';
import {
  ProjectAccountCheckResults,
  ProjectAccountProperties,
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

  get projectLanguagesControl() {
    return this.settingsForm.get('project_languages');
  }

  get hourlyRateControl() {
    return this.settingsForm.get('hourly_rate');
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
        details: this.getPublishInsightDetails(results),
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
            ? 'فعّل إشعارات واتساب'
            : 'Enable WhatsApp notifications',
        ],
        route: '/app/insighter-dashboard/account-settings/notification-settings',
        passed: !!results.whatsapp?.pass,
      },
    ];
  }

  private getPublishInsightDetails(results: ProjectAccountCheckResults): string[] {
    const required = results.publish_insights?.required;
    const paid = required?.paid ?? 0;
    const free = required?.free ?? 0;
    const passed = !!results.publish_insights?.pass;

    if (paid > 0 || free > 0) {
      return [
        this.lang === 'ar'
          ? 'انشر العدد المطلوب من الرؤى.'
          : 'Publish the required insight mix.',
      ];
    }

    if (!passed) {
      return [
        this.lang === 'ar'
          ? 'انشر الرؤى المطلوبة.'
          : 'Publish <span class="text-info fs-6"><b>2 Free</b></span> insights and<span class="text-info fs-6 fw-bolder"><b>1 Paid</b></span> Insight.',
      ];
    }

    return [
      this.lang === 'ar'
        ? 'تم استيفاء متطلبات نشر الرؤى.'
        : 'Insight publishing requirement completed.',
    ];
  }

  private getProfileDetails(results: ProjectAccountCheckResults): string[] {
    const required = results.profile?.required;
    const missingFieldsEn: string[] = [];
    const missingFieldsAr: string[] = [];

    if (required) {
      if (required.profile_photo !== true) {
        missingFieldsEn.push('Add Profile picture');
        missingFieldsAr.push('أضف صورة شخصية');
      }

      if (this.isCompanyAccount()) {
        if (required.about_us !== true) {
          missingFieldsEn.push('Add Company About Us');
          missingFieldsAr.push('أضف نبذة عن الشركة');
        }
      } else if (required.bio !== true) {
        missingFieldsEn.push('Add Bio');
        missingFieldsAr.push('أضف النبذة الشخصية');
      }
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

  private isProfileComplete(results: ProjectAccountCheckResults): boolean {
    const required = results.profile?.required;

    if (required) {
      return (
        required.profile_photo === true &&
        (this.isCompanyAccount()
          ? required.about_us === true
          : required.bio === true)
      );
    }

    return !!results.profile?.pass;
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
    });

    this.settingsForm.markAsPristine();
    this.settingsForm.markAsUntouched();
  }

  private getSelectedProjectLanguages(): Array<'english' | 'arabic'> {
    return (this.projectLanguagesControl?.value || []) as Array<'english' | 'arabic'>;
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
