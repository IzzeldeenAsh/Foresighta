import { Component, Injector, Input, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';
import { Subscription, forkJoin } from 'rxjs';
import { ICreateKnowldege } from '../../create-account.helper';
import { BaseComponent } from 'src/app/modules/base.component';
import { LanguagesService, Language } from 'src/app/_fake/services/languages-list/languages.service';
import { TranslationService } from 'src/app/modules/i18n/translation.service';
import { trigger, transition, style, animate } from '@angular/animations';
import { IndustryService } from 'src/app/_fake/services/industries/industry.service';
import { TreeNode } from 'primeng/api';
import { Topic, TopicsService } from 'src/app/_fake/services/topic-service/topic.service';
import { EconomicBloc } from 'src/app/_fake/services/economic-block/economic-block.service';
import { IsicCodesService } from 'src/app/_fake/services/isic-code/isic-codes.service';

@Component({
  selector: 'app-step2',
  templateUrl: './step2.component.html',
  animations: [
    trigger('fadeInMoveY', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(-20px)' }),
        animate('300ms ease-out', style({ opacity: 1, transform: 'translateY(0)' }))
      ]),
      transition(':leave', [
        animate('300ms ease-in', style({ opacity: 0, transform: 'translateY(-20px)' }))
      ])
    ])
  ]
})
export class Step2Component extends BaseComponent implements OnInit {
  @Input('updateParentModel') updateParentModel: (
    part: Partial<ICreateKnowldege>,
    isFormValid: boolean
  ) => void;
  form: FormGroup;
  @Input() defaultValues: Partial<ICreateKnowldege>;
  @Input() knowledgeId!: number;
  languages: Language[] = [];
  currentLang: string = 'en';
  industryNodes: TreeNode[] = [];
  isLoading = false;
  topics: any[] = [];
  selectedTopic: Topic | null = null;

  marketOptions = [
    {
      label: 'Region',
      value: '1',
      icon: 'ki-duotone ki-globe fs-1',
      description: 'Group of countries that share similar cultural and social characteristics.'
    },
    {
      label: 'Economic Block',
      value: '2',
      icon: 'ki-duotone ki-chart fs-1',
      description: 'Group of countries that share similar economic characteristics.'
    }
  ];
  isicCodeNodes: TreeNode[] = [];
  hsCodeNodes: TreeNode[] = [];
  selectedIsicId: number = 0;
  selectedIndustryId: number = 0;

  // Add new class property to store trimmed and lowercased topic names
  private topicNames: string[] = [];

  constructor(
    injector: Injector,
    private fb: FormBuilder,
    public languagesService: LanguagesService,
    private topicService: TopicsService,
    private translationService: TranslationService,
    private industryService: IndustryService,
    private isicCodeService: IsicCodesService
  ) {
    super(injector);
    this.currentLang = this.translationService.getSelectedLanguage();
  }

  ngOnInit() {
    if (this.defaultValues.industry) {
      this.selectedIndustryId = this.defaultValues.industry;
      this.getTopics(this.defaultValues.industry);
    }
    this.initForm();
    this.loadData();
    this.updateParentModel({}, this.checkForm());

    // Subscribe to language changes
    const langChangeSub = this.translationService.onLanguageChange().subscribe(lang => {
      if (lang) {
        this.currentLang = lang;
        this.loadData();
      }
    });
    this.unsubscribe.push(langChangeSub);
  }

  private loadData() {
    this.isLoading = true;
    const dataSub = forkJoin({
      industries: this.industryService.getIsicCodesTree(this.currentLang),
      languages: this.languagesService.getLanguages(this.currentLang),
      isicCodes: this.isicCodeService.getIsicCodesTree(this.currentLang)
    }).subscribe({
      next: (response) => {
        this.industryNodes = response.industries;
        this.languages = response.languages;
        this.isicCodeNodes = response.isicCodes;
      },
      error: (error) => {
        console.error('Error loading data:', error);
      },
      complete: () => {
        this.isLoading = false;
      }
    });
    this.unsubscribe.push(dataSub);
  }

  initForm() {
    this.form = this.fb.group({
      title: [this.defaultValues.title, [Validators.required]],
      description: [this.defaultValues.description, [Validators.required]],
      accountPlan: ['1', [Validators.required]],
      language: [this.defaultValues.language, [Validators.required]],
      targetMarket: [this.defaultValues.targetMarket, [Validators.required]],
      industry: [this.defaultValues.industry, [Validators.required]],
      economicBlocks: [this.defaultValues.economic_blocs || []],
      regions: [this.defaultValues.regions || []],
      countries: [this.defaultValues.countries || []],
      topicId: [this.defaultValues.topicId, [Validators.required]],
      customTopic: [this.defaultValues.customTopic],
      isic_code: [this.defaultValues.isic_code],
      hs_code: [this.defaultValues.hs_code],
    });

    const regionsControl = this.form.get('regions');
    const countriesControl = this.form.get('countries');
    const economicBlocksControl = this.form.get('economicBlocks');

    // Custom validator for regions/countries
    const regionsCountriesValidator = (): ValidationErrors | null => {
      const regions = this.form.get('regions')?.value || [];
      const countries = this.form.get('countries')?.value || [];
      return regions.length > 0 || countries.length > 0 ? null : { required: true };
    };

    // Custom validator for economic blocks
    const economicBlocksValidator = (): ValidationErrors | null => {
      const blocks = this.form.get('economicBlocks')?.value || [];
      return blocks.length > 0 ? null : { required: true };
    };

    this.form.get('targetMarket')?.valueChanges.subscribe(value => {
      if (value === '1') {
        regionsControl?.setValidators([regionsCountriesValidator]);
        countriesControl?.clearValidators();
        economicBlocksControl?.clearValidators();
        
        regionsControl?.updateValueAndValidity();
        countriesControl?.updateValueAndValidity();
        economicBlocksControl?.updateValueAndValidity();
        
        this.updateParentModel({ 
          economic_blocs: [],
          regions: regionsControl?.value,
          countries: countriesControl?.value 
        }, this.checkForm());
      } else if (value === '2') {
        economicBlocksControl?.setValidators([economicBlocksValidator]);
        regionsControl?.clearValidators();
        countriesControl?.clearValidators();
        
        economicBlocksControl?.updateValueAndValidity();
        regionsControl?.updateValueAndValidity();
        countriesControl?.updateValueAndValidity();
        
        this.updateParentModel({ 
          regions: [], 
          countries: [],
          economic_blocs: economicBlocksControl?.value 
        }, this.checkForm());
      }
    });

    // Set initial validators based on current target market
    const currentTargetMarket = this.form.get('targetMarket')?.value;
    if (currentTargetMarket === '1') {
      regionsControl?.setValidators([regionsCountriesValidator]);
    } else if (currentTargetMarket === '2') {
      economicBlocksControl?.setValidators([economicBlocksValidator]);
    }

    // Update validity of all controls
    regionsControl?.updateValueAndValidity();
    countriesControl?.updateValueAndValidity();
    economicBlocksControl?.updateValueAndValidity();

    const topicIdControl = this.form.get('topicId');
    const customTopicControl = this.form.get('customTopic');

    topicIdControl?.valueChanges.subscribe(value => {
      if (value === 'other') {
        customTopicControl?.setValidators([
          Validators.required,
          this.duplicateTopicValidator()
        ]);
      } else {
        customTopicControl?.clearValidators();
      }
      customTopicControl?.updateValueAndValidity();
    });

    if (this.defaultValues.industry) {
      this.selectedIndustryId = this.defaultValues.industry;
    }
    if (this.defaultValues.isic_code) {
      this.selectedIsicId = this.defaultValues.isic_code;
    }

    const formChangesSubscr = this.form.valueChanges.subscribe((val) => {
      this.updateParentModel(val, this.checkForm());
    });
    this.unsubscribe.push(formChangesSubscr);
  }

  // Custom Validator Function
  private duplicateTopicValidator(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      if (!control.value) {
        return null;
      }
      const enteredTopic = control.value.trim().toLowerCase();
      const exists = this.topicNames.includes(enteredTopic);
      return exists ? { duplicateTopic: true } : null;
    };
  }

  checkForm() {
    const targetMarket = this.form.get('targetMarket')?.value;
    const regions = this.form.get('regions')?.value || [];
    const countries = this.form.get('countries')?.value || [];
    const economicBlocks = this.form.get('economicBlocks')?.value || [];

    // Check target market specific validation
    let targetMarketValid = false;
    if (targetMarket === '1') {
      targetMarketValid = regions.length > 0 || countries.length > 0;
    } else if (targetMarket === '2') {
      // Consider both form control value and defaultValues.economic_bloc
      targetMarketValid = economicBlocks.length > 0 || (this.defaultValues.economic_bloc?.length || 0) > 0;
    }

    // Check all other form controls
    const otherControlsValid = Object.keys(this.form.controls)
      .filter(key => !['regions', 'countries', 'economicBlocks'].includes(key))
      .every(key => !this.form.get(key)?.errors);

    return targetMarketValid && otherControlsValid;
  }

  onIndustrySelected(node: TreeNode) {
    this.form.get('industry')?.setValue(node.data.key);
    this.selectedIndustryId = node.data.key;
    if (node.data && node.data.key) {
      this.getTopics(node.data.key);
    }
  }

  private getTopics(industryId: number) {
    this.topicService.getTopicsByIndustry(industryId).subscribe({
      next: (data: Topic[]) => {
        this.topics = [...data, { id: 'other', name: 'Other' }];
        // Store trimmed and lowercased topic names for validation
        this.topicNames = data.map(topic => topic.name.trim().toLowerCase());
        this.selectedTopic = null;
        if (this.selectedIndustryId && this.defaultValues.topicId) {
          this.form.get('topicId')?.setValue(this.defaultValues.topicId);
        } else {
          this.form.get('topicId')?.reset();
        }
      },
      error: (error) => {
        console.error('Error fetching topics:', error);
      }
    });
  }

  onTopicSelected(topicId: any) {
    const customTopicControl = this.form.get('customTopic');

    if (topicId === 'other') {
      // If "Other" is selected, validate the custom topic input
      if (customTopicControl?.value) {
        const enteredTopic = customTopicControl.value.trim().toLowerCase();
        if (this.topicNames.includes(enteredTopic)) {
          customTopicControl.setErrors({ duplicateTopic: true });
          return;
        }
      }
    }

    this.form.get('topicId')?.setValue(topicId);
    this.updateParentModel({ topicId: topicId }, this.checkForm());
  }

  onEconomicBlocksSelected(blocks: EconomicBloc[]) {
    const selectedBlocks = blocks.map(block => block.id);
    this.form.get('economicBlocks')?.setValue(selectedBlocks);
    // Force validation check
    this.form.get('economicBlocks')?.updateValueAndValidity();
    this.updateParentModel({ economic_blocs: selectedBlocks }, this.checkForm());
  }

  onRegionsSelected(regions: any) {
    console.log("regions", regions);
    
    const regionsControl = this.form.get('regions');
    const countriesControl = this.form.get('countries');
    
    // Update form controls
    regionsControl?.setValue(regions.regions);
    countriesControl?.setValue(regions.countries);
    
    // Force validation check
    regionsControl?.markAsTouched();
    countriesControl?.markAsTouched();
    regionsControl?.updateValueAndValidity();
    countriesControl?.updateValueAndValidity();
    
    // Consolidate parent model updates
    this.updateParentModel(
      { 
        regions: regions.regions, 
        countries: regions.countries 
      }, 
      this.checkForm()
    );
  }

  onIsicCodeSelected(node: any) {
    console.log("ISIC", node);
    this.selectedIsicId = node.data.key;
    this.form.get('isic_code')?.setValue(node.data.key);
    this.updateParentModel({ isic_code: node.data.key }, this.checkForm());
  }

  onHSCodeSelected(node: any) {
    console.log("HS Code", node);
    this.form.get('hs_code')?.setValue(node.id);
    this.updateParentModel({ hs_code: node.id }, this.checkForm());
  }

  // Add getter for economic bloc IDs
  get selectedEconomicBlocIds(): string[] {
    return this.defaultValues.economic_bloc 
      ? this.defaultValues.economic_bloc.map((block:any) => block.id) 
      : [];
  }
}
