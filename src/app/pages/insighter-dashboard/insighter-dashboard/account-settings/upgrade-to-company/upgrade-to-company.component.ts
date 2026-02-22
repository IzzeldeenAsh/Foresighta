import { InsighterAsCompany } from "./../../../../../_fake/services/register-insighter-as-company/register-insighter-as-company.service";
// upgrade-to-corporate.component.ts

import {
  Component,
  OnInit,
  OnDestroy,
  ViewChild,
  ElementRef,
  Injector,
  ChangeDetectorRef,
  Inject,
} from "@angular/core";
import { FormBuilder, FormGroup, Validators, FormArray } from "@angular/forms";
import {
  Subscription,
  BehaviorSubject,
  timer,
  Observable,
  take,
  map,
  fromEvent,
  startWith,
  of,
  forkJoin,
} from "rxjs";
import { TranslationService } from "src/app/modules/i18n";
import { HttpClient } from "@angular/common/http";
import { Message, MessageService } from "primeng/api";
import { ScrollAnimsService } from "src/app/_fake/services/scroll-anims/scroll-anims.service";
import Swal from "sweetalert2";
import { Router } from "@angular/router";
import { BaseComponent } from "src/app/modules/base.component";
import { TreeNode } from 'src/app/reusable-components/shared-tree-selector/TreeNode';
import { ConsultingFieldTreeService } from "src/app/_fake/services/consulting-fields-tree/consulting-fields-tree.service";
import { IsicCodesService } from "src/app/_fake/services/isic-code/isic-codes.service";
import { IndustryService } from "src/app/_fake/services/industries/industry.service";
import { Document, DocumentsService } from "src/app/_fake/services/douments-types/documents-types.service";
import { phoneNumbers } from "src/app/pages/wizards/phone-keys";
import { TranslateService } from "@ngx-translate/core";
import { CountriesService, Country } from "src/app/_fake/services/countries/countries.service";
import { ProfileService } from "src/app/_fake/services/get-profile/get-profile.service";
import { GuidelinesService } from "src/app/_fake/services/guidelines/guidelines.service";

@Component({
  selector: "app-upgrade-to-company",
  templateUrl: "./upgrade-to-company.component.html",
  styleUrl: "./upgrade-to-company.component.scss",
})
export class UpgradeToCompanyComponent
  extends BaseComponent
  implements OnInit, OnDestroy
{
  form: FormGroup;
  logoPreview: string | ArrayBuffer | null = null;
  gettingCodeLoader = false;
  isGetCodeDisabled = false;
  getCodeCountdown$ = new BehaviorSubject<number | null>(null);
  updateProfile$: Observable<boolean>;
  dialogWidth: string = "50vw";
  @ViewChild("logoInput") logoInput: ElementRef<HTMLInputElement>;
  @ViewChild("fileInput") fileInput: ElementRef<HTMLInputElement>;
  @ViewChild("certFileInput") certFileInput: ElementRef<HTMLInputElement>;
  defaultImage =
    "https://au.eragroup.com/wp-content/uploads/2018/02/logo-placeholder.png";

  // Agreement properties
  agreementChecked: boolean = false;
  showAgreementError: boolean = false;
  agreementContent: any = null;
  isLoadingAgreement: boolean = false;
  showAgreementDialog: boolean = false;
  attemptedSubmit: boolean = false;

  // Consulting fields and industries
  listOfConsultingFields: TreeNode[] = [];
  nodes: TreeNode[] = [];
  allConsultingFieldSelected: any[] = [];
  allIndustriesSelected: any[] = [];
  isLoadingFields: boolean = false;
  phoneNumbers = phoneNumbers;
  isLoading$: Observable<boolean> = of(false);
  lang: string = 'en';
  countries: Country[] = [];
  
  // Document types for certifications
  documentTypes: Document[] = [];
  isLoadingDocumentTypes: boolean = false;
  documentTypesError: string = "";
  fizeSizeMessages: Message[] = [];
  
  // API error handling
  apiErrorMessages: string[] = [];
  showApiErrors: boolean = false;

  currentUser: any;
  constructor(
    private fb: FormBuilder,
    private http: HttpClient,
    @Inject(InsighterAsCompany) private insighterAsCompany: InsighterAsCompany,
    private router: Router,
    private _KnoldgFieldsService: ConsultingFieldTreeService,
    private _isicService: IndustryService,
    private documentsService: DocumentsService,
    private translationService: TranslationService,
    private _countriesService: CountriesService,
    private profileService: ProfileService,
    private guidelinesService: GuidelinesService,
    private cdr: ChangeDetectorRef,
    injector: Injector
  ) {
    super(injector);
    this.updateProfile$ = this.insighterAsCompany.isLoading$;
    this.lang = this.translationService.getSelectedLanguage();
  }

  ngOnInit(): void {
    // Initialize form first
    this.initForm();
    
    // Setup window resize handling
    this.windowResize();
    
    // Load all required data
    this.initApiCalls();
    this.loadDocumentTypes();

    // Setup subscriptions
    this.setupSubscriptions();

    // Initialize validators
    this.setVerificationValidators(this.form.get("verificationMethod")?.value);
  }

  private setupSubscriptions(): void {
    // Language change subscription
    const langSub = this.translationService.onLanguageChange().subscribe((lang) => {
      this.lang = lang;
      this.initApiCalls(); // Reload data when language changes
    });
    this.unsubscribe.push(langSub);

    // Verification method change subscription
    const verificationMethodSub = this.form
      .get("verificationMethod")
      ?.valueChanges.subscribe((method) => {
        this.setVerificationValidators(method);
      });
    if (verificationMethodSub) this.unsubscribe.push(verificationMethodSub);

    // Domain matching validation subscriptions
    this.setupDomainValidationSubscriptions();
  }

  private setupDomainValidationSubscriptions(): void {
    const websiteChangesSubscr = this.form.get('website')?.valueChanges.subscribe(() => {
      this.validateDomainMatching();
    });
    
    const emailChangesSubscr = this.form.get('companyEmail')?.valueChanges.subscribe(() => {
      this.validateDomainMatching();
    });
    
    if (websiteChangesSubscr) this.unsubscribe.push(websiteChangesSubscr);
    if (emailChangesSubscr) this.unsubscribe.push(emailChangesSubscr);
  }

  initApiCalls() {
    this.isLoadingFields = true;
    this.isLoading$ = of(true);

    const apiCalls = forkJoin({
      consultingFields: this._KnoldgFieldsService.getConsultingCodesTree(this.lang || 'en'),
      isicCodes: this._isicService.getIsicCodesTree(this.lang || 'en'),
      countries: this._countriesService.getCountries(),
      profile: this.profileService.getProfile()
    }).subscribe({
      next: (results) => {
        // Process consulting fields and industries
        this.listOfConsultingFields = results.consultingFields;
        this.nodes = results.isicCodes;
        
        // Process countries with error handling
        this.countries = results.countries.map(country => ({
          ...country,
          showFlag: true
        }));
        
        // Set loading states
        this.isLoadingFields = false;
        this.isLoading$ = of(false);
        
        // Set default country from profile in a controlled manner
        this.setDefaultCountryFromProfile(results.profile);
        
        // Force change detection after all data is set
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error loading fields:', err);
        this.handleApiError('Failed to load consulting fields or industries.');
        this.isLoadingFields = false;
        this.isLoading$ = of(false);
      }
    });
    this.unsubscribe.push(apiCalls);
  }

  private handleApiError(message: string): void {
    this.messageService.add({ 
      severity: 'error', 
      summary: 'Error', 
      detail: message
    });
  }

  private loadDocumentTypes() {
    this.isLoadingDocumentTypes = true;
    
    // This screen is for upgrading to company (corporate) account.
    const docTypesSub = this.documentsService.getDocumentsTypes("corporate").subscribe({
      next: (types) => {
        this.documentTypes = types;
        this.isLoadingDocumentTypes = false;
      },
      error: (error) => {
        this.documentTypesError = "Failed to load document types.";
        this.isLoadingDocumentTypes = false;
        this.handleApiError("Failed to load document types.");
        console.error(error);
      },
    });
    
    this.unsubscribe.push(docTypesSub);
  }

  ngOnDestroy(): void {
    // Unsubscribe from all subscriptions
    this.unsubscribe.forEach((sub) => {
      if (sub && !sub.closed) {
        sub.unsubscribe();
      }
    });
  }

  private windowResize() {
    const screenwidth$ = fromEvent(window, "resize").pipe(
      map(() => window.innerWidth),
      startWith(window.innerWidth)
    );

    const resizeSubscription = screenwidth$.subscribe((width) => {
      this.dialogWidth = width < 768 ? "100vw" : "70vw";
    });
    
    this.unsubscribe.push(resizeSubscription);
  }

  // Open the agreement dialog to view the full terms
  openAgreementDialog(event?: any) {
    // If event exists but not from p-checkbox, it's a click on the checkbox, so prevent immediate toggling
    if (event && event.originalEvent) {
      // This is from p-checkbox onChange, skip the dialog if it's checked/unchecked directly
      // Only show dialog when unchecking
      if (!event.checked) {
        this.form.get('agreement')?.setValue(false);
        this.showAgreementError = this.attemptedSubmit;
        return;
      }
    }
    
    this.isLoadingAgreement = true;
    this.showAgreementDialog = true;
    
    this.guidelinesService.getCurrentGuidelineByType('company_agreement').subscribe({
      next: (data) => {
        this.agreementContent = data;
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
    this.form.get('agreement')?.setValue(true);
    this.form.get('agreement')?.markAsTouched();
    this.showAgreementDialog = false;
    this.showAgreementError = false;
  }

  // Decline the agreement terms
  declineAgreement() {
    this.form.get('agreement')?.setValue(false);
    this.form.get('agreement')?.markAsTouched();
    this.showAgreementDialog = false;
    this.showAgreementError = true;
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

  // Consulting fields selection handler
  onConsultingNodesSelected(event: any) {
    this.allConsultingFieldSelected = event && event.length > 0 ? event : [];
    this.form.get('consultingFields')?.setValue(this.allConsultingFieldSelected);
    this.form.get('consultingFields')?.markAsTouched();
    this.form.get('consultingFields')?.updateValueAndValidity();
  }

  // Industry selection handler
  onIndustrySelected(event: any) {
    this.allIndustriesSelected = event && event.length > 0 ? event : [];
    this.form.get('isicCodes')?.setValue(this.allIndustriesSelected);
    this.form.get('isicCodes')?.markAsTouched();
    this.form.get('isicCodes')?.updateValueAndValidity();
  }

  initForm() {
    this.form = this.fb.group({
      legalName: ["", Validators.required],
      aboutCompany: ["", Validators.required],
      logo: [null, Validators.required],
      address: ["", Validators.required],
      company_phone: ["", Validators.required],
      phoneCountryCode: ["", Validators.required],
      country: [null, Validators.required],
      verificationMethod: ["websiteEmail", Validators.required],
      website: [""],
      companyEmail: ["", Validators.email],
      code: [""],
      registerDocument: [null],
      agreement: [false, Validators.requiredTrue],
      // New fields
      consultingFields: [[], [Validators.required]],
      isicCodes: [[], [Validators.required]],
      certifications: this.fb.array([])
    });
  }

  // Get certifications form array
  get certifications(): FormArray {
    return this.form.get("certifications") as FormArray;
  }

  // Get certification controls for template iteration
  get certificationControls(): FormGroup[] {
    return this.certifications.controls as FormGroup[];
  }

  // Add certification
  addCertification(cert?: { type?: string; file?: File }) {
    const certForm = this.fb.group({
      type: [cert?.type || "", [Validators.required]],
      file: [cert?.file || null, [Validators.required]],
    });
    this.certifications.push(certForm);
  }

  // Remove certification
  removeCertification(index: number) {
    this.certifications.removeAt(index);
  }

  // Handle certification file selection
  onCertFileSelected(event: any) {
    const files: FileList = event.target.files;
    this.handleCertFiles(files);
    
    // Reset the file input to allow re-uploading the same file if needed
    if (this.certFileInput) {
      this.certFileInput.nativeElement.value = "";
    }
  }

  // Open file input for certification
  onCertDropzoneClick() {
    if (this.certFileInput) {
      this.certFileInput.nativeElement.click();
    }
  }

  // Process certification files
  handleCertFiles(files: FileList) {
    const MAX_SIZE_MB = 2;
    const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;

    for (let i = 0; i < files.length; i++) {
      const file = files.item(i);
      if (file) {
        if (file.size > MAX_SIZE_BYTES) {
          this.messageService.add({
            severity: "error",
            summary: "File Too Large",
            detail: `File "${file.name}" exceeds the 2MB size limit.`,
          });
          continue; // Skip adding this file
        }
        this.addCertification({ file });
      }
    }
  }

  // Get file icon based on extension
  getFileIcon(file: File) {
    if (file) {
      const extension = file.name.split(".").pop()?.toLowerCase();
      const iconPath = `./assets/media/svg/files/${extension}.svg`;
      return iconPath;
    }
    return "./assets/media/svg/files/default.svg";
  }

  // Optional: Additional handling to sanitize phone input
  onPhoneNumberInput(event: Event) {
    const input = event.target as HTMLInputElement;
    // Remove any non-digit characters
    let sanitizedValue = input.value.replace(/\D/g, '');
    // Limit to 10 digits
    if (sanitizedValue.length > 10) {
      sanitizedValue = sanitizedValue.slice(0, 10);
    }
    // Update the input value without triggering another event
    this.form.controls['company_phone'].setValue(sanitizedValue, { emitEvent: false });
  }

  setVerificationValidators(method: string) {
    if (method === "websiteEmail") {
      this.form.get("website")?.setValidators([Validators.required, this.websiteValidator()]);
      this.form
        .get("companyEmail")
        ?.setValidators([Validators.required, Validators.email]);
      this.form.get("code")?.setValidators([Validators.required]);

      this.form.get("registerDocument")?.clearValidators();
      this.form.get("registerDocument")?.setValue(null);
    } else if (method === "uploadDocument") {
      this.form.get("registerDocument")?.setValidators([Validators.required]);

      this.form.get("website")?.clearValidators();
      this.form.get("companyEmail")?.clearValidators();
      this.form.get("code")?.clearValidators();

      this.form.get("website")?.setValue("");
      this.form.get("companyEmail")?.setValue("");
      this.form.get("code")?.setValue("");
    }

    this.form.get("website")?.updateValueAndValidity();
    this.form.get("companyEmail")?.updateValueAndValidity();
    this.form.get("code")?.updateValueAndValidity();
    this.form.get("registerDocument")?.updateValueAndValidity();
  }

  onLogoSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];
      const validTypes = ["image/png", "image/jpeg", "image/jpg"];
      if (!validTypes.includes(file.type)) {
        this.messageService.add({
          severity: "error",
          summary: "Invalid File Type",
          detail: "Please select a PNG or JPEG image.",
        });
        this.form.get("logo")?.setErrors({ invalidType: true });
        return;
      }
      const maxSize = 2 * 1024 * 1024; // 2MB
      if (file.size > maxSize) {
        this.messageService.add({
          severity: "error",
          summary: "File Too Large",
          detail: "Logo must be smaller than 2MB.",
        });
        this.form.get("logo")?.setErrors({ maxSizeExceeded: true });
        return;
      }

      // Check image dimensions for high quality
      const img = new Image();
      const reader = new FileReader();
      
      reader.onload = (e) => {
        if (e.target) {
          img.src = e.target.result as string;
          img.onload = () => {
            const minWidth = 500; // Minimum width in pixels
            const minHeight = 300; // Minimum height in pixels
            
            if (img.width < minWidth || img.height < minHeight) {
              this.messageService.add({
                severity: "error",
                summary: "Low Resolution Image",
                detail: `Logo must be at least ${minWidth}x${minHeight} pixels for high quality.`,
              });
              this.form.get("logo")?.setErrors({ lowResolution: true });
              this.logoPreview = null;
              if (this.logoInput) {
                this.logoInput.nativeElement.value = "";
              }
              return;
            }
            
            // Image passed all quality checks
            this.form.patchValue({ logo: file });
            this.form.get("logo")?.updateValueAndValidity();
            this.logoPreview = img.src;
          };
        }
      };
      
      reader.readAsDataURL(file);
    }
  }

  removeLogo() {
    this.form.patchValue({ logo: null });
    this.logoPreview = null;
    if (this.logoInput) {
      this.logoInput.nativeElement.value = "";
    }
  }

  getLogoBackgroundImage() {
    return `url(${this.logoPreview || this.defaultImage})`;
  }

  getCode() {
    const email = this.form.get("companyEmail")?.value;
    if (email) {
      this.gettingCodeLoader = true;
      const getCodeSub = this.http
        .post("https://api.insightabusiness.com/api/auth/company/code/send", {
          verified_email: email,
        }, {
          headers: {
            'Accept-Language': 'en'
          }
        })
        .subscribe({
          next: (response) => {
            this.messageService.add({
              severity: "success", 
              summary: "Success",
              detail: "Verification email sent successfully.",
            });
            this.gettingCodeLoader = false;
            this.startGetCodeCooldown();
          },
          error: (error) => {
            console.error("Error sending code:", error);
            const errorMsg =
              error?.error?.message || "Failed to send verification code.";
            this.messageService.add({
              severity: "error",
              summary: "Error", 
              detail: errorMsg,
            });
            this.gettingCodeLoader = false;
          },
        });
      this.unsubscribe.push(getCodeSub);
    }
  }

  startGetCodeCooldown(): void {
    const countdownTime = 30; // seconds

    this.isGetCodeDisabled = true;
    this.getCodeCountdown$.next(countdownTime);

    const countdown$ = timer(0, 1000).pipe(
      take(countdownTime + 1), // Ensure the timer completes after countdownTime seconds
      map((value) => countdownTime - value)
    );

    const resendTimerSubscription = countdown$.subscribe({
      next: (remainingTime) => {
        this.getCodeCountdown$.next(remainingTime);
      },
      complete: () => {
        this.getCodeCountdown$.next(null);
        this.isGetCodeDisabled = false;
      },
    });

    this.unsubscribe.push(resendTimerSubscription);
  }

  onRegisterDocumentSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];
      this.form.patchValue({ registerDocument: file });
      this.form.get("registerDocument")?.updateValueAndValidity();
    }
  }

  removeRegisterDocument() {
    this.form.patchValue({ registerDocument: null });
    if (this.fileInput) {
      this.fileInput.nativeElement.value = "";
    }
  }

  onDropzoneClick() {
    this.fileInput.nativeElement.click();
  }

  onFileSelected(event: any) {
    const file = event.target.files[0];
    if (file) {
      this.form.patchValue({ registerDocument: file });
      this.form.get("registerDocument")?.updateValueAndValidity();
    }
  }

  onDragOver(event: DragEvent) {
    event.preventDefault();
  }

  onFileDrop(event: DragEvent) {
    event.preventDefault();
    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      const file = files.item(0);
      this.form.patchValue({ registerDocument: file });
      this.form.get("registerDocument")?.updateValueAndValidity();
    }
  }

  onSubmit() {
    this.attemptedSubmit = true;
    
    // Mark all form controls as touched to display validation errors
    this.markFormGroupTouched(this.form);
    
    if (this.form.invalid) {
      // Scroll to the top to show validation errors
      window.scrollTo({top: 0, behavior: 'smooth'});
      return;
    }

    const formData = new FormData();
    formData.append("legal_name", this.form.get("legalName")?.value);
    formData.append("about_us", this.form.get("aboutCompany")?.value);
    formData.append("logo", this.form.get("logo")?.value);
    formData.append("address", this.form.get("address")?.value);
    formData.append("country", this.form.get("country")?.value);
    
    // Add phone and phone code separately
    if (this.form.get("company_phone")?.value) {
      const phoneNumber = this.form.get("company_phone")?.value;
      formData.append("company_phone", phoneNumber);
    }

    if (this.form.get("phoneCountryCode")?.value) {
      const phoneCountryCode = this.form.get("phoneCountryCode")?.value;
      const phoneCode = phoneCountryCode.code || phoneCountryCode;
      if (phoneCode && typeof phoneCode === 'string') {
        const cleanPhoneCode = phoneCode.startsWith('+') ? phoneCode.substring(1) : phoneCode;
        formData.append("phone_code", cleanPhoneCode);
      }
    }
    
    formData.append("company_agreement", "true"); // Add company agreement

    const verificationMethod = this.form.get("verificationMethod")?.value;

    if (verificationMethod === "websiteEmail") {
      formData.append("website", this.form.get("website")?.value);
      formData.append("verified_email", this.form.get("companyEmail")?.value);
      formData.append("code", this.form.get("code")?.value);
    } else if (verificationMethod === "uploadDocument") {
      formData.append(
        "register_document",
        this.form.get("registerDocument")?.value
      );
    }

    // Add consulting fields - standard fields and custom 'other' fields
    const consultingFieldList = this.form.get('consultingFields')?.value.filter((node: any) => 
      typeof node.key === 'number'
    );
    
    const otherConsultingFields = this.form.get('consultingFields')?.value.filter((node: any) => 
      typeof node.key === 'string' && 
      node.key !== 'selectAll' && 
      node.data && 
      node.data.customInput !== undefined && 
      node.data.customInput !== null
    );
    
    if(consultingFieldList && consultingFieldList.length > 0){
      consultingFieldList.forEach((field: any) => {
        formData.append("consulting_field[]", field.key.toString());
      });
    }
    
    if(otherConsultingFields && otherConsultingFields.length > 0){
      otherConsultingFields.forEach((field: any, index: number) => {
        formData.append(`suggest_consulting_fields[${index}][parent_id]`, 
          field.parent && field.parent.key ? (field.parent.key === "selectAll" ? "0" : field.parent.key) : "0");
        formData.append(`suggest_consulting_fields[${index}][name][en]`, field.data.customInput);
        formData.append(`suggest_consulting_fields[${index}][name][ar]`, field.data.customInput);
      });
    }
    
    // Add industries - standard fields and custom 'other' fields
    const industriesList = this.form.get('isicCodes')?.value.filter((node: any) => 
      typeof node.key === 'number'
    );
    
    const otherIndustriesFields = this.form.get('isicCodes')?.value.filter((node: any) => 
      typeof node.key === 'string' && 
      node.key !== 'selectAll' && 
      node.data && 
      node.data.customInput !== undefined && 
      node.data.customInput !== null
    );
    
    if(industriesList && industriesList.length > 0){
      industriesList.forEach((code: any) => {
        formData.append("industries[]", code.key.toString());
      });
    }
    
    if(otherIndustriesFields && otherIndustriesFields.length > 0){
      otherIndustriesFields.forEach((field: any, index: number) => {
        formData.append(`suggest_industries[${index}][parent_id]`, 
          field.parent && field.parent.key ? (field.parent.key === "selectAll" ? "0" : field.parent.key) : "0");
        formData.append(`suggest_industries[${index}][name][en]`, field.data.customInput);
        formData.append(`suggest_industries[${index}][name][ar]`, field.data.customInput);
      });
    }
    
    // Add certifications
    if (this.certifications.controls.length > 0) {
      this.certifications.controls.forEach((control: any, index: number) => {
        if (control.valid) {
          formData.append(`certification[${index}][type]`, control.value.type);
          formData.append(`certification[${index}][file]`, control.value.file);
        }
      });
    }

    this.apiPost(formData);
  }

  apiPost(formData: FormData) {
    const postProfileSub = this.insighterAsCompany
      .postInsighterToCompany(formData)
      .subscribe({
        next: (res) => {
          Swal.fire({
            icon: "success",
            title:
              this.lang === "ar"
                ? "تم تحديث حسابك بنجاح"
                : "Your account has been successfully updated",
            text:
              this.lang === "ar"
                ? "سنقوم بالتحقق من حسابك بمجرد تأكيد المعلومات."
                : "We will verify your account once the information is confirmed.",
            confirmButtonText: this.lang === "ar" ? "حسناً" : "OK",
            allowOutsideClick: false,
            allowEscapeKey: false
          }).then(() => {
            // Force reload to ensure fresh page state
            window.location.href = window.location.href;
          });
        },
        error: (error) => {
          this.handleServerErrors(error);
        },
      });
    this.unsubscribe.push(postProfileSub);
  }

  private handleServerErrors(error: any) {
    // Clear previous API errors
    this.apiErrorMessages = [];

    if (error.error) {
      // Check for message property
      if (error.error.message) {
        if (error.error.type === "warning") {
          this.showWarn('Error',error.error.message);
        } else {
          this.showError('Error',error.error.message);
        }
      }

      // Check for errors object
      if (error.error.errors) {
        const serverErrors = error.error.errors;
        for (const key in serverErrors) {
          if (serverErrors.hasOwnProperty(key)) {
            const messages = serverErrors[key];

            // Handle 'common' errors or general errors not tied to a specific field
            if (key === 'common') {
              if (error.error.type === "warning") {
                this.showWarn('Error',messages.join(", "));
              } else {
                this.showError('Error',messages.join(", "));
              }
              this.showApiErrors = true;
            } else {
              // Form field specific errors
              const formField = this.form.get(key);
              if (formField) {
                formField.setErrors({ serverError: messages.join(", ") });
              } else {
                // If field not found, show as general error
                this.apiErrorMessages.push(`${key}: ${messages.join(", ")}`);
                this.showApiErrors = true;
              }
            }
          }
        }
      }
    } else {
      this.messageService.add({
        severity: "error",
        summary: "Error",
        detail: "An unexpected error occurred.",
      });
    }

    // Scroll to the top to show validation errors
    if (this.showApiErrors) {
      window.scrollTo({top: 0, behavior: 'smooth'});
    }
  }
  
  /**
   * Recursively marks all controls in a form group as touched
   * @param formGroup - The form group to process
   */
  private markFormGroupTouched(formGroup: FormGroup | FormArray) {
    if (formGroup instanceof FormGroup) {
      Object.keys(formGroup.controls).forEach(key => {
        const control = formGroup.get(key);
        if (control) {
          if (control instanceof FormGroup || control instanceof FormArray) {
            this.markFormGroupTouched(control);
          } else {
            control.markAsTouched();
          }
        }
      });
    } else if (formGroup instanceof FormArray) {
      formGroup.controls.forEach(control => {
        if (control instanceof FormGroup || control instanceof FormArray) {
          this.markFormGroupTouched(control);
        } else {
          control.markAsTouched();
        }
      });
    }
  }

  private setDefaultCountryFromProfile(profile: any): void {
    if (!profile || !this.countries?.length) {
      return;
    }

    // Extract country ID from profile with better error handling
    const countryId = profile?.data?.country_id || profile?.country_id;
    
    if (!countryId) {
      return;
    }

    // Find the country in the list
    const userCountry = this.countries.find(country => country.id === countryId);
    
    if (userCountry) {
      // Set the country value directly without multiple timeouts
      const countryControl = this.form.get('country');
      if (countryControl) {
        countryControl.setValue(userCountry.id);
        countryControl.markAsTouched();
        
        // Trigger change detection only once
        this.cdr.markForCheck();
      }
    }
  }

  onFlagError(country: any) {
    country.showFlag = false;
  }

  // Website URL validator
  websiteValidator() {
    return (control: any) => {
      if (!control.value) {
        return null; // Don't validate empty values (required validator handles that)
      }
      
      const website = control.value.trim();
      
      // Basic URL format validation
      const urlPattern = /^(https?:\/\/)?(www\.)?[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.[a-zA-Z]{2,}(\.[a-zA-Z]{2,})?(\S*)?$/;
      
      if (!urlPattern.test(website)) {
        return { invalidWebsite: true };
      }
      
      return null;
    };
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
}
