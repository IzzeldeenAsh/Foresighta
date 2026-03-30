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
      [style]="{ width: 'min(92vw, 760px)' }"
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
          <div class="project-progress-badge">
            {{ lang === 'ar' ? 'إنجاز جديد' : 'Milestone unlocked' }}
          </div>

          <div class="project-progress-hero-content">
            <div class="project-progress-orb">
              <i class="pi pi-star-fill"></i>
            </div>

            <div class="project-progress-copy">
              <h2>{{ headline }}</h2>
              <p>{{ summary }}</p>
            </div>
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
              <i [class]="item.passed ? 'pi pi-check' : 'pi pi-times'"></i>
            </div>

            <div class="project-progress-item-copy">
              <div class="project-progress-item-title">{{ item.title }}</div>
              <div class="project-progress-item-description">{{ item.description }}</div>
            </div>

            <div class="project-progress-item-status">
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
      background: rgba(9, 16, 32, 0.3) !important;
      backdrop-filter: blur(12px);
    }

    :host ::ng-deep .project-progress-dialog.p-dialog {
      border: 0;
      box-shadow: none;
      background: transparent;
    }

    :host ::ng-deep .project-progress-dialog .p-dialog-content {
      border: 0;
      padding: 0 !important;
      border-radius: 28px;
      overflow: hidden;
      background: transparent;
      box-shadow: none;
    }

    .project-progress-shell {
      position: relative;
      overflow: hidden;
      border-radius: 28px;
      border: 1px solid rgba(255, 255, 255, 0.55);
      background:
        radial-gradient(circle at top left, rgba(68, 154, 255, 0.22), transparent 38%),
        radial-gradient(circle at bottom right, rgba(44, 201, 144, 0.18), transparent 34%),
        linear-gradient(145deg, rgba(255, 255, 255, 0.88), rgba(240, 247, 255, 0.74));
      backdrop-filter: blur(22px);
      box-shadow: 0 30px 80px rgba(15, 23, 42, 0.22);
    }

    .project-progress-shell::before,
    .project-progress-shell::after {
      content: '';
      position: absolute;
      border-radius: 999px;
      pointer-events: none;
      opacity: 0.7;
    }

    .project-progress-shell::before {
      width: 210px;
      height: 210px;
      top: -88px;
      right: -76px;
      background: rgba(255, 255, 255, 0.28);
    }

    .project-progress-shell::after {
      width: 180px;
      height: 180px;
      left: -90px;
      bottom: -88px;
      background: rgba(76, 175, 80, 0.08);
    }

    .project-progress-close {
      position: absolute;
      top: 20px;
      right: 20px;
      z-index: 2;
      width: 40px;
      height: 40px;
      border: 0;
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.72);
      color: #17324d;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 10px 25px rgba(15, 23, 42, 0.12);
      transition: transform 0.18s ease, background 0.18s ease;
    }

    .project-progress-close:hover {
      transform: translateY(-1px);
      background: rgba(255, 255, 255, 0.92);
    }

    [dir='rtl'] .project-progress-close {
      right: auto;
      left: 20px;
    }

    .project-progress-hero {
      position: relative;
      padding: 32px 32px 22px;
      border-bottom: 1px solid rgba(134, 159, 187, 0.22);
    }

    .project-progress-badge {
      display: inline-flex;
      align-items: center;
      padding: 0.45rem 0.8rem;
      border-radius: 999px;
      background: rgba(17, 111, 220, 0.1);
      color: #0f5fc9;
      font-size: 0.82rem;
      font-weight: 700;
      letter-spacing: 0.03em;
      text-transform: uppercase;
    }

    .project-progress-hero-content {
      display: flex;
      align-items: center;
      gap: 1rem;
      margin-top: 1rem;
    }

    .project-progress-orb {
      width: 72px;
      height: 72px;
      flex: 0 0 72px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border-radius: 24px;
      background: linear-gradient(135deg, rgba(11, 112, 255, 0.2), rgba(35, 191, 122, 0.2));
      color: #0a66d0;
      font-size: 1.75rem;
      box-shadow: inset 0 1px 1px rgba(255, 255, 255, 0.9);
      animation: projectProgressFloat 3.2s ease-in-out infinite;
    }

    .project-progress-copy h2 {
      margin: 0;
      color: #0f172a;
      font-size: 1.8rem;
      font-weight: 800;
      line-height: 1.15;
    }

    .project-progress-copy p {
      margin: 0.5rem 0 0;
      color: #4b5563;
      font-size: 1rem;
      line-height: 1.65;
    }

    .project-progress-meter {
      margin-top: 1.4rem;
      padding: 1rem 1rem 0.95rem;
      border-radius: 22px;
      background: rgba(255, 255, 255, 0.52);
      border: 1px solid rgba(255, 255, 255, 0.6);
    }

    .project-progress-meter-label {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      margin-bottom: 0.75rem;
      color: #1f2937;
      font-size: 0.95rem;
    }

    .project-progress-meter-track {
      width: 100%;
      height: 12px;
      overflow: hidden;
      border-radius: 999px;
      background: rgba(148, 163, 184, 0.22);
    }

    .project-progress-meter-fill {
      height: 100%;
      min-width: 10%;
      border-radius: inherit;
      background: linear-gradient(90deg, #0f69d8, #26c281);
      box-shadow: 0 8px 18px rgba(38, 194, 129, 0.28);
      transition: width 0.25s ease;
    }

    .project-progress-list {
      display: grid;
      gap: 0.9rem;
      padding: 1.5rem 2rem 0;
    }

    .project-progress-item {
      width: 100%;
      border: 1px solid rgba(148, 163, 184, 0.18);
      border-radius: 22px;
      background: rgba(255, 255, 255, 0.6);
      padding: 1rem 1.1rem;
      display: flex;
      align-items: center;
      gap: 0.9rem;
      text-align: left;
      transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease;
    }

    .project-progress-item:hover {
      transform: translateY(-1px);
      box-shadow: 0 18px 34px rgba(15, 23, 42, 0.09);
    }

    .project-progress-item.is-highlighted {
      border-color: rgba(15, 105, 216, 0.28);
      box-shadow: 0 22px 38px rgba(15, 105, 216, 0.1);
    }

    .project-progress-item.is-complete {
      background: rgba(239, 253, 244, 0.78);
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
      font-size: 1.1rem;
    }

    .project-progress-item-icon.is-complete {
      color: #157347;
      background: rgba(21, 115, 71, 0.12);
    }

    .project-progress-item-icon.is-pending {
      color: #b42318;
      background: rgba(180, 35, 24, 0.1);
    }

    .project-progress-item-copy {
      min-width: 0;
      flex: 1 1 auto;
    }

    .project-progress-item-title {
      color: #111827;
      font-size: 1.03rem;
      font-weight: 700;
    }

    .project-progress-item-description {
      margin-top: 0.15rem;
      color: #6b7280;
      font-size: 0.92rem;
      line-height: 1.45;
    }

    .project-progress-item-status {
      white-space: nowrap;
      color: #1f2937;
      font-size: 0.85rem;
      font-weight: 700;
    }

    .project-progress-footer {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 0.75rem;
      padding: 1.5rem 2rem 2rem;
    }

    .project-progress-primary,
    .project-progress-secondary {
      min-width: 158px;
      border-radius: 999px;
      padding-inline: 1.15rem;
    }

    @keyframes projectProgressFloat {
      0%, 100% {
        transform: translateY(0);
      }
      50% {
        transform: translateY(-4px);
      }
    }

    @media (max-width: 768px) {
      .project-progress-hero,
      .project-progress-list,
      .project-progress-footer {
        padding-left: 1.2rem;
        padding-right: 1.2rem;
      }

      .project-progress-hero-content,
      .project-progress-footer {
        flex-direction: column;
        align-items: stretch;
      }

      .project-progress-copy h2 {
        font-size: 1.45rem;
      }

      .project-progress-item {
        align-items: flex-start;
      }

      .project-progress-item-status {
        padding-top: 0.45rem;
      }

      .project-progress-primary,
      .project-progress-secondary {
        width: 100%;
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
            ? 'أكمل الصورة والنبذة والدولة لتقوية حسابك.'
            : 'Complete the photo, bio, and country essentials.',
        route: '/app/profile/settings/personal-info',
        passed: !!results.profile?.pass,
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

  get headline(): string {
    if (this.completedCount === this.items.length && this.items.length > 0) {
      return this.lang === 'ar'
        ? 'اكتمل تجهيز حساب المشروع'
        : 'Project setup complete';
    }

    switch (this.state?.trigger) {
      case 'publish_insights':
        return this.lang === 'ar' ? 'تم فتح إنجاز نشر الرؤى' : 'Insight milestone unlocked';
      case 'profile':
        return this.lang === 'ar' ? 'تم فتح إنجاز الملف الشخصي' : 'Profile milestone unlocked';
      case 'whatsapp':
        return this.lang === 'ar' ? 'تم فتح إنجاز واتساب' : 'WhatsApp milestone unlocked';
      default:
        return this.lang === 'ar' ? 'تم تحديث تقدمك' : 'Your progress was updated';
    }
  }

  get summary(): string {
    if (this.completedCount === this.items.length && this.items.length > 0) {
      return this.lang === 'ar'
        ? 'كل المهام الرئيسية مكتملة الآن. حسابك أصبح جاهزًا أكثر لفرص المشاريع.'
        : 'All main setup tasks are complete. Your account is now more ready for project opportunities.';
    }

    return this.lang === 'ar'
      ? 'كل خطوة تنجزها ترفع جاهزية حسابك. هذه هي حالتك الحالية الآن.'
      : 'Each completed task levels up your account readiness. Here is your current progress.';
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
