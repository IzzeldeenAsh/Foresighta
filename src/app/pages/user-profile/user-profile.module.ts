  import { CUSTOM_ELEMENTS_SCHEMA, NgModule } from '@angular/core';
  import { CommonModule } from '@angular/common';

  import { UserProfileRoutingModule } from './user-profile-routing.module';
  import { ProfileComponent } from './profile.component';
  import { SharedModule } from 'src/app/_metronic/shared/shared.module';
  import { DropdownMenusModule } from 'src/app/_metronic/partials';
  import { ProfileHeaderComponent } from './profile-header/profile-header.component';
  import { ActionButtonsComponent } from './action-buttons/action-buttons.component';
  import { NavigationTabsComponent } from './navigation-tabs/navigation-tabs.component';
  import { TranslationModule } from 'src/app/modules/i18n';
  import { OverviewComponent } from './profile-pages/overview/overview.component';
  import { FormsModule, ReactiveFormsModule } from '@angular/forms';
  import { ProgressBarModule } from 'primeng/progressbar';
  import { DropdownModule } from 'primeng/dropdown';
  import { DialogModule } from 'primeng/dialog';
  import { TreeSelectModule } from 'primeng/treeselect';
  import { MultiSelectModule } from 'primeng/multiselect';
  import { ToastModule } from 'primeng/toast';
  import { MessageService } from 'primeng/api';
  import { ButtonModule } from 'primeng/button';
  import { FileUploadModule } from 'primeng/fileupload';
  import { CertificatesComponent } from './profile-pages/certificates/certificates.component';
  import { DocumentsComponent } from './profile-pages/documents/documents.component';
  import { ResetPasswordComponent } from './profile-pages/account-settings/reset-password/reset-password.component';
  import { DialogService, DynamicDialogModule } from 'primeng/dynamicdialog';
  import { TooltipModule } from 'primeng/tooltip';
  import { UpgradeToCompanyComponent } from './profile-pages/account-settings/upgrade-to-company/upgrade-to-company.component';
import { SharedTreeSelectorComponent } from 'src/app/reusable-components/shared-tree-selector/shared-tree-selector.component';
import { InsightersModalComponent } from './profile-pages/account-settings/insighters-modal/insighters-modal.component';
import { InputTextModule } from 'primeng/inputtext';
import { SettingsDashboardComponent } from './profile-pages/account-settings/settings-dashboard/settings-dashboard.component';
import { SettingsSidebarComponent } from './profile-pages/account-settings/settings-sidebar/settings-sidebar.component';
import { CompanySettingsComponent } from './profile-pages/account-settings/company-settings/company-settings.component';
import { PersonalSettingsComponent } from './profile-pages/account-settings/personal-settings/personal-settings.component';
import { SettingsActionComponent } from './profile-pages/account-settings/settings-action/settings-action.component';
import { DeactivateModalComponent } from './profile-pages/account-settings/deactivate-modal/deactivate-modal.component';
import { UserRequestsComponent } from './profile-pages/user-requests/user-requests.component';
import { NgbActiveModal, NgbModalModule } from '@ng-bootstrap/ng-bootstrap';
import { InlineSVGModule } from 'ng-inline-svg-2';
import { DeleteWithDataComponent } from './profile-pages/account-settings/delete-with-data/delete-with-data.component';
import { ReactivateModalComponent } from './profile-pages/account-settings/reactivate-modal/reactivate-modal.component';
import { ConfirmDialogModule } from 'primeng/confirmdialog';



  @NgModule({
    declarations: [
      ProfileComponent,
      ProfileHeaderComponent,
      UserRequestsComponent,
      ActionButtonsComponent,
      NavigationTabsComponent,
      SettingsActionComponent,
      CompanySettingsComponent,
      PersonalSettingsComponent,
      DocumentsComponent,
      DeactivateModalComponent,
      SettingsSidebarComponent,
      SettingsDashboardComponent,
      OverviewComponent,
      DeleteWithDataComponent,
      UpgradeToCompanyComponent,
      InsightersModalComponent,
      ReactivateModalComponent,
      CertificatesComponent,
      ResetPasswordComponent,
    ],
    imports: [
      CommonModule,
      UserProfileRoutingModule,
      FormsModule,
      ConfirmDialogModule,
      SharedModule,
      ReactiveFormsModule,
      DynamicDialogModule,
      ToastModule,
      InputTextModule,
      SharedTreeSelectorComponent,
      NgbModalModule,
      FileUploadModule,
      ProgressBarModule,
      ButtonModule,
      DynamicDialogModule,
      InlineSVGModule,
      DropdownModule,
      TooltipModule,
      DialogModule,
      TreeSelectModule,
      MultiSelectModule,
      TranslationModule,
      DropdownMenusModule
    ],
    providers: [ DialogService,NgbActiveModal],
    schemas: [CUSTOM_ELEMENTS_SCHEMA]  // Add this line
  })
  export class UserProfileModule { }
