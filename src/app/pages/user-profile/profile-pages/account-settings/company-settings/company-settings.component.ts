import { Component, OnInit, Injector } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { catchError, forkJoin, Observable, of, tap } from 'rxjs';
import { IKnoldgProfile } from 'src/app/_fake/models/profile.interface';
import { ConsultingFieldTreeService } from 'src/app/_fake/services/consulting-fields-tree/consulting-fields-tree.service';
import { CountriesService } from 'src/app/_fake/services/countries/countries.service';
import { ProfileService } from 'src/app/_fake/services/get-profile/get-profile.service';
import { IndustryService } from 'src/app/_fake/services/industries/industry.service';
import { UpdateProfileService } from 'src/app/_fake/services/profile/profile.service';
import { AuthService } from 'src/app/modules/auth';
import { BaseComponent } from 'src/app/modules/base.component';
import { ProjectProgressCelebrationService } from 'src/app/reusable-components/project-progress-celebration/project-progress-celebration.service';
@Component({
  selector: 'app-company-settings',
  templateUrl: './company-settings.component.html',
  styleUrl: './company-settings.component.scss'
})
export class CompanySettingsComponent extends BaseComponent implements OnInit {
  isLoading:boolean = false;
  isUpdatingProfile$ :Observable<boolean> = of(false);
  isLoading$ :Observable<boolean> = of(false);
  roles:string[] = [];
  profile:IKnoldgProfile;
  corporateInfoForm:FormGroup;
  industries:any[] = [];
  consultingFields: any[] = [];
  countries: any[] = [];
  allIndustriesSelected:any[] = [];
  allConsultingFieldsSelected:any[] = [];
  constructor(
    private _profileService: AuthService,
    private fb: FormBuilder,
    private _industries: IndustryService,
    private _consultingFieldService: ConsultingFieldTreeService,
    private _profilePost: UpdateProfileService,
    private _countryService: CountriesService,
    injector: Injector,
    private getProfileService: ProfileService,
    private readonly projectProgressCelebrationService: ProjectProgressCelebrationService
  ) {
    super(injector);
  }

  ngOnInit(): void {
    this.handleAPIs();
  }

  handleAPIs(){
    this.isLoading$ = of(true);

    const profile$ = this.getProfileService.getProfile().pipe(
      tap((profile) => {
        this.profile = profile;
        this.roles = profile.roles;
      })
    );

    const industries$ = this._industries.getIsicCodesTree(this.lang ? this.lang : 'en').pipe(
      tap((codes) => {
        this.industries = codes;
      }),
      catchError((error) => {
        return of([]);
      })
    );

    const consultingFields$ = this._consultingFieldService.getConsultingCodesTree(this.lang ? this.lang : 'en').pipe(
      tap((fields) => {
        this.consultingFields = fields;
      }),
      catchError((err) => {
        return of([]);
      })
    );

    const countries$ = this._countryService.getCountries().pipe(
      tap((countries) => {
        this.countries = countries.map((country: any) => ({
          ...country,
          flagPath: `assets/media/flags/${country.flag}.svg`,
          showFlag: true,
        }));
      }),
      catchError((err) => {
        return of([]);
      })
    );

    forkJoin(
      [profile$, industries$, consultingFields$, countries$]
    ).subscribe({
      next: () => {
        if(this.hasRole(["company"])){
          this.initForm(); // Initialize form here
          this.populateForm();
        }
        this.isLoading$ = of(false);
      },
      error: (err) => {
        this.isLoading$ = of(false);
      }
    });
  }

  initForm(){
    if(this.profile.roles.includes("company")){
      this.corporateInfoForm = this.fb.group({
        companyAddress: ["", Validators.required],
        companyCountry: [null, Validators.required],
        companyPhoneCountryCode: [""],
        companyPhoneNumber: [""],
        companyIndustries: [[], Validators.required],
        companyConsultingFields: [[], Validators.required],
        companyLegalName: ["", Validators.required],
        companyWebsite: [null],
        companyRegisterDocument: [null],
        companyAboutUs: ["",Validators.required],
        linkedIn: [''],
        facebook: [''],
        x: [''],
        instagram: [''],
        youtube: [''],
      });
    }
  }


  onFileSelectedRegistry(event: any) {
    const file = event.target.files[0];
    if (file) {
      this.corporateInfoForm.patchValue({ companyRegisterDocument: file });
      this.corporateInfoForm.get("companyRegisterDocument")?.markAsTouched();
    }
  }
  onFileDrop(event: DragEvent) {
    event.preventDefault();
    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      const file = files.item(0);
      this.corporateInfoForm.patchValue({ companyRegisterDocument: file });
      this.corporateInfoForm.get("companyRegisterDocument")?.markAsTouched();
    }
  }
  onDragOver(event: DragEvent) {
    event.preventDefault();
  }
  // Remove the uploaded register document
  removeRegisterDocument() {
    this.corporateInfoForm.patchValue({ companyRegisterDocument: null });
    // Removed reference to fileInputRegistry.nativeElement
  }

  populateForm(){
    const transformNodes = (nodes: any[]): any[] => {
      if (!nodes || !Array.isArray(nodes)) return [];
      return nodes.map(node => ({
        key: node.id,
        label: this.lang === 'ar' ? node.name : node.name,
        data: { 
          key: node.id,
          code: node.code,
          status: node.status,
          nameEn: node.name,
          nameAr: node.name,
        },
        children: node.children ? transformNodes(node.children) : []
      }));
    
    };

    const transformedIndustries = transformNodes(this.profile.company?.industries || []);
    const transformedConsultingFields = transformNodes(this.profile.company?.consulting_field || []);

    
    this.corporateInfoForm.patchValue({
      companyIndustries: transformedIndustries,
      companyConsultingFields: transformedConsultingFields,
      companyLegalName: this.profile.company?.legal_name,
      companyWebsite: this.profile.company?.website,
      companyRegisterDocument: this.profile.company?.register_document,
      companyAboutUs: this.profile.company?.about_us,
      companyAddress: this.profile.company?.address,
      companyCountry: this.profile.country_id || null,
      companyPhoneCountryCode: this.profile.company?.phone_code || '',
      companyPhoneNumber: this.profile.company?.company_phone || '',
    });

    // Add social media population
    if (this.profile.company?.social) {
      this.profile.company.social.forEach((social: any) => {
        switch (social.type) {
          case 'linkedin':
            this.corporateInfoForm.patchValue({ linkedIn: social.link });
            break;
          case 'facebook':
            this.corporateInfoForm.patchValue({ facebook: social.link });
            break;
          case 'x':
            this.corporateInfoForm.patchValue({ x: social.link });
            break;
          case 'instagram':
            this.corporateInfoForm.patchValue({ instagram: social.link });
            break;
          case 'youtube':
            this.corporateInfoForm.patchValue({ youtube: social.link });
            break;
        }
      });
    }
  }

  getProfile(){
    const profileSubscription = this._profileService.getProfile().subscribe((profile) => {
      this.profile = profile;
      this.roles = profile.roles;
    });
    this.unsubscribe.push(profileSubscription);
  }
  // Removed onDropzoneClick method

  onFileSelected(event: any) {
    // Removed file selection functionality
  }
  handleFiles(files: FileList) {
    // Removed file handling functionality
  }


  onIndustrySelected(selectedNodes: any) {
    this.allIndustriesSelected = selectedNodes && selectedNodes.length > 0 ? selectedNodes : [];
    this.corporateInfoForm.get('companyIndustries')?.setValue(this.allIndustriesSelected);
  }

  onConsultingNodesSelected(selectedNodes: any) {
    this.allConsultingFieldsSelected = selectedNodes && selectedNodes.length > 0 ? selectedNodes : [];
    this.corporateInfoForm.get('companyConsultingFields')?.setValue(this.allConsultingFieldsSelected);
  }
  
  hasRole(requiredRoles: string[]): boolean {
    return requiredRoles.some((role) => this.roles.includes(role));
  }

  getFieldError(fieldName: string): string {
    const field = this.corporateInfoForm.get(fieldName);
    if (field && field.invalid && field.touched) {
      if (field.errors?.['required']) {
        return this.lang === 'ar' ? 'هذا الحقل مطلوب' : 'This field is required';
      }
      if (field.errors?.['pattern']) {
        return this.lang === 'ar' ? 'الرابط غير صحيح' : 'Invalid URL format';
      }
    }
    return '';
  }

  isFieldInvalid(fieldName: string): boolean {
    const field = this.corporateInfoForm.get(fieldName);
    return field ? field.invalid && field.touched : false;
  }
  get isSubmitDisabled(): boolean {
    return false;
  }
  onSubmit(){
    // Mark all fields as touched to show validation errors
    this.corporateInfoForm.markAllAsTouched();
    
    if (this.corporateInfoForm.invalid) {
      return;
    }
    const formData = new FormData();
    formData.append("first_name", this.profile.first_name);
    formData.append("last_name", this.profile.last_name);
    const companyCountry = this.corporateInfoForm.get("companyCountry")?.value;
    if(companyCountry){
      formData.append("country_id", companyCountry.toString());
    }

    formData.append("address", this.corporateInfoForm.get("companyAddress")?.value);
    formData.append("legal_name", this.corporateInfoForm.get("companyLegalName")?.value);
    formData.append("website", this.corporateInfoForm.get("companyWebsite")?.value);
    formData.append("about_us", this.corporateInfoForm.get("companyAboutUs")?.value);

    // Add company phone if provided
    if (this.corporateInfoForm.get("companyPhoneNumber")?.value) {
      formData.append("company_phone", this.corporateInfoForm.get("companyPhoneNumber")?.value);
    }

    // Add company phone code if provided
    if (this.corporateInfoForm.get("companyPhoneCountryCode")?.value) {
      formData.append("phone_code", this.corporateInfoForm.get("companyPhoneCountryCode")?.value);
    }
      // Handle industries selection
    const industriesList = this.corporateInfoForm.get("companyIndustries")?.value.filter((node: any) => typeof node.key === 'number');
    const otherIndustriesFields = this.corporateInfoForm.get("companyIndustries")?.value.filter(
      (node: any) =>
        typeof node.key === 'string' &&
        node.key !== 'selectAll' &&
        node.data?.customInput
    );
    if(industriesList && industriesList.length>0){
      industriesList.forEach((code: any) => {
        formData.append("industries[]", code.key.toString());
      });
    }
    if(otherIndustriesFields && otherIndustriesFields.length>0){
      otherIndustriesFields.forEach((field:any, index:number) => {
        formData.append(`suggest_industries[${index}][parent_id]`, field.parent.key ==="selectAll" ? 0 :field.parent.key);
        formData.append(`suggest_industries[${index}][name][en]`, field.data.customInput);
        formData.append(`suggest_industries[${index}][name][ar]`, field.data.customInput);
      });
    }
    
    // Handle consulting fields selection
    const consultingFieldList = this.corporateInfoForm.get("companyConsultingFields")?.value.filter((node: any) => typeof node.key === 'number');
    const otherConsultingFields = this.corporateInfoForm.get("companyConsultingFields")?.value.filter(
      (node: any) =>
        typeof node.key === 'string' &&
        node.key !== 'selectAll' &&
        node.data?.customInput
    );
    if(consultingFieldList && consultingFieldList.length>0){
      consultingFieldList.forEach((field: any) => {
        formData.append("consulting_field[]", field.key.toString());
      });
    }
    if(otherConsultingFields && otherConsultingFields.length>0){
      otherConsultingFields.forEach((field:any, index:number) => {
        formData.append(`suggest_consulting_fields[${index}][parent_id]`, field.parent.key ==="selectAll" ? 0 :field.parent.key);
        formData.append(`suggest_consulting_fields[${index}][name][en]`, field.data.customInput);
        formData.append(`suggest_consulting_fields[${index}][name][ar]`, field.data.customInput);
      });
    }
    const formDataEntries: Array<{ key: string; value: string }> = [];
    formData.forEach((value, key) => {
      formDataEntries.push({ key, value: value.toString() });
    });

    // Call both company info and social networks update
    forkJoin([
      this._profilePost.updateCompanyInfo(formData),
      this.submitSocialNetworks()
    ]).subscribe({
      next: ([profileRes, socialRes]) => {
        this.showSuccess(
          this.lang === "ar" ? "نجح" : "Success",
          this.lang === "ar" ? "تم تعديل البروفايل" : "Profile Updated Successfully"
        );

        const celebrationSub = this.projectProgressCelebrationService
          .checkMilestone('profile', this.roles)
          .subscribe();
        this.unsubscribe.push(celebrationSub);

        // Refresh profile in background to reflect changes without reload
        this.refreshProfileAndForm({
          warnMessage:
            this.lang === "ar"
              ? "تم الحفظ، ولكن حدثت مشكلة أثناء تحديث البيانات."
              : "Saved, but failed to refresh data.",
        });
      },
      error: (error) => {
        this.handleServerErrors(error);
      }
    });
  }

  /**
   * Clears cached profile and re-populates the form so we don't rely on full page reload.
   * Only warns if refresh fails (success toast is already shown after save).
   */
  private refreshProfileAndForm(opts?: { warnMessage?: string }): void {
    const sub = this.getProfileService.refreshProfile().subscribe({
      next: (profile) => {
        this.profile = profile;
        this.roles = profile.roles || [];
        // Re-init & repopulate if company role is present
        if (this.hasRole(["company"])) {
          if (!this.corporateInfoForm) {
            this.initForm();
          }
          this.populateForm();
          this.corporateInfoForm?.markAsPristine();
        }
      },
      error: () => {
        this.showWarn(
          this.lang === "ar" ? "تحذير" : "Warning",
          opts?.warnMessage ||
            (this.lang === "ar"
              ? "حدثت مشكلة أثناء تحديث البيانات."
              : "Failed to refresh data.")
        );
      },
    });
    this.unsubscribe.push(sub);
  }

  submitSocialNetworks() {
    const social = [];
    const formValues = this.corporateInfoForm.value;

    if (formValues.linkedIn) {
      social.push({ type: 'linkedin', link: formValues.linkedIn });
    }
    if (formValues.facebook) {
      social.push({ type: 'facebook', link: formValues.facebook });
    }
    if (formValues.x) {
      social.push({ type: 'x', link: formValues.x });
    }
    if (formValues.instagram) {
      social.push({ type: 'instagram', link: formValues.instagram });
    }
    if (formValues.youtube) {
      social.push({ type: 'youtube', link: formValues.youtube });
    }

    return this._profilePost.addCompanySocial(social);
  }

  private handleServerErrors(error: any) {
    if (error.error && error.error.errors) {
      const serverErrors = error.error.errors;
      for (const key in serverErrors) {
        if (serverErrors.hasOwnProperty(key)) {
          const messages = serverErrors[key];
          if (error.error.type === "warning") {
            this.showWarn('Error',messages.join(", "));
          } else {
            this.showError('Error',messages.join(", "));
          }
        }
      }
    } else {
      this.showError("", "An unexpected error occurred.");
    }
  }

  onCompanyCountryCodeChange(countryCode: string): void {
    this.corporateInfoForm.get('companyPhoneCountryCode')?.setValue(countryCode);
  }

  onCompanyPhoneNumberChange(phoneNumber: string): void {
    this.corporateInfoForm.get('companyPhoneNumber')?.setValue(phoneNumber);
  }

  onCompanyFormattedPhoneNumberChange(formattedPhone: string): void {
    // Handle formatted phone number if needed
  }

  onFlagError(country: any): void {
    if (country) {
      country.showFlag = false;
    }
  }
}
