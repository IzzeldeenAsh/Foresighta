import { Component, Injector, OnInit } from '@angular/core';
import { BehaviorSubject, finalize } from 'rxjs';
import { BaseComponent } from 'src/app/modules/base.component';
import {
  ProjectAccountCheckResults,
  ProjectSettingsService,
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

  checklist: ProjectChecklistItem[] = [];
  errorMessage = '';
  private lastResults: ProjectAccountCheckResults = {};

  private readonly loadingSubject = new BehaviorSubject<boolean>(true);
  readonly isLoading$ = this.loadingSubject.asObservable();

  constructor(
    injector: Injector,
    private readonly projectSettingsService: ProjectSettingsService
  ) {
    super(injector);
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
    });
    this.unsubscribe.push(langSub);

    this.loadChecklist();
  }

  get completedCount(): number {
    return this.checklist.filter((item) => item.passed).length;
  }

  private loadChecklist(): void {
    this.loadingSubject.next(true);
    this.errorMessage = '';

    const sub = this.projectSettingsService
      .getProjectAccountCheck()
      .pipe(finalize(() => this.loadingSubject.next(false)))
      .subscribe({
        next: (results) => {
          this.lastResults = results;
          this.checklist = this.buildChecklist(results);
        },
        error: () => {
          this.lastResults = {};
          this.checklist = this.buildChecklist({});
          this.errorMessage =
            this.lang === 'ar'
              ? 'تعذر تحميل حالة إعدادات المشروع الآن.'
              : 'Unable to load the project settings checklist right now.';
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
      {
        key: 'profile',
        title: this.lang === 'ar' ? 'إكمال الملف الشخصي' : 'Complete Profile',
        details: this.getProfileDetails(results),
        route: '/app/profile/overview',
        passed: !!results.profile?.pass,
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
    const passed = !!results.profile?.pass;

    if (required) {
      if (required.profile_photo == null || required.profile_photo === false) {
        missingFieldsEn.push('Add Profile picture');
        missingFieldsAr.push('أضف صورة شخصية');
      }

      if (required.about_us !== true) {
        missingFieldsEn.push('Add About us / Bio');
        missingFieldsAr.push('أضف About us / Bio');
      }

      if (required.country !== true) {
        missingFieldsEn.push('Add a country');
        missingFieldsAr.push('أضف الدولة');
      }
    }

    if (missingFieldsAr.length || missingFieldsEn.length) {
      return this.lang === 'ar' ? missingFieldsAr : missingFieldsEn;
    }

    if (!passed) {
      return this.lang === 'ar'
        ? ['أضف صورة شخصية', 'أضف About us / Bio', 'أضف الدولة']
        : ['Add Profile picture', 'Add About us / Bio', 'Add a country'];
    }

    return [
      this.lang === 'ar'
        ? 'تم استيفاء متطلبات الملف الشخصي.'
        : 'Profile requirement completed.',
    ];
  }
}
