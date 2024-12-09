import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ProfileComponent } from './profile.component';
import { AuthGuard } from 'src/app/guards/auth-guard/auth.guard';
import { OverviewComponent } from './profile-pages/overview/overview.component';
import { AccountSettingsComponent } from './profile-pages/account-settings/account-settings.component';
import { CertificatesComponent } from './profile-pages/certificates/certificates.component';
import { RolesGuard } from 'src/app/guards/roles-guard/roles-gurad.gurad';
import { DocumentsComponent } from './profile-pages/documents/documents.component';
import { UpgradeToCompanyComponent } from './profile-pages/account-settings/upgrade-to-company/upgrade-to-company.component';

const routes: Routes = [
  {
    path:'',
   component:ProfileComponent,
   children:[
    {
      path:'',
      redirectTo:'overview',
      pathMatch:'full'
    },
    {
      path:'overview',
      component:OverviewComponent
    },
    {
      path:'documents',
      component:DocumentsComponent,
      canActivate:[RolesGuard],
      data: { roles: [ 'company'] } 
    },
    {
      path:'certificates',
      component:CertificatesComponent,
      canActivate:[RolesGuard],
      data: { roles: ['insighter', 'company'] } 
    },
    {
      path: 'settings',
      component: AccountSettingsComponent,
      canActivate: [AuthGuard], // Apply guards here
      data: { roles: ['insighter', 'company'] } 
    },
    {
      path:'company-account',
      component:UpgradeToCompanyComponent,
      canActivate:[RolesGuard],
      data: { roles: ['insighter'] } 
    },
   ]
  },
 
 
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class UserProfileRoutingModule { }
