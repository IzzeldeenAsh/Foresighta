import { Component, Injector, OnDestroy, OnInit } from "@angular/core";
import { FormBuilder, FormGroup, Validators } from "@angular/forms";
import { ActivatedRoute, Router } from "@angular/router";
import { HttpClient, HttpErrorResponse, HttpHeaders } from "@angular/common/http";
import { BehaviorSubject, Observable, of, Subscription, take, timer } from "rxjs";
import { BaseComponent } from "src/app/modules/base.component";
import { TranslationService } from "src/app/modules/i18n";
import { environment } from "src/environments/environment";
import { AuthService } from "../../services/auth.service";

@Component({
  selector: "app-login-email-verification",
  templateUrl: "./login-email-verification.component.html",
  styleUrls: ["./login-email-verification.component.scss"],
})
export class LoginEmailVerificationComponent extends BaseComponent implements OnInit, OnDestroy {
  verificationCodeForm: FormGroup;
  isLoadingVerify$: Observable<boolean> = of(false);

  isResendDisabled = false;
  resendCountdown$ = new BehaviorSubject<number | null>(null);

  verifyErrorMessage: string = "";
  email: string = "";
  returnUrl: string = "";
  selectedLang: string = "en";

  private langChangeSubscription?: Subscription;
  private hasAutoResent = false;
  private readonly AUTO_RESEND_MIN_INTERVAL_MS = 60 * 1000; // 1 minute
  private readonly AUTO_RESEND_STORAGE_PREFIX = "autoResendEmailVerifyTs:";
  private popStateHandler?: () => void;

  // Used by CanDeactivate guard
  public isVerified = false;
  public isLoggingOut = false;

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private http: HttpClient,
    private authService: AuthService,
    private translationService: TranslationService,
    injector: Injector
  ) {
    super(injector);
    this.selectedLang = this.translationService.getSelectedLanguage?.() || "en";
    this.verificationCodeForm = this.fb.group({
      code: [
        "",
        [
          Validators.required,
          // allow 4-10 digits; backend accepts numeric code
          Validators.pattern(/^\d{4,10}$/),
        ],
      ],
    });
  }

  ngOnInit(): void {
    // Require token cookie (login already happened)
    const token = this.authService.getTokenFromCookie();
    if (!token) {
      this.router.navigateByUrl("/auth/login");
      return;
    }

    // Disable browser back navigation from this page:
    // if the user attempts to go back (or otherwise leave via history),
    // log them out and force them to login again.
    try {
      history.pushState(null, "", window.location.href);
      this.popStateHandler = () => {
        if (this.isVerified || this.isLoggingOut) return;
        this.logout();
      };
      window.addEventListener("popstate", this.popStateHandler);
    } catch {
      // ignore
    }

    this.route.queryParams.subscribe((params) => {
      this.email = (params["email"] || "").trim();
      this.returnUrl = params["returnUrl"] || "";
      if (this.returnUrl) {
        try {
          this.returnUrl = decodeURIComponent(this.returnUrl);
        } catch {
          // keep as-is
        }
      }

      // Auto-trigger resend once when user lands on this screen (rate-limited).
      // This matches the UX expectation: if a user is blocked due to unverified email,
      // we proactively send a fresh code without waiting for an extra click.
      if (!this.hasAutoResent) {
        this.hasAutoResent = true;
        this.autoResendVerificationEmailIfAllowed();
      }
    });

    this.langChangeSubscription = this.translationService.onLanguageChange().subscribe((lang) => {
      this.selectedLang = lang || "en";
    });
  }

  ngOnDestroy(): void {
    this.langChangeSubscription?.unsubscribe();
    if (this.popStateHandler) {
      try {
        window.removeEventListener("popstate", this.popStateHandler);
      } catch {
        // ignore
      }
    }
  }

  logout(): void {
    if (this.isLoggingOut) return;
    this.isLoggingOut = true;
    this.authService.handleLogout().subscribe({
      next: () => this.router.navigateByUrl("/auth/login"),
      error: () => this.router.navigateByUrl("/auth/login"),
    });
  }

  onResendClick(): void {
    if (this.isResendDisabled) return;

    this.isResendDisabled = true;
    this.authService.resendVerificationEmail().subscribe({
      next: () => {
        this.messageService.add({
          severity: "success",
          summary: this.lang === "ar" ? "تم" : "Success",
          detail: this.lang === "ar" ? "تم إعادة إرسال البريد بنجاح." : "Verification email resent successfully.",
        });
        this.startResendCooldown();
      },
      error: (error: any) => {
        this.isResendDisabled = false;

        if (error?.validationMessages?.length) {
          error.validationMessages.forEach((msg: any) => {
            this.messageService.add({
              severity: msg.severity || "error",
              summary: msg.summary || (this.lang === "ar" ? "خطأ" : "Error"),
              detail: msg.detail || (this.lang === "ar" ? "فشل إعادة الإرسال." : "Failed to resend verification email."),
            });
          });
          return;
        }

        this.messageService.add({
          severity: "error",
          summary: this.lang === "ar" ? "خطأ" : "Error",
          detail: this.lang === "ar" ? "فشل إعادة إرسال البريد." : "Failed to resend verification email.",
        });
      },
    });
  }

  private autoResendVerificationEmailIfAllowed(): void {
    const emailForKey = this.getEmailForKey();
    const storageKey = `${this.AUTO_RESEND_STORAGE_PREFIX}${emailForKey || "unknown"}`;
    const lastTsRaw = localStorage.getItem(storageKey);
    const lastTs = lastTsRaw ? Number(lastTsRaw) : 0;
    const now = Date.now();

    if (Number.isFinite(lastTs) && lastTs > 0 && now - lastTs < this.AUTO_RESEND_MIN_INTERVAL_MS) {
      return;
    }

    localStorage.setItem(storageKey, String(now));
    this.onResendClick();
  }

  private getEmailForKey(): string {
    const direct = (this.email || "").trim().toLowerCase();
    if (direct) return direct;

    try {
      const raw = localStorage.getItem("currentUser") || localStorage.getItem("user") || "";
      if (!raw) return "";
      const parsed = JSON.parse(raw);
      return String(parsed?.email || "").trim().toLowerCase();
    } catch {
      return "";
    }
  }

  onVerifyCodeSubmit(): void {
    this.verificationCodeForm.markAllAsTouched();
    this.verifyErrorMessage = "";

    if (this.verificationCodeForm.invalid) return;

    const codeRaw = String(this.verificationCodeForm.value.code || "").trim();
    if (!codeRaw) return;

    this.isLoadingVerify$ = of(true);

    const headers = new HttpHeaders({
      Accept: "application/json",
      "Content-Type": "application/json",
      "Accept-Language": this.lang || this.selectedLang || "en",
    });

    const url = `${environment.apiBaseUrl}/account/email/verify`;

    this.http.post(url, { code: Number(codeRaw) }, { headers }).subscribe({
      next: () => {
        this.isLoadingVerify$ = of(false);
        this.isVerified = true;
        this.messageService.add({
          severity: "success",
          summary: this.lang === "ar" ? "تم" : "Success",
          detail: this.lang === "ar" ? "تم تفعيل البريد الإلكتروني بنجاح." : "Email verified successfully.",
        });
        this.redirectAfterVerification();
      },
      error: (error: HttpErrorResponse) => {
        this.isLoadingVerify$ = of(false);

        const serverMessage =
          (error?.error && (error.error.message || error.error?.error)) ||
          (typeof error?.error === "string" ? error.error : "") ||
          "";

        this.verifyErrorMessage =
          serverMessage ||
          (this.lang === "ar" ? "رمز التفعيل غير صالح أو منتهي الصلاحية." : "Invalid or expired verification code.");

        this.messageService.add({
          severity: "error",
          summary: this.lang === "ar" ? "خطأ" : "Error",
          detail: this.verifyErrorMessage,
        });
      },
    });
  }

  private startResendCooldown(): void {
    const countdownTime = 30; // seconds
    this.resendCountdown$.next(countdownTime);

    const resendTimerSubscription = timer(1, 1000)
      .pipe(take(countdownTime))
      .subscribe({
        next: (elapsedTime) => {
          const remainingTime = countdownTime - elapsedTime;
          this.resendCountdown$.next(remainingTime);
        },
        complete: () => {
          this.resendCountdown$.next(null);
          this.isResendDisabled = false;
        },
      });

    this.unsubscribe.push(resendTimerSubscription);
  }

  private redirectAfterVerification(): void {
    // If the returnUrl is a local Angular route, go there (guards will re-evaluate with verified email).
    if (this.returnUrl && this.returnUrl.startsWith("/")) {
      this.router.navigateByUrl(this.returnUrl);
      return;
    }

    // Mirror ProductionLoginComponent domain validation behavior
    if (this.returnUrl) {
      try {
        const returnUrlObj = new URL(this.returnUrl);
        const allowedDomains = [
          "foresighta.co",
          "www.insightabusiness.com",
          "app.insightabusiness.com",
          "insightabusiness.com",
          "localhost",
          "127.0.0.1",
        ];

        const isAllowed = allowedDomains.some((domain) => {
          return (
            returnUrlObj.hostname === domain ||
            returnUrlObj.hostname.endsWith(`.${domain}`) ||
            returnUrlObj.hostname.startsWith("localhost:") ||
            returnUrlObj.hostname.startsWith("127.0.0.1:")
          );
        });

        if (isAllowed) {
          window.location.replace(this.returnUrl);
          return;
        }
      } catch {
        // fall through
      }
    }

    this.redirectToDefault();
  }

  private redirectToDefault(): void {
    const isLocalhost =
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1" ||
      window.location.hostname.startsWith("localhost:") ||
      window.location.hostname.startsWith("127.0.0.1:");

    const lang = this.lang || this.selectedLang || "en";
    if (isLocalhost) {
      window.location.replace(`https://insightabusiness.com/${lang}/home`);
    } else {
      window.location.replace(`https://www.insightabusiness.com/${lang}/home`);
    }
  }
}
