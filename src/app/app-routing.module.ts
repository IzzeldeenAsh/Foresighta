import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { adminGuard } from './guards/admin-guard/admin.guard';
import { authGuard } from './guards/auth-guard/auth.guard';
import { CountryGuard } from './guards/country-guard/country.guard';
import { CorsTestComponent } from './cors-test.component';
import { CrossDomainAuthHelperComponent } from './shared/cross-domain-auth-helper.component';
import { adminExternalRedirectChildGuard, adminExternalRedirectGuard } from './guards/admin-external-redirect-guard/admin-external-redirect.guard';

export const routes: Routes = [
{
  path: '',
  redirectTo : 'auth',
  pathMatch:"full"
},

{
  path: 'auth',
  loadChildren: () =>
    import('./modules/auth/auth.module').then((m) => m.AuthModule),
  canActivate: [adminExternalRedirectGuard],
  canActivateChild: [adminExternalRedirectChildGuard],
},
{
  path: 'app',
  loadChildren: () =>
    import('./_metronic/layout/layout.module').then((m) => m.LayoutModule),
  canActivate: [adminExternalRedirectGuard, authGuard, CountryGuard],
  canActivateChild: [adminExternalRedirectChildGuard],
},

{
  path: 'cors-test',
  component: CorsTestComponent,
  canActivate: [adminExternalRedirectGuard],
},
{
  path: 'auth-receiver',
  component: CrossDomainAuthHelperComponent,
  canActivate: [adminExternalRedirectGuard],
},
{ path: '**', redirectTo: 'auth' },
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule],
})
export class AppRoutingModule {}
