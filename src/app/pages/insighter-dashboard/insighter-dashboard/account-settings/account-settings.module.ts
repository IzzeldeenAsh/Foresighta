import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Routes } from '@angular/router';
import { AccountSettingsComponent } from './account-settings.component';
import { TranslationModule } from 'src/app/modules/i18n';
import { UpgradeToCompanyComponent } from './upgrade-to-company/upgrade-to-company.component';
import { GeneralSettingsComponent } from './general-settings/general-settings.component';
import { RolesGuard } from 'src/app/guards/roles-guard/roles-gurad.gurad';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { DialogModule } from 'primeng/dialog';
import { DynamicDialogModule } from 'primeng/dynamicdialog';
import { ToastModule } from 'primeng/toast';
import { ProgressBarModule } from 'primeng/progressbar';
import { ReactivateDialogComponent } from './activate-account/reactivate-dialog/reactivate-dialog.component';
import { TransferDialogComponent } from './transfer-dialog/transfer-dialog.component';
import { DeactivateDialogComponent } from './deactivate-dialog/deactivate-dialog.component';
import { DeleteDialogComponent } from './delete-dialog/delete-dialog.component';
import { ActivateAccountComponent } from './activate-account/activate-account.component';
import { ResetPasswordComponent } from './reset-password/reset-password.component';
import { TooltipModule } from 'primeng/tooltip';

const routes: Routes = [
  {
    path: '',
    component: AccountSettingsComponent,
    children: [
      {
        path: '',
        redirectTo: 'general-settings',
        pathMatch: 'full'
      },
      {
        path: 'company-account',
        component: UpgradeToCompanyComponent,
        canActivate: [RolesGuard],
        data: { roles: ['insighter'] }
      },
      {
        path: 'general-settings',
        component: GeneralSettingsComponent
      }
    ]
  }
];

@NgModule({
  declarations: [
    AccountSettingsComponent,
    UpgradeToCompanyComponent,
    GeneralSettingsComponent,
    ReactivateDialogComponent,
    TransferDialogComponent,
    DeactivateDialogComponent,
    DeleteDialogComponent,
    ActivateAccountComponent,
    ResetPasswordComponent
  ],
  imports: [
    CommonModule,
    RouterModule.forChild(routes),
    TranslationModule,
    FormsModule,
    TooltipModule,
    ReactiveFormsModule,
    DialogModule,
    DynamicDialogModule,
    ToastModule,
    ProgressBarModule
  ]
})
export class AccountSettingsModule { } 