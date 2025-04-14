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
    this.windowResize();
    this.initForm();
    this._translateion.onLanguageChange().subscribe((lang) => {
      this.lang = lang;
    });
    
    // Initialize from default values
    if (this.defaultValues?.registerDocument) {
      this.form.patchValue({
        registerDocument: this.defaultValues?.registerDocument,
      });
      this.form.get("registerDocument")?.markAsTouched();
    }
    
    // Initialize agreement checkbox if available in default values
    if (this.defaultValues?.companyAgreement) {
      this.agreementChecked = true;
    }
    
    // Update parent model initially without showing error
    this.updateParentModel(
      { 
        registerDocument: this.defaultValues?.registerDocument,
        companyAgreement: this.agreementChecked 
      },
      this.form.valid && this.agreementChecked
    );
  }

  // Open the agreement dialog to view the full terms
  openAgreementDialog(event?: MouseEvent) {
    // If event exists, it's a click on the checkbox, so prevent immediate toggling
    if (event) {
      event.preventDefault();
    }
    
    this.isLoadingAgreement = true;
    this.showAgreementDialog = true;
    
    this.commonService.getClientAgreement('company-agreement').subscribe({
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

  windowResize() {
    const screenwidth$ = fromEvent(window, "resize").pipe(
      map(() => window.innerWidth),
      startWith(window.innerWidth)
    );

    this.resizeSubscription = screenwidth$.subscribe((width) => {
      this.dialogWidth = width < 768 ? "100vw" : "70vw";
    });
  }
  onDropzoneClick() {
    this.fileInput.nativeElement.click();
  }
  getCode() {
    const email = this.form.get('companyEmail')?.value;
    const headers = new HttpHeaders({
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'Accept-Language': 'en'
    });
    if (email) {
      this.gettingCodeLoader = true;
      this.http.post('https://api.knoldg.com/api/auth/company/code/send', {
        verified_email: email,
      }, {
        headers: headers
      }).subscribe({
        next: (response) => {
          // Handle success (e.g., show a success message)
          this.messageService.add({ 
            severity: 'success', 
            summary: 'Success', 
            detail: 'Verification email resent successfully.' 
          });
          this.gettingCodeLoader = false;
          this.startGetCodeCooldown();
        },
        error: (error) => {
          // Handle error (e.g., show an error message)
          console.error('Error sending code:', error);
          const errorMsg = error?.error?.message || 'Failed to resend verification code.';
    
          this.showError('', errorMsg);
          this.gettingCodeLoader = false;
        }
      });
    }
  }
  startGetCodeCooldown(): void {
    const countdownTime = 30; // seconds

    this.isGetCodeDisabled = true;
    this.getCodeCountdown$.next(countdownTime);
    
    const resendTimerSubscription = timer(0, 1000).pipe(
      take(countdownTime)
    ).subscribe({
      next: (elapsedTime) => {
        const remainingTime = countdownTime - elapsedTime - 1;
        this.getCodeCountdown$.next(remainingTime >= 0 ? remainingTime : 0);
      },
      complete: () => {
        this.getCodeCountdown$.next(null);
        this.isGetCodeDisabled = false;
      }
    });

    if (resendTimerSubscription) {
      this.unsubscribe.push(resendTimerSubscription)
    }
  }
  // Handle file selection from the file input
  onFileSelected(event: any) {
    const file = event.target.files[0];
    if (file) {
      if (file.size > this.MAX_FILE_SIZE) {
        this.showError('File Size Exceeded', 'The uploaded document exceeds the 2MB size limit.');
        return;
      }
      this.form.patchValue({ registerDocument: file });
      this.form.get("registerDocument")?.markAsTouched();
      this.updateParentModel({ registerDocument: file }, this.checkForm());
    }
  }

  // Prevent default drag over behavior
  onDragOver(event: DragEvent) {
    event.preventDefault();
  }

  // Handle files dropped into the dropzone
  onFileDrop(event: DragEvent) {
    event.preventDefault();
    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      const file = files.item(0);
      if (file && file.size > this.MAX_FILE_SIZE) {
        this.showError('File Size Exceeded', 'The uploaded document exceeds the 2MB size limit.');
        return;
      }
      this.form.patchValue({ registerDocument: file });
      this.form.get("registerDocument")?.markAsTouched();
      this.updateParentModel({ registerDocument: file }, this.checkForm());
    }
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
    this.form = this.fb.group(
      {
        verificationMethod: ['websiteEmail', Validators.required],
        website: [''],
        companyEmail: [''],
        code: [''],
        registerDocument: [null],

      },
      { validators:this.verificationMethodValidator() }
    );

    const formChangesSubscr = this.form.valueChanges.subscribe((val) => {
      this.updateParentModel(val, this.checkForm());
    });
    this.unsubscribe.push(formChangesSubscr);
    
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
    if (file) {
      if (file.size > this.MAX_FILE_SIZE) {
        this.showError('File Size Exceeded', 'The uploaded document exceeds the 2MB size limit.');
        return;
      }
      this.form.patchValue({ registerDocument: file });
      this.updateParentModel({ registerDocument: file }, this.checkForm());
    }
  }
  checkForm() {
    // Don't change attemptedSubmit value here
    // Update the parent with the agreement status
    this.updateParentModel({ companyAgreement: this.agreementChecked }, this.form.valid && this.agreementChecked);
    
    // Only show error after attempted submit or explicit decline
    if (!this.agreementChecked && this.attemptedSubmit) {
      this.showAgreementError = true;
    }
    
    return this.form.valid && this.agreementChecked;
  }

  // Call this before submitting the form - used by the parent component
  prepareForSubmit() {
    this.attemptedSubmit = true;
    if (!this.agreementChecked) {
      this.showAgreementError = true;
    }
    return this.checkForm();
  }
}
