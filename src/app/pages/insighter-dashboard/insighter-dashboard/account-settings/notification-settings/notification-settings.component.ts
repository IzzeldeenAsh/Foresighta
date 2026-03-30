import { Component, HostListener, Injector, OnInit } from "@angular/core";
import { FormBuilder, FormGroup, Validators } from "@angular/forms";
import { ConfirmationService } from "primeng/api";
import { BehaviorSubject, Observable, Observer, catchError, finalize, forkJoin, map, of, switchMap, tap } from "rxjs";
import { CountriesService } from "src/app/_fake/services/countries/countries.service";
import { ProfileService } from "src/app/_fake/services/get-profile/get-profile.service";
import { UpdateProfileService } from "src/app/_fake/services/profile/profile.service";
import { BaseComponent } from "src/app/modules/base.component";
import { ProjectProgressCelebrationService } from "src/app/reusable-components/project-progress-celebration/project-progress-celebration.service";

type ChannelStatus = "active" | "inactive";

@Component({
  selector: "app-notification-settings",
  templateUrl: "./notification-settings.component.html",
  styleUrls: ["./notification-settings.component.scss"],
  providers: [ConfirmationService],
})
export class NotificationSettingsComponent extends BaseComponent implements OnInit {
  form!: FormGroup;
  countries: any[] = [];

  private initialFormSnapshot: string | null = null;

  private readonly loadingSubject = new BehaviorSubject<boolean>(true);
  readonly isLoading$ = this.loadingSubject.asObservable();

  private readonly savingSubject = new BehaviorSubject<boolean>(false);
  readonly isSaving$ = this.savingSubject.asObservable();

  private profileAny: any = null;
  private isSyncingPhoneFields = false;
  private smsAutoFilledFrom: "whatsapp" | null = null;
  private whatsappAutoFilledFrom: "sms" | null = null;
  private pendingNavigationObserver: Observer<boolean> | null = null;
  private suppressConfirmHide = false;

  constructor(
    injector: Injector,
    private readonly fb: FormBuilder,
    private readonly countriesService: CountriesService,
    private readonly profileService: ProfileService,
    private readonly updateProfileService: UpdateProfileService,
    private readonly confirmationService: ConfirmationService,
    private readonly projectProgressCelebrationService: ProjectProgressCelebrationService
  ) {
    super(injector);
  }

  ngOnInit(): void {
    this.initForm();
    this.initialFormSnapshot = this.serializeNormalizedFormValue();
    this.loadData();
  }

  reload(): void {
    this.loadData();
  }

  toggleWhatsApp(enabled: boolean): void {
    const current = !!this.form.get("whatsapp_enabled")?.value;
    if (enabled === current) return;
    this.form.get("whatsapp_enabled")?.setValue(enabled);
    this.updateChannelValidators();
  }

  toggleSms(enabled: boolean): void {
    const current = !!this.form.get("sms_enabled")?.value;
    if (enabled === current) return;
    this.form.get("sms_enabled")?.setValue(enabled);
    this.updateChannelValidators();
  }

  onFlagError(country: any): void {
    country.showFlag = false;
  }

  onWhatsAppCountryCodeChange(countryCode: string): void {
    const current = this.normalizeCountryCode(this.form.get("whatsapp_country_code")?.value);
    const next = this.normalizeCountryCode(countryCode);
    if (current === next) return;
    this.markPhoneChannelAsUserEdited("whatsapp");
    this.form.get("whatsapp_country_code")?.setValue(countryCode);
    this.syncOtherChannelIfEmptyOrAutoFilled("whatsapp");
    this.updateChannelValidators();
  }

  onWhatsAppNumberChange(phoneNumber: string): void {
    const current = this.normalizePhoneNumber(this.form.get("whatsapp_number")?.value);
    const next = this.normalizePhoneNumber(phoneNumber);
    if (current === next) return;
    this.markPhoneChannelAsUserEdited("whatsapp");
    this.form.get("whatsapp_number")?.setValue(phoneNumber);
    this.syncOtherChannelIfEmptyOrAutoFilled("whatsapp");
    this.updateChannelValidators();
  }

  onWhatsAppFormattedPhoneNumberChange(_: string): void {
    // no-op
  }

  onSmsCountryCodeChange(countryCode: string): void {
    const current = this.normalizeCountryCode(this.form.get("sms_country_code")?.value);
    const next = this.normalizeCountryCode(countryCode);
    if (current === next) return;
    this.markPhoneChannelAsUserEdited("sms");
    this.form.get("sms_country_code")?.setValue(countryCode);
    this.syncOtherChannelIfEmptyOrAutoFilled("sms");
    this.updateChannelValidators();
  }

  onSmsNumberChange(phoneNumber: string): void {
    const current = this.normalizePhoneNumber(this.form.get("sms_number")?.value);
    const next = this.normalizePhoneNumber(phoneNumber);
    if (current === next) return;
    this.markPhoneChannelAsUserEdited("sms");
    this.form.get("sms_number")?.setValue(phoneNumber);
    this.syncOtherChannelIfEmptyOrAutoFilled("sms");
    this.updateChannelValidators();
  }

  onSmsFormattedPhoneNumberChange(_: string): void {
    // no-op
  }

  isFieldInvalid(fieldName: string): boolean {
    const field = this.form.get(fieldName);
    return !!field && field.invalid && field.touched;
  }

  getFieldError(fieldName: string): string {
    const field = this.form.get(fieldName);
    if (!field || !field.touched || !field.errors) return "";
    if (field.errors["required"]) {
      return this.lang === "ar" ? "هذا الحقل مطلوب" : "This field is required";
    }
    return this.lang === "ar" ? "قيمة غير صحيحة" : "Invalid value";
  }

  onSubmit(): void {
    const sub = this.saveChanges().subscribe();
    this.unsubscribe.push(sub);
  }

  private initForm(): void {
    this.form = this.fb.group({
      whatsapp_enabled: [false],
      whatsapp_country_code: [""],
      whatsapp_number: [""],
      sms_enabled: [false],
      sms_country_code: [""],
      sms_number: [""],
    });
  }

  canDeactivate(): boolean | Observable<boolean> {
    if (this.hasUnsavedChanges() && !this.savingSubject.value) {
      return new Observable<boolean>((observer) => {
        this.pendingNavigationObserver = observer;
        this.confirmationService.confirm({
          header: this.lang === "ar" ? "تغييرات غير محفوظة" : "Unsaved Changes",
          message:
            this.lang === "ar"
              ? "لديك تغييرات غير محفوظة. هل تريد حفظ التغييرات أم المتابعة بدون حفظ؟"
              : "You have unsaved changes. Do you want to save the changes or continue without saving?",
          icon: "pi pi-exclamation-triangle",
          acceptLabel: this.lang === "ar" ? "حفظ التغييرات" : "Save Changes",
          rejectLabel: this.lang === "ar" ? "المتابعة بدون حفظ" : "Continue Redirecting",
          accept: () => {
            this.suppressConfirmHide = true;
            this.saveChanges().subscribe((ok) => {
              observer.next(ok);
              observer.complete();
              this.pendingNavigationObserver = null;
            });
          },
          reject: () => {
            this.suppressConfirmHide = true;
            observer.next(true);
            observer.complete();
            this.pendingNavigationObserver = null;
          },
        });
      });
    }

    return true;
  }

  onConfirmDialogHide(): void {
    if (this.suppressConfirmHide) {
      this.suppressConfirmHide = false;
      return;
    }

    if (this.pendingNavigationObserver) {
      this.pendingNavigationObserver.next(false);
      this.pendingNavigationObserver.complete();
      this.pendingNavigationObserver = null;
    }
  }

  @HostListener("window:beforeunload", ["$event"])
  onBeforeUnload(event: BeforeUnloadEvent): void {
    if (this.hasUnsavedChanges() && !this.savingSubject.value) {
      event.preventDefault();
      event.returnValue = "";
    }
  }

  private loadData(): void {
    this.loadingSubject.next(true);

    const profile$ = this.profileService.getProfile().pipe(
      catchError(() => of(null))
    );

    const countries$ = this.countriesService.getCountries().pipe(
      tap((countries) => {
        this.countries = (countries || []).map((country: any) => ({
          ...country,
          flagPath: `assets/media/flags/${country.flag}.svg`,
          showFlag: true,
        }));
      }),
      catchError(() => {
        this.countries = [];
        return of([]);
      })
    );

    const sub = forkJoin({ profile: profile$, countries: countries$ })
      .pipe(finalize(() => this.loadingSubject.next(false)))
      .subscribe({
        next: ({ profile }) => {
          if (!profile) {
            const msg =
              this.lang === "ar"
                ? "تعذر تحميل إعدادات الإشعارات."
                : "Failed to load notification settings.";
            this.showError("", msg);
            return;
          }
          this.applyProfile(profile);
        },
        error: () => {
          const msg =
            this.lang === "ar"
              ? "تعذر تحميل إعدادات الإشعارات."
              : "Failed to load notification settings.";
          this.showError("", msg);
        },
      });

    this.unsubscribe.push(sub);
  }

  private saveChanges(): Observable<boolean> {
    if (this.savingSubject.value) return of(false);

    this.form.markAllAsTouched();
    this.updateChannelValidators();
    if (this.form.invalid) return of(false);

    this.savingSubject.next(true);

    const whatsappEnabled = !!this.form.get("whatsapp_enabled")?.value;
    const smsEnabled = !!this.form.get("sms_enabled")?.value;

    const whatsappStatus: ChannelStatus = whatsappEnabled ? "active" : "inactive";
    const smsStatus: ChannelStatus = smsEnabled ? "active" : "inactive";

    const payload: any = {
      whatsapp_status: whatsappStatus,
      whatsapp_country_code: whatsappEnabled ? (this.form.get("whatsapp_country_code")?.value || "") : "",
      whatsapp_number: whatsappEnabled ? (this.form.get("whatsapp_number")?.value || "") : "",
      sms_status: smsStatus,
      sms_whatsapp: smsStatus, // backend key seen in API screenshot (kept for compatibility)
      sms_country_code: smsEnabled ? (this.form.get("sms_country_code")?.value || "") : "",
      sms_number: smsEnabled ? (this.form.get("sms_number")?.value || "") : "",
    };

    return this.updateProfileService.updateNotificationChannel(payload).pipe(
      tap(() => {
        const msg =
          this.lang === "ar"
            ? "تم تحديث إعدادات الإشعارات"
            : "Notification settings updated";
        this.showSuccess("", msg);

        const celebrationSub = this.projectProgressCelebrationService
          .checkMilestone("whatsapp", this.profileAny?.roles ?? [])
          .subscribe();
        this.unsubscribe.push(celebrationSub);
      }),
      switchMap(() =>
        this.profileService.refreshProfile().pipe(
          tap((profile) => {
            this.applyProfile(profile);
          }),
          map(() => true),
          catchError(() => {
            // Save succeeded; profile refresh failed. Still clear the dirty state.
            this.form.markAsPristine();
            this.initialFormSnapshot = this.serializeNormalizedFormValue();
            return of(true);
          })
        )
      ),
      catchError((error) => {
        const err = error?.error ?? error;
        const message =
          typeof err?.message === "string" && err.message
            ? err.message
            : this.lang === "ar"
              ? "حدث خطأ أثناء الحفظ."
              : "Failed to save.";
        this.showError("", message);
        return of(false);
      }),
      finalize(() => this.savingSubject.next(false))
    );
  }

  private applyProfile(profile: any): void {
    this.profileAny = profile;
    const whatsappStatus = String(profile?.whatsapp_status ?? "inactive");
    const smsStatus = String(profile?.sms_status ?? profile?.sms_whatsapp ?? "inactive");

    const whatsappEnabled = whatsappStatus === "active";
    const smsEnabled = smsStatus === "active";

    this.form.patchValue(
      {
        whatsapp_enabled: whatsappEnabled,
        whatsapp_country_code: profile?.whatsapp_country_code || "",
        whatsapp_number: profile?.whatsapp_number || "",
        sms_enabled: smsEnabled,
        sms_country_code: profile?.sms_country_code || "",
        sms_number: profile?.sms_number || "",
      },
      { emitEvent: false }
    );

    // Loaded values should not be treated as "auto-filled" mirrors.
    this.smsAutoFilledFrom = null;
    this.whatsappAutoFilledFrom = null;

    this.updateChannelValidators();
    this.form.markAsPristine();
    this.initialFormSnapshot = this.serializeNormalizedFormValue();
  }

  private markPhoneChannelAsUserEdited(channel: "whatsapp" | "sms"): void {
    if (this.isSyncingPhoneFields) return;
    if (channel === "whatsapp") {
      this.whatsappAutoFilledFrom = null;
    } else {
      this.smsAutoFilledFrom = null;
    }
  }

  private hasUnsavedChanges(): boolean {
    if (!this.form) return false;
    if (!this.initialFormSnapshot) return false;
    return this.serializeNormalizedFormValue() !== this.initialFormSnapshot;
  }

  private serializeNormalizedFormValue(): string {
    const raw = this.form.getRawValue() as any;
    const whatsappEnabled = !!raw?.whatsapp_enabled;
    const smsEnabled = !!raw?.sms_enabled;
    const normalized = {
      whatsapp_enabled: whatsappEnabled,
      whatsapp_country_code: whatsappEnabled ? this.normalizeCountryCode(raw?.whatsapp_country_code) : "",
      whatsapp_number: whatsappEnabled ? this.normalizePhoneNumber(raw?.whatsapp_number) : "",
      sms_enabled: smsEnabled,
      sms_country_code: smsEnabled ? this.normalizeCountryCode(raw?.sms_country_code) : "",
      sms_number: smsEnabled ? this.normalizePhoneNumber(raw?.sms_number) : "",
    };
    return JSON.stringify(normalized);
  }

  private normalizeCountryCode(value: unknown): string {
    return this.normalizePhoneField(value).replace(/^\+/, "");
  }

  private normalizePhoneNumber(value: unknown): string {
    return this.normalizePhoneField(value).replace(/\D/g, "");
  }

  private syncOtherChannelIfEmptyOrAutoFilled(source: "whatsapp" | "sms"): void {
    if (this.isSyncingPhoneFields) return;

    const srcCodeKey = source === "whatsapp" ? "whatsapp_country_code" : "sms_country_code";
    const srcNumberKey = source === "whatsapp" ? "whatsapp_number" : "sms_number";
    const dstCodeKey = source === "whatsapp" ? "sms_country_code" : "whatsapp_country_code";
    const dstNumberKey = source === "whatsapp" ? "sms_number" : "whatsapp_number";

    const srcCode = this.normalizePhoneField(this.form.get(srcCodeKey)?.value);
    const srcNumber = this.normalizePhoneField(this.form.get(srcNumberKey)?.value);

    const dstCode = this.normalizePhoneField(this.form.get(dstCodeKey)?.value);
    const dstNumber = this.normalizePhoneField(this.form.get(dstNumberKey)?.value);

    const srcHasAny = !!srcCode || !!srcNumber;
    const dstHasAny = !!dstCode || !!dstNumber;

    const dstIsAutoFilled =
      source === "whatsapp" ? this.smsAutoFilledFrom === "whatsapp" : this.whatsappAutoFilledFrom === "sms";

    // Mirror when the other channel is still empty, or when it was auto-filled from this source.
    if ((!dstHasAny && srcHasAny) || dstIsAutoFilled) {
      this.isSyncingPhoneFields = true;
      this.form.get(dstCodeKey)?.setValue(srcCode, { emitEvent: false });
      this.form.get(dstNumberKey)?.setValue(srcNumber, { emitEvent: false });
      this.isSyncingPhoneFields = false;

      if (source === "whatsapp") {
        this.smsAutoFilledFrom = "whatsapp";
      } else {
        this.whatsappAutoFilledFrom = "sms";
      }
    }
  }

  private normalizePhoneField(value: unknown): string {
    return String(value ?? "").trim();
  }

  private updateChannelValidators(): void {
    const whatsappEnabled = !!this.form.get("whatsapp_enabled")?.value;
    const smsEnabled = !!this.form.get("sms_enabled")?.value;

    const whatsappCode = this.form.get("whatsapp_country_code");
    const whatsappNumber = this.form.get("whatsapp_number");
    const smsCode = this.form.get("sms_country_code");
    const smsNumber = this.form.get("sms_number");

    // Numbers are optional. If a channel is enabled and the user starts filling one field,
    // require the other field to complete the pair (country code + number).
    if (whatsappEnabled) {
      const hasCode = !!String(whatsappCode?.value || "").trim();
      const hasNumber = !!String(whatsappNumber?.value || "").trim();
      whatsappCode?.setValidators(hasNumber ? [Validators.required] : []);
      whatsappNumber?.setValidators(hasCode ? [Validators.required] : []);
    } else {
      whatsappCode?.clearValidators();
      whatsappNumber?.clearValidators();
    }

    if (smsEnabled) {
      const hasCode = !!String(smsCode?.value || "").trim();
      const hasNumber = !!String(smsNumber?.value || "").trim();
      smsCode?.setValidators(hasNumber ? [Validators.required] : []);
      smsNumber?.setValidators(hasCode ? [Validators.required] : []);
    } else {
      smsCode?.clearValidators();
      smsNumber?.clearValidators();
    }

    whatsappCode?.updateValueAndValidity({ emitEvent: false });
    whatsappNumber?.updateValueAndValidity({ emitEvent: false });
    smsCode?.updateValueAndValidity({ emitEvent: false });
    smsNumber?.updateValueAndValidity({ emitEvent: false });
  }
}
