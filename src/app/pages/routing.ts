import { Routes } from '@angular/router';
import { NonInsightersAuthGuard } from '../guards/non-insighter-guard/non-insighters.guard';
import { authGuard } from '../guards/auth-guard/auth.guard';
import { RolesGuard } from '../guards/roles-guard/roles-gurad.gurad';
//dsds
const Routing: Routes = [
  {
    path: '',
    redirectTo: 'insighter-dashboard',
    pathMatch: 'full',
  },
  {
    path: 'insighter-register',
    loadChildren: () => import('./wizards/wizards.module').then((m) => m.WizardsModule),
    canActivate: [NonInsightersAuthGuard], 
  },
  {
    path: 'profile',
    loadChildren: () => import('./user-profile/user-profile.module').then((m) => m.UserProfileModule),
    canActivate:[authGuard,RolesGuard],
    data: { roles: [ 'insighter','company','company-insighter','client'] }
  },
  {
    path: 'add-knowledge',
    loadChildren: () => import('./add-knowledge/add-knowledge.module').then((m) => m.AddKnowledgeModule),
    canActivate:[authGuard,RolesGuard],
    data: { roles: [ 'insighter','company','company-insighter'] }
  },
  {
    path: 'edit-knowledge',
    loadChildren: () => import('./add-knowledge/add-knowledge.module').then((m) => m.AddKnowledgeModule),
    canActivate:[authGuard,RolesGuard],
    data: { roles: [ 'insighter','company','company-insighter'] }
  },
  {
    path: 'insighter-dashboard',
    loadChildren: () => import('./insighter-dashboard/insighter-dashboard.module').then((m) => m.InsighterDashboardModule),
    canActivate:[authGuard,RolesGuard],
    data: { roles: [ 'insighter','company','company-insighter','client'] } 
  },
  {
    path: 'knowledge-detail',
    loadChildren: () => import('./knowledge-detail/knowledge-detail.module').then((m) => m.KnowledgeDetailModule),
    canActivate:[authGuard,RolesGuard],
    data: { roles: [ 'insighter','company','company-insighter'] }
  },
  {
    path: 'my-knowledge-base',
    loadChildren: () => import('./my-knowledge-base/my-knowledge-base.module').then((m) => m.MyKnowledgeBaseModule),
    canActivate:[authGuard,RolesGuard],
    data: { roles: [ 'insighter','company','company-insighter'] } 
  },
  {
    path: 'review-insighter-knowledge',
    loadChildren: () => import('./review-insighter-knowledge/review-insighter-knowledge.module').then((m) => m.ReviewInsighterKnowledgeModule),
    canActivate:[authGuard,RolesGuard],
    data: { roles: ['company'] } 
  },
  {
    path: '**',
    redirectTo: 'error/404',
  },
];

export { Routing };
