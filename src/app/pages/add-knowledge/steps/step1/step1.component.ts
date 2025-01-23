import { Component, Injector, Input, OnDestroy, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Subscription } from 'rxjs';
import { ICreateKnowldege } from '../../create-account.helper';
import { TranslationService } from 'src/app/modules/i18n/translation.service';
import { BaseComponent } from 'src/app/modules/base.component';

@Component({
  selector: 'app-step1',
  templateUrl: './step1.component.html',
})
export class Step1Component extends BaseComponent implements OnInit, OnChanges {
  @Input('updateParentModel') updateParentModel: (
    part: Partial<ICreateKnowldege>,
    isFormValid: boolean
  ) => void;
  form: FormGroup;
  @Input() knowledgeId!:number;
  @Input() defaultValues: Partial<ICreateKnowldege>;

  knowledgeTypes = [
    {
      id: 'kt_create_account_form_type_data',
      value: 'data',
      label: 'DATA',
      iconName: 'data',
      iconClass: 'text-primary',
      icon: 'fas fa-database text-primary mx-2 fs-6',
      description: 'DATA_DESCRIPTION'
    },
    {
      id: 'kt_create_account_form_type_insights',
      value: 'insight',
      label: 'INSIGHTS',
      iconName: 'chart-line',
      iconClass: 'text-success',
      icon: 'fas fa-lightbulb text-success mx-2 fs-6',
      description: 'INSIGHTS_DESCRIPTION'
    },
    {
      id: 'kt_create_account_form_type_reports',
      value: 'report',
      label: 'REPORTS',
      iconName: 'document',
      iconClass: 'text-info',
      icon: 'fas fa-file-alt text-info mx-2 fs-6',
      description: 'REPORTS_DESCRIPTION'
    },
    {
      id: 'kt_create_account_form_type_manual',
      value: 'manual',
      label: 'MANUAL',
      iconName: 'book',
      iconClass: 'text-warning',
      icon: 'fas fa-book text-warning mx-2 fs-6',
      description: 'MANUAL_DESCRIPTION'
    },
    {
      id: 'kt_create_account_form_type_course',
      value: 'course',
      label: 'COURSE',
      iconName: 'teacher',
      iconClass: 'text-success',
      icon: 'fas fa-graduation-cap text-success mx-2 fs-6',
      description: 'COURSE_DESCRIPTION'
    },
    {
      id: 'kt_create_account_form_type_media',
      value: 'media',
      label: 'MEDIA',
      iconName: 'youtube',
      iconClass: 'text-danger',
      icon: 'fas fa-play-circle text-danger mx-2 fs-6',
      description: 'MEDIA_DESCRIPTION',
      disabled: true,
      tooltip: 'Coming Soon'
    }
  ];

  constructor(injector: Injector,private fb: FormBuilder, private translationService: TranslationService) {
    super(injector);
  }

  ngOnInit() {
    this.initForm();
    this.updateParentModel({}, this.checkForm());

    const langChangeSub = this.translationService.onLanguageChange().subscribe(lang => {
      // Perform any actions needed when the language changes
    });
    this.unsubscribe.push(langChangeSub);
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['defaultValues'] && this.form) {
      const currentValue = changes['defaultValues'].currentValue;
      if (currentValue?.knowledgeType) {
        this.form.patchValue({
          knowledgeType: currentValue.knowledgeType
        }, { emitEvent: false });
      }
    }
  }

  initForm() {
    this.form = this.fb.group({
      knowledgeType: ['', [Validators.required]], // Initialize with empty string
    });

    // If we have initial defaultValues, set them
    if (this.defaultValues?.knowledgeType) {
      this.form.patchValue({
        knowledgeType: this.defaultValues.knowledgeType
      }, { emitEvent: false });
    }

    const formChangesSubscr = this.form.valueChanges.subscribe((val) => {
      this.updateParentModel(val, this.checkForm());
    });
    this.unsubscribe.push(formChangesSubscr);
  }

  checkForm(): boolean {
    return this.form.valid;
  }

}
