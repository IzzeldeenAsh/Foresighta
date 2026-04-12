// roles.guard.ts
import { Injectable } from '@angular/core';
import { CanActivate, ActivatedRouteSnapshot, RouterStateSnapshot, Router, UrlTree } from '@angular/router';
import { Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { ProfileService } from 'src/app/_fake/services/get-profile/get-profile.service';
import { TranslationService } from 'src/app/modules/i18n';
import { environment } from 'src/environments/environment';

@Injectable({ providedIn: 'root' })
export class RolesGuard implements CanActivate {
  constructor(
    private getProfileService: ProfileService,
    private router: Router,
    private translationService: TranslationService
  ) {}

  private getProfileSettingsUrl(): string {
    const lang = this.translationService.getSelectedLanguage() === 'ar' ? 'ar' : 'en';
    return `${environment.mainAppUrl}/${lang}/profile/settings`;
  }

  canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): Observable<boolean | UrlTree> {
    // Retrieve the required roles from route data
    const requiredRoles: string[] = route.data.roles;
    return this.getProfileService.getProfile().pipe(
      map(user => {
        if (user && requiredRoles.some(role => user.roles.includes(role))) {
          // User has at least one of the required roles
          return true;
        }
        // User lacks the required roles, redirect accordingly
        window.location.href = this.getProfileSettingsUrl();
        return false;
      }),
      catchError(() => {
        // Handle errors, such as unauthenticated users
        // Save the URL the user is trying to access
        const url = state.url;
        console.log('Roles Guard - Redirecting to login with returnUrl:', url);
        // Return router URL tree with returnUrl
        return of(this.router.createUrlTree(['/auth/login'], { 
          queryParams: { returnUrl: url } 
        }));
      })
    );
  }
}
