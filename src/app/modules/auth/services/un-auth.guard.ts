import { Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot } from '@angular/router';
import { AuthService } from './auth.service';
import { first } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class UnAuthGuard  {
  constructor(private authService: AuthService,private router:Router) {}

  canActivate(route: ActivatedRouteSnapshot, state: RouterStateSnapshot) {
    const currentUser = this.authService.currentUserValue;
    if (!currentUser) {
      // logged in so return true
      return true;
    }
    this.router.navigate(['/app'])
   
    return false;
  }
}