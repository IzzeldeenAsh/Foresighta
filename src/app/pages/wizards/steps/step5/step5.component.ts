
import {
  Component,
  ElementRef,
  Injector,
  Input,
  OnDestroy,
  OnInit,
  ViewChild,
} from "@angular/core";
import { FormBuilder, FormGroup, Validators } from "@angular/forms";
import { BehaviorSubject, Subscription, fromEvent, map, startWith, take, timer } from "rxjs";

import { ICreateAccount } from "../../create-account.helper";

import { TranslationService } from "src/app/modules/i18n";

import { HttpClient, HttpHeaders } from "@angular/common/http";
import { BaseComponent } from "src/app/modules/base.component";
import { CommonService } from "src/app/_fake/services/common/common.service";

@Component({
  selector: "app-step5",
  templateUrl: "./step5.component.html",
  styleUrls: ["./step5.component.scss"]
})
export class Step5Component extends BaseComponent implements OnInit {
  lang: string;
  dialogWidth: string = "50vw";
  reverseLoader: boolean = false;
  gettingCodeLoader:boolean=false;
  @Input("updateParentModel") updateParentModel: (
    part: Partial<ICreateAccount>,
    isFormValid: boolean
  ) => void;
  form: FormGroup;
  @Input() defaultValues: Partial<ICreateAccount>;
  @ViewChild("fileInput") fileInput: ElementRef<HTMLInputElement>;
  resizeSubscription!: Subscription;
  isGetCodeDisabled: boolean = false;
  getCodeCountdown$ = new BehaviorSubject<number | null>(null);

  // Agreement properties
  agreementChecked: boolean = false;
  showAgreementError: boolean = false;
  agreementContent: any = null;
  isLoadingAgreement: boolean = false;
  showAgreementDialog: boolean = false;
  attemptedSubmit: boolean = false; // Track if user has attempted to submit

  private readonly MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB in bytes

  constructor(
    injector: Injector,
    private fb: FormBuilder,
    private _translateion: TranslationService,
    private http: HttpClient,
    private commonService: CommonService
  ) {
    super(injector);
    this.lang = this._translateion.getSelectedLanguage();
  }

  ngOnInit() {
    // Initialize core components
    this.initForm();
    this.windowResize();
    
    // Setup subscriptions
    this.setupSubscriptions();
    
    // Initialize from default values
    this.initializeFromDefaults();
    
    // Update parent model initially with all step 5 data
    this.updateParentModel(
      { 
        verificationMethod: this.form.get('verificationMethod')?.value,
        website: this.form.get('website')?.value,
        companyEmail: this.form.get('companyEmail')?.value,
        code: this.form.get('code')?.value,
        registerDocument: this.defaultValues?.registerDocument,
        companyAgreement: this.agreementChecked 
      },
      this.form.valid && this.agreementChecked
    );
  }

  private setupSubscriptions(): void {
    // Language change subscription
    const langSub = this._translateion.onLanguageChange().subscribe((lang) => {
      this.lang = lang;
    });
    this.unsubscribe.push(langSub);
  }

  private initializeFromDefaults(): void {
    if (this.defaultValues?.registerDocument) {
      this.form.patchValue({
        registerDocument: this.defaultValues.registerDocument,
      });
      this.form.get("registerDocument")?.markAsTouched();
    }
    
    // Initialize verification method from default values
    if (this.defaultValues?.verificationMethod) {
      this.form.patchValue({
        verificationMethod: this.defaultValues.verificationMethod,
      });
      this.updateConditionalValidators(this.defaultValues.verificationMethod);
    }
    
    // Initialize website input from default values
    if (this.defaultValues?.website) {
      this.form.patchValue({
        website: this.defaultValues.website,
      });
      this.form.get("website")?.markAsTouched();
    }
    
    // Initialize company email from default values
    if (this.defaultValues?.companyEmail) {
      this.form.patchValue({
        companyEmail: this.defaultValues.companyEmail,
      });
      this.form.get("companyEmail")?.markAsTouched();
    }
    
    // Initialize verification code from default values
    if (this.defaultValues?.code) {
      this.form.patchValue({
        code: this.defaultValues.code,
      });
      this.form.get("code")?.markAsTouched();
    }
    
    if (this.defaultValues?.companyAgreement) {
      this.agreementChecked = true;
    }
  }

  // Open the agreement dialog to view the full terms
  openAgreementDialog(event?: MouseEvent) {
    // If event exists, it's a click on the checkbox, so prevent immediate toggling
    if (event) {
      event.preventDefault();
    }
    
    this.isLoadingAgreement = true;
    this.showAgreementDialog = true;
    
    this.commonService.getGuidelineByTypeCurrent('company_agreement').subscribe({
      next: (response) => {
        this.agreementContent = response.data;
        this.isLoadingAgreement = false;
      },
      error: (error) => {
        console.error('Error loading agreement:', error);
        this.isLoadingAgreement = false;
        this.messageService.add({ 
          severity: 'error', 
          summary: 'Error', 
          detail: 'Failed to load agreement. Please try again.' 
        });
      }
    });
  }
  
  // Accept the agreement terms
  acceptAgreement() {
    this.agreementChecked = true;
    this.showAgreementDialog = false;
    this.updateParentModel({ companyAgreement: true }, this.form.valid);
  }

  // Decline the agreement terms
  declineAgreement() {
    this.agreementChecked = false;
    this.showAgreementDialog = false;
    this.showAgreementError = true; // Show error on explicit decline
    this.updateParentModel({ companyAgreement: false }, false);
  }

  // Print terms document in a new window
  printTerms(): void {
    // Create a new window for printing
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      // Prepare content for printing
      const termsTitle = this.agreementContent?.name || 'Company Terms of Service';
      const termsContent = this.agreementContent?.guideline || '';
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
          <div class="content">${termsContent}</div>
        </body>
        </html>
      `;
      
      printWindow.document.open();
      printWindow.document.write(printContent);
      printWindow.document.close();
      
      setTimeout(() => {
        printWindow.print();
      }, 500);
    } else {
      this.messageService.add({ 
        severity: 'error', 
        summary: 'Error', 
        detail: 'Could not open print window. Please check your browser settings.' 
      });
    }
  }

  // Save terms as a text file
  saveTerms(): void {
    if (this.agreementContent) {
      const termsTitle = this.agreementContent.name || 'Company-Terms-of-Service';
      const termsText = this.stripHtmlTags(this.agreementContent.guideline);
      
      // Create a Blob with the text content
      const blob = new Blob([termsText], { type: 'text/plain' });
      
      // Create a download link and trigger the download
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${termsTitle.replace(/\s+/g, '-')}.txt`;
      document.body.appendChild(a);
      a.click();
      
      // Clean up
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    }
  }

  // Helper method to strip HTML tags from content
  private stripHtmlTags(html: string): string {
    // Create a temporary element to extract text from HTML
    const tempElement = document.createElement('div');
    tempElement.innerHTML = html;
    return tempElement.textContent || tempElement.innerText || '';
  }

  private windowResize() {
    const screenwidth$ = fromEvent(window, "resize").pipe(
      map(() => window.innerWidth),
      startWith(window.innerWidth)
    );

    this.resizeSubscription = screenwidth$.subscribe((width) => {
      this.dialogWidth = width < 768 ? "100vw" : "70vw";
    });
  }

  ngOnDestroy(): void {
    if (this.resizeSubscription) {
      this.resizeSubscription.unsubscribe();
    }
    
    // Unsubscribe from all subscriptions
    this.unsubscribe.forEach(sub => {
      if (sub && !sub.closed) {
        sub.unsubscribe();
      }
    });
  }
  onDropzoneClick() {
    this.fileInput.nativeElement.click();
  }
  getCode() {
    const email = this.form.get('companyEmail')?.value;
    
    if (!email || !this.form.get('companyEmail')?.valid) {
      return;
    }

    this.gettingCodeLoader = true;
    
    const headers = new HttpHeaders({
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'Accept-Language': this.lang || 'en'
    });

    const getCodeSub = this.http.post('https://api.insightabusiness.com/api/auth/company/code/send', {
      verified_email: email,
    }, { headers })
    .subscribe({
      next: () => {
        this.showSuccess('Success', 'Verification email sent successfully.');
        this.gettingCodeLoader = false;
        this.startGetCodeCooldown();
      },
      error: (error) => {
        console.error('Error sending code:', error);
        const errorMsg = error?.error?.message || 'Failed to send verification code.';
        this.showError('Error', errorMsg);
        this.gettingCodeLoader = false;
      }
    });
    
    this.unsubscribe.push(getCodeSub);
  }
  startGetCodeCooldown(): void {
    const countdownTime = 30;

    this.isGetCodeDisabled = true;
    this.getCodeCountdown$.next(countdownTime);
    
    const countdown$ = timer(0, 1000).pipe(
      take(countdownTime + 1),
      map(value => countdownTime - value)
    );

    const resendTimerSubscription = countdown$.subscribe({
      next: (remainingTime) => {
        this.getCodeCountdown$.next(remainingTime >= 0 ? remainingTime : 0);
      },
      complete: () => {
        this.getCodeCountdown$.next(null);
        this.isGetCodeDisabled = false;
      }
    });

    this.unsubscribe.push(resendTimerSubscription);
  }
  // Handle file selection from the file input
  onFileSelected(event: any) {
    const file = event.target.files[0];
    if (!file) {
      return;
    }

    if (!this.validateFileSize(file)) {
      return;
    }

    this.form.patchValue({ registerDocument: file });
    this.form.get("registerDocument")?.markAsTouched();
    this.updateParentModel({ registerDocument: file }, this.checkForm());
  }

  private validateFileSize(file: File): boolean {
    if (file.size > this.MAX_FILE_SIZE) {
      this.showError('File Size Exceeded', 'The uploaded document exceeds the 2MB size limit.');
      return false;
    }
    return true;
  }

  // Prevent default drag over behavior
  onDragOver(event: DragEvent) {
    event.preventDefault();
  }

  // Handle files dropped into the dropzone
  onFileDrop(event: DragEvent) {
    event.preventDefault();
    const files = event.dataTransfer?.files;
    
    if (!files || files.length === 0) {
      return;
    }

    const file = files.item(0);
    if (!file) {
      return;
    }

    if (!this.validateFileSize(file)) {
      return;
    }

    this.form.patchValue({ registerDocument: file });
    this.form.get("registerDocument")?.markAsTouched();
    this.updateParentModel({ registerDocument: file }, this.checkForm());
  }

  // Remove the uploaded register document
  removeRegisterDocument() {
    this.form.patchValue({ registerDocument: null });
    this.updateParentModel({ registerDocument: null }, this.checkForm());
    this.fileInput.nativeElement.value = "";
  }

  // Get the icon path based on the file extension
  getFileIcon(file: File): string {
    const extension = file.name.split(".").pop()?.toLowerCase();
    const iconPath = `./assets/media/svg/files/${extension}.svg`;
    // If the icon doesn't exist, you can return a default icon path
    return iconPath;
  }

  initForm() {
    this.form = this.fb.group({
      verificationMethod: ['websiteEmail', Validators.required],
      website: [''],
      companyEmail: [''],
      code: [''],
      registerDocument: [null]
    }, { 
      validators: this.verificationMethodValidator() 
    });

    this.setupFormSubscriptions();
    this.updateConditionalValidators('websiteEmail');
  }

  private setupFormSubscriptions(): void {
    // Verification method changes
    const verificationMethodSub = this.form.get('verificationMethod')?.valueChanges
      .subscribe(value => {
        this.updateConditionalValidators(value);
        // Update parent model when verification method changes
        const updateData = {
          verificationMethod: value,
          website: this.form.get('website')?.value,
          companyEmail: this.form.get('companyEmail')?.value,
          code: this.form.get('code')?.value,
          registerDocument: this.form.get('registerDocument')?.value,
          companyAgreement: this.agreementChecked
        };
        this.updateParentModel(updateData, this.checkForm());
      });
    
    if (verificationMethodSub) {
      this.unsubscribe.push(verificationMethodSub);
    }

    // Form value changes
    const formChangesSub = this.form.valueChanges.subscribe((val) => {
      // Create a comprehensive update object with all form values
      const updateData = {
        verificationMethod: val.verificationMethod,
        website: val.website,
        companyEmail: val.companyEmail,
        code: val.code,
        registerDocument: val.registerDocument,
        companyAgreement: this.agreementChecked
      };
      this.updateParentModel(updateData, this.checkForm());
    });
    this.unsubscribe.push(formChangesSub);
    
    // Domain matching validation
    this.setupDomainValidationSubscriptions();
  }

  private setupDomainValidationSubscriptions(): void {
    const websiteChangesSub = this.form.get('website')?.valueChanges
      .subscribe(() => this.validateDomainMatching());
    
    const emailChangesSub = this.form.get('companyEmail')?.valueChanges
      .subscribe(() => this.validateDomainMatching());
    
    if (websiteChangesSub) this.unsubscribe.push(websiteChangesSub);
    if (emailChangesSub) this.unsubscribe.push(emailChangesSub);
  }

  updateConditionalValidators(verificationMethod: string) {
    if (verificationMethod === 'websiteEmail') {
      // Make website, companyEmail, and code required
      this.form.get('website')?.setValidators([Validators.required]);
      this.form.get('companyEmail')?.setValidators([Validators.required, Validators.email]);
      this.form.get('code')?.setValidators([Validators.required]);
      this.form.get('registerDocument')?.setValidators([]);
    } else if (verificationMethod === 'uploadDocument') {
      // Make registerDocument required, others optional
      this.form.get('website')?.setValidators([]);
      this.form.get('companyEmail')?.setValidators([]);
      this.form.get('code')?.setValidators([]);
      this.form.get('registerDocument')?.setValidators([Validators.required]);
    }

    // Update validity for all controls
    this.form.get('website')?.updateValueAndValidity();
    this.form.get('companyEmail')?.updateValueAndValidity();
    this.form.get('code')?.updateValueAndValidity();
    this.form.get('registerDocument')?.updateValueAndValidity();
  }

  verificationMethodValidator(){
    return (group:FormGroup)=>{
      const verificationMethod = group.get('verificationMethod')?.value;
      if (verificationMethod === 'websiteEmail') {
        const website = group.get('website')?.value;
        const companyEmail = group.get('companyEmail')?.value;
        const code = group.get('code')?.value;
        if (!website || !companyEmail || !code) {
          return { websiteEmailRequired: true };
        }
      }else if (verificationMethod === 'uploadDocument') {
        const registerDocument = group.get('registerDocument')?.value;
        if (!registerDocument) {
          return { registerDocumentRequired: true };
        }
      }
      return null;
    }
  }

  atLeastOneRequired(...fields: string[]) {
    return (group: FormGroup) => {
      const hasAtLeastOne = fields.some((fieldName) => {
        const field = group.get(fieldName);
        return field && field.value && field.value !== "";
      });
      return hasAtLeastOne ? null : { atLeastOneRequired: true };
    };
  }
  onFileChange(event: any) {
    const file = event.target.files[0];
    if (!file) {
      return;
    }

    if (!this.validateFileSize(file)) {
      return;
    }

    this.form.patchValue({ registerDocument: file });
    this.updateParentModel({ registerDocument: file }, this.checkForm());
  }
  checkForm(): boolean {
    const isValid = this.form.valid && this.agreementChecked;
    
    // Update the parent with the agreement status
    this.updateParentModel({ companyAgreement: this.agreementChecked }, isValid);
    
    // Show agreement error only after attempted submit or explicit decline
    this.showAgreementError = !this.agreementChecked && this.attemptedSubmit;
    
    return isValid;
  }

  // Validates if the email domain matches the website domain
  validateDomainMatching(): boolean {
    if (this.form.get('verificationMethod')?.value !== 'websiteEmail') {
      return true; // Not using website/email verification method
    }
    
    const website = this.form.get('website')?.value;
    const email = this.form.get('companyEmail')?.value;
    
    if (!website || !email) {
      return false; // Missing required fields
    }
    
    const websiteDomain = this.extractDomainFromWebsite(website);
    const emailDomain = this.extractDomainFromEmail(email);
    
    return !!(websiteDomain && emailDomain && emailDomain.endsWith(websiteDomain));
  }
  
  // Extract domain from website URL, handling various formats
  extractDomainFromWebsite(website: string): string | null {
    if (!website) return null;
    
    // Clean up the website input
    let domain = website.trim().toLowerCase();
    
    // Remove protocol (http://, https://)
    domain = domain.replace(/^(https?:\/\/)/i, '');
    
    // Remove www. prefix if present
    domain = domain.replace(/^www\./i, '');
    
    // Remove path, query parameters, and hash
    domain = domain.split('/')[0];
    domain = domain.split('?')[0];
    domain = domain.split('#')[0];
    
    // Remove port if present
    domain = domain.split(':')[0];
    
    return domain || null;
  }
  
  // Extract domain from email address
  extractDomainFromEmail(email: string): string | null {
    if (!email || !email.includes('@')) return null;
    
    return email.split('@')[1].toLowerCase();
  }
  
  // Check if email contains @ symbol for early validation
  hasEmailAtSymbol(): boolean {
    const email = this.form.get('companyEmail')?.value;
    return email && email.includes('@');
  }
  
  // Call this before submitting the form - used by the parent component
  prepareForSubmit() {
    this.attemptedSubmit = true;
    
    // Mark all relevant fields as touched to show validation errors
    this.validateAndMarkTouched();
    
    if (!this.agreementChecked) {
      this.showAgreementError = true;
    }
    return this.checkForm();
  }

  /**
   * Validates the form and marks all relevant fields as touched to show validation errors
   * @returns boolean indicating if the form is valid
   */
  validateAndMarkTouched(): boolean {
    // Always mark verification method as touched
    this.form.get('verificationMethod')?.markAsTouched();
    this.form.get('verificationMethod')?.updateValueAndValidity();

    const verificationMethod = this.form.get('verificationMethod')?.value;

    if (verificationMethod === 'websiteEmail') {
      // Mark website, email, and code fields as touched
      this.form.get('website')?.markAsTouched();
      this.form.get('website')?.updateValueAndValidity();
      
      this.form.get('companyEmail')?.markAsTouched();
      this.form.get('companyEmail')?.updateValueAndValidity();
      
      this.form.get('code')?.markAsTouched();
      this.form.get('code')?.updateValueAndValidity();
    } else if (verificationMethod === 'uploadDocument') {
      // Mark register document field as touched
      this.form.get('registerDocument')?.markAsTouched();
      this.form.get('registerDocument')?.updateValueAndValidity();
    }

    return this.form.valid;
  }
}
