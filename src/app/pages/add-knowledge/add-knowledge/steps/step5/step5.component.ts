import { Component, Injector, Input, OnInit, ChangeDetectorRef } from '@angular/core';
import { FormBuilder, FormGroup, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { Router } from '@angular/router';
import { ICreateKnowldege } from '../../create-account.helper';
import { BaseComponent } from 'src/app/modules/base.component';
import { ProfileService } from 'src/app/_fake/services/get-profile/get-profile.service';
import { TranslateService } from '@ngx-translate/core';
import { TooltipModule } from 'primeng/tooltip';
import { PaymentService, PaymentDetailsResponse } from 'src/app/_fake/services/payment/payment.service';
import { KnowledgeService, Knowledge } from 'src/app/_fake/services/knowledge/knowledge.service';

@Component({
  selector: 'app-step5',
  templateUrl: './step5.component.html',
  styles: [`
    /* Calendar styles */
    ::ng-deep .p-calendar {
      width: 100%;
    }
    ::ng-deep .p-calendar .p-inputtext {
      border-top-right-radius: 0;
      border-bottom-right-radius: 0;
      height: calc(1.5em + 1.5rem + 2px);
    }
    ::ng-deep .p-calendar .p-button {
      border-top-left-radius: 0;
      border-bottom-left-radius: 0;
      border-top-right-radius: 0.475rem;
      border-bottom-right-radius: 0.475rem;
      width: 3rem;
      height: calc(1.5em + 1.5rem + 2px);
      background: #FAFAFA;
      border: 1px solid #DFDFDF;
      color: #6E6E6E;
    }
    ::ng-deep .p-calendar .p-button:enabled:hover {
      background: #FAFAFA;
      border-color: #DFDFDF;
      color: #6E6E6E;
    }

    /* Radio button selection styles */
    :host ::ng-deep .btn-check:checked + .btn-outline {
      background-color: #f1faff !important;
      color: #3b82f6 !important;
      border: 1px solid #3b82f6 !important;
      box-shadow: 0 0 10px rgba(0, 158, 247, 0.1);
    }

    :host ::ng-deep .btn-check:checked + .btn-outline .text-gray-800 {
      color: #3b82f6 !important;
      font-weight: 600 !important;
    }

    :host ::ng-deep .btn-check:checked + .btn-outline .text-gray-600 {
      color: #0095e8 !important;
    }

    /* Hover effect for options */
    :host ::ng-deep .btn-outline:hover {
      background-color: #f8f8f8;
      transition: all 0.3s ease;
    }

    /* Fixed height for consistent card heights */
    .fixed-height-card {
      min-height: 180px;
      align-items: center;
    }

    /* Ensure proper spacing between cards */
    .notice + .notice {
      margin-top: 1.5rem;
    }

    /* Social share button styles */
    .social-share-btn {
      width: 50px;
      height: 50px;
      border-radius: 50%;
      transition: all 0.2s ease;
      border: none;
    }

    .social-share-btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    }

    .social-share-btn:active {
      transform: translateY(0);
    }

    .social-share-btn i {
      font-size: 20px !important;
      line-height: 1;
    }

    /* Ensure consistent sizing across all buttons */
    .social-share-btn.btn-primary,
    .social-share-btn.btn-dark,
    .social-share-btn.btn-info,
    .social-share-btn.btn-success {
      width: 50px;
      height: 50px;
      min-width: 50px;
      padding: 0;
    }
  `]
})
export class Step5Component extends BaseComponent implements OnInit {
  @Input('updateParentModel') updateParentModel: (
    part: Partial<ICreateKnowldege>,
    isFormValid: boolean
  ) => void;

  @Input() defaultValues: Partial<ICreateKnowldege>;

  publishForm: FormGroup;
  minDate: Date = new Date();
  publishOptions: Array<{
    id: string;
    value: string;
    label: string;
    description: string;
    icon: string;
    disabled: boolean;
  }> = [];
  userProfile: any = null;
  timeError: string = '';
  hasOnlyTwoOptions: boolean = false;
  paymentAccountDetails: PaymentDetailsResponse['data'] | null = null;
  paymentAccountLoading: boolean = false;
  paymentAccountError: string | null = null;
  hasActivePaymentAccount: boolean = false;

  // Calendar configuration for PrimeNG
  timeFormat: string = '24';
  dateFormat: string = 'yy-mm-dd';

  // Share functionality properties
  showShareBox: boolean = false;
  publishedKnowledge: Knowledge | null = null;
  isSocialShareModalVisible: boolean = false;
  customShareMessage: string = "";
  linkCopied: boolean = false;

  get isStripeAccountUnderVerification(): boolean {
    const primaryAccount = this.getPrimaryAccount();
    return primaryAccount?.type === 'provider' && 
           primaryAccount?.status !== 'active' && 
           primaryAccount?.details_submitted_at !== null &&
           primaryAccount?.charges_enable_at === null;
  }

  get isStripeAccountIncomplete(): boolean {
    const primaryAccount = this.getPrimaryAccount();
    return primaryAccount?.type === 'provider' && 
           primaryAccount?.status !== 'active' && 
           primaryAccount?.details_submitted_at === null;
  }

  get isManualAccountInactive(): boolean {
    const primaryAccount = this.getPrimaryAccount();
    return primaryAccount?.type === 'manual' && primaryAccount?.status !== 'active';
  }

  private getPrimaryAccount() {
    return this.paymentAccountDetails?.find(account => account.primary) || null;
  }

  get shouldShowPaymentWarning(): boolean {
    const roles = this.userProfile?.roles || [];
    const isInsighter = Array.isArray(roles) && roles.includes('insighter');
    const isCompany = Array.isArray(roles) && roles.includes('company');
    
    // Show warning if user has insighter/company role but no active payment account
    return (isInsighter || isCompany) && !this.hasActivePaymentAccount && this.paymentAccountDetails !== null;
  }

  saveAsDraftAndRedirect() {
    // Save as draft
    this.updateParentModel({
      publish_status: 'unpublished',
      publish_date_time: undefined
    }, true);
    
    // Redirect to setup payment info
    this.router.navigate(['/app/insighter-dashboard/account-settings/payment-settings']);
  }

  constructor(
    injector: Injector,
    private fb: FormBuilder,
    private profileService: ProfileService,
    private translateService: TranslateService,
    private paymentService: PaymentService,
    private cdr: ChangeDetectorRef,
    private router: Router,
    private knowledgeService: KnowledgeService
  ) {
    super(injector);

    // Add translation keys
    this.addTranslations();
  }

  private addTranslations() {
    // Add translation keys for account status messages
    const translations = {
      'en': {
        'ACCOUNT_STATUS_NOTICE': 'Payment Account Required',
        'ACTIVE_ACCOUNT_REQUIRED_MESSAGE': 'You need an active payment account to publish or schedule your knowledge. Please set up your payment account first. In the meantime, you can save it as a draft.',
        'STRIPE_VERIFICATION_NOTICE': 'Account Under Verification',
        'STRIPE_VERIFICATION_MESSAGE': 'Your Stripe payment account is currently under verification. Once verified, you will be able to publish and schedule your knowledge. In the meantime, you can save it as a draft.',
        'STRIPE_INCOMPLETE_NOTICE': 'Payment Account Setup Required',
        'STRIPE_INCOMPLETE_MESSAGE': 'You need to complete your payment account setup to publish or schedule your knowledge. Please complete the account creation process first. In the meantime, you can save it as a draft.',
        'MANUAL_ACCOUNT_INACTIVE_NOTICE': 'You\'re Almost There!',
        'MANUAL_ACCOUNT_INACTIVE_MESSAGE': 'One final step to start earning - set up your payment account to receive revenue from your published knowledge.',
        'SAVE_DRAFT_AND_SETUP_ACCOUNT': 'Save as draft and set up payment account',
        'SEND_TO_MANAGER': 'Send to Manager',
        'SEND_TO_MANAGER_DESC': 'Submit your knowledge for manager review before publishing.',
        'SCHEDULE_TIME_MIN_ERROR': 'Scheduled time must be at least 1 hour from now',
        'PAST_DATE_ERROR': 'Selected date cannot be in the past',
        'PAST_TIME_ERROR': 'Selected time must be at least 1 hour from now',
        'SHARE_YOUR_KNOWLEDGE': 'Share Your Knowledge',
        'SHARE_KNOWLEDGE_DESCRIPTION': 'Spread the word and help others discover your valuable insights. Sharing your knowledge increases its reach and impact in the community.',
        'SHARE_NOW': 'Share Now',
        'SHARE': 'Share',
        'COPY_LINK': 'Copy Link',
        'LINK_COPIED': 'Link Copied!'
      },
      'ar': {
        'ACCOUNT_STATUS_NOTICE': 'مطلوب حساب دفع',
        'ACTIVE_ACCOUNT_REQUIRED_MESSAGE': 'تحتاج إلى حساب دفع نشط لنشر أو جدولة المعرفة الخاصة بك. يرجى إعداد حساب الدفع الخاص بك أولاً. في غضون ذلك، يمكنك حفظها كمسودة.',
        'STRIPE_VERIFICATION_NOTICE': 'الحساب قيد التحقق',
        'STRIPE_VERIFICATION_MESSAGE': 'حساب الدفع الخاص بك عبر Stripe قيد التحقق حالياً. بمجرد التحقق منه، ستتمكن من نشر وجدولة المعرفة الخاصة بك. في غضون ذلك، يمكنك حفظها كمسودة.',
        'STRIPE_INCOMPLETE_NOTICE': 'مطلوب إعداد حساب الدفع',
        'STRIPE_INCOMPLETE_MESSAGE': 'تحتاج إلى إكمال إعداد حساب الدفع الخاص بك لنشر أو جدولة المعرفة الخاصة بك. يرجى إكمال عملية إنشاء الحساب أولاً. في غضون ذلك، يمكنك حفظها كمسودة.',
        'MANUAL_ACCOUNT_INACTIVE_NOTICE': 'أنت على وشك الانتهاء!',
        'MANUAL_ACCOUNT_INACTIVE_MESSAGE': 'خطوة أخيرة واحدة لبدء الربح - قم بإعداد حساب الدفع الخاص بك لتلقي الإيرادات من معرفتك المنشورة.',
        'SAVE_DRAFT_AND_SETUP_ACCOUNT': 'حفظ كمسودة وإعداد حساب الدفع',
        'SEND_TO_MANAGER': 'إرسال إلى المدير',
        'SEND_TO_MANAGER_DESC': 'أرسل المعرفة الخاصة بك للمراجعة من قبل المدير قبل النشر.',
        'SCHEDULE_TIME_MIN_ERROR': 'يجب أن يكون وقت الجدولة ساعة واحدة على الأقل من الآن',
        'PAST_DATE_ERROR': 'لا يمكن أن يكون التاريخ المحدد في الماضي',
        'PAST_TIME_ERROR': 'يجب أن يكون الوقت المحدد ساعة واحدة على الأقل من الآن',
        'SHARE_YOUR_KNOWLEDGE': 'شارك معرفتك',
        'SHARE_KNOWLEDGE_DESCRIPTION': 'انشر الكلمة وساعد الآخرين في اكتشاف رؤاك القيمة. مشاركة معرفتك تزيد من انتشارها وتأثيرها في المجتمع.',
        'SHARE_NOW': 'شارك الآن',
        'SHARE': 'شارك',
        'COPY_LINK': 'نسخ الرابط',
        'LINK_COPIED': 'تم نسخ الرابط!'
      }
    };
    
    // Add translations for each language
    for (const [lang, trans] of Object.entries(translations)) {
      this.translateService.setTranslation(lang, trans, true);
    }
  }

  ngOnInit(): void {
    // Get user profile data to determine roles and status
    this.profileService.getProfile().subscribe(profile => {
      this.userProfile = profile;
      
      // Check payment account status first
      this.checkPaymentAccount(() => {
        // Initialize after payment check
        this.initializePublishOptions();
        this.initializeForm();
      });
    });
  }

  private checkPaymentAccount(callback: () => void) {
    const roles = this.userProfile?.roles || [];
    const isInsighter = Array.isArray(roles) && roles.includes('insighter');
    const isCompany = Array.isArray(roles) && roles.includes('company');
    
    // Check if user status is active first
    let isActive = false;
    
    if (isCompany && this.userProfile?.company?.status === 'active') {
      isActive = true;
    }
    
    if (isInsighter && this.userProfile?.insighter_status === 'active') {
      isActive = true;
    }
    
    // Only check payment account for insighter/company roles with active status
    if (!isActive || (!isInsighter && !isCompany)) {
      this.hasActivePaymentAccount = false;
      callback();
      return;
    }

    this.paymentAccountLoading = true;
    this.paymentAccountError = null;

    const subscription = this.paymentService.getPaymentAccountDetails().subscribe({
      next: (response: PaymentDetailsResponse) => {
        this.paymentAccountDetails = response.data;
        const primaryAccount = this.getPrimaryAccount();
        this.hasActivePaymentAccount = primaryAccount?.status === 'active' || false;
        this.paymentAccountLoading = false;
        this.cdr.detectChanges();
        callback();
      },
      error: (error: any) => {
        if (error.status === 404) {
          this.paymentAccountDetails = null;
          this.hasActivePaymentAccount = false;
        } else {
          this.paymentAccountError = this.lang === 'ar' ? 'فشل في تحميل بيانات حساب الدفع' : 'Failed to load payment account details';
          this.hasActivePaymentAccount = false;
        }
        this.paymentAccountLoading = false;
        this.cdr.detectChanges();
        callback();
      }
    });
    this.unsubscribe.push(subscription);
  }

  private initializePublishOptions() {
    // Check if roles array exists and contains specific roles
    const roles = this.userProfile?.roles || [];
    
    const isCompany = Array.isArray(roles) && roles.includes('company');
    const isInsighter = Array.isArray(roles) && roles.includes('insighter');
    const isCompanyInsighter = Array.isArray(roles) && roles.includes('company-insighter');
    
    // Check if user status is active
    let isActive = false;
    
    if (isCompany && this.userProfile?.company?.status === 'active') {
      isActive = true;
    }
    
    if (isInsighter && this.userProfile?.insighter_status === 'active') {
      isActive = true;
    }
    
    // Check for company-insighter role first
    if (isCompanyInsighter) {
      
      // Check if the company-insighter has active status
      const isCompanyInsighterActive = this.userProfile?.insighter_status === 'active';
      
      // Always show both options, but disable review if inactive
      this.publishOptions = [
        {
          id: 'draft',
          value: 'unpublished',
          label: 'SAVE_AS_DRAFT',
          description: 'SAVE_AS_DRAFT_DESC',
          icon: 'document',
          disabled: false
        },
        {
          id: 'review',
          value: 'in_review',
          label: 'SEND_TO_MANAGER',
          description: 'SEND_TO_MANAGER_DESC',
          icon: 'eye',
          disabled: !isCompanyInsighterActive
        }
      ];
      
      this.hasOnlyTwoOptions = !isCompanyInsighterActive;
      return;
    }
    
    // For insighter/company roles, allow publishing regardless of payment status
    // but show warning message for inactive accounts
    const canPublish = isActive;
    
    // Always show all options, never disable them
    this.publishOptions = [
      {
        id: 'publish',
        value: 'published',
        label: 'PUBLISH_NOW',
        description: 'PUBLISH_NOW_DESC',
        icon: 'send',
        disabled: !canPublish
      },
      {
        id: 'schedule',
        value: 'scheduled',
        label: 'SCHEDULE',
        description: 'SCHEDULE_DESC',
        icon: 'time',
        disabled: !canPublish
      },
      {
        id: 'draft',
        value: 'unpublished',
        label: 'SAVE_AS_DRAFT',
        description: 'SAVE_AS_DRAFT_DESC',
        icon: 'document',
        disabled: false
      }
    ];
    
    // Never disable options, but show warning for payment account issues
    this.hasOnlyTwoOptions = false;
  }

  // Custom validator for date - must be today or future
  private dateValidator = (control: AbstractControl): ValidationErrors | null => {
    const publishOption = this.publishForm?.get('publishOption')?.value;
    
    if (publishOption !== 'scheduled' || !control.value) {
      return null;
    }

    // Check if value is a valid Date object
    if (!(control.value instanceof Date)) {
      return null;
    }
    
    // Check if date is valid (not Invalid Date)
    if (isNaN(control.value.getTime())) {
      return null;
    }

    const selectedDate = new Date(control.value);
    const today = new Date();
    
    // Reset hours to compare dates properly
    selectedDate.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);
    
    if (selectedDate < today) {
      return { pastDate: true };
    }
    
    return null;
  };

  // Custom validator for datetime combination - must be at least 1 hour from now
  private dateTimeValidator = (control: AbstractControl): ValidationErrors | null => {
    const publishOption = this.publishForm?.get('publishOption')?.value;
    
    if (publishOption !== 'scheduled') {
      return null;
    }

    const dateValue = this.publishForm?.get('publishDate')?.value;
    const timeValue = control.value;
    
    if (!dateValue || !timeValue) {
      return null;
    }
    
    // Check if values are valid Date objects
    if (!(dateValue instanceof Date) || !(timeValue instanceof Date)) {
      return null;
    }
    
    // Check if dates are valid (not Invalid Date)
    if (isNaN(dateValue.getTime()) || isNaN(timeValue.getTime())) {
      return null;
    }
    
    try {
      // Create a combined date-time object
      const scheduledDate = new Date(dateValue);
      scheduledDate.setHours(timeValue.getHours(), timeValue.getMinutes(), 0, 0);
      
      // Check if combined date is valid
      if (isNaN(scheduledDate.getTime())) {
        return { invalidDateTime: true };
      }
      
      const now = new Date();
      
      // Check if the scheduled date is in the past
      if (scheduledDate <= now) {
        return { pastDateTime: true };
      }
      
      // Check if the scheduled time is at least 1 hour from now
      const oneHourFromNow = new Date(now.getTime() + (60 * 60 * 1000));
      
      if (scheduledDate < oneHourFromNow) {
        return { tooSoon: true };
      }
      
      return null;
    } catch (error) {
      console.error('Error validating date/time:', error);
      return { invalidDateTime: true };
    }
  };
  
  private initializeForm() {
    this.publishForm = this.fb.group({
      publishOption: ['', Validators.required],
      publishDate: [null],
      publishTime: [null]
    });

    // Set validation rules for scheduled publishingx
    this.publishForm.get('publishOption')?.valueChanges.subscribe(option => {
      const publishDateControl = this.publishForm.get('publishDate');
      const publishTimeControl = this.publishForm.get('publishTime');

      if (option === 'scheduled') {
        publishDateControl?.setValidators([Validators.required, this.dateValidator]);
        publishTimeControl?.setValidators([Validators.required, this.dateTimeValidator]);
      } else {
        publishDateControl?.clearValidators();
        publishTimeControl?.clearValidators();
      }

      publishDateControl?.updateValueAndValidity();
      publishTimeControl?.updateValueAndValidity();
      
      // Clear timeError when switching away from scheduled
      if (option !== 'scheduled') {
        this.timeError = '';
      }

      // Update parent model with the selected option
      this.updateParentValues();
    });

    // React to form value changes
    this.publishForm.valueChanges.subscribe(() => {
      this.updateTimeError();
      this.updateParentValues();
    });

    // Add subscription for date changes to trigger time validation (since time depends on date)
    this.publishForm.get('publishDate')?.valueChanges.subscribe(() => {
      if (this.publishForm.get('publishOption')?.value === 'scheduled') {
        // Only re-validate time field when date changes (time validation depends on date)
        if (this.publishForm.get('publishTime')?.value) {
          this.publishForm.get('publishTime')?.updateValueAndValidity();
        }
      }
    });

    // Set defaults if we're in edit mode
    if (this.defaultValues.publish_status === 'scheduled' && this.defaultValues.publish_date_time) {
      const date = new Date(this.defaultValues.publish_date_time);
      this.publishForm.patchValue({
        publishOption: 'scheduled',
        publishDate: date,
        publishTime: date
      });
    }
  }

  onDateSelect(): void {
    // Trigger validation when date is selected
    const publishDateControl = this.publishForm.get('publishDate');
    const publishTimeControl = this.publishForm.get('publishTime');
    
    // Re-validate both date and time when date changes
    publishDateControl?.updateValueAndValidity();
    
    // Important: Re-validate time when date changes since time validator depends on date
    if (publishTimeControl?.value) {
      publishTimeControl?.updateValueAndValidity();
    }
    
    this.updateTimeError();
  }

  private updateTimeError(): void {
    const publishOption = this.publishForm.get('publishOption')?.value;
    
    if (publishOption !== 'scheduled') {
      this.timeError = '';
      return;
    }

    const publishDateControl = this.publishForm.get('publishDate');
    const publishTimeControl = this.publishForm.get('publishTime');
    
    // Check for date errors
    if (publishDateControl?.errors?.['pastDate']) {
      this.timeError = this.translateService.instant('PAST_DATE_ERROR');
    }
    // Check for time errors
    else if (publishTimeControl?.errors?.['pastDateTime']) {
      this.timeError = this.translateService.instant('PAST_TIME_ERROR');
    }
    else if (publishTimeControl?.errors?.['tooSoon']) {
      this.timeError = this.translateService.instant('SCHEDULE_TIME_MIN_ERROR');
    }
    else if (publishTimeControl?.errors?.['invalidDateTime']) {
      this.timeError = 'Invalid date or time';
    }
    else {
      // Clear error if no validation errors
      this.timeError = '';
    }
  }

  private getFormattedDateTime(): string | undefined {
    try {
      const dateValue = this.publishForm.get('publishDate')?.value;
      const timeValue = this.publishForm.get('publishTime')?.value;
      
      // Check if both values exist and are valid Date objects
      if (!dateValue || !timeValue) {
        return undefined;
      }
      
      // Ensure both values are Date objects
      if (!(dateValue instanceof Date) || !(timeValue instanceof Date)) {
        return undefined;
      }
      
      // Check if dates are valid (not Invalid Date)
      if (isNaN(dateValue.getTime()) || isNaN(timeValue.getTime())) {
        return undefined;
      }
      
      // Create a new date combining the date and time values
      const combinedDate = new Date(dateValue);
      combinedDate.setHours(timeValue.getHours(), timeValue.getMinutes(), 0, 0);
      
      // Final check that combined date is valid
      if (isNaN(combinedDate.getTime())) {
        return undefined;
      }
      
      // Format as MySQL datetime (YYYY-MM-DD HH:MM:SS)
      const year = combinedDate.getFullYear();
      const month = combinedDate.getMonth() + 1;
      const day = combinedDate.getDate();
      const hours = combinedDate.getHours();
      const minutes = combinedDate.getMinutes();
      
      return `${year}-${this.padZero(month)}-${this.padZero(day)} ${this.padZero(hours)}:${this.padZero(minutes)}:00`;
    } catch (error) {
      console.error('Error formatting date/time:', error);
      return undefined;
    }
  }

  private padZero(num: number): string {
    return num < 10 ? `0${num}` : `${num}`;
  }

  private updateParentValues() {
    const publishOption = this.publishForm.get('publishOption')?.value;
    let publishDateTime: string | undefined = undefined;

    // Only format date/time if scheduled option is selected
    if (publishOption === 'scheduled') {
      publishDateTime = this.getFormattedDateTime();
    }

    this.updateParentModel({
      publish_status: publishOption,
      publish_date_time: publishDateTime
    }, this.checkForm());
  }

  confirmSchedule() {
    // Final validation before confirming scheduled publish
    if (this.publishForm.valid) {
      const publishOption = this.publishForm.get('publishOption')?.value;
      const publishDateTime = this.getFormattedDateTime();

      this.updateParentModel({
        publish_status: publishOption,
        publish_date_time: publishDateTime
      }, true);
    }
  }

  saveAsDraft() {
    // Save as draft without validation
    this.updateParentModel({
      publish_status: 'unpublished',
      publish_date_time: undefined
    }, true);
  }

  checkForm(): boolean {
    const publishOption = this.publishForm.get('publishOption')?.value;
    
    // Basic form validation
    if (!publishOption) {
      return false;
    }

    // For scheduled option, check if form is valid (includes custom validators)
    if (publishOption === 'scheduled') {
      // Check if both date and time are required and valid
      const publishDateControl = this.publishForm.get('publishDate');
      const publishTimeControl = this.publishForm.get('publishTime');
      
      // Both date and time must be selected
      if (!publishDateControl?.value || !publishTimeControl?.value) {
        return false;
      }
      
      // Check for validation errors
      if (publishDateControl?.errors || publishTimeControl?.errors) {
        return false;
      }
      
      // Form is valid for scheduled option
      return this.publishForm.valid;
    }

    // For other options, just check if publish option is selected
    return this.publishForm.get('publishOption')?.valid || false;
  }


  /**
   * Validates the form and marks all fields as touched to show validation errors
   * @returns boolean indicating whether the form is valid
   */
  validateForm(): boolean {
    // Mark all controls as touched to show validation errors
    Object.keys(this.publishForm.controls).forEach(key => {
      this.publishForm.get(key)?.markAsTouched();
    });

    // Update time error display
    this.updateTimeError();

    // Update parent values after validation
    this.updateParentValues();

    // Return form validity
    return this.checkForm();
  }

  // Method to be called after successful publish to show share box
  onPublishSuccess(knowledgeId: number): void {
    // Fetch the published knowledge details
    this.knowledgeService.getKnowledgeById(knowledgeId).subscribe({
      next: (response) => {
        this.publishedKnowledge = response.data;
        this.showShareBox = true;
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Error fetching published knowledge:', error);
      }
    });
  }

  openSocialShareModal(): void {
    this.isSocialShareModalVisible = true;
    this.customShareMessage = this.getDefaultShareMessage();
    this.linkCopied = false;
  }

  closeSocialShareModal(): void {
    this.isSocialShareModalVisible = false;
  }

  getShareableLink(): string {
    if (!this.publishedKnowledge) return '';
    const knowledgeType = this.publishedKnowledge.type?.toLowerCase() || 'statistic';
    const slug = this.publishedKnowledge.slug || '';
    return `https://foresighta.co/${this.lang}/knowledge/${knowledgeType}/${slug}`;
  }

  getSocialShareTitle(): string {
    if (!this.publishedKnowledge) return 'Knowledge';
    const knowledgeType = this.publishedKnowledge.type ? this.publishedKnowledge.type.charAt(0).toUpperCase() + this.publishedKnowledge.type.slice(1) : 'Knowledge';
    const title = this.publishedKnowledge.title || 'Amazing Knowledge';
    return `${knowledgeType} - ${title}`;
  }

  getDefaultShareMessage(): string {
    if (!this.publishedKnowledge) return '';
    if (this.lang === 'ar') {
      return `اعتقدت أنك قد تستمتع بهذا على insightabusiness.com: ${this.publishedKnowledge.type || 'معرفة'} - ${this.publishedKnowledge.title || 'تحقق من هذه المعرفة'}`;
    }
    return `Thought you might enjoy this on insightabusiness.com: ${this.publishedKnowledge.type || 'Knowledge'} - ${this.publishedKnowledge.title || 'Check out this knowledge'}`;
  }

  shareToSocial(platform: string): void {
    const shareUrl = this.getSocialShareLinkWithCustomMessage(platform);
    window.open(shareUrl, '_blank', 'width=600,height=400');
    this.closeSocialShareModal();
  }

  getSocialShareLinkWithCustomMessage(platform: string): string {
    const shareUrl = this.getShareableLink();
    const message = this.customShareMessage || this.getDefaultShareMessage();
    const title = this.getSocialShareTitle();

    switch(platform) {
      case 'facebook':
        return `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}&quote=${encodeURIComponent(message)}`;
      case 'twitter':
        return `https://twitter.com/intent/tweet?text=${encodeURIComponent(message)}&url=${encodeURIComponent(shareUrl)}`;
      case 'linkedin':
        return `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}&title=${encodeURIComponent(title)}&summary=${encodeURIComponent(message)}`;
      case 'whatsapp':
        return `https://api.whatsapp.com/send?text=${encodeURIComponent(message)}%20${encodeURIComponent(shareUrl)}`;
      default:
        return '';
    }
  }

  copyToClipboard(text: string): void {
    navigator.clipboard.writeText(text).then(() => {
      this.linkCopied = true;
      setTimeout(() => {
        this.linkCopied = false;
      }, 3000);
    });
  }
}