// src/app/pages/wizards/step3/step3.component.ts

import {
  Component,
  ElementRef,
  Injector,
  Input,
  OnDestroy,
  OnInit,
  ViewChild,
} from "@angular/core";
import { FormArray, FormBuilder, FormGroup, Validators } from "@angular/forms";
import {  Observable, of } from "rxjs";
import { ICreateAccount } from "../../create-account.helper";
import {
  Document,
  DocumentsService,
} from "src/app/_fake/services/douments-types/documents-types.service";
import { BaseComponent } from "src/app/modules/base.component";
import { CommonService } from "src/app/_fake/services/common/common.service";

@Component({
  selector: "app-step3",
  templateUrl: "./step3.component.html",
  styleUrls: ["./step3.component.scss"]
})
export class Step3Component extends BaseComponent implements OnInit, OnDestroy {
  @Input("updateParentModel") updateParentModel: (
    part: Partial<ICreateAccount>,
    isFormValid: boolean
  ) => void;
  form: FormGroup;

  @Input() defaultValues: Partial<ICreateAccount>;

  @ViewChild("fileInput") fileInput: ElementRef<HTMLInputElement>;

  documentTypes: Document[] = [];
  isLoadingDocumentTypes: boolean = false;
  documentTypesError: string = "";
  isLoading$: Observable<boolean> = of(false);
  
  // Agreement properties
  agreementChecked: boolean = false;
  showAgreementError: boolean = false;
  agreementContent: any = null;
  isLoadingAgreement: boolean = false;
  showAgreementDialog: boolean = false;
  attemptedSubmit: boolean = false; // Track if user has attempted to submit
  userScrolledToBottom: boolean = false; // Gate the Submit button until the terms are read

  @ViewChild("agreementContentEl") agreementContentRef?: ElementRef<HTMLDivElement>;
  
  constructor(
    private fb: FormBuilder,
    private documentsService: DocumentsService,
    private commonService: CommonService,
    injector: Injector
  ) {
    super(injector);
    this.isLoading$ = this.documentsService.isLoading$;
  }

  ngOnInit() {
    this.initForm();
    this.loadDocumentTypes();
    
    // Initialize agreement status from defaultValues if available
    if (this.defaultValues?.insighterAgreement) {
      this.agreementChecked = true;
    }
    
    // Update the parent model initially but don't show error
    this.updateParentModel(
      { insighterAgreement: this.agreementChecked }, 
      this.form.valid && this.agreementChecked
    );
  }

  // This lifecycle hook is called when the component becomes visible
  ngAfterViewInit() {
    // Use setTimeout to avoid ExpressionChangedAfterItHasBeenCheckedError
    setTimeout(() => {
      // Re-evaluate form validity when navigating back to this step
      this.updateParentModel(
        { insighterAgreement: this.agreementChecked },
        this.checkForm()
      );
    });
  }

  initForm() {
    this.form = this.fb.group({
      certifications: this.fb.array([]),
    });

    if (this.defaultValues?.certifications) {
      this.defaultValues.certifications.forEach((cert) => {
        this.addCertification(cert);
      });
    }

    const formChangesSubscr = this.form.valueChanges.subscribe((val) => {
      this.updateParentModel(val, this.checkForm());
    });
    this.unsubscribe.push(formChangesSubscr);
  }

  loadDocumentTypes() {
    this.isLoadingDocumentTypes = true;
    const docTypesSub = this.documentsService
      .getDocumentsTypes(this.defaultValues?.accountType)
      .subscribe({
      next: (types) => {
        this.documentTypes = types;
        this.isLoadingDocumentTypes = false;
      },
      error: (error) => {
        this.documentTypesError = "Failed to load document types.";
        this.isLoadingDocumentTypes = false;
        console.error(error);
      },
    });
    this.unsubscribe.push(docTypesSub);
  }

  get certifications(): FormArray<FormGroup> {
    return this.form.get("certifications") as FormArray;
  }
  get certificationControls(): FormGroup[] {
    return this.certifications.controls as FormGroup[];
  }
  addCertification(cert?: { type?: string; file?: File }) {
    const certForm = this.fb.group({
      type: [cert?.type || "", cert?.file ? [Validators.required] : []],
      file: [cert?.file || null],
    });
    this.certifications.push(certForm);
    this.updateParentModel(this.form.value, this.checkForm());
  }
  removeCertification(index: number) {
    this.certifications.removeAt(index);
    this.updateParentModel(this.form.value, this.checkForm());
    // Optionally reset the file input if needed
    // this.fileInput.nativeElement.value = '';
  }
  onDropzoneClick() {
    this.fileInput.nativeElement.click();
  }
  onFileSelected(event: any) {
    const files: FileList = event.target.files;
    this.handleFiles(files);
    // Reset the file input to allow re-uploading the same file if needed
    this.fileInput.nativeElement.value = "";
  }
  onDragOver(event: DragEvent) {
    event.preventDefault();
  }
  onFileDrop(event: DragEvent) {
    event.preventDefault();
    if (event.dataTransfer) {
      const files = event.dataTransfer.files;
      this.handleFiles(files);
    }
  }
  handleFiles(files: FileList) {
    const MAX_SIZE_MB = 5;
    const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;

    for (let i = 0; i < files.length; i++) {
      const file = files.item(i);
      if (file) {
        if (file.size > MAX_SIZE_BYTES) {
          this.showError('', `File "${file.name}" exceeds the 5MB size limit.`);
          continue; // Skip adding this file
        }
        this.addCertification({ file });
      }
    }
  }
  getFileIcon(file: File) {
    if (file) {
      const extension = file.name.split(".").pop()?.toLowerCase();
      const iconPath = `./assets/media/svg/files/${extension}.svg`;
      // Optionally, you can add logic to handle missing icons
      return iconPath;
    }
    return "./assets/media/svg/files/default.svg";
  }
  
  // Open the agreement dialog to view the full terms
  openAgreementDialog(event?: MouseEvent) {
    // If event exists, it's a click on the checkbox, so prevent immediate toggling
    if (event) {
      event.preventDefault();
    }
    
    this.isLoadingAgreement = true;
    this.showAgreementDialog = true;
    this.userScrolledToBottom = false; // Require reading each time the dialog opens

    this.commonService.getGuidelineByTypeCurrent('insighter_agreement').subscribe({
      next: (response) => {
        this.agreementContent = response.data;
        this.isLoadingAgreement = false;
        // Once the content has rendered, allow submission immediately if it's
        // short enough that there's nothing to scroll.
        this.checkAgreementScrollable();
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
  
  // Track scrolling inside the agreement content. Once the user reaches the
  // bottom, the Submit button is unlocked.
  onAgreementScroll(event: Event): void {
    const el = event.target as HTMLElement;
    const threshold = 24; // px tolerance so we don't require pixel-perfect scrolling
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - threshold) {
      this.userScrolledToBottom = true;
    }
  }

  // If the agreement content fits without scrolling there is nothing to read
  // through, so unlock the Submit button immediately.
  private checkAgreementScrollable(): void {
    setTimeout(() => {
      const el = this.agreementContentRef?.nativeElement;
      if (!el) {
        return;
      }
      if (el.scrollHeight <= el.clientHeight + 5) {
        this.userScrolledToBottom = true;
      }
    }, 300);
  }

  // Accept the agreement terms
  acceptAgreement() {
    this.agreementChecked = true;
    this.showAgreementDialog = false;
    this.updateParentModel({ insighterAgreement: true }, this.form.valid);
  }
  
  // Decline the agreement terms
  declineAgreement() {
    this.agreementChecked = false;
    this.showAgreementDialog = false;
    this.showAgreementError = true; // Show error on explicit decline
    this.updateParentModel({ insighterAgreement: false }, false);
  }
  
  // Print terms document in a new window
  printTerms(): void {
    // Create a new window for printing
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      // Prepare content for printing
      const termsTitle = this.agreementContent?.name || 'Insighter Terms of Service';
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
      const termsTitle = this.agreementContent.name || 'Insighter-Terms-of-Service';
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
  
  checkForm() {
    // Mark all form controls as touched to trigger validation display
    this.form.markAllAsTouched();
    
    // Only require agreement for personal account type
    if (this.defaultValues?.accountType === 'personal') {
      // Update the parent with the agreement status
      this.updateParentModel({ insighterAgreement: this.agreementChecked }, this.form.valid && this.agreementChecked);
      
      // Only show error after attempted submit or explicit decline
      if (!this.agreementChecked && this.attemptedSubmit) {
        this.showAgreementError = true;
      }
      
      return this.form.valid && this.agreementChecked;
    } else {
      // For corporate accounts, we don't need agreement at this step
      this.updateParentModel({}, this.form.valid);
      return this.form.valid;
    }
  }
  
  // Call this before submitting the form - used by the parent component
  prepareForSubmit() {
    this.attemptedSubmit = true;
    
    // Only check agreement for personal account type
    if (this.defaultValues?.accountType === 'personal') {
      if (!this.agreementChecked) {
        this.showAgreementError = true;
      }
    }
    
    return this.checkForm();
  }
  
  ngOnDestroy() {
    this.unsubscribe.forEach((sb) => sb.unsubscribe());
  }
}
