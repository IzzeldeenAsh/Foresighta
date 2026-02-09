import { Component, OnInit, OnDestroy, ChangeDetectorRef, Injector } from "@angular/core";
import { FormBuilder, FormGroup, Validators } from "@angular/forms";
import { Observable } from "rxjs";
import { first } from "rxjs/operators";
import { AuthService } from "../../services/auth.service";
import { ActivatedRoute, Router } from "@angular/router";
import { TranslationService } from "src/app/modules/i18n/translation.service";
import { Message } from "primeng/api";
import { BaseComponent } from "src/app/modules/base.component";
import { environment } from "src/environments/environment";
import { CookieService } from "src/app/utils/cookie.service";
import { HttpClient, HttpHeaders } from "@angular/common/http";

@Component({
  selector: "app-login",
  templateUrl: "./login.component.html",
  styleUrls: ["./login.component.scss"],
})
export class LoginComponent extends BaseComponent implements OnInit, OnDestroy {
  defaultAuth: any = {
    email: null,
    password: null,
  };
  
  loginForm: FormGroup;
  hasError: boolean = false;
  returnUrl: string;
  isLoading$: Observable<boolean>;
  selectedLang: string = "en";
  messages: Message[] = [];
  isRTL: boolean = false;
  passwordVisible: boolean = false;
  showFullLoader: boolean = false;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private route: ActivatedRoute,
    private router: Router,
    private translationService: TranslationService,
    private cookieService: CookieService,
    private http: HttpClient,
    injector: Injector
  ) {
    super(injector);
    this.isLoading$ = this.authService.isLoading$;
    this.selectedLang = this.translationService.getSelectedLanguage();
    this.isRTL = this.selectedLang === "ar";
  }

  ngAfterViewInit(): void {
    setTimeout(() => {
      this.scrollAnims.scrollAnimations();
    }, 100);
  }

  getHomeUrl(): string {
    return `${environment.mainAppUrl}/${this.lang}`;
  }

  ngOnInit(): void {
    this.initForm();
    
    // Get return URL from route parameters
    this.returnUrl = this.route.snapshot.queryParams["returnUrl"] || "/";
    if (this.returnUrl && this.returnUrl !== "/") {
      try {
        // Decode the returnUrl if it's encoded (to preserve query params)
        this.returnUrl = decodeURIComponent(this.returnUrl);
      } catch (e) {
        console.error("Error decoding returnUrl:", e);
      }
    }
    
    console.log('Login component initialized with returnUrl:', this.returnUrl);

    // Subscribe to language changes
    this.translationService.onLanguageChange().subscribe((lang) => {
      this.selectedLang = lang;
      this.isRTL = lang === "ar";
    });
  }

  get f() {
    return this.loginForm.controls;
  }

  initForm() {
    this.loginForm = this.fb.group({
      email: [
        this.defaultAuth.email,
        Validators.compose([
          Validators.required,
          Validators.email,
          Validators.minLength(3),
          Validators.maxLength(320),
        ]),
      ],
      password: [
        this.defaultAuth.password,
        Validators.compose([
          Validators.required,
          Validators.minLength(3),
          Validators.maxLength(100),
        ]),
      ],
    });
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
    const returnUrl = this.getReturnUrl();
    const effectiveLang = this.selectedLang || 'en';
    const localizedReturnUrl = this.localizeNextJsUrl(returnUrl, effectiveLang);
    
    // Store return URL in cookie
    this.setReturnUrlCookie(localizedReturnUrl);
    // Store preferred language in cookie for Next.js middleware
    this.cookieService.setPreferredLanguage(effectiveLang);
    
    const authMethod = provider === 'google' 
      ? this.authService.getGoogleAuthRedirectUrl()
      : this.authService.getLinkedInAuthRedirectUrl();

    authMethod.subscribe({
      next: (redirectUrl) => {
        window.location.href = redirectUrl;
      },
      error: (err) => {
        console.error(`Error getting ${provider} auth redirect URL`, err);
        this.messageService.add({ 
          severity: 'error', 
          summary: 'Error', 
          detail: `Failed to initiate ${provider} sign-in.` 
        });
      }
    });
  }

  togglePasswordVisibility(passwordField: HTMLInputElement): void {
    this.passwordVisible = !this.passwordVisible;
    passwordField.type = this.passwordVisible ? "text" : "password";
  }
  
  private getReturnUrl(): string {
    let returnUrl = this.returnUrl !== "/" ? this.returnUrl : document.referrer;
    
    // Check if returnUrl is a full URL from allowed domains
    if (returnUrl && (returnUrl.includes('insightabusiness.com') || returnUrl.includes('localhost'))) {
      return returnUrl;
    }
    
    // Don't return to login or auth pages
    if (!returnUrl || returnUrl === "/" || returnUrl.includes("/login") || returnUrl.includes("/auth/")) {
      return "/";
    }
    
    return returnUrl;
  }
  
  submit() {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    this.hasError = false;
    this.messages = [];

    const returnUrl = this.getReturnUrl();
    
    const loginSubscr = this.authService
      .login(this.f.email.value, this.f.password.value, this.selectedLang, returnUrl)
      .pipe(first())
      .subscribe({
        next: (loginResponse) => {
          this.handleLoginSuccess(loginResponse.userData, loginResponse.token);
        },
        error: (error) => {
          this.handleLoginError(error);
        },
      });
    
    this.unsubscribe.push(loginSubscr);
  }

  private handleLoginSuccess(userData: any, token: string): void {
    console.log('Login successful for user:', userData.email, 'with token:', token.substring(0, 20) + '...');
    
    // Check if user needs email verification
    if (userData.verified === false) {
      this.router.navigate(["/auth/email-reconfirm"]);
      return;
    }

    // Check user roles and redirect accordingly
    if (userData.roles && (userData.roles.includes("admin") || userData.roles.includes("staff"))) {
      // Admin/staff users stay in the Angular app - set timezone first
      this.setUserTimezone(token).subscribe({
        next: () => {
          this.router.navigate(["/admin-dashboard"]);
        },
        error: (error: any) => {
          console.error('Failed to set timezone:', error);
          // Proceed with navigation even if timezone setting fails
          this.router.navigate(["/admin-dashboard"]);
        }
      });
    } else {
      // Regular users redirect to Next.js app
      this.redirectToMainApp(token);
    }
  }

  private handleLoginError(error: any): void {
    this.hasError = true;
    this.messages = [];

    if (error.validationMessages) {
      this.messages = error.validationMessages;
    } else if (error.error?.message === 'Your email address is not verified.') {
      this.router.navigate(['/auth/email-reconfirm']);
    } else {
      this.messages.push({
        severity: "error",
        summary: "Authentication Error",
        detail: error.error?.message || "An unexpected error occurred.",
      });
    }
  }

  private redirectToMainApp(token: string): void {
    const returnUrl = this.getReturnUrl();
    const effectiveLang = this.selectedLang || 'en';
    const localizedReturnUrl = this.localizeNextJsUrl(returnUrl, effectiveLang);
    
    console.log('Redirecting to Next.js with token:', token.substring(0, 20) + '...', 'and returnUrl:', returnUrl);
    
    // Store token in cookie for Next.js to read (cross-domain)
    this.cookieService.setAuthCookie('token', token);
    // Also store return URL in cookie (for consistency with social auth)
    if (localizedReturnUrl) {
      this.setReturnUrlCookie(localizedReturnUrl);
    }
    // Ensure preferred language is stored for middleware-based locale detection
    this.cookieService.setPreferredLanguage(effectiveLang);

    // Build the redirect URL WITHOUT token (cookie-based handoff)
    let redirectUrl = `${environment.mainAppUrl}/${effectiveLang}/callback`;
    
    // Add return URL as query parameter if it exists
    if (localizedReturnUrl && localizedReturnUrl !== '/') {
      redirectUrl += `?returnUrl=${encodeURIComponent(localizedReturnUrl)}`;
    }
    
    console.log('Final redirect URL:', redirectUrl);
    
    // Redirect immediately; Next.js callback will show its own loader
    window.location.href = redirectUrl;
  }

  private setReturnUrlCookie(url: string): void {
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    
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


  private localizeNextJsUrl(url: string, lang: string): string {
    if (!url) {
      return url;
    }
    try {
      // Handle absolute URLs
      const absolute = new URL(url, window.location.origin);
      const isNextHost = absolute.hostname === 'localhost' && absolute.port === '3000';
      const isProdNextHost = absolute.hostname.endsWith('insightabusiness.com') && absolute.hostname !== 'app.insightabusiness.com';
      if (isNextHost || isProdNextHost) {
        const adjustedPath = this.ensureLocalePrefix(absolute.pathname, lang);
        absolute.pathname = adjustedPath;
        return absolute.toString();
      }
      // If not targeting Next.js host, return as is
      return url;
    } catch {
      // Handle relative paths
      if (url.startsWith('/')) {
        return this.ensureLocalePrefix(url, lang);
      }
      return url;
    }
  }

  private ensureLocalePrefix(pathname: string, lang: string): string {
    const locales = ['en', 'ar'];
    const hasLocale = locales.some(l => pathname === `/${l}` || pathname.startsWith(`/${l}/`));
    if (hasLocale) {
      // Replace existing locale with the desired one
      const withoutLocale = pathname.replace(/^\/(en|ar)(\/|$)/, '/');
      return `/${lang}${withoutLocale === '/' ? '' : withoutLocale}`;
    }
    // Add locale if missing
    return `/${lang}${pathname.startsWith('/') ? '' : '/'}${pathname}`;
  }

  private setUserTimezone(token: string): any {
    try {
      const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const headers = new HttpHeaders({
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Accept-Language': this.selectedLang || 'en',
      });
      return this.http.post('https://api.insightabusiness.com/api/account/timezone/set',
        { timezone: userTimezone },
        { headers }
      );
    } catch (error) {
      console.error('Error setting timezone:', error);
      return new Promise(resolve => resolve(null));
    }
  }
}
