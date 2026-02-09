// src/app/pages/wizards/step1.component.ts

import { Component, Input, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Subscription } from 'rxjs';
import { ICreateAccount } from '../../create-account.helper';
import { TranslateService } from '@ngx-translate/core';
import { CommonService } from 'src/app/_fake/services/common/common.service';

@Component({
  selector: 'app-step1',
  templateUrl: './step1.component.html',
})
export class Step1Component implements OnInit, OnDestroy {
  insighterLink: string = '';
  @Input('updateParentModel') updateParentModel: (
    part: Partial<ICreateAccount>,
    isFormValid: boolean
  ) => void;
  
  @Input() defaultValues: Partial<ICreateAccount>;
  
  form: FormGroup;
  private subscriptions: Subscription = new Subscription();

  constructor(private fb: FormBuilder, private translateService: TranslateService, private commonService: CommonService
  ) {}

  ngOnInit() {
    this.initForm();
    // Initial update to parent with default values
    this.updateParentModel(this.defaultValues, this.form.valid);
    const lang = this.translateService.currentLang;
    this.insighterLink = `https://insightabusiness.com/${lang}/insighter`;
  }

  initForm() {
    this.form = this.fb.group({
      accountType: [this.defaultValues.accountType, [Validators.required]],
    });

    // Subscribe to all form value changes
    const formChangesSub = this.form.valueChanges.subscribe((val) => {
      this.updateParentModel(val, this.form.valid);
    });

    // Specifically subscribe to accountType changes
    const accountTypeChangeSub = this.form.get('accountType')!.valueChanges.subscribe((newType) => {
      if (newType !== this.defaultValues.accountType) {
        this.resetDefaultValues(newType);
      }
    });

    this.subscriptions.add(formChangesSub);
    this.subscriptions.add(accountTypeChangeSub);
  }

  /**
   * Notify the parent to reset defaultValues based on the new account type
   * @param newType The newly selected account type
   */
  private resetDefaultValues(newType: 'personal' | 'corporate') {
    // Define the new default values based on accountType
    const newDefaults: Partial<ICreateAccount> = {
      accountType: newType,
      // Reset other fields as necessary
      phoneNumber: null,
      consultingFields: [],
      isicCodes: [],
      phoneCountryCode: { text: '', code: '', country: '' }, // Adjust as needed
      bio: newType === 'personal' ? '' : undefined,
      legalName: newType === 'corporate' ? '' : undefined,
      website: newType === 'corporate' ? '' : undefined,
      registerDocument: null,
      aboutCompany: newType === 'corporate' ? '' : undefined,
      certifications: [],
    };

    // Notify the parent component with the new default values
    this.updateParentModel(newDefaults, this.form.valid);
  }

  ngOnDestroy() {
    this.subscriptions.unsubscribe();
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
    });
    
    return this.form.valid;
  }
  getCompanySection() {
    this.commonService.getCompanySection();
  }
  getInsighterSection(){
    this.commonService.resetCompanySection();
  }
}
