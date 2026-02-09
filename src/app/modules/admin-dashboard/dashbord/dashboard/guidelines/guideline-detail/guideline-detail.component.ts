import { Component, OnInit, Injector, AfterViewInit, ElementRef, ViewChild, ChangeDetectorRef } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Observable, forkJoin } from 'rxjs';
import { GuidelineType, GuidelinesService, GuidelineDetail } from 'src/app/_fake/services/guidelines/guidelines.service';
import { BaseComponent } from 'src/app/modules/base.component';
import { HttpClient } from '@angular/common/http';
import { environment } from 'src/environments/environment';

@Component({
  selector: 'app-guideline-detail',
  templateUrl: './guideline-detail.component.html',
  styleUrls: ['./guideline-detail.component.scss']
})
export class GuidelineDetailComponent extends BaseComponent implements OnInit, AfterViewInit {
  currentValue: string | null = null;
  guidelineType: GuidelineType | null = null;
  isLoading$: Observable<boolean>;

  // Guideline data
  currentGuideline: GuidelineDetail | null = null;
  lastGuideline: GuidelineDetail | null = null;
  shouldShowLastGuideline = false;

  // Modal and form properties
  showAddVersionModal = false;
  addVersionForm: FormGroup;
  isCreating = false;

  // Collapsible content controls
  @ViewChild('currentContent') currentContentRef?: ElementRef<HTMLElement>;
  @ViewChild('lastContent') lastContentRef?: ElementRef<HTMLElement>;
  isCurrentExpanded = false;
  isLastExpanded = false;
  hasCurrentOverflow = false;
  hasLastOverflow = false;
  private readonly COLLAPSED_MAX_HEIGHT_PX = 420;

  // Jodit editor configurations
  joditConfigEn = {
    readonly: false,
    height: 300,
    language: 'en',
    toolbarSticky: false,
    showCharsCounter: false,
    showWordsCounter: false,
    showXPathInStatusbar: false,
    askBeforePasteHTML: false,
    askBeforePasteFromWord: false,
    defaultActionOnPaste: 'insert_clear_html',
    buttons: [
      'bold', 'italic', 'underline', '|',
      'ul', 'ol', '|',
      'align', '|',
      'undo', 'redo', '|',
      'table', 'link', '|',
      'source'
    ]
  };

  joditConfigAr = {
    readonly: false,
    height: 300,
    language: 'ar',
    direction: 'rtl',
    toolbarSticky: false,
    showCharsCounter: false,
    showWordsCounter: false,
    showXPathInStatusbar: false,
    askBeforePasteHTML: false,
    askBeforePasteFromWord: false,
    defaultActionOnPaste: 'insert_clear_html',
    buttons: [
      'bold', 'italic', 'underline', '|',
      'ul', 'ol', '|',
      'align', '|',
      'undo', 'redo', '|',
      'table', 'link', '|',
      'source'
    ]
  };

  constructor(
    private guidelinesService: GuidelinesService,
    private router: Router,
    private route: ActivatedRoute,
    private fb: FormBuilder,
    private http: HttpClient,
    private cdr: ChangeDetectorRef,
    injector: Injector
  ) {
    super(injector);
    this.isLoading$ = this.guidelinesService.isLoading$;
    this.initializeForm();
  }

  ngOnInit(): void {
    this.route.paramMap.subscribe(params => {
      this.currentValue = params.get('value');
      if (this.currentValue) {
        this.loadGuidelineDetail();
      }
    });
  }

  ngAfterViewInit(): void {
    // Check overflow after initial render
    setTimeout(() => this.checkOverflow(), 0);
  }

  loadGuidelineDetail() {
    if (!this.currentValue) return;

    // Load guideline types, current guideline, and last guideline in parallel
    forkJoin({
      types: this.guidelinesService.getGuidelineTypes(),
      current: this.guidelinesService.getCurrentGuidelineByType(this.currentValue),
      last: this.guidelinesService.getLastGuidelineByType(this.currentValue)
    }).subscribe({
      next: ({ types, current, last }) => {
        // Set guideline type
        this.guidelineType = types.find((type: GuidelineType) => type.value === this.currentValue) || null;

        // Set current guideline
        this.currentGuideline = current;

        // Set last guideline and determine if it should be shown
        this.lastGuideline = last;
        this.shouldShowLastGuideline = current && last && current.version !== last.version;

        console.log('Current guideline:', this.currentGuideline);
        console.log('Last guideline:', this.lastGuideline);
        console.log('Should show last guideline:', this.shouldShowLastGuideline);

        // Reset expanded states and recalc overflow after view updates
        this.isCurrentExpanded = false;
        this.isLastExpanded = false;
        this.cdr.detectChanges();
        setTimeout(() => this.checkOverflow(), 0);
      },
      error: (err) => {
        console.error(err);
        this.showError(
          this.lang === 'ar' ? 'حدث خطأ' : 'Error',
          this.lang === 'ar' ? 'فشل في تحميل تفاصيل التوجيه' : 'Failed to load guideline details'
        );
      },
    });
  }

  initializeForm() {
    this.addVersionForm = this.fb.group({
      nameEn: ['', Validators.required],
      nameAr: ['', Validators.required],
      guidelineEn: ['', Validators.required],
      guidelineAr: ['', Validators.required],
      version: ['', Validators.required],
      applyAt: ['', Validators.required]
    });
  }

  openAddVersionModal() {
    this.showAddVersionModal = true;
    this.addVersionForm.reset();
  }

  closeAddVersionModal() {
    this.showAddVersionModal = false;
    this.addVersionForm.reset();
  }

  onEditorChange(event: any, fieldName: string) {
    // Ensure we always store a string (HTML) in the form control
    let content = '';
    if (typeof event === 'string') {
      content = event;
    } else if (event && typeof event?.html === 'string') {
      content = event.html;
    } else if (event && typeof event?.value === 'string') {
      content = event.value;
    } else if (event && event?.target && typeof event.target.innerHTML === 'string') {
      content = event.target.innerHTML;
    } else {
      content = '';
    }

    const control = this.addVersionForm.get(fieldName);
    if (control) {
      control.setValue(content);
      control.markAsDirty();
      control.updateValueAndValidity({ onlySelf: true });
    }
  }

  createNewVersion() {
    if (!this.addVersionForm.valid || !this.currentValue) {
      return;
    }

    // Show irreversible confirmation ONLY for specific types
    if (this.requiresIrreversibleConfirm(this.currentValue)) {
      const message =
        this.lang === 'ar'
          ? 'هذا الإجراء غير قابل للتراجع. سيتلقى جميع الخبراء بريداً إلكترونياً بالشروط الجديدة. هل تريد المتابعة؟'
          : 'This action is irreversible. All insighters will receive an email with the new terms. Do you want to continue?';
      const confirmed = window.confirm(message);
      if (!confirmed) {
        return;
      }
    }

    this.isCreating = true;
    const formValue = this.addVersionForm.value;

    // Format the date for apply_at using local timezone to avoid UTC shift
    const formattedDate = this.formatDateLocal(formValue.applyAt);

    // Prepare form data according to API specification
    const formData = new FormData();
    formData.append('name[en]', formValue.nameEn);
    formData.append('name[ar]', formValue.nameAr);
    formData.append('type', this.currentValue);
    formData.append('guideline[en]', formValue.guidelineEn);
    formData.append('guideline[ar]', formValue.guidelineAr);
    formData.append('version', formValue.version);
    formData.append('apply_at', formattedDate);

    // API headers
    const headers = {
      'Accept': 'application/json',
      'Accept-Language': this.lang,
      'X-Timezone': Intl.DateTimeFormat().resolvedOptions().timeZone,
    };

    const apiUrl = 'https://api.insightabusiness.com/api/admin/setting/guideline';

    this.http.post(apiUrl, formData, { headers }).subscribe({
      next: (response) => {
        this.showSuccess(
          this.lang === 'ar' ? 'نجح الحفظ' : 'Success',
          this.lang === 'ar' ? 'تم إنشاء إصدار جديد بنجاح' : 'New version created successfully'
        );
        this.closeAddVersionModal();
        this.isCreating = false;
        // Reload the guideline details to show the updated data
        this.loadGuidelineDetail();
      },
      error: (error) => {
        this.isCreating = false;
        this.handleServerErrors(error);
      }
    });
  }

  toggleCurrentExpanded(): void {
    this.isCurrentExpanded = !this.isCurrentExpanded;
  }

  toggleLastExpanded(): void {
    this.isLastExpanded = !this.isLastExpanded;
  }

  private requiresIrreversibleConfirm(type: string): boolean {
    const TYPES_REQUIRING_CONFIRM = ['insighter_agreement', 'company_agreement'];
    return TYPES_REQUIRING_CONFIRM.includes(type);
  }

  private checkOverflow(): void {
    if (this.currentContentRef?.nativeElement) {
      const el = this.currentContentRef.nativeElement;
      this.hasCurrentOverflow = el.scrollHeight > Math.min(el.clientHeight, this.COLLAPSED_MAX_HEIGHT_PX);
    } else {
      this.hasCurrentOverflow = false;
    }
    if (this.lastContentRef?.nativeElement) {
      const el = this.lastContentRef.nativeElement;
      this.hasLastOverflow = el.scrollHeight > Math.min(el.clientHeight, this.COLLAPSED_MAX_HEIGHT_PX);
    } else {
      this.hasLastOverflow = false;
    }
    this.cdr.markForCheck();
  }

  private formatDateLocal(dateInput: any): string {
    if (!dateInput) return '';
    if (typeof dateInput === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
      return dateInput;
    }

    const date = new Date(dateInput);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private handleServerErrors(error: any) {
    if (error.error && error.error.errors) {
      const serverErrors = error.error.errors;
      for (const key in serverErrors) {
        if (serverErrors.hasOwnProperty(key)) {
          const messages = serverErrors[key];
          this.showError(
            this.lang === "ar" ? "حدث خطأ" : "An error occurred",
            messages.join(", ")
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

  navigateBack() {
    this.router.navigate(['/admin-dashboard/admin/dashboard/main-dashboard/guidelines']);
  }
}
