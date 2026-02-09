import { Component, ElementRef, Input, OnDestroy, OnInit, OnChanges, SimpleChanges, ViewChild,AfterViewInit, ChangeDetectorRef    } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ValidatorFn, AbstractControl, ValidationErrors, FormControl, AsyncValidatorFn } from '@angular/forms';
import { Observable, Subscription, fromEvent, map, startWith, forkJoin, of, timer } from 'rxjs';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { debounceTime, switchMap, catchError } from 'rxjs/operators';
import { ICreateAccount } from '../../create-account.helper';
import { ConsultingField, ConsultingFieldsService } from 'src/app/_fake/services/admin-consulting-fields/consulting-fields.service';
import { Message } from 'primeng/api';
import { TranslationService } from 'src/app/modules/i18n';
import { IsicCodesService } from 'src/app/_fake/services/isic-code/isic-codes.service';
import { IndustryService } from 'src/app/_fake/services/industries/industry.service';
import { ConsultingFieldTreeService } from 'src/app/_fake/services/consulting-fields-tree/consulting-fields-tree.service';
import { TreeNode } from 'src/app/reusable-components/shared-tree-selector/TreeNode';
import { CountriesService, Country } from 'src/app/_fake/services/countries/countries.service';
@Component({
  selector: 'app-step2',
  templateUrl: './step2.component.html',
  styleUrl: './step2.component.scss'
})
export class Step2Component implements OnInit, OnChanges, OnDestroy  {
  isLoading$: Observable<boolean>;
  listOfConsultingFields: TreeNode[] = [];
  messages: Message[] = [];
  optionLabel: string = 'name.en';
  lang:string;
  countries: Country[] = [];
  nodes: TreeNode[] = [];
  selectedNodes: any;
  logoPreview: string | ArrayBuffer | null = null;
  @Input('updateParentModel') updateParentModel: (
    part: Partial<ICreateAccount>,
    isFormValid: boolean
  ) => void;
  form: FormGroup;
  @Input() defaultValues: Partial<ICreateAccount>;
  @ViewChild('fileInput') fileInput: ElementRef<HTMLInputElement>;
  defaultImage = 'https://au.eragroup.com/wp-content/uploads/2018/02/logo-placeholder.png';
  private unsubscribe: Subscription[] = [];

  allConsultingFieldSelected  = []
  allIndustriesSelected  = []

  // Custom validator for arrays to ensure at least one item is selected
  arrayRequiredValidator(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const value = control.value;
      
      if (!value || !Array.isArray(value) || value.length === 0) {
        return { required: true };
      }
      
      // Filter out the "selectAll" node - only count actual selections
      const actualSelections = value.filter((node: any) => node.key !== "selectAll");
      
      if (actualSelections.length === 0) {
        return { required: true };
      }
      
      return null;
    };
  }

  // Async validator to check if legal name already exists
  legalNameExistsValidator(): AsyncValidatorFn {
    return (control: AbstractControl): Observable<ValidationErrors | null> => {
      if (!control.value || control.value.trim() === '') {
        return of(null); // Don't validate empty values
      }

      return timer(500).pipe( // Debounce for 500ms
        switchMap(() => {
          return this.http.post<{exists: boolean}>('https://api.foresighta.co/api/account/insighter/company/name-exists', {
            legal_name: control.value.trim()
          }, {
            headers: new HttpHeaders({
              'Accept': 'application/json',
              'Content-Type': 'application/json',
              'Accept-Language': this.lang,
              'X-Timezone': Intl.DateTimeFormat().resolvedOptions().timeZone,
            })
          }).pipe(
            map(response => {
              return response.exists ? { legalNameExists: true } : null;
            }),
            catchError(() => {
              // In case of API error, don't block the form
              return of(null);
            })
          );
        })
      );
    };
  }
  constructor(
    private fb: FormBuilder,
    private _KnoldgFieldsService: ConsultingFieldTreeService,
    private _translateion:TranslationService,
    private _isicService: IndustryService,
    private _countriesService: CountriesService,
    private cdr: ChangeDetectorRef,
    private http: HttpClient
  ) {
    this.lang=this._translateion.getSelectedLanguage();
  }
 

  ngOnInit() {
    this.initApiCalls();
    this.initForm();
    this.updateParentModel({}, this.checkForm());
    this._translateion.onLanguageChange().subscribe((lang)=>{
      this.lang =lang;
      this.initApiCalls();
    });
    this.handleDefaultValues();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['defaultValues'] && !changes['defaultValues'].firstChange) {
      this.handleDefaultValues();
    }
  }

  private handleDefaultValues() {
    if (this.defaultValues?.registerDocument) {
      this.form.patchValue({ registerDocument: this.defaultValues?.registerDocument });
      this.form.get('registerDocument')?.markAsTouched();
      this.updateParentModel({ registerDocument: this.defaultValues?.registerDocument }, this.checkForm());
    }
    if(this.defaultValues?.logo){
      if (this.defaultValues.logo instanceof File) {
        const reader = new FileReader();
        reader.onload = () => {
          this.logoPreview = reader.result;
          this.cdr.detectChanges();
          this.updateBackgroundImage();
        };
        reader.readAsDataURL(this.defaultValues.logo);
      } else if (typeof this.defaultValues.logo === 'string') {
        this.logoPreview = this.defaultValues.logo;
        this.cdr.detectChanges();
        this.updateBackgroundImage();
      }
    }
    
    // Handle pre-selected country from profile
    if (this.defaultValues?.country && this.form) {
      this.form.patchValue({ country: this.defaultValues.country });
      this.updateParentModel({ country: this.defaultValues.country }, this.checkForm());
    }
    // Handle pre-selected phone code and numbers from profile/defaults
    if (this.form) {
      // Normalize phoneCountryCode to a plain numeric string without '+'
      const rawCode: any = this.defaultValues?.phoneCountryCode as any;
      const normalizedCode =
        typeof rawCode === 'object'
          ? (rawCode?.code || '').toString()
          : (rawCode || '').toString();
      const cleanedCode = normalizedCode.replace(/^\+/, '');
      if (cleanedCode) {
        this.form.patchValue({ phoneCountryCode: cleanedCode });
      }
      if (this.defaultValues?.phoneNumber !== undefined && this.defaultValues?.phoneNumber !== null) {
        this.form.patchValue({ phoneNumber: this.defaultValues.phoneNumber as any });
      }
      if (this.defaultValues?.phoneCompanyNumber) {
        this.form.patchValue({ phoneCompanyNumber: this.defaultValues.phoneCompanyNumber });
      }
    }
  }

  initApiCalls() {
    this.isLoading$=of(true);
    const apiCalls = forkJoin({
      consultingFields: this._KnoldgFieldsService.getConsultingCodesTree(this.lang || 'en'),
      isicCodes: this._isicService.getIsicCodesTree(this.lang || 'en'),
      countries: this._countriesService.getCountries()
    }).subscribe({
      next: (results) => {
        this.listOfConsultingFields = results.consultingFields;
        this.nodes = results.isicCodes;
        this.countries = results.countries.map(country => ({
          ...country,
          showFlag: true
        }));
        this.isLoading$=of(false);
      },
      error: (err) => {
        this.messages = [];
        if (err.validationMessages) {
          this.messages = err.validationMessages;
        } else {
          this.messages.push({
            severity: 'error',
            summary: 'Error',
            detail: 'An unexpected error occurred.',
          });
          setTimeout(() => {
            this.messages = [];
          }, 4000);
          this.isLoading$=of(false);
        }
      }
    });
    this.unsubscribe.push(apiCalls);
  }

  getBackgroundImage(){
    if (this.logoPreview) {
      return `url(${this.logoPreview})`;
    }
    return `url(${this.defaultImage})`;
  }

  // Method to force update the background image
  updateBackgroundImage() {
    this.cdr.detectChanges();
  }
  onLogoSelected(event:Event){
    const input  =event.target as HTMLInputElement;
    if(input.files && input.files[0]){
      const file = input.files[0];
      const validTypes = ['image/png', 'image/jpeg', 'image/jpg'];
      if(!validTypes.includes(file.type)){
        this.messages = [{
          severity: 'error',
          summary: 'Invalid File Type',
          detail: 'Please select a PNG or JPEG image.',
          id:'fileType'
        }];
        setTimeout(() => {
          this.messages = [];
        }, 4000);
        return
      };
      const maxSize = 2 *1024*1024 ; //2MB
      if(file.size > maxSize){
        this.messages = [{
          icon:'',
          severity: 'error',
          summary:this.lang ==='en' ? 'Logo must be smaller than 2MB.' : 'يجب أن يكون الحجم أقل من ٢ ميجا',
          detail:  '',
          id:'fizeSize'
        }];
        setTimeout(() => {
          this.messages = [];
        }, 4000);
        return;
      }
      this.form.patchValue({logo:file});
      this.updateParentModel({ logo: file }, this.checkForm());
      const reader = new FileReader();
      reader.onload = () => {
        this.logoPreview = reader.result;
        this.cdr.detectChanges();
        this.updateBackgroundImage();
      };
      reader.onerror = (error) => {
        console.error('Error reading file:', error);
      };
      reader.readAsDataURL(file);
    }
  };
  removeLogo() {
    this.form.patchValue({ logo: null });
    this.logoPreview = null;
    this.updateParentModel({ logo: null }, this.checkForm());
    if (this.fileInput) {
      this.fileInput.nativeElement.value = '';
    }
    this.cdr.detectChanges();
    this.updateBackgroundImage();
  }
  
  onDropzoneClick() {
    this.fileInput.nativeElement.click();
  }
 
// Handle file selection from the file input
onFileSelected(event: any) {
  const file = event.target.files[0];
  if (file) {
    this.form.patchValue({ registerDocument: file });
    this.form.get('registerDocument')?.markAsTouched();
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
    this.form.patchValue({ registerDocument: file });
    this.form.get('registerDocument')?.markAsTouched();
    this.updateParentModel({ registerDocument: file }, this.checkForm());
  }


}

// Remove the uploaded register document
removeRegisterDocument() {
  this.form.patchValue({ registerDocument: null });
  this.updateParentModel({ registerDocument: null }, this.checkForm());
  this.fileInput.nativeElement.value =''
}

// Get the icon path based on the file extension
getFileIcon(file: File): string {
  const extension = file.name.split('.').pop()?.toLowerCase();
  const iconPath = `./assets/media/svg/files/${extension}.svg`;
  // If the icon doesn't exist, you can return a default icon path
  return iconPath;
}

  onConsultingNodesSelected(event:any){
   this.allConsultingFieldSelected=event && event.length >0 ? event : [];
   const consultingFieldsControl = this.form.get('consultingFields');
   consultingFieldsControl?.setValue(this.allConsultingFieldSelected);
   consultingFieldsControl?.markAsTouched();
   consultingFieldsControl?.updateValueAndValidity();
   
   this.updateParentModel({consultingFields:this.allConsultingFieldSelected}, this.checkForm());
 
  }

  onIndustrySelected(event: any) {
    this.allIndustriesSelected = event && event.length > 0 ? event : [];
    const isicCodesControl = this.form.get('isicCodes');
    isicCodesControl?.setValue(this.allIndustriesSelected);
    isicCodesControl?.markAsTouched();
    isicCodesControl?.updateValueAndValidity();
    
    this.updateParentModel({isicCodes:this.allIndustriesSelected}, this.checkForm());
   
  }
  

  initForm() {
    const accountType = this.defaultValues.accountType;
    if (accountType === 'personal') {
      this.form = this.fb.group({
        bio: [this.defaultValues.bio || '', [Validators.required]],
        country: [this.defaultValues.country || '', [Validators.required]],
        phoneCountryCode: [this.defaultValues.phoneCountryCode || ''],
        phoneNumber: [
          this.defaultValues.phoneNumber || '',
          [
          ],
        ],
        consultingFields: [this.defaultValues.consultingFields || [], [this.arrayRequiredValidator()]],
        isicCodes: [this.defaultValues.isicCodes  || [], [this.arrayRequiredValidator()]],
      });
    } else {
      this.form = this.fb.group(
        {
          legalName: new FormControl(this.defaultValues.legalName || '', {
            validators: [Validators.required],
            asyncValidators: [this.legalNameExistsValidator()],
            updateOn: 'blur'
          }),
          companyAddress: [this.defaultValues.companyAddress || '', [Validators.required]],
          aboutCompany: [this.defaultValues.aboutCompany || '', [Validators.required]],
          country: [this.defaultValues.country || '', [Validators.required]],
          phoneCountryCode: [this.defaultValues.phoneCountryCode || ''],
          phoneCompanyNumber: [
            this.defaultValues.phoneCompanyNumber || '',
            [
              Validators.required
            ],
          ],
          consultingFields: [this.defaultValues.consultingFields || [], [this.arrayRequiredValidator()]],
          isicCodes: [this.defaultValues.isicCodes || [], [this.arrayRequiredValidator()]],
          logo: [this.defaultValues.logo || null, [Validators.required]],
        }
      );
    }
    

    const formChangesSubscr = this.form.valueChanges.subscribe((val) => {
      this.updateParentModel(val, this.checkForm());
    });
    this.unsubscribe.push(formChangesSubscr);
  }

onFileChange(event: any) {
    const file = event.target.files[0];
    if (file) {
      this.form.patchValue({ registerDocument: file });
      this.updateParentModel({ registerDocument: file }, this.checkForm());
    }
  }
  checkForm() {
    return this.form.valid;
  }

  get fizeSizeMessages() {
    // Return only the messages with the ID 'fizeSize'
    return this.messages.filter((message) => message.id === 'fizeSize');
  }

  onFlagError(country: any) {
    country.showFlag = false;
  }

  // Custom filter function for country dropdown
  customCountryFilter(event: any) {
    const query = event.filter.toLowerCase();
    const filtered: any[] = [];
    
    for (let i = 0; i < this.countries.length; i++) {
      const country = this.countries[i];
      if (country.names.en.toLowerCase().indexOf(query) !== -1 || 
          country.names.ar.toLowerCase().indexOf(query) !== -1) {
        filtered.push(country);
      }
    }
    
    return filtered;
  }

  ngOnDestroy() {
    this.unsubscribe.forEach((sb) => sb.unsubscribe());
  }

  /**
   * Validates the form and marks all fields as touched to show validation errors
   * @returns boolean indicating if the form is valid
   */
  validateAndMarkTouched(): boolean {
    // Mark all fields as touched to show validation errors
    Object.keys(this.form.controls).forEach(key => {
      const control = this.form.get(key);
      control?.markAsTouched();
      // Don't call updateValueAndValidity() as it triggers async validators unnecessarily
    });
    
    // Check if form is valid and not pending (important for async validators)
    return this.form.valid && !this.form.pending;
  }
}
