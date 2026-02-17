import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { adminGuard } from './guards/admin-guard/admin.guard';
import { authGuard } from './guards/auth-guard/auth.guard';
import { CountryGuard } from './guards/country-guard/country.guard';
import { CorsTestComponent } from './cors-test.component';
import { CrossDomainAuthHelperComponent } from './shared/cross-domain-auth-helper.component';

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
},
{
  path: 'app',
  loadChildren: () =>
    import('./_metronic/layout/layout.module').then((m) => m.LayoutModule),
  canActivate:[authGuard, CountryGuard]
},

{
  path: 'cors-test',
  component: CorsTestComponent
},
{
  path: 'auth-receiver',
  component: CrossDomainAuthHelperComponent
},
{ path: '**', redirectTo: 'auth' },
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule],
})
export class AppRoutingModule {}
