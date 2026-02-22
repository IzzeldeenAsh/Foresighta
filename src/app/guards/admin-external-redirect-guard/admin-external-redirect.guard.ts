import { inject } from '@angular/core';
import { CanActivateChildFn, CanActivateFn } from '@angular/router';
import { Observable, of } from 'rxjs';
import { catchError, first, map } from 'rxjs/operators';
import { ProfileService } from 'src/app/_fake/services/get-profile/get-profile.service';
import { AuthService } from 'src/app/modules/auth/services/auth.service';

const ADMIN_DASHBOARD_URL = 'http://localhost:3000/en/dashboard';

function isTokenExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    const currentTime = Math.floor(Date.now() / 1000);
    return payload.exp < currentTime;
  } catch {
    return true;
  }
}

function redirectToAdminDashboard(): false {
  if (typeof window !== 'undefined') {
    window.location.replace(ADMIN_DASHBOARD_URL);
  }
  return false;
}

function checkAdminAndMaybeRedirect(): boolean | Observable<boolean> {
  if (typeof window === 'undefined') return true;

  const authService = inject(AuthService);
  const profileService = inject(ProfileService);

  const token = authService.getTokenFromCookie();
  if (!token || isTokenExpired(token)) return true;

  const cachedUser = profileService.getCurrentUser();
  if (cachedUser?.roles?.includes('admin')) return redirectToAdminDashboard();

  return profileService.getProfile().pipe(
    first(),
    map((user) => ((user?.roles || []) as string[]).includes('admin') ? redirectToAdminDashboard() : true),
    catchError(() => of(true))
  );
}

export const adminExternalRedirectGuard: CanActivateFn = () => checkAdminAndMaybeRedirect();
export const adminExternalRedirectChildGuard: CanActivateChildFn = () => checkAdminAndMaybeRedirect();

