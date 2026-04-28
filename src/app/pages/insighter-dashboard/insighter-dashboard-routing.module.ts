import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { InsighterDashboardComponent } from './insighter-dashboard/insighter-dashboard.component';
import { RolesGuard } from 'src/app/guards/roles-guard/roles-gurad.gurad';
import { authGuard } from 'src/app/guards/auth-guard/auth.guard';

const routes: Routes = [
  {
    path: '',
    component: InsighterDashboardComponent,
    children: [
      {
        path: '',
        redirectTo: 'my-dashboard',
        pathMatch: 'full'
      },
      {
        path: 'my-dashboard',
        loadChildren: () => import('./insighter-dashboard/my-dashboard/my-dashboard.module').then(m => m.MyDashboardModule),
        canActivate:[authGuard,RolesGuard],
        data: { roles: [ 'insighter','company','company-insighter','client'] }
        },
      {
        path: 'my-requests',
        loadChildren: () => import('./insighter-dashboard/my-requests/my-requests.module').then(m => m.MyRequestsModule),
        canActivate:[authGuard,RolesGuard],
        data: { roles: [ 'insighter','company','company-insighter'] }
      },
      {
        path: 'my-knowledge',
        loadChildren: () => import('./insighter-dashboard/my-knowledge/my-knowledge.module').then(m => m.MyKnowledgeModule),
        canActivate:[authGuard,RolesGuard],
        data: { roles: [ 'insighter','company','company-insighter'] }
      },
      {
        path: 'my-downloads',
        loadChildren: () => import('./insighter-dashboard/my-downloads/my-downloads.module').then(m => m.MyDownloadsModule),
        canActivate:[authGuard,RolesGuard],
        data: { roles: [ 'insighter','company','company-insighter','client'] }
      },
      {
        path: 'read-later',
        loadChildren: () => import('./insighter-dashboard/read-later/read-later.module').then(m => m.ReadLaterModule),
        canActivate:[authGuard]
      },
      {
        path: 'my-orders',
        loadChildren: () => import('./insighter-dashboard/my-orders/my-orders.module').then(m => m.MyOrdersModule),
        canActivate:[authGuard,RolesGuard],
        data: { roles: ['client','insighter','company','company-insighter'] }
      },
      {
        path: 'my-meetings',
        loadChildren: () => import('./insighter-dashboard/my-meetings/my-meetings.module').then(m => m.MyMeetingsModule),
        canActivate:[authGuard,RolesGuard],
        data: { roles: [ 'insighter','company','company-insighter','client'] }
      },
      {
        path: 'my-consulting-schedule',
        loadChildren: () => import('./insighter-dashboard/my-consulting-schedule/my-consulting-schedule.module').then(m => m.MyConsultingScheduleModule),
        canActivate:[authGuard,RolesGuard],
        data: { roles: [ 'insighter','company','company-insighter'] }
      },
      {
        path: 'account-settings',
        loadChildren: () => import('./insighter-dashboard/account-settings/account-settings.module').then(m => m.AccountSettingsModule),
        canActivate:[authGuard,RolesGuard],
        data: { roles: [ 'insighter','company','company-insighter','client'] },
        
      },
      {
        path: 'my-company-settings',
        loadChildren: () => import('./insighter-dashboard/my-company/my-company.module').then(m => m.MyCompanyModule),
        canActivate: [RolesGuard],
        data: { roles: ['company'] }
      },
      {
        path: 'wallet',
        loadChildren: () => import('./insighter-dashboard/wallet/wallet.module').then(m => m.WalletModule),
        canActivate: [authGuard, RolesGuard],
        data: { roles: ['insighter', 'company', 'client'] }
      },
      {
        path: 'sales',
        loadChildren: () => import('./insighter-dashboard/sales/sales.module').then(m => m.SalesModule),
        canActivate: [authGuard, RolesGuard],
        data: { roles: ['insighter', 'company', 'company-insighter'] }
      },
      {
        path: 'project-offers',
        loadChildren: () => import('./insighter-dashboard/project-offers/project-offers.module').then(m => m.ProjectOffersModule),
        canActivate: [authGuard, RolesGuard],
        data: { roles: ['insighter', 'company', 'company-insighter'] }
      },
      {
        path: 'projects-created',
        loadChildren: () => import('./insighter-dashboard/projects-created/projects-created.module').then(m => m.ProjectsCreatedModule),
        canActivate: [authGuard, RolesGuard],
        data: { roles: ['client', 'insighter', 'company', 'company-insighter'] }
      }
    ]
  }
  
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class InsighterDashboardRoutingModule { }
