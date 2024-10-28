import { Component, OnInit, OnDestroy, ViewChild, signal } from '@angular/core';
import { FormGroup, FormBuilder, Validators } from '@angular/forms';
import { Subscription, Observable, map } from 'rxjs';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { ConfirmPasswordValidator } from './confirm-password.validator';
import { first } from 'rxjs/operators';
import { CountryService } from 'src/app/_fake/services/countries-api/countries-get.service';
import { Country, ICountry } from 'src/app/_fake/models/country.model';
import { TranslationService } from 'src/app/modules/i18n';
import { ConsultingFieldService } from 'src/app/_fake/services/consulting-field/consulting-field.service';
import { IsicService } from 'src/app/_fake/services/isic/isic.service';
import { HSCodeService } from 'src/app/_fake/services/hs-code/hs-code.service';
import { UserPreRegistration } from 'src/app/_fake/models/pre-user.model';
import { PreRegsiterService } from 'src/app/_fake/services/pre-register/pre-regsiter.service';

import { ScrollAnimsService } from 'src/app/_fake/services/scroll-anims/scroll-anims.service';
import { Message } from 'primeng/api';
import { IsicCode, TreeNode } from 'src/app/_fake/models/isicNodes.model';
@Component({
  selector: 'app-registration',
  templateUrl: './preregistraion.component.html',
  styleUrls: ['./registration.component.scss'],
})
export class RegistrationComponent implements OnInit, OnDestroy {

  isLoading$: Observable<boolean>;
  isLoadingConsultingFields$: Observable<boolean>;
  isLoadingSubmit$: Observable<boolean>;
  isLoadingIsicCodes$: Observable<boolean>;
  isLoadingCountires$: Observable<boolean>;
  isLoadingHSCodes$: Observable<boolean>;
  selectedNodes: any[] = []; // Initialize as an empty array
  selectedCountry: any; // Initialize as an empty array

  

  messages: Message[] = [];  // Array to hold error messages
  passwordFieldType: string = 'password';
  confirmPasswordFieldType: string = 'password';
  registrationForm: FormGroup;
  hasError: boolean;

  consultingFields: any[] = []; 
  isic:any;
  isicCodes: any[] = [];
  nodes:any;
  hsCodes: any[] = [];
  optionLabelHSCode:string;
  lang:string;
  isOtherSelected: boolean = false; // Track if "Other" is selected
  private unsubscribe: Subscription[] = [];
  optionLabelField: string = 'description.en';  // default to English
  optionLabel: string = 'name.en';  // default to English
  countries: ICountry[];
  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router,
    private _countriesGet :CountryService,
    private _translateion:TranslationService,
    private _consultingFieldsService: ConsultingFieldService, // Add your service
    private _isicService: IsicService, // Inject the ISIC service
    private _hsCodeService: HSCodeService, // Inject the HSCodeService
    private _register: PreRegsiterService ,// Inject the HSCodeService
    private scrollAnims: ScrollAnimsService
  ) {
    this.isLoading$ = this.authService.isLoading$;
    this.isLoadingCountires$ = this._countriesGet.isLoading$;
    this.isLoadingIsicCodes$ = this._isicService.isLoading$;
    this.isLoadingConsultingFields$ = this._consultingFieldsService.isLoading$
    this.isLoadingHSCodes$ = this._hsCodeService.isLoading$;
    this.isLoadingSubmit$ = this._register.isLoading$;
  }
  ngAfterViewInit(): void {
    setTimeout(() => {
      this.scrollAnims.scrollAnimations();
    }, 100); 
  }

  ngOnInit(): void {
   this._isicService.getList().subscribe()
    this._translateion.onLanguageChange().subscribe((lang)=>{
      this.lang =lang;
      this.setOptionLabel()
    })
    // this.countries = countriesData.countriesLocalAPI;
    this.getListOfCountries();
    this.setOptionLabel()
    this.initForm();
    this.getConsultingFields();
    this.loadIsicCodes()
   
    this.onConsultingFieldChange();
    this.onISICFieldChange()
  }

  loadIsicCodes() {
    const isicSub = this._isicService.getIsicCodes().subscribe({
      next: (res) => {
        this.isicCodes = res;
        this.nodes = this.mapIsicCodesToTreeNodes(this.isicCodes);
      },
      error: (err) => {
        console.error('Error loading ISIC codes:', err);
      },
    });
    this.unsubscribe.push(isicSub);
  }

  mapIsicCodesToTreeNodes(isicCodes: IsicCode[]): TreeNode[] {
    return isicCodes.map((isicCode) => this.mapIsicCodeToTreeNode(isicCode));
  }

  mapIsicCodeToTreeNode(isicCode: IsicCode): TreeNode {
    return {
      key: isicCode.id.toString(),
      label: `${isicCode.code} - ${isicCode.description.en}`,
      data: isicCode,
      children: isicCode.child_isic_code?.length
        ? this.mapIsicCodesToTreeNodes(isicCode.child_isic_code)
        : undefined,
    };
  }

  getConsultingFields() {
    const getConsultingFieldsSub = this._consultingFieldsService.getConsultingFields().subscribe({
      next: (res) => {
        this.consultingFields = res; 
      },
      error: (err) => {
        console.log('err', err);
      },
    });
    this.unsubscribe.push(getConsultingFieldsSub);
  }
  trimText(text: string, maxLength: number): string {
    if (text.length > maxLength) {
      return text.substring(0, maxLength) + '...';
    }
    return text;
  }
  setOptionLabelFiield() {
    // Adjust the optionLabel based on the current language
    if (this.lang === 'en') {
      this.optionLabelField = 'description.en';
      this.optionLabelHSCode = 'label'; // Using the 'label' property set in getHSCodes()
    } else if (this.lang === 'ar') {
      this.optionLabelField = 'description.ar';
      this.optionLabelHSCode = 'label'; // Using the 'label' property set in getHSCodes()
    }
  }
  
  getListOfCountries(){
    const getCountriesSub = this._countriesGet.getCountries().subscribe({
      next : (res)=>{
        this.countries=res.map((country:ICountry) => ({
          ...country,
          flagPath: `../../../../../assets/media/flags/${country.flag}.svg` 
        }));

      },
      error : (err)=>{console.log('err',err)}
    })
    this.unsubscribe.push(getCountriesSub)
  }


  setOptionLabel() {
    // Adjust the optionLabel based on the current language
    if (this.lang === 'en') {
      this.optionLabel = 'name.en';
    } else if (this.lang === 'ar') {
      this.optionLabel = 'name.ar';
    }
  }

  // Form initialization
  initForm() {
    this.registrationForm = this.fb.group(
      {
        firstName: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(100)]],
        lastName: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(100)]],
        aboutDescription: [''],
        email: ['', [Validators.required, Validators.email, Validators.minLength(3), Validators.maxLength(320)]],
        password: [
          '',
          [
            Validators.required,
            Validators.minLength(8),
            Validators.maxLength(100),
            Validators.pattern(/^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/)
          ]
        ],
        // country: [null, Validators.required],
        consultingField: [[], Validators.required], // Consulting Field
        otherConsultingField: ['', Validators.maxLength(100)], // Optional field for "Other"
        // hscode: [null], // Updated to [null] for dropdown
        cPassword: ['', [Validators.required, Validators.minLength(8), Validators.maxLength(100)]],
        agree: [true],
      },
      {
        validator: ConfirmPasswordValidator.MatchPassword,
      }
    );
  }

  // When the user changes the Consulting Field
  onConsultingFieldChange() {
    const consultingFieldSub = this.registrationForm.get('consultingField')?.valueChanges.subscribe(res => {
      const selectedFields = res; // res is now an array
      if (selectedFields && selectedFields.length > 0) {
        // Check if 'Other' is selected among the selectedFields
        this.isOtherSelected = selectedFields.some((field:any) => field.description.en.trim() === 'Other');
      } else {
        this.isOtherSelected = false;
      }
  
      if (this.isOtherSelected) {
        this.registrationForm.get('otherConsultingField')?.setValidators([Validators.required, Validators.maxLength(100)]);
      } else {
        this.registrationForm.get('otherConsultingField')?.clearValidators();
        this.registrationForm.get('otherConsultingField')?.setValue('');
      }
      this.registrationForm.get('otherConsultingField')?.updateValueAndValidity();
    });
    if (consultingFieldSub) this.unsubscribe.push(consultingFieldSub);
  }
  

  onISICFieldChange() {
    const ISICFieldSub = this.registrationForm.get('industry')?.valueChanges.subscribe(res => {
      if (res && res.code) {  // Ensure 'res' and 'res.code' are not null or undefined
        this.getHScodeByISIC(res.code);
      } else {
        console.log('No valid industry selected');
        this.hsCodes = [];
        this.registrationForm.get('hscode')?.setValue(null);
      }
    });
    if (ISICFieldSub) this.unsubscribe.push(ISICFieldSub);
  }

  getHScodeByISIC(ISICid: string) {
    if (!ISICid) {
      console.error('ISIC code is null or undefined');
      return;
    }
  
    const getHScodeSub = this._hsCodeService.getHScodeByISIC( ISICid).subscribe({
      next: (res) => {
        if (Array.isArray(res)) {
          this.hsCodes = res.map((item: any) => {
            let label = this.lang === 'en' ? item.section.en : (item.section.ar || item.section.en);
            return { ...item, label };
          });
        } else {
          console.error('Unexpected response format for HS codes:', res);
        }
      },
      error: (err) => {
        console.error('Error fetching HS codes:', err);
      },
    });
    if (getHScodeSub) this.unsubscribe.push(getHScodeSub);
  }

  submit() {
    
    if (this.registrationForm.valid && this.selectedNodes && this.selectedNodes.length > 0) {
      this.hasError = false;
      const newUser:UserPreRegistration={
        first_name: '',
        last_name: '',
        email: '',
        password: '',
        confirm_password: '',
        country_id: 1,
        isic_codes: [],
        consulting_feild_ids: [],
        hs_code: '',
        description: ''
      };
      newUser.first_name=this.registrationForm.get('firstName')?.value;
      newUser.last_name=this.registrationForm.get('lastName')?.value;
      newUser.email=this.registrationForm.get('email')?.value;
      newUser.password=this.registrationForm.get('password')?.value;
      newUser.confirm_password=this.registrationForm.get('password')?.value;
      newUser.country_id=this.selectedCountry.id;
      newUser.isic_codes=this.selectedNodes ? this.selectedNodes.map(node => node.data.id) : [];;
      newUser.consulting_feild_ids =this.registrationForm.get('consultingField')?.value.map((field:any) => field.id);
      // newUser.hs_code=this.registrationForm.get('hscode')?.value?this.registrationForm.get('hscode')?.value.id  : null ;
      newUser.description =this.registrationForm.get('aboutDescription')?.value ? this.registrationForm.get('aboutDescription')?.value : null;
      newUser.other_consulting_field=this.registrationForm.get('otherConsultingField')?.value ? this.registrationForm.get('otherConsultingField')?.value : null;
console.log("newUser" ,newUser);
console.log("selectedNodes",this.selectedNodes);
      const registerAPI= this._register.preRegisterUser(newUser).pipe(first()).subscribe({
        next: (res)=>{
          if(res.state){
           this.registrationForm.reset();
           this.router.navigate(['/auth/verify-email' , newUser.email])
          }
        },
        error: (error) => {
          // Clear the existing messages
          this.messages = [];
        
          // Check if the error contains validation messages
          if (error.validationMessages) {
            this.messages = error.validationMessages;  // Set the messages array
          } else {
            this.messages.push({ severity: 'error', summary: 'Error', detail: 'An unexpected error occurred.' });
          }
        }
      
      })
      this.unsubscribe.push(registerAPI);
    }else{
      this.hasError = true;
    }

  }
  togglePasswordVisibility(field: string): void {
    if (field === 'password') {
      this.passwordFieldType =
        this.passwordFieldType === 'password' ? 'text' : 'password';
    } else if (field === 'confirmPassword') {
      this.confirmPasswordFieldType =
        this.confirmPasswordFieldType === 'password' ? 'text' : 'password';
    }
  }
  ngOnDestroy() {
    this.unsubscribe.forEach((sb) => sb.unsubscribe());
  }
}