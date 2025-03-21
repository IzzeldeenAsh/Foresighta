import { Component, Injector, Input, OnInit, ViewChild, ChangeDetectorRef } from '@angular/core';
import { FormBuilder, FormGroup, Validators, AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';
import { Subscription, forkJoin, of, delay, finalize } from 'rxjs';
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
import { TagsService } from 'src/app/_fake/services/tags/tags.service';
import { KnowledgeService } from 'src/app/_fake/services/knowledge/knowledge.service';
import { AddInsightStepsService, DocumentParserResponse } from 'src/app/_fake/services/add-insight-steps/add-insight-steps.service';

interface Chip {
  id: number;
  label: string;
  selected: boolean;
}

interface KeywordItem {
  display: string;
  value: string;
}

@Component({
  selector: 'app-step4',
  templateUrl: './step4.component.html',
  styleUrls: ['./step4.component.scss'],
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
export class Step4Component extends BaseComponent implements OnInit {
  @Input('updateParentModel') updateParentModel: (
    part: Partial<ICreateKnowldege>,
    isFormValid: boolean
  ) => void;
  
  @Input() defaultValues: Partial<ICreateKnowldege>;
  
  form: FormGroup;
  isLoading = false;
  
  // Language related properties
  languages: Language[] = [];
  currentLang: string = 'en';
  
  // Industry related properties
  industryNodes: TreeNode[] = [];
  selectedIndustryId: number = 0;
  
  // Topic related properties
  topics: any[] = [];
  selectedTopic: Topic | null = null;
  private topicNames: string[] = [];
  
  // Target market properties
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
  
  // ISIC and HS code properties
  isicCodeNodes: TreeNode[] = [];
  hsCodeNodes: TreeNode[] = [];
  selectedIsicId: number = 0;
  
  // Tags related properties
  tags: { id: number; name: string }[] = [];
  chips: Chip[] = [];
  customTagForm: FormGroup;
  isAddingCustomTag: boolean = false;
  
  // Keywords related properties
  availableKeywords: KeywordItem[] = [];

  @ViewChild('regionSelector') regionSelector: any;
  @ViewChild('economicBlockSelector') economicBlockSelector: any;

  isDescriptionLoading = false;
  aiAbstractError = false;

  constructor(
    injector: Injector,
    private fb: FormBuilder,
    public languagesService: LanguagesService,
    private topicService: TopicsService,
    private translationService: TranslationService,
    private industryService: IndustryService,
    private isicCodeService: IsicCodesService,
    private tagsService: TagsService,
    private knowledgeService: KnowledgeService,
    private addInsightStepsService: AddInsightStepsService,
    private cdr: ChangeDetectorRef
  ) {
    super(injector);
    this.currentLang = this.translationService.getSelectedLanguage();
  }

  ngOnInit() {
    this.initForms();
    
    if (this.defaultValues.industry) {
      this.selectedIndustryId = this.defaultValues.industry;
      this.getTopics(this.defaultValues.industry);
    }
    
    if (this.defaultValues.knowledgeId) {
      this.fetchKnowledgeData(this.defaultValues.knowledgeId);
    }
    
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
    
    // Auto-generate description if empty and knowledge ID exists
    if (this.defaultValues.knowledgeId && (!this.form.get('description')?.value || !this.form.get('description')?.value?.trim())) {
      // Wait a short delay before triggering to allow form to fully initialize
      setTimeout(() => {
        this.generateAIDescription();
      }, 500);
    }
  }
  
  private initForms() {
    // Initialize main form
    this.form = this.fb.group({
      title: [this.defaultValues.title, [Validators.required]],
      description: [this.defaultValues.description, [Validators.required]],
      language: [this.defaultValues.language, [Validators.required]],
      industry: [this.defaultValues.industry, [Validators.required]],
      topicId: [this.defaultValues.topicId, [Validators.required]],
      customTopic: [this.defaultValues.customTopic],
      targetMarket: [this.defaultValues.targetMarket || '1', [Validators.required]],
      economicBlocks: [this.defaultValues.economic_blocs || []],
      regions: [this.defaultValues.regions || []],
      countries: [this.defaultValues.countries || []],
      isic_code: [this.defaultValues.isic_code],
      hs_code: [this.defaultValues.hs_code],
      tag_ids: [this.defaultValues.tag_ids || []],
      keywords: [this.defaultValues.keywords || []]
    });
    
    // Initialize custom tag form
    this.customTagForm = this.fb.group({
      name: ['', Validators.required]
    });
    
    // Setup form change subscription
    const formChangesSubscr = this.form.valueChanges.subscribe((val) => {
      this.updateParentModel(val, this.checkForm());
    });
    this.unsubscribe.push(formChangesSubscr);
    
    // Setup conditional validators
    this.setupConditionalValidators();
    
    // Set initial values
    if (this.defaultValues.industry) {
      this.selectedIndustryId = this.defaultValues.industry;
    }
    if (this.defaultValues.isic_code) {
      this.selectedIsicId = this.defaultValues.isic_code;
    }
  }
  
  private setupConditionalValidators() {
    const regionsControl = this.form.get('regions');
    const countriesControl = this.form.get('countries');
    const economicBlocksControl = this.form.get('economicBlocks');
    const topicIdControl = this.form.get('topicId');
    const customTopicControl = this.form.get('customTopic');
    
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
    
    // Setup target market change listener
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
        
        // Open region dialog with a slight delay to ensure component is rendered
        setTimeout(() => {
          if (this.regionSelector && (!regionsControl?.value?.length && !countriesControl?.value?.length)) {
            this.regionSelector.showDialog();
          }
        }, 100);
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
        
        // Open economic blocks dialog with a slight delay to ensure component is rendered
        setTimeout(() => {
          if (this.economicBlockSelector && (!economicBlocksControl?.value?.length)) {
            this.economicBlockSelector.showDialog();
          }
        }, 100);
      }
    });
    
    // Set initial validators based on current target market
    const currentTargetMarket = this.form.get('targetMarket')?.value;
    if (currentTargetMarket === '1') {
      regionsControl?.setValidators([regionsCountriesValidator]);
    } else if (currentTargetMarket === '2') {
      economicBlocksControl?.setValidators([economicBlocksValidator]);
    }
    
    // Topic ID change listener for custom topic
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
    
    // Update validity of all controls
    regionsControl?.updateValueAndValidity();
    countriesControl?.updateValueAndValidity();
    economicBlocksControl?.updateValueAndValidity();
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
        this.fetchTags();
      },
      error: (error) => {
        console.error('Error loading data:', error);
        this.isLoading = false;
      },
      complete: () => {
        this.isLoading = false;
      }
    });
    this.unsubscribe.push(dataSub);
  }
  
  private fetchKnowledgeData(knowledgeId: number) {
    this.knowledgeService.getKnowledgeById(knowledgeId).subscribe({
      next: (response) => {
        const knowledge = response.data;
        
        if (knowledge.tags) {
          this.defaultValues.tag_ids = knowledge.tags.map(tag => tag.id);
        }
        if (knowledge.keywords) {
          // Convert string keywords to KeywordItem format
          this.defaultValues.keywords = knowledge.keywords.map(keyword => ({
            display: keyword,
            value: keyword
          }));
        }
        
        // Update form controls
        this.form.get('tag_ids')?.setValue(this.defaultValues.tag_ids || []);
        this.form.get('keywords')?.setValue(this.defaultValues.keywords || []);
        
        this.cdr.detectChanges();
        // Initialize tags if topic is selected
        const topicId = this.form.get('topicId')?.value;
        if (topicId && topicId !== 'other') {
          this.fetchTagsByTopic(topicId);
          this.fetchSuggestedKeywordsByTopic(topicId);
        }
      },
      error: (error) => {
        console.error("Error fetching knowledge data:", error);
      },
    });
  }
  
  // Form validation
  checkForm() {
    const targetMarket = this.form.get('targetMarket')?.value;
    const regions = this.form.get('regions')?.value || [];
    const countries = this.form.get('countries')?.value || [];
    const economicBlocks = this.form.get('economicBlocks')?.value || [];
    const keywords = this.form.get('keywords')?.value || [];
    
    // Check target market specific validation
    let targetMarketValid = false;
    if (targetMarket === '1') {
      targetMarketValid = regions.length > 0 || countries.length > 0;
    } else if (targetMarket === '2') {
      targetMarketValid = economicBlocks.length > 0 || (this.defaultValues.economic_bloc?.length || 0) > 0;
    }
    
    // Check all other form controls and keyword requirement
    const otherControlsValid = Object.keys(this.form.controls)
      .filter(key => !['regions', 'countries', 'economicBlocks', 'keywords'].includes(key))
      .every(key => !this.form.get(key)?.errors);
    
    return targetMarketValid && otherControlsValid && keywords.length > 0;
  }
  
  // Custom Validator for Topic
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
  
  // Industry related methods
  onIndustrySelected(node: TreeNode) {
    this.form.get('industry')?.setValue(node.data.key);
    this.selectedIndustryId = node.data.key;
    if (node.data && node.data.key) {
      this.getTopics(node.data.key);
      // Clear tags and keywords when industry changes
      this.clearTagsAndKeywords();
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
    
    // Clear existing tags and keywords
    this.clearTagsAndKeywords();
    
    // Fetch tags and keywords based on the new topic
    if (topicId && topicId !== 'other') {
      this.fetchTagsByTopic(topicId);
      this.fetchSuggestedKeywordsByTopic(topicId);
    }
    
    this.updateParentModel({ topicId: topicId }, this.checkForm());
  }
  
  // Target market related methods
  onRegionsSelected(regions: any) {
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
  
  onEconomicBlocksSelected(blocks: EconomicBloc[]) {
    const selectedBlocks = blocks.map(block => block.id);
    this.form.get('economicBlocks')?.setValue(selectedBlocks);
    // Force validation check
    this.form.get('economicBlocks')?.updateValueAndValidity();
    this.updateParentModel({ economic_blocs: selectedBlocks }, this.checkForm());
  }
  
  // ISIC and HS code methods
  onIsicCodeSelected(node: any) {
    this.selectedIsicId = node.data.key;
    this.form.get('isic_code')?.setValue(node.data.key);
    this.updateParentModel({ isic_code: node.data.key }, this.checkForm());
  }
  
  onHSCodeSelected(node: any) {
    this.form.get('hs_code')?.setValue(node.id);
    this.updateParentModel({ hs_code: node.id }, this.checkForm());
  }
  
  // Tags related methods
  private fetchTags() {
    // Only fetch tags if a topic is selected
    const topicId = this.form.get('topicId')?.value;
    if (this.defaultValues.industry && topicId && topicId !== 'other') {
      this.fetchTagsByTopic(topicId);
    }
  }
  
  private fetchTagsByTopic(topicId: number | string) {
    if (!this.defaultValues.industry) return;
    
    // Call the new topic-specific method in TagsService
    this.tagsService
      .getTagsByTopic(this.defaultValues.industry, topicId, this.currentLanguage)
      .subscribe({
        next: (tags: { id: number; name: string }[]) => {
          this.tags = tags;
          this.chips = this.tags.map((tag) => ({
            id: tag.id,
            label: tag.name,
            selected: this.defaultValues.tag_ids?.includes(tag.id) || false,
          }));
          this.updateParentModel({ tag_ids: this.defaultValues.tag_ids }, this.checkForm());
        },
        error: (error: any) => {
          console.error("Error fetching tags by topic:", error);
        },
      });
  }
  
  toggleSelection(chip: Chip): void {
    chip.selected = !chip.selected;
    const selectedTagIds = this.chips
      .filter((c) => c.selected)
      .map((c) => c.id);

    this.form.patchValue({ tag_ids: selectedTagIds });
    this.updateParentModel({ tag_ids: selectedTagIds }, this.checkForm());
  }
  
  selectAll(): void {
    this.chips.forEach((chip) => (chip.selected = true));
    const selectedTagIds = this.chips.map((chip) => chip.id);

    this.form.patchValue({ tag_ids: selectedTagIds });
    this.updateParentModel({ tag_ids: selectedTagIds }, this.checkForm());
  }
  
  clearAll(): void {
    this.chips.forEach((chip) => (chip.selected = false));

    this.form.patchValue({ tag_ids: [] });
    this.updateParentModel({ tag_ids: [] }, this.checkForm());
  }
  
  openAddCustomTag() {
    this.isAddingCustomTag = true;
  }
  
  closeAddCustomTag() {
    this.isAddingCustomTag = false;
    this.customTagForm.reset();
  }
  
  submitCustomTag() {
    if (this.customTagForm.invalid || !this.defaultValues.industry) {
      this.customTagForm.markAllAsTouched();
      return;
    }

    const tagName = this.customTagForm.value.name.trim();
    const tagRequest = {
      industry_id: this.defaultValues.industry,
      name: {
        en: tagName,
        ar: tagName,
      },
    } as const;

    this.tagsService.createSuggestTag(tagRequest).subscribe({
      next: (response) => {
        const newTagId = response.data.tag_id;
        this.closeAddCustomTag();
        this.fetchTagsAndSelectNewTag(newTagId);
      },
      error: (error) => {
       this.handleServerErrors(error);
      },
    });
  }
  
  private fetchTagsAndSelectNewTag(newTagId: number) {
    if (!this.defaultValues.industry) return;

    this.tagsService.getTagsByIndustry(this.defaultValues.industry, this.currentLanguage).subscribe({
      next: (tags) => {
        this.tags = tags;
        this.chips = this.tags.map((tag) => ({
          id: tag.id,
          label: tag.name,
          selected: tag.id === newTagId || (this.defaultValues.tag_ids?.includes(tag.id) ?? false),
        }));
        const selectedTagIds = this.chips
          .filter((c) => c.selected)
          .map((c) => c.id);

        this.form.patchValue({ tag_ids: selectedTagIds });
        this.updateParentModel({ tag_ids: selectedTagIds }, this.checkForm());
      },
      error: (error) => {
        this.handleServerErrors(error);
        },
    });
  }
  
  // Keywords related methods
  private fetchSuggestedKeywords() {
    const topicId = this.form.get('topicId')?.value;
    if (this.defaultValues.knowledgeId && topicId && topicId !== 'other') {
      this.fetchSuggestedKeywordsByTopic(topicId);
    }
  }
  
  private fetchSuggestedKeywordsByTopic(topicId: number | string) {
    if (!this.defaultValues.knowledgeId) return;

    // Call the new method in TagsService
    this.tagsService.getSuggestKeywordsByTopic(this.defaultValues.knowledgeId!, topicId, this.currentLanguage)
      .subscribe({
        next: (keywords: string[]) => {
          // Convert suggested keywords to KeywordItem format
          this.availableKeywords = keywords.map((keyword: string) => ({
            display: keyword,
            value: keyword
          }));
        },
        error: (error: any) => {
          console.error("Error fetching suggested keywords:", error);
          this.handleServerErrors(error);
        }
      });
  }
  
  addKeyword(event: any) {
    const value = typeof event.value === 'string' ? event.value : event.value?.value;
    if (!value?.trim()) return;

    // Create keyword item
    const newKeyword: KeywordItem = {
      display: value.trim(),
      value: value.trim()
    };

    // Get current keywords
    const currentKeywords: KeywordItem[] = this.form.get('keywords')?.value || [];

    // Check if keyword already exists
    if (!currentKeywords.some(k => k.value === newKeyword.value)) {
      const updatedKeywords = [...currentKeywords, newKeyword];
      
      // Update form
      this.form.get('keywords')?.setValue(updatedKeywords);
      
      // Update parent
      this.updateParentModel(
        { keywords: updatedKeywords },
        this.checkForm()
      );
    }
  }
  
  removeKeyword(event: any) {
    const removedKeyword = event.removed;
    if (!removedKeyword) return;

    const currentKeywords: KeywordItem[] = this.form.get('keywords')?.value || [];
    
    // Remove the keyword
    const updatedKeywords = currentKeywords.filter(keyword => 
      keyword.value !== (typeof removedKeyword === 'string' ? removedKeyword : removedKeyword.value)
    );

    // Update form
    this.form.get('keywords')?.setValue(updatedKeywords);
    
    // Update parent
    this.updateParentModel(
      { keywords: updatedKeywords },
      this.checkForm()
    );
  }
  
  // Helper methods
  private handleServerErrors(error: any) {
    if (error.error && error.error.errors) {
      const serverErrors = error.error.errors;
      for (const key in serverErrors) {
        if (serverErrors.hasOwnProperty(key)) {
          const messages = serverErrors[key];
          this.showError('', messages.join(", "));
        }
      }
    } else {
      this.showError('', 'An unexpected error occurred.');
    }
  }
  
  // Getter for economic bloc IDs
  get selectedEconomicBlocIds(): string[] {
    return this.defaultValues.economic_bloc 
      ? this.defaultValues.economic_bloc.map((block: any) => block.id) 
      : [];
  }
  
  // Getter for language
  get currentLanguage(): string {
    return this.currentLang;
  }
  
  // Clear tags and keywords
  private clearTagsAndKeywords() {
    this.chips = [];
    this.tags = [];
    this.availableKeywords = [];
    this.form.get('tag_ids')?.setValue([]);
    this.form.get('keywords')?.setValue([]);
    this.updateParentModel({ 
      tag_ids: [], 
      keywords: [] 
    }, this.checkForm());
  }

  // Function to handle Generate AI Description button click
  generateAIDescription(): void {
    // Only proceed if we have a knowledge ID and description is empty or not filled
    if (!this.defaultValues.knowledgeId || this.form.get('description')?.value?.trim()) {
      return;
    }

    this.isDescriptionLoading = true;
    this.aiAbstractError = false;
    
    // Set maximum time to show loader (15 seconds)
    const maxWaitTime = 15000;
    const pollingInterval = 2000; // Check every 2 seconds
    let elapsedTime = 0;
    let polling: any;
    
    // Start polling
    polling = setInterval(() => {
      elapsedTime += pollingInterval;
      
      // Call the fetchKnowledgeDescription method to check for summary
      this.fetchKnowledgeDescription(polling);
      
      // Stop polling if we've reached the max time
      if (elapsedTime >= maxWaitTime) {
        clearInterval(polling);
        
        // Ensure loading state is turned off after max time
        if (this.isDescriptionLoading) {
          this.isDescriptionLoading = false;
          this.cdr.detectChanges();
        }
      }
    }, pollingInterval);
  }

  // Fetch knowledge description from AI parser API
  fetchKnowledgeDescription(pollingIntervalId?: any): void {
    // Loading state is already set to true when this is called
    if (!this.defaultValues.knowledgeId) {
      this.isDescriptionLoading = false;
      return;
    }
    
    const summarySubscription = this.addInsightStepsService.getKnowledgeParserData(this.defaultValues.knowledgeId)
      .subscribe({
        next: (response: DocumentParserResponse) => {
          if (response.data) {
            // Extract data from response
            const data = response.data;
            
            // Handle both string format and object format
            if (typeof data === 'string') {
              // If data is a string, it's just the summary
              this.form.get('description')?.setValue(data);
              this.form.get('description')?.markAsTouched();
            } else {
              // Handle object format with multiple fields
              // Update description if available
              if (data.summary) {
                this.form.get('description')?.setValue(data.summary);
                this.form.get('description')?.markAsTouched();
              }
              
              // Update title if available from metadata
              if (data.metadata && data.metadata.title) {
                this.form.get('title')?.setValue(data.metadata.title);
                this.form.get('title')?.markAsTouched();
              }
              
              // Try to determine language (this might need customization based on actual API response)
              // Since Language interface doesn't have code, we'll rely on name comparison
              const languageName = this.determineLanguageFromMetadata(data);
              if (languageName) {
                const matchedLanguage = this.languages.find(lang => 
                  lang.name.toLowerCase() === languageName.toLowerCase()
                );
                
                if (matchedLanguage) {
                  this.form.get('language')?.setValue(matchedLanguage.id);
                  this.form.get('language')?.markAsTouched();
                }
              }
            }
            
            // Update parent model with all form values
            this.updateParentModel(this.form.value, this.checkForm());
            this.aiAbstractError = false;
            
            // Clear polling interval if we have valid data
            if (pollingIntervalId) {
              clearInterval(pollingIntervalId);
            }
            
            // Turn off loading
            this.isDescriptionLoading = false;
          } else {
            // No data returned from AI parser
            // Don't set error yet - continue polling until timeout
            console.error('No data returned from AI parser');
          }
          
          // Only update UI state and turn off loading if this was the final request
          if (!pollingIntervalId) {
            this.isDescriptionLoading = false;
            this.aiAbstractError = true;
            this.cdr.detectChanges();
          }
        },
        error: (error) => {
          console.error(`Error getting knowledge description:`, error);
          
          // Only update UI state and turn off loading if this was the final request
          if (!pollingIntervalId) {
            this.isDescriptionLoading = false;
            this.aiAbstractError = true;
            this.cdr.detectChanges();
          }
        }
      });
    
    this.unsubscribe.push(summarySubscription);
  }
  
  // Helper method to determine language from metadata
  private determineLanguageFromMetadata(data: any): string | null {
    // Try to determine language from metadata or other fields
    // This is a placeholder - adjust according to the actual API response structure
    
    // Check if metadata.subject or description contains language info
    if (data.metadata && data.metadata.subject && data.metadata.subject.toLowerCase().includes('language:')) {
      const match = data.metadata.subject.match(/language:\s*(\w+)/i);
      if (match && match[1]) {
        return match[1];
      }
    }
    
    // Default to English or current language if no language info found
    return this.currentLang === 'en' ? 'English' : 'Arabic';
  }
} 