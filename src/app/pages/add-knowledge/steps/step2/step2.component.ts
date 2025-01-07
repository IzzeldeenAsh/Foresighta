import { Component, Injector, Input, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
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
  languages: Language[] = [];
  currentLang: string = 'en';
  industryNodes: TreeNode[] = [];
  isLoading = false;
  topics: any[] = [];
  selectedTopic: Topic | null = null;
  marketOptions = [
    {
      label: 'Economic Block',
      value: '1',
      icon: 'ki-duotone ki-chart fs-1',
      description: 'Group of countries that share similar economic characteristics.'
    },
    {
      label: 'Region',
      value: '2',
      icon: 'ki-duotone ki-globe fs-1', // Changed to a globe icon for regions
      description: 'Group of countries that share similar cultural and social characteristics.'
    }
  ];
  isicCodeNodes: TreeNode[] = [];
  hsCodeNodes: TreeNode[] = [];
  selectedIsicId: number = 0;
  selectedIndustryId: number = 0;
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
      economicBlocks: [this.defaultValues.economic_block],
      regions: [this.defaultValues.regions],
      countries: [this.defaultValues.countries],
      topicId: [this.defaultValues.topicId, [Validators.required]],
      customTopic: [this.defaultValues.customTopic],
      isic_code: [this.defaultValues.isic_code],
      hs_code: [this.defaultValues.hs_code],
    });

    // Update initial validation based on default values
    const targetMarketControl = this.form.get('targetMarket');
    if (this.defaultValues.targetMarket === '1') {
      this.form.get('economicBlocks')?.setValidators([Validators.required]);
    } else if (this.defaultValues.targetMarket === '2') {
      this.form.get('regions')?.setValidators([Validators.required]);
    }

    targetMarketControl?.valueChanges.subscribe(value => {
      const economicBlocksControl = this.form.get('economicBlocks');
      const regionsControl = this.form.get('regions');
      
      if (value === '1') {
        economicBlocksControl?.setValidators([Validators.required]);
        economicBlocksControl?.updateValueAndValidity();
        regionsControl?.clearValidators();
        regionsControl?.updateValueAndValidity();
      } else if (value === '2') {
        regionsControl?.setValidators([Validators.required]);
        regionsControl?.updateValueAndValidity();
        economicBlocksControl?.clearValidators();
        economicBlocksControl?.updateValueAndValidity();
      }
    });

    const topicIdControl = this.form.get('topicId');

    topicIdControl?.valueChanges.subscribe(value => {
      const customTopicControl = this.form.get('customTopic');
      
      if (value === 'other') {
        customTopicControl?.setValidators([Validators.required]);
      } else {
        customTopicControl?.clearValidators();
      }
      
      customTopicControl?.updateValueAndValidity();
    });

    if(this.defaultValues.industry){
      this.selectedIndustryId = this.defaultValues.industry;
    }
    if(this.defaultValues.isic_code){
      this.selectedIsicId = this.defaultValues.isic_code;
    }

    const formChangesSubscr = this.form.valueChanges.subscribe((val) => {
      this.updateParentModel(val, this.checkForm());
    });
    this.unsubscribe.push(formChangesSubscr);
  }

  checkForm() {
    return this.form.valid;
  }

  onIndustrySelected(node: TreeNode) {
    this.form.get('industry')?.setValue(node.data.key);
    this.selectedIndustryId = node.data.key;
    if (node.data && node.data.key) {
      const industryId = node.data.key;
      this.topicService.getTopicsByIndustry(industryId).subscribe({
        next: (data: Topic[]) => {
          this.topics = [...data, { id: 'other', name: 'Other' }];
          this.selectedTopic = null;
          this.form.get('topicId')?.reset();
        },
        error: (error) => {
          console.error('Error fetching topics:', error);
        }
      });
    }   
  }
  onTopicSelected(topicId: any) {
    console.log("topicId", topicId);
    this.form.get('topicId')?.setValue(topicId);
    this.updateParentModel({topicId: topicId}, this.checkForm());
  }
  onEconomicBlocksSelected(blocks: EconomicBloc[]) {
    const selectedBlocks = blocks.map(block => block.id);
    this.form.get('economicBlocks')?.setValue(selectedBlocks);
    // Force validation check
    this.form.get('economicBlocks')?.updateValueAndValidity();
    this.updateParentModel({economic_block: selectedBlocks}, this.checkForm());
  }
  onRegionsSelected(regions: any) {
    console.log("regions", regions);
    if(regions.regions.length > 0){
      this.form.get('regions')?.setValue(regions.regions);
      this.updateParentModel({regions: regions.regions}, this.checkForm());
    }
    if(regions.countries.length > 0){
      this.form.get('countries')?.setValue(regions.countries);
      this.updateParentModel({countries: regions.countries}, this.checkForm());
    }
  }
  onIsicCodeSelected(node: any) {
    console.log("ISIC", node);
    this.selectedIsicId = node.data.key;
    this.form.get('isic_code')?.setValue(node.data.key);
    this.updateParentModel({isic_code: node.data.key}, this.checkForm());
  }

  onHSCodeSelected(node: any) {
    console.log("HS Code", node);
    this.form.get('hs_code')?.setValue(node.id);
    this.updateParentModel({hs_code: node.id}, this.checkForm());
  }

  
}
