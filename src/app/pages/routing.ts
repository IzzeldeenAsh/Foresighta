import { Routes } from '@angular/router';
import { NonInsightersAuthGuard } from '../guards/non-insighter-guard/non-insighters.guard';
import { authGuard } from '../guards/auth-guard/auth.guard';

const Routing: Routes = [
  {
    path: '',
    redirectTo: 'results-home',
    pathMatch: 'full',
  },
  {
    path: 'results-home',
    loadChildren: () => import('./main-page/main-page.module').then((m) => m.MainPageModule),
  },
  {
    path: 'insighter-register',
    loadChildren: () => import('./wizards/wizards.module').then((m) => m.WizardsModule),
    canActivate: [NonInsightersAuthGuard], // Apply the guard here
  },
  {
    path: 'profile',
    loadChildren: () => import('./user-profile/user-profile.module').then((m) => m.UserProfileModule),
  },
  {
    path: 'initiate-insight',
    loadChildren: () => import('./insighte-initiate/insighte-initiate.module').then((m) => m.InsighteInitiateModule),
  },
  {
    path: '**',
    redirectTo: 'error/404',
  },
];

export { Routing };
