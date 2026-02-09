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
    });

    this.langChangeSubscription = this.translationService.onLanguageChange().subscribe((lang) => {
      this.selectedLang = lang || "en";
    });
  }

  ngOnDestroy(): void {
    this.langChangeSubscription?.unsubscribe();
  }

  logout(): void {
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

