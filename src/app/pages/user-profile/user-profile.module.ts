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
import { CompanyComponent } from './profile-pages/company/company.component';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { ProgressBarModule } from 'primeng/progressbar';
import { DropdownModule } from 'primeng/dropdown';
import { DialogModule } from 'primeng/dialog';
import { TreeSelectModule } from 'primeng/treeselect';
import { MultiSelectModule } from 'primeng/multiselect';
import { ToastModule } from 'primeng/toast';
import { ButtonModule } from 'primeng/button';
import { FileUploadModule } from 'primeng/fileupload';
import { CertificatesComponent } from './profile-pages/certificates/certificates.component';
import { CompanyCertificatesComponent } from './profile-pages/company-certificates/company-certificates.component';
import { DocumentsComponent } from './profile-pages/documents/documents.component';
import { DialogService, DynamicDialogModule } from 'primeng/dynamicdialog';
import { TooltipModule } from 'primeng/tooltip';
import { SharedTreeSelectorComponent } from 'src/app/reusable-components/shared-tree-selector/shared-tree-selector.component';
import { PhoneNumberInputModule } from 'src/app/reusable-components/phone-number-input/phone-number-input.module';
import { InputTextModule } from 'primeng/inputtext';
import { SettingsDashboardComponent } from './profile-pages/account-settings/settings-dashboard/settings-dashboard.component';
import { SettingsSidebarComponent } from './profile-pages/account-settings/settings-sidebar/settings-sidebar.component';
import { CompanySettingsComponent } from './profile-pages/account-settings/company-settings/company-settings.component';
import { PersonalSettingsComponent } from './profile-pages/account-settings/personal-settings/personal-settings.component';
import { NgbActiveModal, NgbModalModule } from '@ng-bootstrap/ng-bootstrap';
import { InlineSVGModule } from 'ng-inline-svg-2';
import { ReactivateModalComponent } from './profile-pages/account-settings/reactivate-modal/reactivate-modal.component';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ResetPasswordComponent } from './profile-pages/account-settings/reset-password/reset-password.component';
import { JoinCompanyComponent } from './profile-pages/join-company/join-company.component';
import { MenuModule } from 'primeng/menu';
import { InsighterDashboardSharedModule } from '../insighter-dashboard/insighter-dashboard/shared/shared.module';
import { CountryDropdownComponent } from 'src/app/reusable-components/country-dropdown/country-dropdown.component';

  @NgModule({
    declarations: [
      ProfileComponent,
      ProfileHeaderComponent,
      ActionButtonsComponent,
      NavigationTabsComponent,
      CompanySettingsComponent,
      JoinCompanyComponent,
      PersonalSettingsComponent,
      DocumentsComponent,
      SettingsSidebarComponent,
      SettingsDashboardComponent,
      OverviewComponent,
      CompanyComponent,
      ReactivateModalComponent,
      ResetPasswordComponent,
      CertificatesComponent,
      CompanyCertificatesComponent,
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
      PhoneNumberInputModule,
      CountryDropdownComponent,
      TranslationModule,
      DropdownMenusModule,
      MenuModule
    ],
    providers: [DialogService, NgbActiveModal],
    schemas: [CUSTOM_ELEMENTS_SCHEMA]  // Add this line
  })
  export class UserProfileModule { }
