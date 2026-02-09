import { Component, Injector, OnInit, ViewChild, AfterViewInit, HostListener } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, UrlTree } from '@angular/router';
import { Observable, of } from 'rxjs';
import { ComponentCanDeactivate } from 'src/app/guards/pending-changes.guard';
import { BaseComponent } from 'src/app/modules/base.component';
import { PaymentService, ManualAccountRequest, UpdateManualAccountRequest, PaymentDetailsResponse, PaymentMethod } from 'src/app/_fake/services/payment/payment.service';
import { CountriesService, Country } from 'src/app/_fake/services/countries/countries.service';
import { environment } from 'src/environments/environment';
import { ProfileService } from 'src/app/_fake/services/get-profile/get-profile.service';
import { PhoneNumberInputComponent } from 'src/app/reusable-components/phone-number-input/phone-number-input.component';
import { OtpModalConfig } from 'src/app/reusable-components/otp-modal/otp-modal.component';
import { GuidelinesService } from 'src/app/_fake/services/guidelines/guidelines.service';

interface ExtendedCountry extends Country {
  showFlag?: boolean;
}

@Component({
  selector: 'app-manual-account',
  templateUrl: './manual-account.component.html',
  styleUrls: ['./manual-account.component.scss']
})
export class ManualAccountComponent extends BaseComponent implements OnInit, AfterViewInit, ComponentCanDeactivate {
  manualAccountForm: FormGroup;
  showValidationErrors: boolean = false;
  isEditing: boolean = false;
  existingData: PaymentMethod | null = null;
  hasExistingManualAccount: boolean = false;
  countries: ExtendedCountry[] = [];
  userRoles: string[] = [];
  isCompanyAccount: boolean = false;
  resendCooldown: number = 0;
  canResendOtp: boolean = true;
  formattedPhoneNumber: string = '';
  selectedCountry: ExtendedCountry | null = null;
  termsAccepted: boolean = false;
  showTermsDialog: boolean = false;
  termsContent: string = '';
  isLoadingTerms: boolean = false;
  acceptAgreement: boolean = false;
  initialFormValue: any = null;
  showUnsavedChangesDialog: boolean = false;
  pendingNavigation: () => void = () => {};
  isFormDirtyOnEdit: boolean = false;
  allowNavigationAfterDiscard: boolean = false;
  private navigationResolver: ((value: boolean) => void) | null = null;

  // OTP Modal properties
  showOtpModal: boolean = false;
  isResendingOtp: boolean = false;
  private isFirstOtpOpen: boolean = true;
  otpModalConfig: OtpModalConfig = {
    headerTitle: '',
    autoGenerateOnOpen: true
  };


  @ViewChild('phoneInput') phoneInput!: PhoneNumberInputComponent;

  constructor(
    injector: Injector,
    private fb: FormBuilder,
    private router: Router,
    public paymentService: PaymentService,
    private countriesService: CountriesService,
    private profileService: ProfileService,
    private guidelinesService: GuidelinesService
  ) {
    super(injector);
    this.manualAccountForm = this.fb.group({
      // Beneficiary Information
      account_name: ['', [Validators.required, Validators.minLength(2)]],
      account_country_id: [''],
      account_phone: [''],

      // Bank Information
      bank_name: ['', [Validators.required, Validators.minLength(2)]],
      bank_country_id: ['', [Validators.required]],
      bank_address: ['', [Validators.required, Validators.minLength(5)]],
      bank_iban: ['', [Validators.required, Validators.minLength(10)]],
      bank_swift_code: [''],

      // Terms and Code
      accept_terms: [false, [Validators.requiredTrue]],
      code: ['', [Validators.required, Validators.minLength(4)]],

      // Helper fields for phone input
      phoneCountryCode: [''],
      phoneNumber: ['']
    });
  }

  ngOnInit() {
    this.loadUserProfile();
    this.loadCountries();
    this.trackFormChanges();
  }

  ngAfterViewInit() {
    // Update phone input component after data is loaded
    console.log('ngAfterViewInit called, phoneInput available:', !!this.phoneInput);
    if (this.isEditing && this.phoneInput) {
      setTimeout(() => {
        console.log('Calling updatePhoneInputDisplay from ngAfterViewInit');
        this.updatePhoneInputDisplay();
      });
    }
  }

  // Track form changes
  private trackFormChanges() {
    this.manualAccountForm.valueChanges.subscribe(() => {
      if (this.isEditing && this.initialFormValue) {
        this.isFormDirtyOnEdit = this.hasFormChanged();
      }
    });
  }

  // Check if form has unsaved changes
  private hasFormChanged(): boolean {
    if (!this.initialFormValue) return false;
    
    const currentValue = this.manualAccountForm.getRawValue();
    const keysToCheck = ['account_name', 'account_country_id', 'account_phone', 'bank_name', 'bank_country_id', 'bank_address', 'bank_iban', 'bank_swift_code', 'accept_terms'];

    for (const key of keysToCheck) {
      if (currentValue[key] !== this.initialFormValue[key]) {
        return true;
      }
    }
    return false;
  }

  // CanDeactivate implementation
  canDeactivate(): Observable<boolean> | boolean {
    if (this.allowNavigationAfterDiscard) {
      return true;
    }
    if (this.isEditing && this.hasFormChanged()) {
      return new Observable<boolean>(observer => {
        this.navigationResolver = (result: boolean) => {
          observer.next(result);
          observer.complete();
        };
        this.showUnsavedChangesDialog = true;
      });
    }
    return true;
  }

  // Handle browser back/refresh
  @HostListener('window:beforeunload', ['$event'])
  unloadNotification($event: any) {
    if (this.isEditing && this.hasFormChanged()) {
      $event.returnValue = true;
    }
  }

  // Dialog actions
  onStayOnPage() {
    this.showUnsavedChangesDialog = false;
    if (this.navigationResolver) {
      this.navigationResolver(false);
      this.navigationResolver = null;
    }
    // Auto-generate OTP when staying on page
    this.openOtpModal();
  }

  onDiscardChanges() {
    this.showUnsavedChangesDialog = false;

    // Reset form state to clean state to bypass canDeactivate check
    this.initialFormValue = this.manualAccountForm.getRawValue();
    this.manualAccountForm.markAsPristine();
    this.isFormDirtyOnEdit = false;

    // Resolve the navigation observable to allow navigation to proceed
    if (this.navigationResolver) {
      this.navigationResolver(true);
      this.navigationResolver = null;
    }

    // Also handle any explicit pending navigation (for back button)
    if (this.pendingNavigation) {
      this.pendingNavigation();
      this.pendingNavigation = () => {};
    }
  }

  loadUserProfile() {
    this.profileService.getProfile().subscribe({
      next: (profile) => {
        this.userRoles = profile?.roles || [];
        this.isCompanyAccount = this.userRoles.includes('company');
        this.updateValidatorsBasedOnAccountType();
      },
      error: (error) => {
        console.error('Error loading user profile:', error);
      }
    });
  }

  private updateValidatorsBasedOnAccountType() {
    const accountCountryControl = this.manualAccountForm.get('account_country_id');

    if (this.isCompanyAccount) {
      // Remove required validator for company accounts
      accountCountryControl?.clearValidators();
    } else {
      // Add required validator for individual accounts
      accountCountryControl?.setValidators([Validators.required]);
    }

    accountCountryControl?.updateValueAndValidity();
  }

  loadCountries() {
    console.log('Starting to load countries from API: https://api.insightabusiness.com/api/common/setting/country/list');

    this.countriesService.getCountries().subscribe({
      next: (countries) => {
        console.log('Countries API response:', countries);
        console.log('Countries API response length:', countries?.length);

        if (!countries || countries.length === 0) {
          console.error('Empty or null countries response from API');
          this.countries = [];
        } else {
          this.countries = countries.map(country => ({
            ...country,
            showFlag: true
          } as ExtendedCountry));
          console.log('Countries loaded successfully:', this.countries.length);
          console.log('Sample countries:', this.countries.slice(0, 3));

          // Log countries with code 268 and ID 167
          const country268 = this.countries.find(c => c.international_code === '268');
          const country167 = this.countries.find(c => c.id === 167);
          console.log('Country with code 268:', country268);
          console.log('Country with ID 167:', country167);
        }

        // Load existing data after countries are loaded
        this.loadExistingData();
      },
      error: (error) => {
        console.error('Error loading countries from API:', error);
        console.error('Error status:', error?.status);
        console.error('Error message:', error?.message);
        console.error('Error details:', error?.error);

        this.countries = [];
        this.loadExistingData();
      }
    });
  }


  // Check if manual account is fully set up (has all required data)
  private isManualAccountFullySetUp(manualAccount: PaymentMethod | null): boolean {
    if (!manualAccount) return false;
    
    // Check if key fields are filled (not null/empty)
    return !!(
      manualAccount.account_name &&
      manualAccount.bank_name &&
      manualAccount.bank_iban &&
      manualAccount.bank_country &&
      manualAccount.bank_address
    );
  }

  loadExistingData() {
    console.log('Loading existing data, countries available:', this.countries.length);
    // Always check payment account details to determine if manual account exists
    this.paymentService.getPaymentAccountDetails().subscribe({
      next: (response: PaymentDetailsResponse) => {
        const manualAccount = this.paymentService.getManualAccount(response.data);

        // Check if manual account exists with actual data
        // If manual account doesn't exist OR iban is null, treat as new account
        this.hasExistingManualAccount = manualAccount !== null &&
                                       manualAccount.bank_iban !== null &&
                                       manualAccount.bank_iban !== '';

        // Set accept_agreement status from the manual account
        // If account is not fully set up (has null values), show terms checkbox
        const isFullySetUp = this.isManualAccountFullySetUp(manualAccount);
        this.acceptAgreement = isFullySetUp && (manualAccount?.accept_agreement || false);
        
        // Check for edit mode
        const urlParams = new URLSearchParams(window.location.search);
        const isEditMode = urlParams.get('edit') === 'true';
        
        if (isEditMode && manualAccount) {
          // Edit mode - populate form with existing data
          this.isEditing = true;
          this.existingData = manualAccount;
          
          // Parse phone number from separate fields
          let countryCode = '';
          let phoneNumber = '';

          // Use separate phone fields if available
          if (this.existingData.account_phone_code && this.existingData.account_phone) {
            countryCode = this.existingData.account_phone_code;
            phoneNumber = this.existingData.account_phone;
            this.formattedPhoneNumber = `(+${countryCode})${phoneNumber}`;
            console.log('Phone code from API:', countryCode, 'Phone number:', phoneNumber);
          } else if (this.existingData.account_phone) {
            // Check if it's in combined format first
            const phoneMatch = this.existingData.account_phone.match(/\(\+(\d+)\)(.+)/);
            if (phoneMatch) {
              countryCode = phoneMatch[1];
              phoneNumber = phoneMatch[2];
              this.formattedPhoneNumber = this.existingData.account_phone;
            } else {
              // Phone number exists but no country code - just use the phone number
              phoneNumber = this.existingData.account_phone;
              this.formattedPhoneNumber = phoneNumber;
              // Keep countryCode empty for now
            }
          }

          // Set bank country if exists
          let bankCountryId: number | string = '';
          if (this.existingData.bank_country) {
            bankCountryId = this.existingData.bank_country.id; // Keep as number for dropdown
            console.log('Bank country from API:', this.existingData.bank_country);
            console.log('Bank country ID to set:', bankCountryId);
            console.log('Bank country ID type:', typeof bankCountryId);
          }
          
          // Set selected country
          if (this.existingData.account_country) {
            this.setSelectedCountry(this.existingData.account_country);
          }
          
          // Pre-fill form
          const formData = {
            account_name: this.existingData.account_name || '',
            account_country_id: this.existingData.account_country?.id || '',
            account_phone: this.formattedPhoneNumber || '',
            bank_name: this.existingData.bank_name || '',
            bank_country_id: bankCountryId,
            bank_address: this.existingData.bank_address || '',
            bank_iban: this.existingData.bank_iban || '',
            bank_swift_code: this.existingData.bank_swift_code || '',
            accept_terms: this.acceptAgreement,
            phoneCountryCode: countryCode,
            phoneNumber: phoneNumber.replace(/\D/g, '')
          };

          console.log('Available countries for dropdown:', this.countries.map(c => ({id: c.id, name: c.name})));
          console.log('Looking for bank country ID:', bankCountryId, 'type:', typeof bankCountryId);

          const matchingBankCountry = this.countries.find(c => c.id === bankCountryId);
          console.log('Matching bank country found:', matchingBankCountry);
          this.manualAccountForm.patchValue(formData);
          
          // Store initial form value after pre-filling
          setTimeout(() => {
            this.initialFormValue = this.manualAccountForm.getRawValue();
            this.manualAccountForm.markAsPristine();
            this.updatePhoneInputDisplay();
            console.log('Form value after patching:', this.manualAccountForm.getRawValue());
            // Additional timeout to ensure phone component is ready
            setTimeout(() => {
              this.updatePhoneInputDisplay();
            }, 500);
          });
        } else if (manualAccount?.country) {
          // Not in edit mode but manual account exists - set country from existing data
          this.setSelectedCountry(manualAccount.country);
          this.manualAccountForm.patchValue({
            account_country_id: manualAccount.country.id,
            bank_country_id: manualAccount.country.id
          });
        }
        
        // Load terms for new accounts or accounts that are not fully set up
        if (!isEditMode || !isFullySetUp) {
          this.loadManualPaymentTerms();
        }
      },
      error: () => {
        console.log('No existing payment details');
        this.hasExistingManualAccount = false;
        this.isEditing = false;
        // Load terms for new accounts
        this.loadManualPaymentTerms();
      }
    });
  }

  private setSelectedCountry(countryData: any) {
    // Find the matching country from the full countries list
    const matchingCountry = this.countries.find(c => c.id === countryData.id);
    if (matchingCountry) {
      this.selectedCountry = matchingCountry;
    } else {
      // If country not found in the full list, create from API data
      this.selectedCountry = {
        ...countryData,
        region_id: 0,
        iso2: '',
        iso3: '',
        nationality: '',
        nationalities: { en: '', ar: '' },
        international_code: '',
        names: { en: countryData.name, ar: countryData.name },
        status: 'active',
        showFlag: true
      } as ExtendedCountry;
    }
  }

  onAccountCountryChange(event: any) {
    const selectedCountryId = event.value;
    if (selectedCountryId) {
      this.selectedCountry = this.countries.find(c => c.id === selectedCountryId) || null;
    } else {
      this.selectedCountry = null;
    }
  }

  onBankCountryChange(event: any) {
    // Handle bank country selection separately if needed
  }

  onSubmit() {
    // Always validate first
    this.showValidationErrors = true;
    this.markFormGroupTouched();

    // Check if form has been modified in edit mode only after validation
    if (this.isEditing && !this.hasFormChanged()) {
      this.showInfo(
        this.lang === 'ar' ? 'معلومات' : 'Information',
        this.lang === 'ar' ? 'لم يتم إجراء أي تغييرات' : 'No changes were made'
      );
      return;
    }

    // Check if all required fields except code are valid
    const formValue = this.manualAccountForm.value;
    if (!this.areRequiredFieldsValid()) {
      // Don't open OTP modal, just show validation errors
      return;
    }

    // If code is missing but all other required fields are valid, generate OTP and open modal
    if (!formValue.code) {
      this.generateAndOpenOtpModal();
      return;
    }

    if (this.manualAccountForm.valid) {
      const formValue = this.manualAccountForm.value;

      if (!this.isCompanyAccount && !formValue.account_country_id) {
        this.showError(
          this.lang === 'ar' ? 'خطأ' : 'Error',
          this.lang === 'ar' ? 'يرجى اختيار بلد الحساب' : 'Please select account country'
        );
        return;
      }

      if (!formValue.bank_country_id) {
        this.showError(
          this.lang === 'ar' ? 'خطأ' : 'Error',
          this.lang === 'ar' ? 'يرجى اختيار بلد البنك' : 'Please select bank country'
        );
        return;
      }

      const requestData = {
        account_name: formValue.account_name,
        account_country_id: formValue.account_country_id,
        account_phone_code: formValue.phoneCountryCode || '',
        account_phone: formValue.phoneNumber || '',
        bank_name: formValue.bank_name,
        bank_country_id: formValue.bank_country_id,
        bank_address: formValue.bank_address,
        bank_iban: formValue.bank_iban.replace(/\s+/g, ''),
        bank_swift_code: formValue.bank_swift_code,
        accept_terms: formValue.accept_terms,
        code: formValue.code
      };

      // Always use updateManualAccount since backend creates account by default
      this.paymentService.updateManualAccount(requestData).subscribe({
        next: () => {
          // Reset form state to prevent unsaved changes dialog
          this.initialFormValue = this.manualAccountForm.getRawValue();
          this.manualAccountForm.markAsPristine();
          this.isFormDirtyOnEdit = false;

          this.showSuccess(
            this.lang === 'ar' ? 'تم الحفظ' : 'Success',
            this.lang === 'ar' ? 'تم تحديث الحساب بنجاح' : 'Account updated successfully'
          );
          this.router.navigate(['/app/insighter-dashboard/account-settings/payment-settings']);
        },
        error: (error) => {
          this.handleServerErrors(error);
        }
      });
    }
  }

  private markFormGroupTouched() {
    Object.keys(this.manualAccountForm.controls).forEach(key => {
      const control = this.manualAccountForm.get(key);
      control?.markAsTouched();
      control?.markAsDirty();
    });
  }

  private areRequiredFieldsValid(): boolean {
    const requiredFields = [
      'account_name',
      'bank_name',
      'bank_country_id',
      'bank_address',
      'bank_iban'
    ];

    // Add account_country_id only for individual accounts
    if (!this.isCompanyAccount) {
      requiredFields.push('account_country_id');
    }

    // Add accept_terms if accept_agreement is false (both new and edit modes)
    if (!this.acceptAgreement) {
      requiredFields.push('accept_terms');
    }

    for (const fieldName of requiredFields) {
      const control = this.manualAccountForm.get(fieldName);
      if (!control || control.invalid) {
        return false;
      }
    }

    return true;
  }

  goBack() {
    if (this.isEditing && this.hasFormChanged()) {
      this.showUnsavedChangesDialog = true;
      this.pendingNavigation = () => {
        this.router.navigate(['/app/insighter-dashboard/account-settings/payment-settings']);
      };
    } else {
      if (this.isEditing) {
        this.router.navigate(['/app/insighter-dashboard/account-settings/payment-settings']);
      } else {
        this.router.navigate(['/setup-payment-info']);
      }
    }
  }

  onCountryCodeChange(countryCode: string) {
    this.manualAccountForm.get('phoneCountryCode')?.setValue(countryCode);
  }

  onPhoneNumberChange(phoneNumber: string) {
    this.manualAccountForm.get('phoneNumber')?.setValue(phoneNumber);
  }

  onFormattedPhoneNumberChange(formattedPhone: string) {
    this.formattedPhoneNumber = formattedPhone;
    // Update account_phone field
    this.manualAccountForm.get('account_phone')?.setValue(formattedPhone);
  }

  updatePhoneInputDisplay() {
    if (this.phoneInput) {
      const countryCode = this.manualAccountForm.get('phoneCountryCode')?.value;
      const phoneNumber = this.manualAccountForm.get('phoneNumber')?.value;

      console.log('Updating phone display - countryCode:', countryCode, 'phoneNumber:', phoneNumber);
      console.log('Available countries for phone:', this.countries.length);

      if (this.countries.length === 0) {
        console.log('Countries not loaded yet, retrying in 1 second...');
        setTimeout(() => this.updatePhoneInputDisplay(), 1000);
        return;
      }

      // Find the country with matching international_code
      const matchingCountry = this.countries.find(c => c.international_code === countryCode);
      console.log('Matching country found:', matchingCountry);

      if (countryCode && matchingCountry) {
        this.phoneInput.countryCode = countryCode;
        this.phoneInput.updateMask();
        this.phoneInput.updatePlaceholder();
        console.log('Phone country code set to:', countryCode);
      }

      if (phoneNumber) {
        this.phoneInput.value = phoneNumber;
        console.log('Phone number set to:', phoneNumber);
      }
    } else {
      console.log('Phone input component not available yet');
    }
  }

  onFlagError(country: any) {
    country.showFlag = false;
  }



  getFlagUrl(flagName: string): string {
    return `assets/media/flags/${flagName}.svg`;
  }

  // OTP Modal methods
  openOtpModal() {
    this.otpModalConfig.headerTitle = this.lang === 'ar' ? 'تحقق من رمز الدفع' : 'Payment Verification';
    // Only auto-generate on first open, not when reopening after validation errors
    this.otpModalConfig.autoGenerateOnOpen = this.isFirstOtpOpen;
    this.showOtpModal = true;
    this.isFirstOtpOpen = false;
  }

  generateAndOpenOtpModal() {
    this.paymentService.generatePaymentOTP().subscribe({
      next: () => {
        this.showSuccess(
          this.lang === 'ar' ? 'تم الإرسال بنجاح' : 'Successfully Sent',
          this.lang === 'ar' ? 'تم إرسال رمز التحقق إلى بريدك الإلكتروني' : 'Verification code sent to your email'
        );
        this.openOtpModal();
      },
      error: (error) => {
        this.handleServerErrors(error);
      }
    });
  }

  onOtpSubmit(otpCode: string) {
    // Update the form control with the OTP code
    this.manualAccountForm.patchValue({ code: otpCode });
    this.manualAccountForm.get('code')?.markAsTouched();
    
    // Automatically submit the form after OTP is entered
    this.submitFormWithOtp();
  }

  private submitFormWithOtp() {
    // Mark all fields as touched to show validation errors
    this.markFormGroupTouched();
    this.showValidationErrors = true;

    // Check if code is valid first
    const codeControl = this.manualAccountForm.get('code');
    if (!codeControl || !codeControl.value || codeControl.value.trim() === '') {
      this.showError(
        this.lang === 'ar' ? 'رمز التحقق مطلوب' : 'Verification Code Required',
        this.lang === 'ar' ? 'يرجى إدخال رمز التحقق' : 'Please enter the verification code'
      );
      // Reopen OTP modal (don't auto-generate new OTP)
      this.otpModalConfig.autoGenerateOnOpen = false;
      setTimeout(() => {
        this.showOtpModal = true;
      }, 500);
      return;
    }

    // Check if code has minimum length
    if (codeControl.value.length < 4) {
      this.showError(
        this.lang === 'ar' ? 'رمز التحقق غير صحيح' : 'Invalid Verification Code',
        this.lang === 'ar' ? 'رمز التحقق يجب أن يكون على الأقل 4 أحرف' : 'Verification code must be at least 4 characters'
      );
      // Reopen OTP modal (don't auto-generate new OTP)
      this.otpModalConfig.autoGenerateOnOpen = false;
      setTimeout(() => {
        this.showOtpModal = true;
      }, 500);
      return;
    }

    // Check if all required fields except code are valid
    if (!this.areRequiredFieldsValid()) {
      // Find which fields are invalid for better error message
      const invalidFields: string[] = [];
      const requiredFields = [
        'account_name',
        'bank_name',
        'bank_country_id',
        'bank_address',
        'bank_iban'
      ];
      
      if (!this.isCompanyAccount) {
        requiredFields.push('account_country_id');
      }
      
      if (!this.acceptAgreement) {
        requiredFields.push('accept_terms');
      }

      requiredFields.forEach(fieldName => {
        const control = this.manualAccountForm.get(fieldName);
        if (!control || control.invalid) {
          invalidFields.push(this.getFieldLabel(fieldName));
        }
      });

      // Show error with specific fields
      const errorMessage = invalidFields.length > 0
        ? (this.lang === 'ar' 
            ? `الحقول التالية مطلوبة: ${invalidFields.join(', ')}`
            : `The following fields are required: ${invalidFields.join(', ')}`)
        : (this.lang === 'ar' 
            ? 'يرجى التأكد من ملء جميع الحقول المطلوبة'
            : 'Please ensure all required fields are filled');

      this.showError(
        this.lang === 'ar' ? 'خطأ في التحقق' : 'Validation Error',
        errorMessage
      );
      // Reopen OTP modal to allow user to try again (don't auto-generate new OTP)
      this.otpModalConfig.autoGenerateOnOpen = false;
      setTimeout(() => {
        this.showOtpModal = true;
      }, 500);
      return;
    }

    const formValue = this.manualAccountForm.value;

    if (!this.isCompanyAccount && !formValue.account_country_id) {
      this.showError(
        this.lang === 'ar' ? 'خطأ' : 'Error',
        this.lang === 'ar' ? 'يرجى اختيار بلد الحساب' : 'Please select account country'
      );
      // Reopen OTP modal (don't auto-generate new OTP)
      this.otpModalConfig.autoGenerateOnOpen = false;
      setTimeout(() => {
        this.showOtpModal = true;
      }, 500);
      return;
    }

    if (!formValue.bank_country_id) {
      this.showError(
        this.lang === 'ar' ? 'خطأ' : 'Error',
        this.lang === 'ar' ? 'يرجى اختيار بلد البنك' : 'Please select bank country'
      );
      // Reopen OTP modal (don't auto-generate new OTP)
      this.otpModalConfig.autoGenerateOnOpen = false;
      setTimeout(() => {
        this.showOtpModal = true;
      }, 500);
      return;
    }

    // Close OTP modal before submitting
    this.showOtpModal = false;

    const requestData = {
      account_name: formValue.account_name,
      account_country_id: formValue.account_country_id,
      account_phone_code: formValue.phoneCountryCode || '',
      account_phone: formValue.phoneNumber || '',
      bank_name: formValue.bank_name,
      bank_country_id: formValue.bank_country_id,
      bank_address: formValue.bank_address,
      bank_iban: formValue.bank_iban.replace(/\s+/g, ''),
      bank_swift_code: formValue.bank_swift_code,
      accept_terms: formValue.accept_terms,
      code: formValue.code
    };

    // Always use updateManualAccount since backend creates account by default
    this.paymentService.updateManualAccount(requestData).subscribe({
      next: () => {
        // Reset form state to prevent unsaved changes dialog
        this.initialFormValue = this.manualAccountForm.getRawValue();
        this.manualAccountForm.markAsPristine();
        this.isFormDirtyOnEdit = false;

        this.showSuccess(
          this.lang === 'ar' ? 'تم الحفظ' : 'Success',
          this.lang === 'ar' ? 'تم تحديث الحساب بنجاح' : 'Account updated successfully'
        );
        this.router.navigate(['/app/insighter-dashboard/account-settings/payment-settings']);
      },
      error: (error) => {
        this.handleOtpError(error);
      }
    });
  }

  private handleOtpError(error: any) {
    // Check if error is specifically related to invalid OTP code only
    if (error?.error?.errors?.code && !error?.error?.errors?.account_phone) {
      // Clear the code field and reopen OTP modal for invalid code
      this.manualAccountForm.patchValue({ code: '' });
      this.showError(
        this.lang === 'ar' ? 'رمز غير صحيح' : 'Invalid Code',
        this.lang === 'ar' ? 'الرمز المدخل غير صحيح، يرجى المحاولة مرة أخرى' : 'The entered code is invalid, please try again'
      );

      // Reopen OTP modal to allow user to try again (don't auto-generate new OTP)
      this.otpModalConfig.autoGenerateOnOpen = false;
      setTimeout(() => {
        this.showOtpModal = true;
      }, 500);
    } else {
      // Handle other server errors normally (including phone validation errors)
      this.handleServerErrors(error);
    }
  }

  onOtpResend() {
    this.isResendingOtp = true;
    this.paymentService.generatePaymentOTP().subscribe({
      next: () => {
        this.isResendingOtp = false;
        this.showSuccess(
          this.lang === 'ar' ? 'تم الإرسال بنجاح' : 'Successfully Sent',
          this.lang === 'ar' ? 'تم إرسال رمز التحقق الجديد إلى بريدك الإلكتروني' : 'New verification code sent to your email'
        );
      },
      error: (error) => {
        this.isResendingOtp = false;
        this.handleServerErrors(error);
      }
    });
  }

  onOtpCancel() {
    this.showOtpModal = false;
    // Clear the code field when user cancels
    this.manualAccountForm.patchValue({ code: '' });
  }

  onOtpClose() {
    this.showOtpModal = false;
    // Clear the code field when user closes modal
    this.manualAccountForm.patchValue({ code: '' });
  }

  // Terms and conditions methods
  openTermsDialog() {
    this.showTermsDialog = true;
  }

  closeTermsDialog() {
    this.showTermsDialog = false;
  }

  acceptTerms() {
    this.termsAccepted = true;
    this.manualAccountForm.patchValue({ accept_terms: true });
    this.manualAccountForm.get('accept_terms')?.markAsTouched();
    this.manualAccountForm.get('accept_terms')?.markAsDirty();
    this.closeTermsDialog();
  }

  declineTerms() {
    this.termsAccepted = false;
    this.manualAccountForm.patchValue({ accept_terms: false });
    this.manualAccountForm.get('accept_terms')?.markAsTouched();
    this.manualAccountForm.get('accept_terms')?.markAsDirty();
    this.closeTermsDialog();
  }

  private loadManualPaymentTerms() {
    this.isLoadingTerms = true;
    this.guidelinesService.getCurrentGuidelineByType('wallet_agreement').subscribe({
      next: (data) => {
        this.termsContent = data?.guideline || '';
        this.isLoadingTerms = false;
      },
      error: (error) => {
        console.error('Failed to load wallet agreement:', error);
        this.termsContent = '';
        this.isLoadingTerms = false;
      }
    });
  }

  printTerms(): void {
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      const termsTitle = this.lang === 'ar' ? 'شروط وأحكام محفظة الدفع' : 'Wallet Payment Terms & Conditions';
      const printContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>${termsTitle}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; line-height: 1.6; }
            h1 { color: #333; text-align: center; margin-bottom: 20px; }
            .content { margin: 0 auto; max-width: 800px; }
          </style>
        </head>
        <body>
          <h1>${termsTitle}</h1>
          <div class="content">${this.termsContent}</div>
        </body>
        </html>
      `;
      
      printWindow.document.open();
      printWindow.document.write(printContent);
      printWindow.document.close();
      
      setTimeout(() => {
        printWindow.print();
      }, 500);
    }
  }

  saveTerms(): void {
    if (this.termsContent) {
      const termsTitle = this.lang === 'ar' ? 'شروط-وأحكام-محفظة-الدفع' : 'Wallet-Payment-Terms-and-Conditions';
      const termsText = this.stripHtmlTags(this.termsContent);
      
      const blob = new Blob([termsText], { type: 'text/plain' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${termsTitle}.txt`;
      document.body.appendChild(a);
      a.click();
      
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    }
  }

  private stripHtmlTags(html: string): string {
    const tempElement = document.createElement('div');
    tempElement.innerHTML = html;
    return tempElement.textContent || tempElement.innerText || '';
  }


  getAccountNameLabel(): string {
    if (this.isCompanyAccount) {
      return this.lang === 'ar' ? 'الاسم القانوني للشركة' : 'Company Legal Name';
    } else {
      return this.lang === 'ar' ? 'الاسم الكامل' : 'Full Name';
    }
  }

  getFieldError(fieldName: string): string {
    const control = this.manualAccountForm.get(fieldName);
    if (control?.errors && (control.dirty || control.touched || this.showValidationErrors)) {
      if (control.errors['required'] || control.errors['requiredTrue']) {
        if (fieldName === 'accept_terms') {
          return this.lang === 'ar'
            ? 'يجب الموافقة على الشروط والأحكام'
            : 'You must agree to the Terms & Conditions';
        }
        return this.lang === 'ar'
          ? `${this.getFieldLabel(fieldName)} مطلوب`
          : `${this.getFieldLabel(fieldName)} is required`;
      }
      if (control.errors['minlength']) {
        const minLength = control.errors['minlength'].requiredLength;
        return this.lang === 'ar' 
          ? `${this.getFieldLabel(fieldName)} يجب أن يكون على الأقل ${minLength} أحرف` 
          : `${this.getFieldLabel(fieldName)} must be at least ${minLength} characters`;
      }
    }
    return '';
  }

  private getFieldLabel(fieldName: string): string {
    const labels: { [key: string]: { en: string, ar: string } } = {
      account_name: this.isCompanyAccount
        ? { en: 'Company Legal Name', ar: 'الاسم القانوني للشركة' }
        : { en: 'Full Name', ar: 'الاسم الكامل' },
      account_country_id: { en: 'Account Country', ar: 'بلد الحساب' },
      account_phone: { en: 'Account Phone', ar: 'هاتف الحساب' },
      bank_name: { en: 'Bank Name', ar: 'اسم البنك' },
      bank_country_id: { en: 'Bank Country', ar: 'بلد البنك' },
      bank_address: { en: 'Bank Address', ar: 'عنوان البنك' },
      bank_iban: { en: 'IBAN', ar: 'رقم الآيبان' },
      bank_swift_code: { en: 'SWIFT Code', ar: 'رمز السويفت' },
      phoneCountryCode: { en: 'Country Code', ar: 'رمز البلد' },
      phoneNumber: { en: 'Phone Number', ar: 'رقم الهاتف' },
      code: { en: 'Verification Code', ar: 'رمز التحقق' },
      accept_terms: { en: 'Terms & Conditions', ar: 'الشروط والأحكام' }
    };
    return this.lang === 'ar' ? labels[fieldName].ar : labels[fieldName].en;
  }

  private handleServerErrors(error: any) {
    if (error?.error) {
      // Handle new error format: {"message":"Invalid Code","errors":{"common":["Invalid Code"]}}
      if (error.error.errors) {
        const serverErrors = error.error.errors;
        for (const key in serverErrors) {
          if (serverErrors.hasOwnProperty(key)) {
            const messages = serverErrors[key];
            if (error.error.type === "warning") {
              this.showWarn(
                this.lang === "ar" ? "تحذير" : "Warning",
                Array.isArray(messages) ? messages.join(", ") : messages
              );
            } else {
              this.showError(
                this.lang === "ar" ? "حدث خطأ" : "An error occurred",
                Array.isArray(messages) ? messages.join(", ") : messages
              );
            }
          }
        }
      }
      // Handle simple message format
      else if (error.error.message) {
        if (error.error.type === "warning") {
          this.showWarn(
            this.lang === "ar" ? "تحذير" : "Warning",
            error.error.message
          );
        } else {
          this.showError(
            this.lang === "ar" ? "حدث خطأ" : "An error occurred",
            error.error.message
          );
        }
      }
      // Fallback for other error formats
      else {
        if (error.error.type === "warning") {
          this.showWarn(
            this.lang === "ar" ? "تحذير" : "Warning",
            this.lang === "ar" ? "تحذير غير متوقع" : "An unexpected warning occurred."
          );
        } else {
          this.showError(
            this.lang === "ar" ? "حدث خطأ" : "An error occurred",
            this.lang === "ar" ? "حدث خطأ غير متوقع" : "An unexpected error occurred."
          );
        }
      }
    } else {
      this.showError(
        this.lang === "ar" ? "حدث خطأ" : "An error occurred",
        this.lang === "ar" ? "حدث خطأ غير متوقع" : "An unexpected error occurred."
      );
    }
  }
}