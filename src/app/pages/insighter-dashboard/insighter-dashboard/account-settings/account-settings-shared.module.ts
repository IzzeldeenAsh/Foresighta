import { CUSTOM_ELEMENTS_SCHEMA, NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { TranslationModule } from 'src/app/modules/i18n';
import { CalendarModule } from 'primeng/calendar';
import { CheckboxModule } from 'primeng/checkbox';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { DialogModule } from 'primeng/dialog';
import { SkeletonModule } from 'primeng/skeleton';
import { ConsultingScheduleComponent } from './consulting-schedule.component';
import { ProjectSettingsComponent } from './project-settings/project-settings.component';

/**
 * Declares and exports the consulting-schedule and project-settings components
 * so they can be reused both by the account-settings dashboard pages and by the
 * become-Insighter onboarding wizard (via [embedded]="true").
 *
 * Previously these were declared privately inside AccountSettingsModule; they
 * were extracted here so WizardsModule can render them without duplicating the
 * declaration (which Angular forbids).
 */
@NgModule({
  declarations: [ConsultingScheduleComponent, ProjectSettingsComponent],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    TranslationModule,
    CalendarModule,
    CheckboxModule,
    ConfirmDialogModule,
    DialogModule,
    SkeletonModule,
  ],
  exports: [ConsultingScheduleComponent, ProjectSettingsComponent],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class AccountSettingsSharedModule {}
