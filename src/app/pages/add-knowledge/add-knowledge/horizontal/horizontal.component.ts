import { Component, Injector, OnInit, ViewChild, ViewContainerRef, QueryList, ViewChildren } from '@angular/core';
import { BaseComponent } from 'src/app/modules/base.component';
import { ICreateKnowldege, inits } from '../create-account.helper';
import { BehaviorSubject, concatMap, from, Observable, map } from 'rxjs';
import { Router } from '@angular/router';
import { ActivatedRoute } from '@angular/router';
import { KnowledgeService } from 'src/app/_fake/services/knowledge/knowledge.service';
import { AddInsightStepsService, UpdateKnowledgeAbstractsRequest } from 'src/app/_fake/services/add-insight-steps/add-insight-steps.service';
import { RegionsService } from 'src/app/_fake/services/region/regions.service';
import * as moment from 'moment';
import { SubStepDocumentsComponent } from '../steps/step2/sub-step-documents/sub-step-documents.component';
import { TopicsService } from 'src/app/_fake/services/topic-service/topic.service';

@Component({
  selector: 'app-horizontal',
  templateUrl: './horizontal.component.html',
  styleUrl: './horizontal.component.scss'
})
export class HorizontalComponent extends BaseComponent implements OnInit {
  formsCount = 6;
  isEditMode = false;
  knowledgeId!: number;
  account$: BehaviorSubject<ICreateKnowldege> =
  new BehaviorSubject<ICreateKnowldege>(inits);
  currentStep$: BehaviorSubject<number> = new BehaviorSubject(1);
  isCurrentFormValid$: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(
    false
  );
  isLoading = false;
  
  private static readonly DRAFT_TOAST_FLAG_KEY = 'knoldg:draft_saved_toast';
  @ViewChild(SubStepDocumentsComponent) documentsComponent: SubStepDocumentsComponent;
  @ViewChild('step3Component') step3Component: any;
  @ViewChild('step4Component') step4Component: any;
  @ViewChild('step5Component') step5Component: any;
  
  constructor(
    injector: Injector,
    private route: ActivatedRoute,
    private knowledgeService: KnowledgeService,
    private addInsightStepsService: AddInsightStepsService,
    private router: Router,
    private viewContainerRef: ViewContainerRef,
    private regionsService: RegionsService,
    private topicService: TopicsService,
   ) {
    super(injector);
  }

  private initialStep: number | null = null;

  private shouldShowSavedAsDraftToast(): boolean {
    // Only for create flow (not edit mode)
    if (this.isEditMode) return false;

    const publishStatus = this.account$.value?.publish_status;

    // If it's published or scheduled, don't show "Saved as Draft"
    if (publishStatus === 'published' || publishStatus === 'scheduled') return false;

    // Show if user didn't reach publish completion (step <= 5),
    // OR they finished but explicitly kept it unpublished (draft).
    return this.currentStep$.value <= 5 || publishStatus === 'unpublished';
  }

  private syncDraftFlagForExternalRedirect() {
    // This flag is used by the Angular header logo click to pass a query param to the Next.js app.
    try {
      if (this.shouldShowSavedAsDraftToast()) {
        sessionStorage.setItem(HorizontalComponent.DRAFT_TOAST_FLAG_KEY, Date.now().toString());
      } else {
        sessionStorage.removeItem(HorizontalComponent.DRAFT_TOAST_FLAG_KEY);
      }
    } catch {
      // ignore (e.g. Safari private mode)
    }
  }

  ngOnInit(): void {
    // Read the optional ?step= query parameter
    this.route.queryParams.subscribe(queryParams => {
      const stepParam = queryParams['step'];
      if (stepParam) {
        this.initialStep = +stepParam;
      }
    });

    this.route.params.subscribe(params => {
      const id = params['id'];
      if (id) {
        this.knowledgeId = +id;
        this.isEditMode = true;
        this.formsCount = 5; // Set forms count to 5 in edit mode
        // Initialize with empty values when editing
        const emptyAccount = {
          ...inits,
          knowledgeType: '', // Start with empty knowledgeType when editing
        };
        this.account$.next(emptyAccount);
        this.loadKnowledgeData();
      }
    });

    // Subscribe to API loading status
    this.addInsightStepsService.isLoading$.subscribe(isLoading => {
      this.isLoading = isLoading;
    });

    // Keep external redirect draft flag in sync while user is in the wizard
    const stepSub = this.currentStep$.subscribe(() => this.syncDraftFlagForExternalRedirect());
    this.unsubscribe.push(stepSub);
    const accountSub = this.account$.subscribe(() => this.syncDraftFlagForExternalRedirect());
    this.unsubscribe.push(accountSub);

    // Ensure the flag is correct on initial load
    this.syncDraftFlagForExternalRedirect();
  }

  private loadKnowledgeData() {
    this.isLoading = true;
    const loadSub = this.knowledgeService.getKnowledgeById(this.knowledgeId)
      .subscribe({
        next: (response) => {
          const knowledge = response.data;
          
          // Check if this knowledge has all regions selected (worldwide case)
          this.checkIfWorldwide(knowledge.regions).subscribe(isWorldwide => {
            // Determine targetMarket based on the rules
            let targetMarket = '1';
            
            if (isWorldwide) {
              // If all regions are selected, mark as worldwide
              targetMarket = '3';
            } else if (knowledge.economic_blocs && knowledge.economic_blocs.length > 0) {
              // If economic blocs are set, use economic blocks option
              targetMarket = '2';
            } else if (knowledge.countries && knowledge.countries.length > 0 && 
                      (!knowledge.regions || knowledge.regions.length === 0)) {
              // If only countries are selected (no regions), use countries only option
              targetMarket = '4';
            } else if (knowledge.regions && knowledge.regions.length > 0) {
              // If regions are selected (with or without countries), use regions/countries option
              targetMarket = '1';
            } else {
              // Default fallback to regions/countries option
              targetMarket = '1';
            }

            // Update the account with fetched data
            const economicBlocIds = knowledge.economic_blocs?.map((bloc: any) => bloc.id) || [];
            
            const updatedAccount: any = {
              ...this.account$.value,
              knowledgeId: this.knowledgeId,
              knowledgeType: knowledge.type,
              title: knowledge.title,
              topicId: knowledge.topic?.id || null,
              industry: knowledge.industry?.id || null,
              isic_code: knowledge.isic_code?.id || null,
              hs_code: knowledge.hs_code?.id || null,
              language: knowledge.language,
              regions: knowledge.regions?.map((region: any) => region.id) || [],
              countries: knowledge.countries?.map((country: any) => country.id) || [],
              economic_blocs: economicBlocIds,
              description: knowledge.description,
              cover_start: knowledge.cover_start || null,
              cover_end: knowledge.cover_end || null,
              targetMarket: targetMarket,
              customTopic: '',
              documents: [],
              publish_date_time: knowledge.published_at ? moment(knowledge.published_at).format('YYYY-MM-DD HH:mm:ss') : '',
              publish_status: knowledge.status === 'published' ? 'unpublished' : knowledge.status,
              // Also store the full economic blocks data for the step4 component
              economic_blocs_data: knowledge.economic_blocs || []
            };

            this.account$.next(updatedAccount);
            this.updateAccount(updatedAccount, true);
            this.isCurrentFormValid$.next(true);
            this.isLoading = false;

            // Jump to the requested step if provided via ?step= query param
            if (this.initialStep && this.initialStep >= 1 && this.initialStep <= this.formsCount) {
              this.currentStep$.next(this.initialStep);
              this.initialStep = null; // Only apply once
            }
          });
        },
        error: (error) => {
          this.handleServerErrors(error);
          this.isLoading = false;
        }
      });

    this.unsubscribe.push(loadSub);
  }

  updateAccount = (part: Partial<ICreateKnowldege>, isFormValid: boolean) => {
    const currentAccount = this.account$.value;
    const updatedAccount = { ...currentAccount, ...part };


    this.account$.next(updatedAccount);
    this.isCurrentFormValid$.next(isFormValid);
    this.syncDraftFlagForExternalRedirect();

    // If the knowledgeType has changed and it's valid, handle the API call
    if (part.knowledgeType && isFormValid) {
      this.handleKnowledgeTypeChange(part.knowledgeType);
    }
  };

  handleKnowledgeTypeChange(knowledgeType: string) {
    // Only handle update case here, creation is delayed until document upload
    if (this.isEditMode && this.knowledgeId) {
      // Update existing knowledge type
      this.addInsightStepsService.updateKnowledgeType(this.knowledgeId, knowledgeType)
        .subscribe({
          next: (response) => {
            // The next step will be triggered by the step1 component's goToNextStep event
          },
          error: (error) => {
            console.error('Error updating knowledge type', error);
            this.handleServerErrors(error);
          }
        });
    }
    // In the creation case, we just update the local model, but don't call API
    // The API call will be made in the SubStepDocumentsComponent during first file upload
  }

  // New method to create knowledge type and get ID
  // Will be called by SubStepDocumentsComponent when uploading first file
  createKnowledgeType(): Promise<number> {
    return new Promise((resolve, reject) => {
      const knowledgeType = this.account$.value.knowledgeType;
      
      if (!knowledgeType) {
        reject(new Error('Knowledge type is not selected'));
        return;
      }

      this.addInsightStepsService.step1HandleKnowledgeType(knowledgeType)
        .subscribe({
          next: (response) => {
            // Store the newly created knowledge ID
            if (response.data && response.data.knowledge_id) {
              this.knowledgeId = response.data.knowledge_id;
              this.updateAccount({ knowledgeId: response.data.knowledge_id }, true);
              resolve(response.data.knowledge_id);
            } else {
              reject(new Error('Failed to get knowledge ID from response'));
            }
          },
          error: (error) => {
            console.error('Error creating knowledge type', error);
            this.handleServerErrors(error);
            reject(error);
          }
        });
    });
  }

  // Getter for current account state - useful for child components
  getCurrentAccount(): ICreateKnowldege {
    return this.account$.value;
  }

  nextStep() {
    const nextStep = this.currentStep$.value + 1;
    if (nextStep > this.formsCount) {
      return;
    }

    // Validate Step 1 - Knowledge Type must be selected
    if (this.currentStep$.value === 1) {
      const currentAccount = this.account$.value;
      if (!currentAccount.knowledgeType) {
       if( this.lang === 'ar' ) {
        this.showWarn('', 'يرجى اختيار نوع المعرفة قبل المتابعة.');
       } else {
        this.showWarn('', 'Please select a knowledge type before proceeding.');
       }
        return;
      }
    }

    // Validate Step 2 - At least one document must be uploaded
    if (this.currentStep$.value === 2) {
      // Get the current account to check for documents
      const currentAccount = this.account$.value;
      
      // Check if the documents array exists and has at least one document
      if (!currentAccount.documents || currentAccount.documents.length === 0) {
        if( this.lang === 'ar' ) {
          this.showWarn('', 'يرجى اختيار الملف المراد تحميلة على المنصة');
         } else {
          this.showWarn('', 'Please add at least one document before proceeding.');
         }
        return;
      }
      
      // Handle step 2 submission (documents)
      this.handleStep2Submission(nextStep);
    } else if (this.currentStep$.value === 3) {
      // Handle step 3 submission (descriptions)
      this.handleStep3Submission(nextStep);
    } else if (this.currentStep$.value === 4) {
      // Handle step 4 submission (knowledge details and tags)
      // For edit mode, redirecting will happen inside the handler after successful submission
      this.handleStep4Submission(nextStep);
    } else if (this.currentStep$.value === 5) {
      // Handle step 5 submission (publishing options)
      this.handleStep5Submission(nextStep);
    } else {
      // For other steps, just proceed without any special handling
      this.currentStep$.next(nextStep);
      this.syncDraftFlagForExternalRedirect();
    }
  }

  handleStep2Submission(nextStep: number) {
    // No documents component means we can proceed
    if (!this.documentsComponent) {
      this.currentStep$.next(nextStep);
      return;
    }
    
    // Validate document titles
    const docs = this.documentsComponent.documents;
    if (docs && docs.length > 0) {
      // Check for empty titles
      const invalidDocuments = docs.filter(doc => !doc.file_name?.trim());
      if (invalidDocuments.length > 0) {
        if( this.lang === 'ar' ) {
          this.showWarn('', 'يرجى إدخال عنوان لكل مستند');
         } else {
          this.showWarn('', 'All documents must have titles');
         }
        return; // Don't advance to next step
      }
      
      // Validate prices: non-charity documents must have price >= 10
      const controls = this.documentsComponent.documentControls;
      for (let i = 0; i < controls.length; i++) {
        const control: any = controls.at(i);
        const isCharity = control.get('isCharity')?.value;
        // When not charity, price must be a number >= 10
        if (!isCharity) {
          const priceValue = Number(control.get('price')?.value);
          if (isNaN(priceValue) || priceValue < 10) {
            if (this.lang === 'ar') {
              this.showWarn('', 'الحد الأدنى للسعر هو 10');
            } else {
              this.showWarn('', 'Minimum price is 10');
            }
            return; // Block proceeding to next step
          }
        }
      }
      
      // Removed duplicate title validation per request
      
      // Check for upload errors
      if (this.hasAnyDocumentUploadErrors()) {
        if( this.lang === 'ar' ) {
          this.showWarn('', 'يرجى إصلاح أخطاء التحميل قبل المتابعة.');
         } else {
          this.showWarn('', 'Please fix the upload errors before continuing');
         }
        return; // Don't advance to next step
      }
      
      // Check for pending uploads
      if (this.documentsComponent.hasUploadsInProgress()) {
        if( this.lang === 'ar' ) {
          this.showWarn('', 'يرجى الإنتظار حتى ينتهي تحميل جميع المستندات قبل المتابعة.');
         } else {
          this.showWarn('', 'Please wait for all uploads to complete before continuing');
         }
        return; // Don't advance to next step
      }
      
      // START LOADING STATE
      this.isLoading = true;
      
      // First fetch the document IDs to ensure we have the correct ones
      this.documentsComponent.getUploadedDocumentIds();
      
      // Add a slight delay to ensure document IDs are fetched
      setTimeout(() => {
              // All validations passed, proceed with updating document details
      
      this.documentsComponent.updateDocumentDetails()
        .then((success: boolean) => {
          if (success) {
            this.isLoading = false;
            this.currentStep$.next(nextStep);
          } else {
            this.isLoading = false;
            // Don't proceed to next step - user wants to edit
          }
        })
        .catch(error => {
          console.error('Error updating document details:', error);
          this.isLoading = false;
          this.handleServerErrors(error);
        });
      }, 1000); // 1 second delay to ensure IDs are fetched
    } else {
      // No documents to update, just proceed
      this.currentStep$.next(nextStep);
    }
  }
  
  private hasAnyDocumentUploadErrors(): boolean {
    if (!this.documentsComponent) {
      return false;
    }
    
    return this.documentsComponent.hasUploadErrors();
  }

  handleStep3Submission(nextStep: number) {
    const currentAccount = this.account$.value;
    
    // Get a reference to the step3 component if it's viewable
    const step3Component = this.getCurrentStepComponent(3);
    if (step3Component && typeof step3Component.validateDocuments === 'function') {
      // Use the component's own validation method
      const isValid = step3Component.validateDocuments();
      if (!isValid) {
        if( this.lang === 'ar' ) {
          this.showWarn('', 'يرجى إدخال وصف لكل مستند');
         } else {
          this.showWarn('', 'All documents must have descriptions');
         }
        return; // Don't advance to next step
      }
    } else {
      // Fallback validation if component reference is not available
      // Validate that abstracts exist before submission
      if (!currentAccount.documentDescriptions || currentAccount.documentDescriptions.length === 0) {
        if( this.lang === 'ar' ) {
          this.showWarn('', 'يرجى إدخال وصف لكل مستند');
         } else {
          this.showWarn('', 'Please generate or enter abstracts for all documents before continuing');
         }
        return; // Don't advance to next step
      }
      
      // Check for empty abstracts
      const emptyAbstracts = currentAccount.documentDescriptions.filter(doc => !doc.description?.trim());
      if (emptyAbstracts.length > 0) {
        if( this.lang === 'ar' ) {
          this.showWarn('', 'يرجى إدخال وصف لكل مستند');
         } else {
          this.showWarn('', 'All documents must have descriptions');
         }
        return; // Don't advance to next step
      }
    }
    
    this.isLoading = true;
    
    // Prepare the request for updating abstracts
    const updateRequest: UpdateKnowledgeAbstractsRequest = {
      documents: currentAccount.documentDescriptions || []
    };

    this.addInsightStepsService.updateKnowledgeAbstracts(this.knowledgeId, updateRequest)
      .subscribe({
        next: (response) => {
          this.currentStep$.next(nextStep);
          this.isLoading = false;
        },
        error: (error) => {
          console.error('Error updating knowledge abstracts', error);
          this.handleServerErrors(error);
          this.isLoading = false;
        }
      });
  }

  handleStep4Submission(nextStep: number) {
    const currentAccount = this.account$.value;
    
    // Get the Step 4 component instance
    const step4Component = this.getCurrentStepComponent(4);
    
    // Use validateForm method to show all validation errors
    if (step4Component && typeof step4Component.validateForm === 'function') {
      // This will mark all controls as touched and show validation errors
      const isValid = step4Component.validateForm();
      if (!isValid) {
        return; // Don't advance to next step, errors are visible in the UI
      }
    } else {
      // Fallback validation if component reference is not available
      // Validate required fields
      if (!currentAccount.title) {
        if( this.lang === 'ar' ) {
          this.showWarn('', 'يرجى إدخال عنوان للمعرفة');
         } else {
          this.showWarn('', 'Please enter a title for your knowledge');
         }
        return; // Don't advance to next step
      }
      
      if (!currentAccount.description) {
        if( this.lang === 'ar' ) {
          this.showWarn('', 'يرجى إدخال وصف للمعرفة');
         } else {
          this.showWarn('', 'Please enter a description for your knowledge');
         }
        return; // Don't advance to next step
      }
      
      if (!currentAccount.language) {
        if( this.lang === 'ar' ) {
          this.showWarn('', 'يرجى اختيار اللغة للمعرفة');
         } else {
          this.showWarn('', 'Please select a language for your knowledge');
         }
        return; // Don't advance to next step
      }
      
      if (!currentAccount.industry) {
        if( this.lang === 'ar' ) {
          this.showWarn('', 'يرجى اختيار الصناعة للمعرفة');
         } else {
          this.showWarn('', 'Please select an industry for your knowledge');
         }
        return; // Don't advance to next step
      }
      
      if (!currentAccount.topicId) {
        if( this.lang === 'ar' ) {
          this.showWarn('', 'يرجى اختيار الموضوع للمعرفة');
         } else {
          this.showWarn('', 'Please select a topic for your knowledge');
         }
        return; // Don't advance to next step
      }
      
      // Check for target market validation
      if (currentAccount.targetMarket === '1') {
        // Region/country validation
        if ((!currentAccount.regions || currentAccount.regions.length === 0) && 
            (!currentAccount.countries || currentAccount.countries.length === 0)) {
          if( this.lang === 'ar' ) {
            this.showWarn('', 'يرجى اختيار على الأقل واحد أو أكثر من المناطق أو الدول');
           } else {
            this.showWarn('', 'Please select at least one region or country');
           }
          return; // Don't advance to next step
        }
      } else if (currentAccount.targetMarket === '4') {
        // Countries-only validation
        if (!currentAccount.countries || currentAccount.countries.length === 0) {
          if( this.lang === 'ar' ) {
            this.showWarn('', 'يرجى اختيار على الأقل واحد أو أكثر من الدول');
           } else {
            this.showWarn('', 'Please select at least one country');
           }
          return; // Don't advance to next step
        }
      } else if (currentAccount.targetMarket === '2') {
        // Economic blocks validation
        if (!currentAccount.economic_blocs || currentAccount.economic_blocs.length === 0) {
          if( this.lang === 'ar' ) {
            this.showWarn('', 'يرجى اختيار على الأقل واحد أو أكثر من المناطق الاقتصادية');
           } else {
            this.showWarn('', 'Please select at least one economic block');
           }
          return; // Don't advance to next step
        }
      } else if (currentAccount.targetMarket === '3') {
        // Worldwide option is valid by default
      } else {
        if( this.lang === 'ar' ) {
          this.showWarn('', 'يرجى اختيار خيار حدد المركز الاقتصادي');
         } else {
          this.showWarn('', 'Please select a target market option');
         }
        return; // Don't advance to next step
      }
    }
    
    this.isLoading = true;
    
    // Check if a custom topic needs to be created
    if (currentAccount.topicId === 'other' && step4Component) {
      // Get the custom topic name from the Step4Component
      const customTopicName = step4Component.form.get('customTopic')?.value;
      
      if (!customTopicName) {
        if( this.lang === 'ar' ) {
          this.showWarn('', 'يرجى إدخال عنوان مخصص للمعرفة');
         } else {
          this.showWarn('', 'Please enter a custom topic name');
         }
        this.isLoading = false;
        return; // Don't advance to next step
      }
      
      // Create a topic suggestion request
      if (!currentAccount.industry) {
        if( this.lang === 'ar' ) {
          this.showWarn('', 'يرجى اختيار الصناعة للمعرفة');
         } else {
          this.showWarn('', 'Industry is required for creating a custom topic');
         }
        this.isLoading = false;
        return; // Don't proceed if industry is missing
      }
      
      const suggestTopicRequest = {
        industry_id: currentAccount.industry as number, // Cast to number to satisfy TypeScript
        name: {
          en: customTopicName,
          ar: customTopicName // Use the same value for both languages
        }
      };
      
      // Call API to create the suggested topic
      this.addInsightStepsService.createSuggestTopic(suggestTopicRequest, step4Component.currentLanguage)
        .subscribe({
          next: (response) => {
            
            // Use the new topic ID for the knowledge details update
            const newTopicId = response.data.topic_id;
            
            // Prepare the request payload with the new topic ID

            const updateRequest = {
              title: currentAccount.title || '',
              description: currentAccount.description || '',
              cover_start: currentAccount.cover_start || null,
              cover_end: currentAccount.cover_end || null,
              topic_id: newTopicId, // Use the newly created topic ID
              industry_id: currentAccount.industry || 0,
              isic_code_id: currentAccount.isic_code || null,
              hs_code_id: currentAccount.hs_code || null,
              language: currentAccount.language || '',
              region: currentAccount.regions || [],
              country: currentAccount.countries || [],
              economic_bloc: currentAccount.economic_blocs || [],
              tag_ids: currentAccount.tag_ids || []
            };
            
            // Now update knowledge details with the new topic ID
            this.updateKnowledgeDetailsAndProceed(updateRequest, nextStep);
          },
          error: (error) => {
            // Check if this is a "name already taken" error (duplicate topic)
            const serverErrors = error?.error?.errors;
            const isDuplicateNameError = serverErrors && (
              serverErrors['name.en'] || serverErrors['name.ar'] || serverErrors['name']
            );

            if (isDuplicateNameError && step4Component && typeof step4Component.setDuplicateTopicError === 'function') {
              // Set the duplicate topic error on the customTopic control and scroll to it
              step4Component.setDuplicateTopicError();
            } else {
              this.handleServerErrors(error);
            }
            this.isLoading = false;
          }
        });
    } else {
      // No custom topic, proceed with regular update
      // Prepare the request payload

      const updateRequest = {
        title: currentAccount.title || '',
        description: currentAccount.description || '',
        cover_start: currentAccount.cover_start || null,
        cover_end: currentAccount.cover_end || null,
        topic_id: currentAccount.topicId || 0,
        industry_id: currentAccount.industry || 0,
        isic_code_id: currentAccount.isic_code || null,
        hs_code_id: currentAccount.hs_code || null,
        language: currentAccount.language || '',
        region: currentAccount.regions || [],
        country: currentAccount.countries || [],
        economic_bloc: currentAccount.economic_blocs || [],
        tag_ids: currentAccount.tag_ids || []
      };

      this.updateKnowledgeDetailsAndProceed(updateRequest, nextStep);
    }
  }

  // Helper method to update knowledge details and proceed to next step
  private updateKnowledgeDetailsAndProceed(updateRequest: any, nextStep: number) {
    this.addInsightStepsService.updateKnowledgeDetails(this.knowledgeId, updateRequest)
      .subscribe({
        next: (response) => {
          
          // In edit mode, redirect to details page when moving to step 5
          if (this.isEditMode && nextStep === 5) {
            this.router.navigate([`/app/my-knowledge-base/view-my-knowledge/${this.knowledgeId}/details`]);
          } else {
            this.currentStep$.next(nextStep);
          }
          
          this.isLoading = false;
        },
        error: (error) => {
          this.handleServerErrors(error);
          this.isLoading = false;
        }
      });
  }

  handleStep5Submission(nextStep: number) {
    const currentAccount = this.account$.value;
    
    // Get the Step 5 component instance and validate it
    const step5Component = this.getCurrentStepComponent(5);
    
    // Use validateForm method if available to show all validation errors
    if (step5Component && typeof step5Component.validateForm === 'function') {
      const isValid = step5Component.validateForm();
      if (!isValid) {
        // Errors are now visible in the UI, no need for toast message
        return; // Don't advance to next step
      }
    } else {
      // Fallback: Check if the current form is valid from the step5 component
      if (!this.isCurrentFormValid$.value) {
        if( this.lang === 'ar' ) {
          this.showWarn('', 'يرجى تصحيح الأخطاء في النموذج قبل المتابعة');
         } else {
          this.showWarn('', 'Please correct the form errors before proceeding');
         }
        return; // Don't advance to next step
      }
    }
    
    // Validate publish status selection
    if (!currentAccount.publish_status) {
      if( this.lang === 'ar' ) {
        this.showWarn('', 'يرجى اختيار خيار النشر');
       } else {
        this.showWarn('', 'Please select a publishing option');
       }
      return; // Don't advance to next step
    }
    
    // If scheduled publish is selected, validate the publish date
    if (currentAccount.publish_status === 'scheduled' && !currentAccount.publish_date_time) {
      if( this.lang === 'ar' ) {
        this.showWarn('', 'يرجى اختيار تاريخ ووقت النشر');
       } else {
        this.showWarn('', 'Please select a publish date and time');
       }
      return; // Don't advance to next step
    }
    
    this.isLoading = true;
    
    // Prepare the publish request based on the selected option
    const publishRequest = {
      status: currentAccount.publish_status || 'unpublished',
      published_at: currentAccount.publish_date_time || this.getCurrentDateTime()
    };
    
    // Only set published_at for scheduled or immediate publish
    if (publishRequest.status === 'unpublished') {
      publishRequest.published_at = '';
    }

    // Make the API call to publish the knowledge
    this.addInsightStepsService.publishKnowledge(this.knowledgeId, publishRequest)
      .subscribe({
        next: (response) => {
          
          // If in edit mode and this is the final step, navigate back to knowledge details
          if (this.isEditMode && nextStep > this.formsCount) {
            this.router.navigate([`/app/my-knowledge-base/view-my-knowledge/${this.knowledgeId}/details`]);
          } else {
            this.currentStep$.next(nextStep);
          }
          
          this.isLoading = false;
        },
        error: (error) => {
          console.error('Error publishing knowledge', error);
          this.handleServerErrors(error);
          this.isLoading = false;
        }
      });
  }

  private getCurrentDateTime(): string {
    const now = new Date();
    
    const year = now.getFullYear();
    const month = this.padZero(now.getMonth() + 1);
    const day = this.padZero(now.getDate());
    
    const hours = this.padZero(now.getHours());
    const minutes = this.padZero(now.getMinutes());
    const seconds = this.padZero(now.getSeconds());
    
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  }

  private padZero(num: number): string {
    return num < 10 ? `0${num}` : `${num}`;
  }

  prevStep() {
    const prevStep = this.currentStep$.value - 1;
    if (prevStep === 0) {
      return;
    }
    this.currentStep$.next(prevStep);
    this.syncDraftFlagForExternalRedirect();
  }

  private handleServerErrors(error: any) {
    if (error.error && error.error.errors) {
      const serverErrors = error.error.errors;
      
      // Check for document-related errors first
      const hasDocumentErrors = Object.keys(serverErrors).some(key => key.startsWith('documents.'));
      
      if (hasDocumentErrors && this.knowledgeId && this.documentsComponent) {
        // Get fresh document information from the server
        this.knowledgeService.getListDocumentsInfo(this.knowledgeId)
          .subscribe({
            next: (response) => {
              const documentsInfo = response.data;
              
              // Now process errors with updated document information
              this.processServerErrors(serverErrors, documentsInfo);
            },
            error: (err) => {
              // Fallback to regular error processing if document info can't be fetched
              this.processServerErrors(serverErrors);
            }
          });
      } else {
        // Process errors normally if no document errors or no document component
        this.processServerErrors(serverErrors);
      }
    } else {
      this.showError('Error', 'An unexpected error occurred.');
    }
  }
  
  private processServerErrors(serverErrors: any, documentsInfo?: any[]) {
    for (const key in serverErrors) {
      if (serverErrors.hasOwnProperty(key)) {
        const messages = serverErrors[key];
        
        // Check if the key follows the 'documents.ID' pattern
        const documentsRegex = /^documents\.(\d+)$/;
        const match = key.match(documentsRegex);
        
        if (match && match[1]) {
          // Extract the document ID
          const documentId = parseInt(match[1], 10);
          
          // Try to find document in the updated documents list first
          let documentName = "";
          if (documentsInfo) {
            const serverDoc = documentsInfo.find(doc => doc.id === documentId);
            if (serverDoc) {
              documentName = serverDoc.file_name;
            }
          }
          
          // If not found in server documents, try the component's documents array
          if (!documentName && this.documentsComponent?.documents) {
            const document = this.documentsComponent.documents.find((doc: any) => doc.id === documentId);
            if (document) {
              documentName = document.file_name;
            }
          }
          
          if (documentName) {
            // Show error with document name
            this.showError(`${documentName}`, messages.join(', '));
          } else {
            // Fallback if document not found
            this.showError(`Document ID ${documentId}`, messages.join(', '));
          }
        } else {
          // For other keys, show the normal error
          this.showError(key, messages.join(', '));
        }
      }
    }
  }

  // Public method to check for upload errors - used in template
  hasAnyUploadErrors(): boolean {
    return this.hasAnyDocumentUploadErrors();
  }

  // Helper method to get the current step component by step number
  private getCurrentStepComponent(stepNumber: number): any {
    // For step 3, we need to access its validation method
    if (stepNumber === 3) {
      return this.step3Component;
    }
    // For step 4, we need to access its validation method
    if (stepNumber === 4) {
      return this.step4Component;
    }
    // For step 5, we need to access its validation method
    if (stepNumber === 5) {
      return this.step5Component;
    }
    return null;
  }

  /**
   * Checks if the selected regions represent all possible regions (worldwide)
   */
  private checkIfWorldwide(selectedRegions: any[]): Observable<boolean> {
    if (!selectedRegions || selectedRegions.length === 0) {
      return new Observable<boolean>(observer => {
        observer.next(false);
        observer.complete();
      });
    }
    
    return this.regionsService.getAllRegionIds().pipe(
      map((allRegionIds: number[]) => {
        // If the count matches and every region ID is included
        const selectedRegionIds = selectedRegions.map((region: any) => region.id);
        return allRegionIds.length === selectedRegionIds.length && 
               allRegionIds.every(regionId => selectedRegionIds.includes(regionId));
      })
    );
  }
}
