import { Injectable } from "@angular/core";
import { CanDeactivate, Router, UrlTree } from "@angular/router";
import { Observable } from "rxjs";
import { AuthService } from "src/app/modules/auth/services/auth.service";
import { LoginEmailVerificationComponent } from "src/app/modules/auth/components/login-email-verification/login-email-verification.component";

@Injectable({ providedIn: "root" })
export class VerifyLoginEmailExitGuard
  implements CanDeactivate<LoginEmailVerificationComponent>
{
  private isHandling = false;

  constructor(private authService: AuthService, private router: Router) {}

  canDeactivate(
    component: LoginEmailVerificationComponent
  ): boolean | UrlTree | Observable<boolean | UrlTree> {
    if (component?.isVerified || component?.isLoggingOut) {
      return true;
    }

    if (this.isHandling) {
      return this.router.createUrlTree(["/auth/login"]);
    }

    this.isHandling = true;
    this.authService.handleLogout().subscribe({
      next: () => {},
      error: () => {},
      complete: () => {
        this.isHandling = false;
      },
    });

    return this.router.createUrlTree(["/auth/login"]);
  }
}

