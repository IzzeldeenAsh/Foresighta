import { Component, Injector, OnInit } from "@angular/core";
import { FormBuilder, FormGroup, Validators } from "@angular/forms";
import { BehaviorSubject, catchError, finalize, forkJoin, of, tap } from "rxjs";
import { CountriesService } from "src/app/_fake/services/countries/countries.service";
import { ProfileService } from "src/app/_fake/services/get-profile/get-profile.service";
import { UpdateProfileService } from "src/app/_fake/services/profile/profile.service";
import { BaseComponent } from "src/app/modules/base.component";

type ChannelStatus = "active" | "inactive";

@Component({
  selector: "app-notification-settings",
  templateUrl: "./notification-settings.component.html",
  styleUrls: ["./notification-settings.component.scss"],
})
export class NotificationSettingsComponent extends BaseComponent implements OnInit {
  form!: FormGroup;
  countries: any[] = [];

  private readonly loadingSubject = new BehaviorSubject<boolean>(true);
  readonly isLoading$ = this.loadingSubject.asObservable();

  private readonly savingSubject = new BehaviorSubject<boolean>(false);
  readonly isSaving$ = this.savingSubject.asObservable();

  private profileAny: any = null;

  constructor(
    injector: Injector,
    private readonly fb: FormBuilder,
    private readonly countriesService: CountriesService,
    private readonly profileService: ProfileService,
    private readonly updateProfileService: UpdateProfileService
  ) {
    super(injector);
  }

  ngOnInit(): void {
    this.initForm();
    this.loadData();
  }

  reload(): void {
    this.loadData();
  }

  toggleWhatsApp(enabled: boolean): void {
    this.form.get("whatsapp_enabled")?.setValue(enabled);
    this.updateChannelValidators();
  }

  toggleSms(enabled: boolean): void {
    this.form.get("sms_enabled")?.setValue(enabled);
    this.updateChannelValidators();
  }

  onFlagError(country: any): void {
    country.showFlag = false;
  }

  onWhatsAppCountryCodeChange(countryCode: string): void {
    this.form.get("whatsapp_country_code")?.setValue(countryCode);
  }

  onWhatsAppNumberChange(phoneNumber: string): void {
    this.form.get("whatsapp_number")?.setValue(phoneNumber);
  }

  onWhatsAppFormattedPhoneNumberChange(_: string): void {
    // no-op
  }

  onSmsCountryCodeChange(countryCode: string): void {
    this.form.get("sms_country_code")?.setValue(countryCode);
  }

  onSmsNumberChange(phoneNumber: string): void {
    this.form.get("sms_number")?.setValue(phoneNumber);
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
    this.form.markAllAsTouched();
    this.updateChannelValidators();

    if (this.form.invalid) return;
    if (this.savingSubject.value) return;

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

    const sub = this.updateProfileService
      .updateNotificationChannel(payload)
      .pipe(
        tap(() => {
          const msg =
            this.lang === "ar"
              ? "تم تحديث إعدادات الإشعارات"
              : "Notification settings updated";
          this.showSuccess("", msg);
        }),
        finalize(() => this.savingSubject.next(false))
      )
      .subscribe({
        next: () => {
          // Must refresh profile after successful post
          const refreshSub = this.profileService.refreshProfile().subscribe({
            next: (profile) => {
              this.applyProfile(profile);
            },
          });
          this.unsubscribe.push(refreshSub);
        },
        error: (error) => {
          const err = error?.error ?? error;
          const message =
            typeof err?.message === "string" && err.message
              ? err.message
              : this.lang === "ar"
                ? "حدث خطأ أثناء الحفظ."
                : "Failed to save.";
          this.showError("", message);
        },
      });

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

  private applyProfile(profile: any): void {
    this.profileAny = profile;
    const whatsappStatus = String(profile?.whatsapp_status ?? "inactive");
    const smsStatus = String(profile?.sms_status ?? profile?.sms_whatsapp ?? "inactive");

    const whatsappEnabled = whatsappStatus === "active";
    const smsEnabled = smsStatus === "active";

    this.form.patchValue({
      whatsapp_enabled: whatsappEnabled,
      whatsapp_country_code: profile?.whatsapp_country_code || "",
      whatsapp_number: profile?.whatsapp_number || "",
      sms_enabled: smsEnabled,
      sms_country_code: profile?.sms_country_code || "",
      sms_number: profile?.sms_number || "",
    });

    this.updateChannelValidators();
    this.form.markAsPristine();
  }

  private updateChannelValidators(): void {
    const whatsappEnabled = !!this.form.get("whatsapp_enabled")?.value;
    const smsEnabled = !!this.form.get("sms_enabled")?.value;

    const whatsappCode = this.form.get("whatsapp_country_code");
    const whatsappNumber = this.form.get("whatsapp_number");
    const smsCode = this.form.get("sms_country_code");
    const smsNumber = this.form.get("sms_number");

    if (whatsappEnabled) {
      whatsappCode?.setValidators([Validators.required]);
      whatsappNumber?.setValidators([Validators.required]);
    } else {
      whatsappCode?.clearValidators();
      whatsappNumber?.clearValidators();
    }

    if (smsEnabled) {
      smsCode?.setValidators([Validators.required]);
      smsNumber?.setValidators([Validators.required]);
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

