import { redirectToNextSignIn } from 'src/app/shared/next-auth';
import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { Observable, of } from 'rxjs';
import { map, catchError, first } from 'rxjs/operators';
import { ProfileService } from 'src/app/_fake/services/get-profile/get-profile.service';

export const adminGuard: CanActivateFn = (route, state): Observable<boolean | UrlTree> => {
  const getProfileService = inject(ProfileService);
  const router = inject(Router);

  return getProfileService.getProfile().pipe(
    first(),
    map(user => {
      if (user && (user.roles.includes('admin') || user.roles.includes('staff'))) {
        // User has the required role, allow access
        return true;
      } else {
        // User does not have the required role, redirect to login
        localStorage.removeItem('foresighta-creds');
        return redirectToNextSignIn();
      }
    }),
    catchError(() => {
      // On error (e.g., token invalid), redirect to login
      localStorage.removeItem('foresighta-creds');
      return of(redirectToNextSignIn());
    })
  );
};
