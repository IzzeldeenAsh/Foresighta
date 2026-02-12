import { Component, Injector, Input, OnInit, OnDestroy, ViewChild, ChangeDetectorRef, ElementRef } from '@angular/core';
import { FormBuilder, FormGroup, Validators, AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';
import { Subscription, forkJoin, of, delay, finalize, interval, timer, takeWhile, takeUntil, Subject, debounceTime, filter } from 'rxjs';
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
import { Dropdown } from 'primeng/dropdown';
import { KnowledgeService } from 'src/app/_fake/services/knowledge/knowledge.service';
import { AddInsightStepsService } from 'src/app/_fake/services/add-insight-steps/add-insight-steps.service';
import { RegionsService } from 'src/app/_fake/services/region/regions.service';
import { normalizeSearchText } from 'src/app/utils/search-normalize';

interface TagItem {
  display: string;
  value: string;
  id: number;
  normalizedDisplay?: string;
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
export class Step4Component extends BaseComponent implements OnInit, OnDestroy {
  @Input('updateParentModel') updateParentModel: (
    part: Partial<ICreateKnowldege>,
    isFormValid: boolean
  ) => void;
  
  @Input() defaultValues: Partial<ICreateKnowldege>;
  
  // Flag to determine if we're in edit mode
  isEditMode = false;
  
  form: FormGroup;
  isLoading = false;
  isDescriptionLoading = false;
  isLanguageLoading = false;

  // Combined loading state for easier template binding
  get isLanguageFieldLoading(): boolean {
    return this.isLanguageLoading || this.isDescriptionLoading;
  }
  
  // Language related properties
  languages: Language[] = [];
  currentLang: string = 'en';
  languageChipIds: { ar: string | null; en: string | null } = { ar: null, en: null };
  private pendingParsedLanguage: string | null = null;
  
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
  
  // ISIC and Products properties
  isicCodeNodes: TreeNode[] = [];
  hsCodeNodes: TreeNode[] = [];
  selectedIsicId: number = 0;
  
  // Tags related properties
  tags: { id: number; name: string }[] = [];
  availableTags: TagItem[] = [];
  tagIdError: string = '';
  selectedTagItems: TagItem[] = [];
  selectedTagIds: number[] = [];
  selectedTagForAdding: number | null = null;
  newTagName: string = '';
  showAllTags = false;
  private readonly tagsPreviewLimit = 17;

  get displayedTags(): TagItem[] {
    return this.showAllTags ? this.availableTags : this.availableTags.slice(0, this.tagsPreviewLimit);
  }

  @ViewChild('regionSelector') regionSelector: any;
  @ViewChild('economicBlockSelector') economicBlockSelector: any;
  @ViewChild('topicDropdown') topicDropdown?: Dropdown;

  aiAbstractError = false;

  // Animation control properties
  typingSpeed = 10; // ms per character
  animationTimers: any;
  animatedAbstract = false;
  animatedAbstractText = '';
  animatedAbstractComplete = false;
  showEditor = false;
  private stopPolling$ = new Subject<void>();

  dropdownOverlaysOpen = 0;
  get isDropdownBackdropVisible(): boolean {
    return this.dropdownOverlaysOpen > 0;
  }

  // Add tracking for AI-generated fields
  aiGeneratedFields: Record<string, boolean> = {
    title: false,
    description: false,
    industry: false,
    language: false
  };

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
    private cdr: ChangeDetectorRef,
    private regionsService: RegionsService,
    private elRef: ElementRef
  ) {
    super(injector);
  }

  ngOnInit(): void {
    this.currentLang = this.translationService.getSelectedLanguage();
    
    // Initialize form
    this.initForms();
    
    // Set up field change listeners
    this.setupFieldChangeListeners();
    
    // Set up conditional validators
    this.setupConditionalValidators();
    
    // Load initial data
    this.loadData();
    
    // Check if worldwide is initially selected and update regions
    if (this.isWorldwide()) {
      this.updateForWorldwide();
    }
    
    // Fetch industry nodes
    this.industryService.getIndustryList().subscribe({
      next: (response: any) => {
        this.industryNodes = response;
      }
    });
    
    // Set edit mode flag if we have a knowledge ID AND existing content (like title/description)
    // This distinguishes between editing an existing document vs a newly uploaded document with an ID
    this.isEditMode = !!this.defaultValues.knowledgeId && 
                     (!!this.defaultValues.title || !!this.defaultValues.description);
    
    if (this.defaultValues.industry) {
      this.selectedIndustryId = this.defaultValues.industry;
      this.getTopics(this.defaultValues.industry);
      this.fetchTagsByIndustry(this.defaultValues.industry);
    }
    
    if (this.defaultValues.knowledgeId) {
      this.fetchKnowledgeData(this.defaultValues.knowledgeId);
      // Only generate AI information when not in edit mode
      if (!this.isEditMode) {
        this.generateAIInformation();
      } else {
        // In edit mode, simply show the editor
        this.showEditor = true;
      }
    }
    
    // Form value changes subscription is handled in initForms() with debouncing
    
    // Subscribe to language changes
    const langChangeSub = this.translationService.onLanguageChange().subscribe(lang => {
      if (lang) {
        this.currentLang = lang;
        this.loadData();
      }
    });
    this.unsubscribe.push(langChangeSub);
    
    // Subscribe to language service loading state
    const langLoadingSub = this.languagesService.isLoading$.subscribe(isLoading => {
      this.isLanguageLoading = isLoading;
    });
    this.unsubscribe.push(langLoadingSub);


  }

  ngOnDestroy(): void {
    this.elRef?.nativeElement?.ownerDocument?.body?.classList.remove('step4-dropdown-overlay-open');

    // Clean up AI generation polling
    if (this.stopPolling$) {
      this.stopPolling$.next();
      this.stopPolling$.complete();
    }

    // Clear any running timers
    if (this.animationTimers) {
      clearInterval(this.animationTimers);
    }

    // Call parent destroy
    super.ngOnDestroy();
  }

  onDropdownOverlayShow(): void {
    this.dropdownOverlaysOpen += 1;
    this.elRef?.nativeElement?.ownerDocument?.body?.classList.add('step4-dropdown-overlay-open');
  }

  onDropdownOverlayHide(): void {
    this.dropdownOverlaysOpen = Math.max(0, this.dropdownOverlaysOpen - 1);
    if (this.dropdownOverlaysOpen === 0) {
      this.elRef?.nativeElement?.ownerDocument?.body?.classList.remove('step4-dropdown-overlay-open');
    }
  }

  closeDropdownOverlays(): void {
    this.topicDropdown?.hide?.();
    this.dropdownOverlaysOpen = 0;
    this.elRef?.nativeElement?.ownerDocument?.body?.classList.remove('step4-dropdown-overlay-open');
  }

  private initForms() {
    // Initialize main form
    this.form = this.fb.group({
      title: [this.defaultValues.title, [Validators.required]],
      description: [this.defaultValues.description, [Validators.required]],
      cover_start: [this.defaultValues.cover_start],
      cover_end: [this.defaultValues.cover_end],
      cover_years: [{ startYear: this.defaultValues.cover_start || null, endYear: this.defaultValues.cover_end || null }],
      language: [this.defaultValues.language, [Validators.required]],
      industry: [this.defaultValues.industry, [Validators.required]],
      topicId: [this.defaultValues.topicId, [Validators.required]],
      customTopic: [this.defaultValues.customTopic],
      targetMarket: [this.defaultValues.targetMarket || '3', [Validators.required]],
      economicBlocks: [this.defaultValues.economic_blocs || []],
      regions: [this.defaultValues.regions || []],
      countries: [this.defaultValues.countries || []],
      isic_code: [this.defaultValues.isic_code],
      hs_code: [this.defaultValues.hs_code],
      tag_ids: [this.defaultValues.tag_ids || [], [Validators.required]],
      tagItems: [[]]  // For displaying selected tags in tag-input
    });
    
    // Ensure worldwide is selected by default if not set
    const initialTargetMarket = this.form.get('targetMarket')?.value;
    if (!initialTargetMarket) {
      this.form.get('targetMarket')?.setValue('3', { emitEvent: false });
      this.updateParentModel({ targetMarket: '3' }, this.checkForm());
    }
    
    // Setup form change subscription with debouncing
    const formChangesSubscr = this.form.valueChanges.pipe(
      debounceTime(100) // Wait 100ms after last change before processing
    ).subscribe((val) => {
      this.updateParentModel(val, this.checkForm());
    });
    this.unsubscribe.push(formChangesSubscr);

    // Setup cover years subscription to sync with start/end fields
    const coverYearsSubscr = this.form.get('cover_years')?.valueChanges.subscribe((yearRange) => {
      if (yearRange) {
        this.form.patchValue({
          cover_start: yearRange.startYear,
          cover_end: yearRange.endYear
        }, { emitEvent: false });
      } else {
        this.form.patchValue({
          cover_start: null,
          cover_end: null
        }, { emitEvent: false });
      }
    });
    if (coverYearsSubscr) {
      this.unsubscribe.push(coverYearsSubscr);
    }

    // Setup reverse sync from cover_start/end to cover_years
    const startEndSubscr = this.form.valueChanges.pipe(
      debounceTime(50),
      filter(val => val.cover_start !== undefined || val.cover_end !== undefined)
    ).subscribe((val) => {
      const currentCoverYears = this.form.get('cover_years')?.value;
      const newCoverYears = {
        startYear: val.cover_start || null,
        endYear: val.cover_end || null
      };

      // Only update if the values are different to avoid infinite loops
      if (!currentCoverYears ||
          currentCoverYears.startYear !== newCoverYears.startYear ||
          currentCoverYears.endYear !== newCoverYears.endYear) {
        this.form.get('cover_years')?.setValue(newCoverYears, { emitEvent: false });
      }
    });
    this.unsubscribe.push(startEndSubscr);
    
    // Setup conditional validators
    this.setupConditionalValidators();
    
    // Set initial values
    if (this.defaultValues.industry) {
      this.selectedIndustryId = this.defaultValues.industry;
    }
    if (this.defaultValues.isic_code) {
      this.selectedIsicId = this.defaultValues.isic_code;
    }
    if (this.defaultValues.tag_ids) {
      this.selectedTagIds = [...this.defaultValues.tag_ids];
    }

    // For worldwide target market, get all region IDs
    this.updateForWorldwide();
  }
  
  private setupConditionalValidators() {
    const regionsControl = this.form.get('regions');
    const countriesControl = this.form.get('countries');
    const economicBlocksControl = this.form.get('economicBlocks');
    const topicIdControl = this.form.get('topicId');
    const customTopicControl = this.form.get('customTopic');
    
    // Custom validator for regions/countries
    this.regionsCountriesValidator = () => {
      const targetMarket = this.form.get('targetMarket')?.value;
      if (targetMarket === '1' || targetMarket === '4') { // Regions or Countries selected
        const regionsValue = this.form.get('regions')?.value;
        const countriesValue = this.form.get('countries')?.value;
        
        const regionsSelected = regionsValue && regionsValue.length > 0;
        const countriesSelected = countriesValue && countriesValue.length > 0;
        
        return regionsSelected || countriesSelected ? null : { required: true };
      }
      return null;
    };
    
    // Custom validator for economic blocks
    this.economicBlocksValidator = () => {
      const blocks = this.form.get('economicBlocks')?.value || [];
      return blocks.length > 0 ? null : { required: true };
    };
    
    // Setup target market change listener
    this.form.get('targetMarket')?.valueChanges.subscribe(value => {
      // Reset target market default values to prevent interference
      this.resetTargetMarketDefaults();
      
      // Reset regions and countries values when target market changes
      regionsControl?.setValue([]);
      countriesControl?.setValue([]);

      if (value === '1') {
        regionsControl?.setValidators([this.regionsCountriesValidator]);
        countriesControl?.clearValidators();
        economicBlocksControl?.clearValidators();
        
        regionsControl?.updateValueAndValidity();
        countriesControl?.updateValueAndValidity();
        economicBlocksControl?.updateValueAndValidity();
        
        this.updateParentModel({ 
          economic_blocs: [],
          regions: [],
          countries: [] 
        }, this.checkForm());
        
        // Open region dialog with a slight delay to ensure component is rendered
        setTimeout(() => {
          if (this.regionSelector) {
            this.regionSelector.showDialog();
          }
        }, 100);
      } else if (value === '4') {
        // Countries only option
        countriesControl?.setValidators([this.regionsCountriesValidator]);
        regionsControl?.clearValidators();
        economicBlocksControl?.clearValidators();
        
        countriesControl?.updateValueAndValidity();
        regionsControl?.updateValueAndValidity();
        economicBlocksControl?.updateValueAndValidity();
        
        this.updateParentModel({ 
          economic_blocs: [],
          regions: [], 
          countries: [] 
        }, this.checkForm());
        
        // Open region dialog (countries tab) with a slight delay
        setTimeout(() => {
          if (this.regionSelector) {
            this.regionSelector.showDialog();
          }
        }, 100);
      } else if (value === '2') {
        economicBlocksControl?.setValidators([this.economicBlocksValidator]);
        regionsControl?.clearValidators();
        countriesControl?.clearValidators();
        
        economicBlocksControl?.updateValueAndValidity();
        regionsControl?.updateValueAndValidity();
        countriesControl?.updateValueAndValidity();
        
        // Reset economic blocks value
        economicBlocksControl?.setValue([]);
        
        this.updateParentModel({ 
          regions: [], 
          countries: [],
          economic_blocs: [] 
        }, this.checkForm());
        
        // Open economic blocks dialog with a slight delay to ensure component is rendered
        setTimeout(() => {
          if (this.economicBlockSelector) {
            this.economicBlockSelector.showDialog();
          }
        }, 100);
      } else if (value === '3') {
        // Worldwide option - clear all validators and data
        regionsControl?.clearValidators();
        countriesControl?.clearValidators();
        economicBlocksControl?.clearValidators();
        
        regionsControl?.updateValueAndValidity();
        countriesControl?.updateValueAndValidity();
        economicBlocksControl?.updateValueAndValidity();
        
        // Use the updateForWorldwide method to handle worldwide selection
        this.updateForWorldwide();
      }
    });
    
    // Set initial validators based on current target market
    const currentTargetMarket = this.form.get('targetMarket')?.value;
    if (currentTargetMarket === '1') {
      regionsControl?.setValidators([this.regionsCountriesValidator]);
    } else if (currentTargetMarket === '2') {
      economicBlocksControl?.setValidators([this.economicBlocksValidator]);
    }
    // If value is '3' (Worldwide), no validators are needed
    
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
        this.computeLanguageChipIds();
        this.applyPendingParsedLanguage();
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

  private computeLanguageChipIds(): void {
    this.languageChipIds = {
      ar: this.findLanguageId('ar'),
      en: this.findLanguageId('en'),
    };
  }

  private findLanguageId(target: 'ar' | 'en'): string | null {
    // Prefer direct ID matching if the API uses 'ar'/'en'
    const byId = this.languages.find((l) => (l?.id ?? '').toLowerCase() === target);
    if (byId?.id) return byId.id;

    // Fallback: match by localized name
    const patterns =
      target === 'ar'
        ? ['arabic', 'عربي', 'العربية', 'عربى']
        : ['english', 'انجليزي', 'إنجليزي', 'الانجليزية', 'الإنجليزية'];

    const byName = this.languages.find((l) => {
      const name = (l?.name ?? '').toString().toLowerCase();
      return patterns.some((p) => name.includes(p.toLowerCase()));
    });

    return byName?.id ?? null;
  }

  private resolveLanguageId(target: 'ar' | 'en'): string | null {
    const id = target === 'ar' ? this.languageChipIds.ar : this.languageChipIds.en;
    if (id) return id;
    return this.findLanguageId(target);
  }

  private inferLanguageTarget(raw: unknown): 'ar' | 'en' | null {
    if (raw == null) return null;
    const value = String(raw).trim().toLowerCase();
    if (!value) return null;

    // Common parser values: "english" | "arabic"
    if (value === 'en' || value.includes('english')) return 'en';
    if (value === 'ar' || value.includes('arabic') || value.includes('العربية') || value.includes('عربي')) return 'ar';

    return null;
  }

  private setLanguageFromParser(rawLanguage: unknown): void {
    const target = this.inferLanguageTarget(rawLanguage);
    if (!target) return;

    const id = this.resolveLanguageId(target);
    if (!id) {
      // Languages list might not be loaded yet; defer.
      this.pendingParsedLanguage = String(rawLanguage);
      return;
    }

    this.form.get('language')?.setValue(id);
    this.aiGeneratedFields.language = true;
    this.pendingParsedLanguage = null;
  }

  private applyPendingParsedLanguage(): void {
    if (!this.pendingParsedLanguage) return;

    const control = this.form.get('language');
    // If the user already selected a language, don't overwrite it.
    if (control?.value) {
      this.pendingParsedLanguage = null;
      return;
    }

    this.setLanguageFromParser(this.pendingParsedLanguage);
  }

  setLanguageChip(target: 'ar' | 'en'): void {
    const control = this.form.get('language');
    control?.markAsTouched();

    const id = target === 'ar' ? this.languageChipIds.ar : this.languageChipIds.en;
    if (!id) {
      this.showWarn(
        this.lang === 'ar' ? 'تنبيه' : 'Warning',
        this.lang === 'ar'
          ? 'تعذر تحديد معرفات اللغة. يرجى إعادة المحاولة.'
          : 'Could not resolve language IDs. Please try again.'
      );
      return;
    }

    control?.setValue(id);
  }
  
  private fetchKnowledgeData(knowledgeId: number) {
    this.knowledgeService.getKnowledgeById(knowledgeId).subscribe({
      next: (response) => {
        const knowledge = response.data;
        
        if (knowledge.tags) {
          this.defaultValues.tag_ids = knowledge.tags.map(tag => tag.id);
        }
        
        // Update form controls and selectedTagIds
        this.form.get('tag_ids')?.setValue(this.defaultValues.tag_ids || []);
        this.selectedTagIds = [...(this.defaultValues.tag_ids || [])];
        
        // Update tag items for display
        this.updateTagItems();

        this.cdr.detectChanges();
        // Initialize tags if industry is selected
        if (this.defaultValues.industry) {
          this.fetchTagsByIndustry(this.defaultValues.industry);
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
    
    // Check target market specific validation
    let targetMarketValid = false;
    if (targetMarket === '1') {
      // Regions mode - need at least one region OR country
      targetMarketValid = regions.length > 0 || countries.length > 0;
    } else if (targetMarket === '4') {
      // Countries only mode - need at least one country
      targetMarketValid = countries.length > 0;
    } else if (targetMarket === '2') {
      // Economic blocks mode - need at least one economic block
      targetMarketValid = economicBlocks.length > 0;
    } else if (targetMarket === '3') {
      // Worldwide is always valid
      targetMarketValid = true;
    }
    
    // Check other required fields
    const title = this.form.get('title')?.value;
    const description = this.form.get('description')?.value;
    const language = this.form.get('language')?.value;
    const industry = this.form.get('industry')?.value;
    const topicId = this.form.get('topicId')?.value;
    const tagIds = this.form.get('tag_ids')?.value || [];
    
    const otherControlsValid = !!(title && description && language && industry && topicId && tagIds.length > 0);
    const isFormValid = this.form.valid;
    
    const result = {
      targetMarketValid,
      otherControlsValid,
      isFormValid: isFormValid && targetMarketValid && otherControlsValid
    };
    
    return result.isFormValid;
  }
  
  /**
   * Validates the knowledge information form and marks fields with errors
   * Ensures error messages are displayed even if fields have not been touched
   * @returns boolean indicating whether the form is valid
   */
  validateForm(): boolean {
    // Mark all form controls as touched to trigger validation messages
    Object.keys(this.form.controls).forEach(key => {
      const control = this.form.get(key);
      control?.markAsTouched();
    });

    // Use the centralized target market validation method
    this.forceTargetMarketValidation();

    // Force full synchronization between form and parent model
    this.forceFullSync();

    const isValid = this.form.valid && this.checkForm();
    
    return isValid;
  }
  
  /**
   * Force full synchronization between form and parent model
   */
  private forceFullSync() {
    const formValue = this.form.value;
    const updateData = {
      title: formValue.title,
      description: formValue.description,
      cover_start: formValue.cover_start,
      cover_end: formValue.cover_end,
      language: formValue.language,
      industry: formValue.industry,
      topicId: formValue.topicId,
      regions: formValue.regions || [],
      countries: formValue.countries || [],
      economic_blocs: formValue.economicBlocks || [],
      tag_ids: formValue.tag_ids || [],
      isic_code: formValue.isic_code,
      hs_code: formValue.hs_code,
      targetMarket: formValue.targetMarket
    };

    this.updateParentModel(updateData, this.checkForm());
  }
  
  /**
   * Force validation and synchronization of target market fields
   */
  private forceTargetMarketValidation() {
    const targetMarket = this.form.get('targetMarket')?.value;
    const regions = this.form.get('regions')?.value || [];
    const countries = this.form.get('countries')?.value || [];
    const economicBlocks = this.form.get('economicBlocks')?.value || [];
    
    // Mark all target market related fields as touched
    this.form.get('targetMarket')?.markAsTouched();
    this.form.get('regions')?.markAsTouched();
    this.form.get('countries')?.markAsTouched();
    this.form.get('economicBlocks')?.markAsTouched();
    
    // Apply appropriate validation based on target market
    if (targetMarket === '1') {
      if (regions.length === 0 && countries.length === 0) {
        this.form.get('regions')?.setErrors({ required: true });
        this.form.get('countries')?.setErrors({ required: true });
      } else {
        this.form.get('regions')?.setErrors(null);
        this.form.get('countries')?.setErrors(null);
      }
    } else if (targetMarket === '4') {
      if (countries.length === 0) {
        this.form.get('countries')?.setErrors({ required: true });
      } else {
        this.form.get('countries')?.setErrors(null);
      }
      this.form.get('regions')?.setErrors(null);
    } else if (targetMarket === '2') {
      if (economicBlocks.length === 0) {
        this.form.get('economicBlocks')?.setErrors({ required: true });
      } else {
        this.form.get('economicBlocks')?.setErrors(null);
      }
      this.form.get('regions')?.setErrors(null);
      this.form.get('countries')?.setErrors(null);
    } else if (targetMarket === '3') {
      // Worldwide - clear all errors
      this.form.get('regions')?.setErrors(null);
      this.form.get('countries')?.setErrors(null);
      this.form.get('economicBlocks')?.setErrors(null);
    }
    
    // Update all field validities
    this.form.get('regions')?.updateValueAndValidity();
    this.form.get('countries')?.updateValueAndValidity();
    this.form.get('economicBlocks')?.updateValueAndValidity();
    
    // Force change detection
    this.cdr.detectChanges();
  }

  // Custom Validator for Topic
  private duplicateTopicValidator(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      if (!control.value) {
        return null;
      }
      const enteredTopic = normalizeSearchText(control.value);
      const exists = this.topicNames.includes(enteredTopic);
      return exists ? { duplicateTopic: true } : null;
    };
  }
  
  // Industry related methods
  onIndustrySelected(node: TreeNode) {
    // Handle clear selection
    if (!node.data || node.data.key === null || node.data.key === undefined) {
      this.form.get('industry')?.setValue(null);
      this.selectedIndustryId = 0;
      this.topics = [];
      this.clearTags();
      return;
    }
    
    this.form.get('industry')?.setValue(node.data.key);
    this.selectedIndustryId = node.data.key;
    
    // If user manually selected industry, it's no longer AI generated
    if (this.aiGeneratedFields.industry) {
      this.aiGeneratedFields.industry = false;
    }
    
    if (node.data && node.data.key) {
      this.getTopics(node.data.key);
      // Fetch tags for the new industry
      this.fetchTagsByIndustry(node.data.key);
    }
  }
  
  private getTopics(industryId: number) {
    this.topicService.getTopicsByIndustry(industryId).subscribe({
      next: (data: Topic[]) => {
        // Add normalized field for hamza/diacritics tolerant filtering in the dropdown.
        this.topics = [
          ...data.map((t: any) => ({
            ...t,
            normalizedName: normalizeSearchText(t.name),
          })),
          { id: 'other', name: this.lang == 'ar' ? 'موضوع آخر' : 'Other Topic', normalizedName: 'other' },
        ];
        // Store normalized topic names for validation (handles hamza/diacritics)
        this.topicNames = data.map(topic => normalizeSearchText(topic.name));
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

  selectOtherOption() {
    // Set the form value to 'other' and trigger the topic selection logic
    this.form.get('topicId')?.setValue('other');
    this.onTopicSelected('other');
  }
  
  // Target market related methods
  /**
   * Reset target market default values to prevent interference
   */
  private resetTargetMarketDefaults() {
    this.defaultValues.regions = [];
    this.defaultValues.countries = [];
    this.defaultValues.economic_blocs = [];
  }

  /**
   * Handles the selection of regions and countries
   */
  onRegionsSelected(regions: any) {
    // Get the current target market selection (1=Regions, 4=Countries, 2=Economic blocks, 3=Worldwide)
    const targetMarket = this.form.get('targetMarket')?.value;

    // Remove duplicates from the incoming data
    const uniqueRegions = regions.regions ? [...new Set(regions.regions)] : [];
    const uniqueCountries = regions.countries ? [...new Set(regions.countries)] : [];

    if (targetMarket === '1') {
      // Regions mode - we accept both regions and individual countries
      this.form.patchValue({
        regions: uniqueRegions,
        countries: uniqueCountries
      });
      
      // Update parent model with both
      const updateData = { 
        regions: uniqueRegions, 
        countries: uniqueCountries,
        economic_blocs: [] // Clear economic blocks
      };
      
      this.updateParentModel(updateData, this.checkForm());
      
      // Set validation errors if both are empty
      if (uniqueRegions.length === 0 && uniqueCountries.length === 0) {
        this.form.get('regions')?.setErrors({ required: true });
        this.form.get('countries')?.setErrors({ required: true });
      } else {
        this.form.get('regions')?.setErrors(null);
        this.form.get('countries')?.setErrors(null);
      }
    } else if (targetMarket === '4') {
      // Countries only mode - only use countries, ignore regions
      this.form.patchValue({
        regions: [],
        countries: uniqueCountries
      });
      
      // Update parent model for countries only
      const updateData = { 
        regions: [], 
        countries: uniqueCountries,
        economic_blocs: [] // Clear economic blocks
      };
      
      this.updateParentModel(updateData, this.checkForm());
      
      // Set validation errors if countries are empty
      if (uniqueCountries.length === 0) {
        this.form.get('countries')?.setErrors({ required: true });
      } else {
        this.form.get('countries')?.setErrors(null);
      }
      this.form.get('regions')?.setErrors(null); // Clear regions errors for countries-only mode
    } else {
      // For other cases (shouldn't happen with current logic), set both
      this.form.patchValue({
        regions: uniqueRegions,
        countries: uniqueCountries
      });
      
      // Update parent model
      const updateData = { 
        regions: uniqueRegions, 
        countries: uniqueCountries,
        economic_blocs: [] // Clear economic blocks
      };
      
      this.updateParentModel(updateData, this.checkForm());
    }

    // Trigger validation and mark as touched to show errors immediately
    this.form.get('regions')?.markAsTouched();
    this.form.get('countries')?.markAsTouched();
    this.form.get('regions')?.updateValueAndValidity();
    this.form.get('countries')?.updateValueAndValidity();
    
    // Force change detection
    this.cdr.detectChanges();
  }
  
  onEconomicBlocksSelected(blocks: EconomicBloc[]) {
    const selectedBlocks = blocks.map(block => block.id);
    
    this.form.get('economicBlocks')?.setValue(selectedBlocks);
    // Force validation check and mark as touched
    this.form.get('economicBlocks')?.markAsTouched();
    this.form.get('economicBlocks')?.updateValueAndValidity();
    
    // Set validation errors if no blocks are selected
    if (selectedBlocks.length === 0) {
      this.form.get('economicBlocks')?.setErrors({ required: true });
    } else {
      this.form.get('economicBlocks')?.setErrors(null);
    }
    
    // Update parent model with cleared regions and countries
    this.updateParentModel({ 
      economic_blocs: selectedBlocks,
      regions: [],
      countries: []
    }, this.checkForm());
    
    // Force change detection
    this.cdr.detectChanges();
  }
  
  // Worldwide helper methods
  isWorldwide(): boolean {
    return this.form.get('targetMarket')?.value === '3';
  }
  
  updateForWorldwide() {
    if (this.isWorldwide()) {
      // Reset regions and countries fields to empty
      this.form.patchValue({
        regions: [],
        countries: [],
        economicBlocks: []
      });
      // Set these fields as valid since worldwide is selected
      this.form.get('regions')?.setErrors(null);
      this.form.get('countries')?.setErrors(null);
      this.form.get('economicBlocks')?.setErrors(null);
      
      // Get all region IDs if the targetMarket is worldwide
      this.regionsService.getAllRegionIds().subscribe((allRegionIds: number[]) => {
        this.form.patchValue({
          regions: allRegionIds
        });
        // Update the parent model with all regions
        this.updateParentModel({
          regions: allRegionIds,
          countries: [],
          economic_blocs: []
        }, this.checkForm());
      });
    }
  }
  
  // ISIC and Products methods
  onIsicCodeSelected(node: any) {
    // Handle clear selection
    if (!node.data || node.data.key === null || node.data.key === undefined) {
      this.selectedIsicId = 0;
      this.form.get('isic_code')?.setValue(null);
      this.form.get('hs_code')?.setValue(null); // Clear Products when ISIC is cleared
      this.updateParentModel({ isic_code: null, hs_code: null }, this.checkForm());
      return;
    }
    
    this.selectedIsicId = node.data.key;
    this.form.get('isic_code')?.setValue(node.data.key);
    this.updateParentModel({ isic_code: node.data.key }, this.checkForm());
  }
  
  onHSCodeSelected(node: any) {
    // Handle clear selection
    if (!node || node.id === null || node.id === undefined) {
      this.form.get('hs_code')?.setValue(null);
      this.updateParentModel({ hs_code: null }, this.checkForm());
      return;
    }
    
    this.form.get('hs_code')?.setValue(node.id);
    this.updateParentModel({ hs_code: node.id }, this.checkForm());
  }
  
  // Tags related methods
  private fetchTags() {
    // Fetch tags if industry is selected
    if (this.defaultValues.industry) {
      this.fetchTagsByIndustry(this.defaultValues.industry);
    }
  }
  
  private fetchTagsByIndustry(industryId: number) {
    // Fetch all available tags for the industry
    this.tagsService.getTagsByIndustry(industryId, this.currentLanguage)
      .subscribe({
        next: (tags: { id: number; name: string }[]) => {
          this.tags = tags;
          
          // Convert tags to the format expected by PrimeNG multiselect
          this.availableTags = this.tags.map((tag) => ({
            display: tag.name,
            value: tag.name,
            id: tag.id,
            normalizedDisplay: normalizeSearchText(tag.name),
          }));
          
          // Update tag items for display
          this.updateTagItems();
        },
        error: (error) => {
          console.error("Error fetching tags by industry:", error);
        },
      });
  }
  
  private fetchTagsByTopic(topicId: number | string) {
    if (!this.defaultValues.industry) return;
    
    // Call the new topic-specific method in TagsService
    this.tagsService
      .getTagsByTopic(this.defaultValues.industry, topicId, this.currentLanguage)
      .subscribe({
        next: (tags: { id: number; name: string }[]) => {
          this.tags = tags;
          
          // Convert tags to the format expected by PrimeNG multiselect
          this.availableTags = this.tags.map((tag) => ({
            display: tag.name,
            value: tag.name,
            id: tag.id,
            normalizedDisplay: normalizeSearchText(tag.name),
          }));
          
          // Update tag items display
          this.updateTagItems();
        },
        error: (error) => {
          console.error("Error fetching tags by topic:", error);
        },
      });
  }
  
  // New methods for dropdown + tag-input approach
  onTagSelectedFromDropdown(event: any): void {
    const tagId = event.value;
    if (!tagId) return;
    
    // Add to selected tags if not already selected
    if (!this.selectedTagIds.includes(tagId)) {
      this.selectedTagIds.push(tagId);
      this.updateTagItems();
      this.updateFormAndParent();
    }
    
    // Clear dropdown selection
    this.selectedTagForAdding = null;
  }
  
  onTagRemoved(event: any): void {
    const removedTagValue = typeof event.value === 'string' ? event.value : event.value?.value;
    if (!removedTagValue) return;
    
    // Find the tag ID from available tags
    const removedTag = this.availableTags.find(t => t.value === removedTagValue);
    if (!removedTag || !removedTag.id) return;
    
    // Remove from selected tag IDs
    this.selectedTagIds = this.selectedTagIds.filter(id => id !== removedTag.id);
    this.updateTagItems();
    this.updateFormAndParent();
  }
  
  updateTagItems(): void {
    // Convert selected tag IDs to TagItem format for tag-input display
    const selectedTagItems = this.availableTags.filter(tag => 
      this.selectedTagIds.includes(tag.id)
    );
    this.form.get('tagItems')?.setValue(selectedTagItems);
  }
  
  updateFormAndParent(): void {
    // Update tag_ids form control
    this.form.get('tag_ids')?.setValue(this.selectedTagIds);
    
    // Update parent model
    this.updateParentModel({ tag_ids: this.selectedTagIds }, this.checkForm());
  }
  
  onTagAddedViaTagInput(event: any): void {
    const tagValue = typeof event.value === 'string' ? event.value : event.value?.value;
    if (!tagValue?.trim()) return;
    
    // Check if this is one of our existing tags
    const norm = normalizeSearchText(tagValue);
    const existingTag = this.availableTags.find((t) => {
      return (
        normalizeSearchText(t.value) === norm ||
        normalizeSearchText(t.display) === norm
      );
    });
    
    if (existingTag && existingTag.id) {
      // This is an existing tag, add it to selected if not already selected
      if (!this.selectedTagIds.includes(existingTag.id)) {
        this.selectedTagIds.push(existingTag.id);
        this.updateFormAndParent();
      }
    } else {
      // This is a new custom tag, create it via API
      this.createCustomTagViaAPI(tagValue.trim());
    }
  }
  
  createCustomTagViaAPI(tagName: string): void {
    if (!this.defaultValues.industry) {
      this.showError('', 'Industry must be selected before adding custom tags');
      return;
    }
    
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
        
        // Add new tag to available tags
        const newTag: TagItem = {
          display: tagName,
          value: tagName,
          id: newTagId,
          normalizedDisplay: normalizeSearchText(tagName),
        };
        // Put the newly added tag first
        this.availableTags = [newTag, ...this.availableTags];
        
        // Add to selected tags
        this.selectedTagIds = [...this.selectedTagIds, newTagId];
        
        // Update tag items and form
        this.updateTagItems();
        this.updateFormAndParent();
        
        // Show success message
        if(this.lang=='ar'){
          this.showSuccess('', 'تم إضافة الوسم المخصص بنجاح');
        }else{
          this.showSuccess('', 'Custom tag added successfully');
        }
      },
      error: (error) => {
        this.handleServerErrors(error);
      },
    });
  }

  // Chips-based tag selection
  isTagSelected(tagId: number): boolean {
    return this.selectedTagIds.includes(tagId);
  }

  toggleTagChip(tag: TagItem): void {
    if (!tag?.id) return;

    // Mark required control as touched so errors show immediately
    this.form.get('tag_ids')?.markAsTouched();

    // Clear server error once user interacts
    this.tagIdError = '';

    if (this.isTagSelected(tag.id)) {
      this.selectedTagIds = this.selectedTagIds.filter((id) => id !== tag.id);
    } else {
      this.selectedTagIds = [...this.selectedTagIds, tag.id];
    }

    this.updateTagItems();
    this.updateFormAndParent();
  }

  addNewTagFromInput(): void {
    const tagName = (this.newTagName || '').trim();
    if (!tagName) return;

    // If it already exists in available tags, just select it
    const norm = normalizeSearchText(tagName);
    const existingTag = this.availableTags.find((t) => {
      return (
        normalizeSearchText(t.value) === norm ||
        normalizeSearchText(t.display) === norm
      );
    });

    if (existingTag?.id) {
      if (!this.selectedTagIds.includes(existingTag.id)) {
        this.selectedTagIds = [...this.selectedTagIds, existingTag.id];
        this.updateTagItems();
        this.updateFormAndParent();
      }
      this.newTagName = '';
      return;
    }

    // Otherwise create it via API (also selects it)
    this.createCustomTagViaAPI(tagName);
    this.newTagName = '';
  }

  toggleViewMoreTags(): void {
    this.showAllTags = !this.showAllTags;
  }
  
  
  
  // Helper methods
  private handleServerErrors(error: any) {
    // Reset all error messages first
    this.tagIdError = '';
    
    if (error.error && error.error.errors) {
      const serverErrors = error.error.errors;
      for (const key in serverErrors) {
        if (serverErrors.hasOwnProperty(key)) {
          const messages = serverErrors[key];
          
          // Handle specific field errors
          if (key === 'tag_ids') {
            this.tagIdError = messages.join(', ');
            // Mark the tag_ids field as touched to show validation error
            this.form.get('tag_ids')?.markAsTouched();
          } else if (key === 'language') {
            // Special handling for language errors
            this.showError('Language Error', messages.join(', '));
            // Mark the language field as touched to show validation error
            this.form.get('language')?.markAsTouched();
          } else {
            // Show general error toast for other fields
            this.showError(key.charAt(0).toUpperCase() + key.slice(1) + ' Error', messages.join(', '));
          }
        }
      }
    } else if (error.error && error.error.message) {
      // Handle case where error has a single message
      this.showError('Error', error.error.message);
    } else {
      this.showError('Error', 'An unexpected error occurred.');
    }
  }
  
  
  // Show editor after animated abstract is displayed
  showDescriptionEditor(): void {
    // Enable the form control first
    const descriptionControl = this.form.get('description');
    if (descriptionControl) {
      descriptionControl.enable();
    }
    
    // Show the editor
    this.showEditor = true;
    this.cdr.detectChanges();
  }
  
  // Start typing animation for abstract
  startTypingAnimation(text: string): void {
    if (!text) return;
    
    const chars = text.length;
    let currentPos = 0;
    this.animatedAbstractComplete = false;
    
    // Clear any existing animation timer
    if (this.animationTimers) {
      clearInterval(this.animationTimers);
    }
    
    // Start animation interval
    this.animationTimers = setInterval(() => {
      if (currentPos < chars) {
        // Add next character to the animated text
        this.animatedAbstractText = text.substring(0, currentPos + 1);
        currentPos++;
      } else {
        // Animation complete
        clearInterval(this.animationTimers);
        this.animatedAbstractComplete = true;
        // Don't automatically show editor - user must click Edit button
        this.cdr.detectChanges();
      }
    }, this.typingSpeed);
  }
  
  // Getter for economic bloc IDs
  get selectedEconomicBlocIds(): number[] {
    const result = this.defaultValues.economic_blocs || [];
    return result;
  }
  
  // Getter for language
  get currentLanguage(): string {
    return this.currentLang;
  }
  
  // Clear tags (but keep available tags since they depend on industry)
  private clearTags() {
    this.form.get('tag_ids')?.setValue([]);
    this.form.get('tagItems')?.setValue([]);
    this.selectedTagIds = [];
    this.updateParentModel({ 
      tag_ids: [] 
    }, this.checkForm());
  }

  generateAIDescription(): void {
    // Always allow AI generation regardless of having an ID
    // The content check above will properly handle true edit mode cases
    this.generateAIInformation();
  }
  
  // Simplified method to generate AI information
  public generateAIInformation(): void {
    if (!this.defaultValues.knowledgeId) {
      // If no knowledge ID, just show the editor
      this.showEditor = true;
      this.cdr.detectChanges();
      return;
    }

    // Set loading state
    this.isDescriptionLoading = true;
    this.showEditor = false;
    this.aiAbstractError = false;
    this.cdr.detectChanges();

    // Clear any previous timers and subscriptions
    if (this.stopPolling$) {
      this.stopPolling$.next();
      this.stopPolling$.complete();
    }
    this.stopPolling$ = new Subject<void>();

    // Time tracking
    const startTime = Date.now();
    const maxDuration = 20000; // Fixed: 20 seconds
    const pollInterval = 2000; // 2 seconds
    let hasReceivedData = false;
    let pollingSubscription: any = null;

    // Function to clean up and stop loading
    const cleanUpAndStop = (showError: boolean = false) => {
      // Stop polling
      if (pollingSubscription && !pollingSubscription.closed) {
        pollingSubscription.unsubscribe();
      }

      // Clean up stop polling subject
      if (this.stopPolling$) {
        this.stopPolling$.next();
        this.stopPolling$.complete();
      }

      // Update UI state
      this.isDescriptionLoading = false;
      if (showError && !hasReceivedData) {
        this.aiAbstractError = true;
        this.showEditor = true;
      }

      this.cdr.detectChanges();
    };

    // Start polling timer - this will execute every 2 seconds
    pollingSubscription = interval(pollInterval).pipe(
      takeWhile(() => (Date.now() - startTime) < maxDuration),
      takeUntil(this.stopPolling$),
      finalize(() => {
        if (!hasReceivedData) {
          cleanUpAndStop(true);
        }
      })
    ).subscribe({
      next: () => {
        // Only make API call if we haven't received data yet
        if (!hasReceivedData) {

          // Make API call
          this.addInsightStepsService.getKnowledgeParserData(this.defaultValues.knowledgeId as number)
            .subscribe({
              next: (response) => {
                // Check if we have valid data
                const responseData = response?.data as any;
                const hasValidData = responseData && (
                  (responseData.abstract && responseData.abstract.trim().length > 0)
                );

                if (hasValidData) {
                  hasReceivedData = true;

                  // Update the form with received data
                  this.updateFormWithAIData(responseData);

                  // Clean up and stop
                  cleanUpAndStop(false);
                }
              },
              error: (error) => {
                console.error('API error:', error);
                // Continue polling on error unless it's a critical error
                if (error.status === 404 || error.status === 403) {
                  hasReceivedData = true; // Prevent timeout handler
                  cleanUpAndStop(true);
                }
              }
            });
        }
      },
      error: (error) => {
        console.error('Polling error:', error);
        cleanUpAndStop(true);
      },
      complete: () => {
        if (!hasReceivedData) {
          cleanUpAndStop(true);
        }
      }
    });

    // Run initial API call immediately
    this.addInsightStepsService.getKnowledgeParserData(this.defaultValues.knowledgeId as number)
      .subscribe({
        next: (response) => {

          // Check if we have valid data
          const responseData = response?.data as any;
          const hasValidData = responseData && (
            (responseData.abstract && responseData.abstract.trim().length > 0)
          );

          if (hasValidData) {
            hasReceivedData = true;
            this.updateFormWithAIData(responseData);
            cleanUpAndStop(false);
          }
        },
        error: (error) => {
          console.error('Initial API error:', error);
          // For critical errors on initial call, stop immediately
          if (error.status === 404 || error.status === 403) {
            hasReceivedData = true; // Prevent timeout handler
            cleanUpAndStop(true);
          }
        }
      });

    // Safety timeout to ensure loading never gets stuck
    setTimeout(() => {
      if (!hasReceivedData) {
        cleanUpAndStop(true);
      }
    }, maxDuration);
  }
  
  // Update form with AI data
  private updateFormWithAIData(data: any): void {
    // Update title if available
    if (data.title) {
      this.form.get('title')?.setValue(data.title);
      this.aiGeneratedFields.title = true;
    }
    
    // Update description using abstract field
    if (data.abstract) {
      // Set form value first (even if not visible in the editor)
      this.form.get('description')?.setValue(data.abstract);
      this.aiGeneratedFields.description = true;
      
      // Enable animation
      this.animatedAbstract = true;
      this.showEditor = false; // Ensure editor is hidden
      this.startTypingAnimation(data.abstract);
    }
    
    // Update language if available (convert from parser string to language ID)
    if (data.language) {
      this.setLanguageFromParser(data.language);
    }
    
    // Update industry if available
    if (data.industry && data.industry.id) {
      const industryId = parseInt(data.industry.id);
      if (!isNaN(industryId)) {
        this.form.get('industry')?.setValue(industryId);
        this.aiGeneratedFields.industry = true;
        // Also update topics and tags if industry changes
        this.getTopics(industryId);
        this.fetchTagsByIndustry(industryId);
      }
    }
    
    // Note: Loading state is handled by the calling function (cleanUpAndStop)
    this.cdr.detectChanges();
  }

  regionsCountriesValidator = () => {
    const targetMarket = this.form.get('targetMarket')?.value;
    if (targetMarket === '1' || targetMarket === '4') { // Regions or Countries selected
      const regionsValue = this.form.get('regions')?.value;
      const countriesValue = this.form.get('countries')?.value;
      
      const regionsSelected = regionsValue && regionsValue.length > 0;
      const countriesSelected = countriesValue && countriesValue.length > 0;
      
      return regionsSelected || countriesSelected ? null : { required: true };
    }
    return null;
  };
  
  economicBlocksValidator = () => {
    const blocks = this.form.get('economicBlocks')?.value || [];
    return blocks.length > 0 ? null : { required: true };
  };

  // Add method to listen for field changes to remove AI Generated badges
  private setupFieldChangeListeners(): void {
    // Title field
    this.form.get('title')?.valueChanges.subscribe(value => {
      // Only mark as non-AI if the value has changed and it was previously AI generated
      if (this.aiGeneratedFields.title && value !== this.defaultValues.title) {
        this.aiGeneratedFields.title = false;
      }
    });

    // Description field - only when editor is visible (user edited)
    this.form.get('description')?.valueChanges.subscribe(value => {
      // Only consider changes when the editor is shown (user is editing)
      if (this.showEditor && this.aiGeneratedFields.description) {
        this.aiGeneratedFields.description = false;
      }
    });

    // Language field
    this.form.get('language')?.valueChanges.subscribe(value => {
      if (this.aiGeneratedFields.language && value !== this.defaultValues.language) {
        this.aiGeneratedFields.language = false;
      }
    });

    // Industry field - handled separately in onIndustrySelected method
  }

  // Method to manually stop AI generation
  stopAIGeneration(): void {
    if (this.stopPolling$) {
      this.stopPolling$.next();
      this.stopPolling$.complete();
    }

    this.isDescriptionLoading = false;
    this.aiAbstractError = true;
    this.showEditor = true;
    this.cdr.detectChanges();
  }

  /**
   * Sets the duplicateTopic error on the customTopic control and scrolls to it.
   * Called from horizontal component when the suggest topic API returns a "name already taken" error.
   */
  setDuplicateTopicError(): void {
    const customTopicControl = this.form.get('customTopic');
    if (customTopicControl) {
      customTopicControl.setErrors({ duplicateTopic: true });
      customTopicControl.markAsTouched();
      this.cdr.detectChanges();

      // Scroll to the custom topic input section
      setTimeout(() => {
        const errorElement = this.elRef.nativeElement.querySelector('.invalid-feedback.d-block');
        if (errorElement) {
          errorElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 100);
    }
  }

  // Custom year picker methods
  getCoverYearRange(): { startYear: number | null, endYear: number | null } {
    const startYear = this.form.get('cover_start')?.value;
    const endYear = this.form.get('cover_end')?.value;

    return {
      startYear: startYear || null,
      endYear: endYear || null
    };
  }



  // Get display text for cover years
  getCoverYearDisplayText(): string {
    const startYear = this.form.get('cover_start')?.value;
    const endYear = this.form.get('cover_end')?.value;

    if (!startYear && !endYear) {
      return '';
    }

    if (startYear === endYear) {
      return startYear.toString();
    }

    return `${startYear}-${endYear}`;
  }

}
