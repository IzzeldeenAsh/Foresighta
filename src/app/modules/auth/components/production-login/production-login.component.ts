import { Component, OnInit, OnDestroy, Injector } from "@angular/core";
import { FormBuilder, FormGroup, Validators } from "@angular/forms";
import { ActivatedRoute, Router } from "@angular/router";
import { TranslationService } from "src/app/modules/i18n/translation.service";
import { BaseComponent } from "src/app/modules/base.component";
import { ProductionLoginService } from "./production-login.service";
import { ProductionCookieService } from "./production-cookie.service";
import { first } from "rxjs/operators";

@Component({
  selector: "app-production-login",
  templateUrl: "./production-login.component.html",
  styleUrls: ["./production-login.component.scss"],
})
export class ProductionLoginComponent extends BaseComponent implements OnInit, OnDestroy {
  selectedLang: string = "en";
  isRTL: boolean = false;
  passwordVisible: boolean = false;
  loginForm: FormGroup;
  hasError: boolean = false;
  returnUrl: string = "";
  isLoading: boolean = false;
  errorMessage: string = "";
  homeUrl: string = "";

  constructor(
    private translationService: TranslationService,
    private fb: FormBuilder,
    private productionLoginService: ProductionLoginService,
    private productionCookieService: ProductionCookieService,
    private route: ActivatedRoute,
    private router: Router,
    injector: Injector
  ) {
    super(injector);
    this.selectedLang = this.translationService.getSelectedLanguage();
    this.isRTL = this.selectedLang === "ar";
    this.loginForm = this.fb.group({
      email: ["", [Validators.required, Validators.email]],
      password: ["", [Validators.required, Validators.minLength(3)]],
    });
  }

  ngAfterViewInit(): void {
    setTimeout(() => {
      this.scrollAnims.scrollAnimations();
    }, 100);
  }

  redirectToHome(event?: Event): void {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    window.location.assign(this.homeUrl || this.getDefaultHomeUrl());
  }

  ngOnInit(): void {
    // Get return URL from query parameters
    this.route.queryParams.subscribe((params) => {
      this.returnUrl = params["returnUrl"] || "";
      if (this.returnUrl) {
        try {
          // Decode the returnUrl if it's encoded
          this.returnUrl = decodeURIComponent(this.returnUrl);
        } catch (e) {
          console.error("Error decoding returnUrl:", e);
        }
      }
    });

    // Subscribe to language changes
    this.translationService.onLanguageChange().subscribe((lang) => {
      this.selectedLang = lang;
      this.isRTL = lang === "ar";
      this.homeUrl = this.getDefaultHomeUrl();
    });

    // Initialize home URL on first load
    this.homeUrl = this.getDefaultHomeUrl();
  }

  get f() {
    return this.loginForm.controls;
  }

  togglePasswordVisibility(): void {
    this.passwordVisible = !this.passwordVisible;
  }

  signInWithGoogle(event: Event): void {
    event.preventDefault();
    this.performSocialAuth('google');
  }

  signInWithLinkedIn(event: Event): void {
    event.preventDefault();
    this.performSocialAuth('linkedin');
  }

  private performSocialAuth(provider: 'google' | 'linkedin'): void {
    // Store return URL in cookie before redirecting
    if (this.returnUrl) {
      this.setReturnUrlCookie(this.returnUrl);
    }
    
    // Store preferred language
    this.productionCookieService.setPreferredLanguage(this.selectedLang);
    
    const authMethod = provider === 'google' 
      ? this.productionLoginService.getGoogleAuthRedirectUrl(this.selectedLang)
      : this.productionLoginService.getLinkedInAuthRedirectUrl(this.selectedLang);

    const authSubscr = authMethod.pipe(first()).subscribe({
      next: (redirectUrl) => {
        // Redirect to social provider
        window.location.href = redirectUrl;
      },
      error: (error) => {
        console.error(`Error getting ${provider} auth redirect URL`, error);
        this.showError(
          this.lang === "ar" ? "خطأ" : "Error",
          this.lang === "ar" 
            ? `فشل البدء بتسجيل الدخول باستخدام ${provider === 'google' ? 'جوجل' : 'لينكد إن'}`
            : `Failed to initiate ${provider} sign-in.`
        );
      },
    });

    this.unsubscribe.push(authSubscr);
  }

  private setReturnUrlCookie(url: string): void {
    const isLocalhost = window.location.hostname === 'localhost' || 
                       window.location.hostname === '127.0.0.1' ||
                       window.location.hostname.startsWith('localhost:') ||
                       window.location.hostname.startsWith('127.0.0.1:');
    
    let cookieSettings;
    if (isLocalhost) {
      cookieSettings = [
        `auth_return_url=${encodeURIComponent(url)}`,
        `Path=/`,
        `Max-Age=${60 * 60}`, // 1 hour
        `SameSite=Lax`
      ];
    } else {
      cookieSettings = [
        `auth_return_url=${encodeURIComponent(url)}`,
        `Path=/`,
        `Max-Age=${60 * 60}`, // 1 hour
        `SameSite=None`,
        `Domain=.insightabusiness.com`,
        `Secure`
      ];
    }
    
    document.cookie = cookieSettings.join('; ');
  }

  submit(): void {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    this.hasError = false;
    this.errorMessage = "";
    this.isLoading = true;

    const email = this.f.email.value;
    const password = this.f.password.value;

    const loginSubscr = this.productionLoginService
      .login(email, password, this.selectedLang)
      .pipe(first())
      .subscribe({
        next: (response) => {
          this.handleLoginSuccess(response.data);
        },
        error: (error) => {
          this.handleLoginError(error);
        },
      });

    this.unsubscribe.push(loginSubscr);
  }

  private handleLoginSuccess(userData: any): void {
    const token = userData.token;
    
    // Store token in cookie with .insightabusiness.com domain for cross-domain sharing
    this.productionCookieService.setAuthToken(token);
    
    // Store preferred language
    this.productionCookieService.setPreferredLanguage(this.selectedLang);
    
    // Clear loading state immediately to update UI
    this.isLoading = false;

    // If email is not verified, go to verification code page (keep token cookie for resend/verify APIs)
    if (userData?.verified === false) {
      const emailFromResponse = (userData?.email || "").trim();
      const email = emailFromResponse || String(this.f.email.value || "").trim();
      this.router.navigate(["/auth/verify-login-email"], {
        queryParams: {
          email,
          returnUrl: this.returnUrl || "",
        },
      });
      return;
    }
    
    // Use setTimeout to ensure cookies are set and UI updates before redirect
    setTimeout(() => {
      // Handle redirect
      if (this.returnUrl) {
        // Redirect to the returnUrl
        try {
          // Validate that returnUrl is from an allowed domain
          const returnUrlObj = new URL(this.returnUrl);
          const allowedDomains = [
            'foresighta.co', 
            'www.insightabusiness.com', 
            'app.insightabusiness.com',
            'insightabusiness.com',
            'localhost',
            '127.0.0.1'
          ];
          const isAllowed = allowedDomains.some(domain => {
            // Check exact match or subdomain match
            return returnUrlObj.hostname === domain || 
                   returnUrlObj.hostname.endsWith(`.${domain}`) ||
                   returnUrlObj.hostname.startsWith('localhost:') ||
                   returnUrlObj.hostname.startsWith('127.0.0.1:');
          });
          
          if (isAllowed) {
            window.location.replace(this.returnUrl);
            return;
          } else {
            // Fallback to default redirect
            console.warn('Return URL not from allowed domain, using default redirect');
            this.redirectToDefault();
          }
        } catch (e) {
          // Invalid URL, use fallback
          console.error('Error parsing returnUrl:', e);
          this.redirectToDefault();
        }
      } else {
        // No returnUrl, redirect to default
        this.redirectToDefault();
      }
    }, 100);
  }

  private redirectToDefault(): void {
    // Redirect to Next.js app home (or main app URL)
    window.location.replace(this.getDefaultHomeUrl());
  }

  private getDefaultHomeUrl(): string {
    // Check if we're on localhost for development
    const host = window.location.hostname;
    const isLocalhost =
      host === "localhost" ||
      host === "127.0.0.1" ||
      host.startsWith("localhost:") ||
      host.startsWith("127.0.0.1:");

    if (isLocalhost) {
      // For localhost, use localhost:3000 (typical Next.js dev server)
      return `https://insightabusiness.com/${this.selectedLang}/home`;
    }

    // For production, redirect to www.insightabusiness.com
    return `https://www.insightabusiness.com/${this.selectedLang}/home`;
  }

  private handleLoginError(error: any): void {
    this.isLoading = false;
    this.hasError = true;

    if (error.error && error.error.errors) {
      // Handle validation errors
      const serverErrors = error.error.errors;
      const errorMessages: string[] = [];
      for (const key in serverErrors) {
        if (serverErrors.hasOwnProperty(key)) {
          errorMessages.push(...serverErrors[key]);
        }
      }
      this.errorMessage = errorMessages.join(", ");
      this.showError(
        this.lang === "ar" ? "حدث خطأ" : "An error occurred",
        this.errorMessage
      );
    } else if (error.message) {
      this.errorMessage = error.message;
      this.showError(
        this.lang === "ar" ? "حدث خطأ" : "An error occurred",
        this.errorMessage
      );
    } else {
      this.errorMessage =
        this.lang === "ar"
          ? "حدث خطأ أثناء تسجيل الدخول"
          : "An unexpected error occurred during login";
      this.showError(
        this.lang === "ar" ? "خطأ" : "Error",
        this.errorMessage
      );
    }
  }
}
