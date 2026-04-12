import { Routes } from '@angular/router';
import { NonInsightersAuthGuard } from '../guards/non-insighter-guard/non-insighters.guard';
import { authGuard } from '../guards/auth-guard/auth.guard';
import { RolesGuard } from '../guards/roles-guard/roles-gurad.gurad';
import { PaymentGuard } from '../guards/payment-guard/payment.guard';
import { SetupPaymentGuard } from '../guards/setup-payment-guard/setup-payment.guard';
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
    path: 'add-knowledge',
    loadChildren: () => import('./add-knowledge/add-knowledge.module').then((m) => m.AddKnowledgeModule),
    canActivate: [authGuard, RolesGuard],
    data: { roles: ['insighter', 'company', 'company-insighter'] }
  },
  {
    path: 'edit-knowledge',
    loadChildren: () => import('./add-knowledge/add-knowledge.module').then((m) => m.AddKnowledgeModule),
    canActivate: [authGuard, RolesGuard],
    data: { roles: ['insighter', 'company', 'company-insighter'] }
  },
  {
    path: 'insighter-dashboard',
    loadChildren: () => import('./insighter-dashboard/insighter-dashboard.module').then((m) => m.InsighterDashboardModule),
    canActivate: [authGuard, RolesGuard],
    data: { roles: ['insighter', 'company', 'company-insighter', 'client'] }
  },
  {
    path: 'knowledge-detail',
    loadChildren: () => import('./knowledge-detail/knowledge-detail.module').then((m) => m.KnowledgeDetailModule),
    canActivate: [authGuard, RolesGuard],
    data: { roles: ['insighter', 'company', 'company-insighter'] }
  },
  {
    path: 'my-knowledge-base',
    loadChildren: () => import('./my-knowledge-base/my-knowledge-base.module').then((m) => m.MyKnowledgeBaseModule),
    canActivate: [authGuard, RolesGuard],
    data: { roles: ['insighter', 'company', 'company-insighter'] }
  },
  {
    path: 'review-insighter-knowledge',
    loadChildren: () => import('./review-insighter-knowledge/review-insighter-knowledge.module').then((m) => m.ReviewInsighterKnowledgeModule),
    canActivate: [authGuard, RolesGuard],
    data: { roles: ['company'] }
  },
  {
    path: 'setup-payment-info',
    loadChildren: () => import('./setup-payment-info/setup-payment-info.module').then((m) => m.SetupPaymentInfoModule),
    canActivate: [authGuard],
  },
  {
    path: 'invoice/:orderNo',
    loadChildren: () => import('./invoice-page/invoice-page.module').then((m) => m.InvoicePageModule),
    canActivate: [authGuard, RolesGuard],
    data: { roles: ['insighter', 'company', 'company-insighter', 'client'] }
  },
  {
    path: '**',
    redirectTo: 'error/404',
  },
];

export { Routing };
