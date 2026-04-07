import { CommonModule } from '@angular/common';
import { Component, Injector, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { DialogModule } from 'primeng/dialog';
import { BaseComponent } from 'src/app/modules/base.component';
import {
  ProjectProgressCelebrationService,
  ProjectProgressCelebrationState,
  ProjectProgressMilestone,
} from './project-progress-celebration.service';

interface ProjectProgressDisplayItem {
  key: ProjectProgressMilestone;
  title: string;
  description: string;
  route: string;
  passed: boolean;
}

@Component({
  selector: 'app-project-progress-celebration',
  standalone: true,
  imports: [CommonModule, DialogModule],
  template: `
    <p-dialog
      [(visible)]="visible"
      [modal]="true"
      [showHeader]="false"
      [draggable]="false"
      [resizable]="false"
      [dismissableMask]="true"
      appendTo="body"
      [closable]="false"
      [blockScroll]="true"
      [focusOnShow]="false"
      styleClass="project-progress-dialog"
      maskStyleClass="project-progress-mask"
      [style]="{ width: 'min(92vw, 620px)' }"
      [contentStyle]="{ padding: '0', overflow: 'hidden', background: 'transparent' }"
      (onHide)="close()"
    >
      <div *ngIf="state" class="project-progress-shell" [dir]="lang === 'ar' ? 'rtl' : 'ltr'">
        <button
          type="button"
          class="project-progress-close"
          (click)="close()"
          [attr.aria-label]="lang === 'ar' ? 'إغلاق' : 'Close'"
        >
          <i class="pi pi-times"></i>
        </button>

        <section class="project-progress-hero">
          <div class="project-progress-eyebrow">
            <span class="project-progress-dot"></span>
            <span>{{ lang === 'ar' ? 'إنجاز جديد' : 'Milestone unlocked' }}</span>
          </div>

          <div class="project-progress-copy">
            <h2>{{ headline }}</h2>
            <p>{{ summary }}</p>
          </div>

          <div class="project-progress-meter">
            <div class="project-progress-meter-label">
              <span>{{ lang === 'ar' ? 'تقدم المشروع' : 'Project progress' }}</span>
              <strong>{{ completedCount }}/{{ items.length }}</strong>
            </div>

            <div class="project-progress-meter-track">
              <div class="project-progress-meter-fill" [style.width]="progressWidth"></div>
            </div>
          </div>
        </section>

        <section class="project-progress-list">
          <button
            type="button"
            class="project-progress-item"
            *ngFor="let item of items"
            [class.is-complete]="item.passed"
            [class.is-highlighted]="item.key === state.trigger"
            (click)="openRoute(item.route)"
          >
            <div
              class="project-progress-item-icon"
              [class.is-complete]="item.passed"
              [class.is-pending]="!item.passed"
            >
              <i [class]="item.passed ? 'pi pi-check-circle' : 'pi pi-exclamation-circle'"></i>
            </div>

            <div class="project-progress-item-copy">
              <div class="project-progress-item-title">{{ item.title }}</div>
              <div class="project-progress-item-description">{{ item.description }}</div>
            </div>

            <div
              class="project-progress-item-status"
              [class.is-complete]="item.passed"
              [class.is-pending]="!item.passed"
            >
              {{ item.passed ? (lang === 'ar' ? 'مكتمل' : 'Done') : (lang === 'ar' ? 'قيد التقدم' : 'Pending') }}
            </div>
          </button>
        </section>

        <footer class="project-progress-footer">
          <button type="button" class="btn btn-light project-progress-secondary" (click)="close()">
            {{ lang === 'ar' ? 'متابعة' : 'Keep going' }}
          </button>

          <button
            type="button"
            class="btn btn-primary project-progress-primary"
            (click)="openRoute(projectSettingsRoute)"
          >
            {{ lang === 'ar' ? 'افتح قائمة الإعداد' : 'Open project setup' }}
          </button>
        </footer>
      </div>
    </p-dialog>
  `,
  styles: [`
    :host ::ng-deep .project-progress-mask {
      background: rgba(15, 23, 42, 0.26) !important;
      backdrop-filter: blur(10px);
    }

    :host ::ng-deep .project-progress-dialog.p-dialog {
      border: 0;
      box-shadow: none;
      background: transparent;
    }

    :host ::ng-deep .project-progress-dialog .p-dialog-content {
      border: 0;
      padding: 0 !important;
      border-radius: 30px;
      overflow: hidden;
      background: transparent;
      box-shadow: none;
    }

    .project-progress-shell {
      position: relative;
      overflow: hidden;
      border-radius: 30px;
      border: 1px solid rgba(226, 232, 240, 0.8);
      background: #fbfcff;
      box-shadow: 0 26px 70px rgba(27, 37, 59, 0.18);
      padding: 40px;
    }

    .project-progress-close {
      position: absolute;
      top: 37px;
      right: 38px;
      z-index: 2;
      width: 28px;
      height: 28px;
      border: 0;
      border-radius: 50%;
      background: transparent;
      color: #93a3bb;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 1.15rem;
      transition: color 0.18s ease, transform 0.18s ease;
    }

    .project-progress-close:hover {
      transform: translateY(-1px);
      color: #536179;
    }

    [dir='rtl'] .project-progress-close {
      right: auto;
      left: 38px;
    }

    .project-progress-hero {
      position: relative;
      padding: 0;
    }

    .project-progress-eyebrow {
      display: flex;
      align-items: center;
      gap: 0.85rem;
      color: #4776ff;
      font-size: 0.92rem;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    .project-progress-dot {
      width: 10px;
      height: 10px;
      flex: 0 0 10px;
      border-radius: 50%;
      background: #8eacff;
    }

    .project-progress-copy h2 {
      margin: 14px 0 0;
      padding-inline-end: 34px;
      color: #121a2f;
      font-size: 1.75rem;
      font-weight: 800;
      line-height: 1.18;
    }

    .project-progress-copy p {
      margin: 18px 0 0;
      color: #73829a;
      font-size: 1rem;
      font-weight: 600;
      line-height: 1.6;
      max-width: 540px;
    }

    .project-progress-meter {
      margin-top: 30px;
    }

    .project-progress-meter-label {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      margin-bottom: 14px;
      color: #4c596e;
      font-size: 0.95rem;
      font-weight: 700;
    }

    .project-progress-meter-label strong {
      color: #121a2f;
      font-size: 0.95rem;
    }

    .project-progress-meter-track {
      width: 100%;
      height: 10px;
      overflow: hidden;
      border-radius: 999px;
      background: #edf1f7;
    }

    .project-progress-meter-fill {
      height: 100%;
      border-radius: inherit;
      background: linear-gradient(90deg, #4776ff 0%, #45c287 100%);
      transition: width 0.25s ease;
    }

    .project-progress-list {
      display: grid;
      gap: 16px;
      padding: 36px 0 0;
    }

    .project-progress-item {
      width: 100%;
      min-height: 92px;
      border: 1px solid #eef2f7;
      border-radius: 20px;
      background: #ffffff;
      padding: 20px;
      display: flex;
      align-items: center;
      gap: 20px;
      text-align: left;
      box-shadow: 0 12px 26px rgba(31, 44, 69, 0.035);
      transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease, background 0.18s ease;
    }

    .project-progress-item:hover {
      transform: translateY(-1px);
      box-shadow: 0 18px 34px rgba(31, 44, 69, 0.08);
    }

    .project-progress-item.is-highlighted {
      border-color: rgba(71, 118, 255, 0.2);
    }

    .project-progress-item.is-complete {
      border-color: #dff7ec;
      background: #f8fffb;
    }

    [dir='rtl'] .project-progress-item {
      text-align: right;
    }

    .project-progress-item-icon {
      width: 48px;
      height: 48px;
      flex: 0 0 48px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border-radius: 16px;
      font-size: 1.35rem;
    }

    .project-progress-item-icon.is-complete {
      color: #2ab77a;
      background: #ddfaea;
    }

    .project-progress-item-icon.is-pending {
      color: #8fa0b7;
      background: #f5f8fc;
    }

    .project-progress-item-copy {
      min-width: 0;
      flex: 1 1 auto;
    }

    .project-progress-item-title {
      color: #1a2338;
      font-size: 1rem;
      font-weight: 800;
      line-height: 1.25;
    }

    .project-progress-item-description {
      margin-top: 8px;
      color: #75849e;
      font-size: 0.93rem;
      font-weight: 600;
      line-height: 1.45;
    }

    .project-progress-item-status {
      margin-inline-start: auto;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      white-space: nowrap;
      border-radius: 999px;
      padding: 0.42rem 0.85rem;
      font-size: 0.85rem;
      font-weight: 700;
      line-height: 1;
    }

    .project-progress-item-status.is-complete {
      color: #2e9b6c;
      background: #dff9ea;
    }

    .project-progress-item-status.is-pending {
      color: #c77808;
      background: #fff1cc;
    }

    .project-progress-footer {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 16px;
      padding: 38px 0 0;
    }

    .project-progress-primary,
    .project-progress-secondary {
      min-width: 152px;
      min-height: 48px;
      border-radius: 14px;
      padding: 0.75rem 1.35rem;
      font-weight: 800;
      font-size: 1rem;
    }

    .project-progress-primary {
      border: 0 !important;
      color: #ffffff !important;
      background: linear-gradient(180deg, #477bff 0%, #2e63f4 100%) !important;
      box-shadow: 0 12px 22px rgba(47, 101, 246, 0.3);
    }

    .project-progress-secondary {
      border: 0 !important;
      color: #536179 !important;
      background: transparent !important;
      box-shadow: none !important;
    }

    @media (max-width: 768px) {
      .project-progress-shell {
        padding: 32px 24px 28px;
      }

      .project-progress-close {
        top: 28px;
        right: 24px;
      }

      .project-progress-copy h2 {
        font-size: 1.5rem;
      }

      .project-progress-item {
        align-items: flex-start;
        gap: 14px;
      }

      .project-progress-item-status {
        margin-top: 2px;
      }

      [dir='rtl'] .project-progress-close {
        left: 24px;
      }
    }

    @media (max-width: 520px) {
      .project-progress-shell {
        padding: 28px 18px 22px;
      }

      .project-progress-close {
        top: 24px;
        right: 18px;
      }

      [dir='rtl'] .project-progress-close {
        left: 18px;
      }

      .project-progress-copy h2 {
        padding-inline-end: 26px;
      }

      .project-progress-item {
        flex-wrap: wrap;
      }

      .project-progress-item-copy {
        flex: 1 1 calc(100% - 68px);
      }

      .project-progress-item-status {
        margin-inline-start: 68px;
      }

      .project-progress-primary,
      .project-progress-secondary {
        width: 100%;
      }

      .project-progress-footer {
        flex-direction: column-reverse;
      }
    }
  `],
})
export class ProjectProgressCelebrationComponent extends BaseComponent implements OnInit {
  readonly projectSettingsRoute = '/app/insighter-dashboard/account-settings/project-settings';
  visible = false;
  state: ProjectProgressCelebrationState | null = null;

  constructor(
    injector: Injector,
    private readonly router: Router,
    private readonly celebrationService: ProjectProgressCelebrationService
  ) {
    super(injector);
  }

  ngOnInit(): void {
    const sub = this.celebrationService.celebrationState$.subscribe((state) => {
      this.state = state;
      this.visible = !!state;
    });

    this.unsubscribe.push(sub);
  }

  get items(): ProjectProgressDisplayItem[] {
    const results = this.state?.results ?? {};

    return [
      {
        key: 'publish_insights',
        title: this.lang === 'ar' ? 'نشر الرؤى' : 'Publish Insight',
        description:
          this.lang === 'ar'
            ? 'استوفِ شرط نشر الرؤى لفتح فرص المشاريع.'
            : 'Meet the insight publishing requirement.',
        route: '/app/add-knowledge/stepper',
        passed: !!results.publish_insights?.pass,
      },
      {
        key: 'profile',
        title: this.lang === 'ar' ? 'إكمال الملف الشخصي' : 'Complete Profile',
        description:
          this.lang === 'ar'
            ? 'أكمل النبذة أو نبذة الشركة والدولة وسنوات الخبرة لتقوية حسابك.'
            : 'Complete your bio or company about us, country, and years of experience essentials.',
        route: '/app/profile/settings/personal-info',
        passed: !!results.profile?.pass && this.isExperienceComplete(),
      },
      {
        key: 'whatsapp',
        title: this.lang === 'ar' ? 'تفعيل واتساب' : 'Enable WhatsApp',
        description:
          this.lang === 'ar'
            ? 'أضف رقم واتساب لتصلك الإشعارات بسرعة.'
            : 'Add your WhatsApp number for faster notifications.',
        route: '/app/insighter-dashboard/account-settings/notification-settings',
        passed: !!results.whatsapp?.pass,
      },
    ];
  }

  get completedCount(): number {
    return this.items.filter((item) => item.passed).length;
  }

  get progressWidth(): string {
    const total = this.items.length || 1;
    return `${(this.completedCount / total) * 100}%`;
  }

  private isExperienceComplete(): boolean {
    const experiencePass = this.state?.results?.experience?.pass;
    return experiencePass !== false &&
      experiencePass !== null &&
      experiencePass !== undefined &&
      experiencePass !== '';
  }

  get headline(): string {
    if (this.completedCount === this.items.length && this.items.length > 0) {
      return this.lang === 'ar'
        ? 'اكتمل تجهيز ميزة المشاريع'
        : 'Project Feature Unlocked!';
    }

    return this.lang === 'ar'
      ? 'اقتربت! افتح ميزة المشاريع'
      : 'Almost There! Unlock Project Feature!';
  }

  get summary(): string {
    if (this.completedCount === this.items.length && this.items.length > 0) {
      return this.lang === 'ar'
        ? 'كل المهام الرئيسية مكتملة الآن. حسابك أصبح جاهزًا أكثر لفرص المشاريع.'
        : 'All main setup tasks are complete. Your account is ready for project opportunities.';
    }

    return this.lang === 'ar'
      ? 'كل خطوة تنجزها ترفع جاهزية حسابك. هذه هي حالتك الحالية الآن.'
      : 'Each completed task builds up your account readiness. Here\'s your current progress!';
  }

  close(): void {
    this.visible = false;
    this.celebrationService.dismiss();
  }

  openRoute(route: string): void {
    this.close();
    void this.router.navigateByUrl(route);
  }
}
