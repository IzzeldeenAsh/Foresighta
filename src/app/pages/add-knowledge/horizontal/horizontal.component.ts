import { Component, Injector, OnDestroy, OnInit } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { ICreateKnowldege, inits } from '../create-account.helper';
import { AddInsightStepsService, CreateKnowledgeRequest, SuggestTopicRequest, AddKnowledgeDocumentRequest, SyncTagsKeywordsRequest, PublishKnowledgeRequest } from 'src/app/_fake/services/add-insight-steps/add-insight-steps.service';
import { switchMap } from 'rxjs/operators';
import { BaseComponent } from 'src/app/modules/base.component';
import { of } from 'rxjs';

@Component({
  selector: 'app-horizontal',
  templateUrl: './horizontal.component.html',
  styleUrls: ['./horizontal.component.scss'],
})
export class HorizontalComponent extends BaseComponent implements OnInit {
  formsCount = 6;
  knowledgeId!: number;
  account$: BehaviorSubject<ICreateKnowldege> =
    new BehaviorSubject<ICreateKnowldege>(inits);
  currentStep$: BehaviorSubject<number> = new BehaviorSubject(1);
  isCurrentFormValid$: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(
    false
  );
  isLoading = false;

  constructor(
    injector: Injector,
    private addInsightStepsService: AddInsightStepsService
  ) {
    super(injector);
  }

  ngOnInit(): void {}

  updateAccount = (part: Partial<ICreateKnowldege>, isFormValid: boolean) => {
    const currentAccount = this.account$.value;
    const updatedAccount = { ...currentAccount, ...part };
    this.account$.next(updatedAccount);
    this.isCurrentFormValid$.next(isFormValid);
    console.log("account", this.account$.value);
  };

  nextStep() {
    const nextStep = this.currentStep$.value + 1;
    if (nextStep > this.formsCount) {
      return;
    }

    // Handle step 2 submission
    if (this.currentStep$.value === 2) {
      this.handleStep2Submission(nextStep);
    } else if (this.currentStep$.value === 3) {
      this.handleStep3Submission(nextStep);
    } else if (this.currentStep$.value === 4) {
      this.isLoading = true;
      const currentAccount = this.account$.value;

      // Convert keywords objects to string array
      const keywordsArray = currentAccount.keywords.map(k => k.value);

      const syncRequest: SyncTagsKeywordsRequest = {
        keywords: keywordsArray,
        tag_ids: currentAccount.tag_ids
      };

      const step4Sub = this.addInsightStepsService
        .syncTagsKeywords(this.knowledgeId, syncRequest)
        .subscribe({
          next: (response) => {
            console.log('Tags and keywords synced successfully', response);
            this.currentStep$.next(nextStep);
            this.isLoading = false;
          },
          error: (error) => {
            this.handleServerErrors(error);
            this.isLoading = false;
          }
        });

      this.unsubscribe.push(step4Sub);
    } else if (this.currentStep$.value === 5) {
      this.handleStep5Submission(nextStep);
    } else {
      // For other steps, just proceed without loading state
      this.currentStep$.next(nextStep);
    }
  }

  /**
   * Handles the submission logic for Step 5.
   * @param nextStep The next step number to navigate to.
   */
  private handleStep5Submission(nextStep: number) {
    const currentAccount = this.account$.value;
    const publishStatus = currentAccount.publish_status;

    if (publishStatus === 'draft') {
      // Proceed to the next step without publishing
      this.currentStep$.next(nextStep);
      return;
    }

    const publishRequest: PublishKnowledgeRequest = {
      status: publishStatus === 'now' ? 'published' : 'scheduled',
      published_at: publishStatus === 'now' ? this.getCurrentDateTime() : currentAccount.publish_date_time
    };

    this.isLoading = true;

    this.addInsightStepsService.publishKnowledge(this.knowledgeId, publishRequest)
      .subscribe({
        next: (response) => {
          console.log('Knowledge published successfully', response);
          this.currentStep$.next(nextStep);
          this.isLoading = false;
        },
        error: (error) => {
          this.handleServerErrors(error);
          this.isLoading = false;
        }
      });
  }

  /**
   * Returns the current date and time formatted as "YYYY-MM-DD HH:mm:ss".
   */
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

  /**
   * Pads a number with a leading zero if it's less than 10.
   * @param num The number to pad.
   */
  private padZero(num: number): string {
    return num < 10 ? `0${num}` : `${num}`;
  }

  prevStep() {
    const prevStep = this.currentStep$.value - 1;
    if (prevStep === 0) {
      return;
    }
 
    this.currentStep$.next(prevStep);
  }


  private handleServerErrors(error: any) {
    if (error.error && error.error.errors) {
      const serverErrors = error.error.errors;
      for (const key in serverErrors) {
        if (serverErrors.hasOwnProperty(key)) {
          const messages = serverErrors[key];
         this.showError('',messages.join(", "));
        }
      }
    } else {
  
      this.showError('','An unexpected error occurred.');
    }
  }


  handleStep2Submission(nextStep: number) {
    this.isLoading = true;
    const currentAccount = this.account$.value;
    
    // Prepare the knowledge request
    const knowledgeRequest: CreateKnowledgeRequest = {
      type: currentAccount.knowledgeType,
      title: currentAccount.title,
      description: currentAccount.description,
      topic_id: currentAccount.topicId,
      industry_id: currentAccount.industry || 0,
      isic_code_id: currentAccount.isic_code ? currentAccount.isic_code : null,
      hs_code_id: currentAccount.hs_code ? currentAccount.hs_code : null,
      language: currentAccount.language,
      // Set region/country or economic_blocks based on targetMarket
      ...(currentAccount.targetMarket === '2' ? {
        region: currentAccount.regions || [],
        country: currentAccount.countries || [],
        economic_blocks: []
      } : {
        region: [],
        country: [],
        economic_blocks: currentAccount.economic_blocks || []
      })
    };

    let submitObservable;

    if (this.knowledgeId) {
      // **Update Scenario**
      if (currentAccount.customTopic.trim() !== '') {
        // If customTopic is provided, create a new topic
        const topicRequest: SuggestTopicRequest = {
          industry_id: currentAccount.industry || 0,
          name: {
            en: currentAccount.customTopic,
            ar: currentAccount.customTopic
          }
        };

        submitObservable = this.addInsightStepsService.createSuggestTopic(topicRequest, this.lang)
          .pipe(
            switchMap(response => {
              // Update the knowledge request with the new topic ID
              knowledgeRequest.topic_id = response.data.topic_id;
              
              // Update account with new topic ID and clear custom topic
              this.updateAccount({
                topicId: response.data.topic_id,
                customTopic: ''
              }, true);

              return this.addInsightStepsService.step2UpdateKnowledge(this.knowledgeId, knowledgeRequest);
            })
          );
      } else {
        // If no customTopic, directly update knowledge
        submitObservable = this.addInsightStepsService.step2UpdateKnowledge(this.knowledgeId, knowledgeRequest);
      }
    } else {
      // **Create Scenario**
      if (currentAccount.customTopic.trim() !== '') {
        // If customTopic is provided, create a new topic first
        const topicRequest: SuggestTopicRequest = {
          industry_id: currentAccount.industry || 0,
          name: {
            en: currentAccount.customTopic,
            ar: currentAccount.customTopic
          }
        };

        submitObservable = this.addInsightStepsService.createSuggestTopic(topicRequest, this.lang)
          .pipe(
            switchMap(response => {
              // Update the knowledge request with the new topic ID
              knowledgeRequest.topic_id = response.data.topic_id;
              
              // Update account with new topic ID and clear custom topic
              this.updateAccount({
                topicId: response.data.topic_id,
                customTopic: ''
              }, true);

              return this.addInsightStepsService.step2CreateKnowledge(knowledgeRequest);
            })
          );
      } else {
        // If no customTopic, directly create knowledge
        submitObservable = this.addInsightStepsService.step2CreateKnowledge(knowledgeRequest);
      }
    }

    const submitSub = submitObservable.subscribe({
      next: (response) => {
        console.log('Knowledge processed successfully', response);
        if (!this.knowledgeId && response.data.knowledge_id) {
          this.knowledgeId = response.data.knowledge_id;
          this.updateAccount({
            knowledgeId: response.data.knowledge_id
          }, true);
        }
        this.currentStep$.next(nextStep);
        this.isLoading = false;
      },
      error: (error) => {
        this.handleServerErrors(error);
        this.isLoading = false;
      }
    });

    this.unsubscribe.push(submitSub);
  }

  handleStep3Submission(nextStep: number) {
    this.isLoading = true;
    const currentAccount = this.account$.value;

    // Optional safeguard: ensure we have knowledgeId from step 2
    if (!this.knowledgeId) {
      console.error('No knowledge ID found. Please complete step 2 first.');
      return;
    }

    // Check whether we have existing documents (to decide isUpdate)
    const listDocs$ = this.addInsightStepsService
      .getListDocumentsInfo(this.knowledgeId);

    const step3Sub = listDocs$
      .pipe(
        switchMap((listResponse) => {
          const existingDocs = listResponse.data || [];
          
          // Process each document in the currentAccount.documents array
          const documentRequests = currentAccount.documents.map((doc: any) => {
            // Find matching existing document if any
            const existingDoc = existingDocs.find(existing => 
              existing.file_name === doc.file_name
            );
            
            let documentRequest: AddKnowledgeDocumentRequest = {
              file_name: doc.file_name,
              price: doc.price?.toString() || '0',
              file: doc.file,
              status: doc.status || 'active',
            };

            // Add description for non-insight knowledge types
            if (currentAccount.knowledgeType !== 'insight') {
              documentRequest.description = doc.description || '';
              
              // Existing table_of_content logic remains the same
              const table_of_content = JSON.parse(doc.table_of_content);
              const chaptersArray = table_of_content.chapters;

              const transformedChapters = chaptersArray.map((chapter: any) => ({
                chapter: {
                  title: chapter.name,
                  sub_child: chapter.subChapters.map((sub: any) => ({
                    title: sub.name,
                    page: sub.index.toString(),
                  })),
                },
              }));

              documentRequest.table_of_content = JSON.stringify(transformedChapters);
            }

            // Return object containing request and metadata
            return {
              request: documentRequest,
              isUpdate: !!existingDoc,
              documentId: existingDoc?.id
            };
          });

          // Process documents sequentially
          return documentRequests.reduce((chain, docData) => {
            return chain.pipe(
              switchMap(() => this.addInsightStepsService.step3AddKnowledgeDocument(
                docData.isUpdate ? (docData.documentId || this.knowledgeId) : this.knowledgeId,
                docData.request,
                docData.isUpdate
              ))
            );
          }, of(null)); // Start with empty observable
        })
      )
      .subscribe({
        next: (response) => {
          console.log('All documents processed successfully');
          this.currentStep$.next(nextStep);
          this.isLoading = false;
        },
        error: (error) => {
          this.handleServerErrors(error);
          this.isLoading = false;
        }
      });

    this.unsubscribe.push(step3Sub);
  }
}
