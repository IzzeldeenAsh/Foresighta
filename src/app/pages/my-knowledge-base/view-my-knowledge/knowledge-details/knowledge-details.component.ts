import { Component, Injector, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { DocumentInfo, AddInsightStepsService, AddKnowledgeDocumentRequest, Chapter, UpdateKnowledgeAbstractsRequest, DocumentParserResponse } from 'src/app/_fake/services/add-insight-steps/add-insight-steps.service';
import { Knowledge, KnowledgeService } from 'src/app/_fake/services/knowledge/knowledge.service';
import { KnowledgeUpdateService } from 'src/app/_fake/services/knowledge/knowledge-update.service';
import { BaseComponent } from 'src/app/modules/base.component';
import Swal from 'sweetalert2';
import { NgbTooltipModule } from '@ng-bootstrap/ng-bootstrap';
import { FormBuilder, FormGroup, FormArray, Validators, ReactiveFormsModule } from '@angular/forms';
import { trigger, transition, style, animate } from '@angular/animations';
import { DialogModule } from 'primeng/dialog';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { MenuItem } from 'primeng/api';
import { MenuModule } from 'primeng/menu';

interface ChapterItem {
  title: string;
  id?: number;
  page_number?: number;
}

// Create an extended interface
interface ExtendedDocumentInfo extends DocumentInfo {
  docUrl?: string;
  fileIcon?: string;
}

@Component({
  selector: 'app-knowledge-details',
  templateUrl: './knowledge-details.component.html',
  styleUrl: './knowledge-details.component.scss',

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
export class KnowledgeDetailsComponent extends BaseComponent implements OnInit {
  knowledgeId: string;
  knowledge: Knowledge;
  documents: DocumentInfo[] = [];
  isLoading: boolean = false;
  displayDocumentDialog = false;
  editingDocument: ExtendedDocumentInfo | null = null;
  docForm: FormGroup;
  previewFilesDialog: any[] = [];
  isSaving: boolean = false;
  headerTitle = 'Document Details';
  isUploadAreaHovered = false;

  // Add animation states
  hoveredDocumentId: number | null = null;
  activeDocumentId: number | null = null;
  animationStates: { [key: number]: string } = {};

  // Add new properties for insight documents
  insightDocForm: FormGroup;
  displayInsightDialog = false;

  // Add new properties for the stepper approach
  showDocumentStepper = false;
  documentStep = 1;
  documentForm: FormGroup;
  selectedFile: File | null = null;
  selectedFileName: string = '';
  selectedFileIcon: string = '';
  isGeneratingAbstract = false;
  abstractError = false;
  showChapters = false;
  newChapterTitle = '';
  stepperChapters: ChapterItem[] = [];
  editorInstance: any;

  // Language mismatch dialog properties
  showLanguageMismatchDialog = false;
  languageMismatchTitle = '';
  languageMismatchMessage = '';
  languageMismatchDocuments: string[] = [];
  private languageMismatchResolver: ((value: boolean) => void) | null = null;

  documentsDummy:any = [
    {
      id: 1,
      file_name: 'Market Analysis Study',
      file_extension: 'xlsx',
      file_size: 2048000, // 2 MB
      price: 49.99,
      description: 'A detailed project report covering all aspects of the project, including milestones and outcomes.',
      highlighted: false
    },
    {
      id: 2,
      file_name: 'Industry Trends Study',
      file_extension: 'doc',
      file_size: 102400, // 100 KB
      price: 29.99,
      description: 'The wireframe design for the upcoming application project.',
      highlighted: true
    },
    {
      id: 3,
      file_name: 'Consumer Behavior Study',
      file_extension: 'docx',
      file_size: 512000, // 500 KB
      price: 19.99,
      description: 'Summary and action items from the team meeting held last week.',
      highlighted: false
    },
    {
      id: 4,
      file_name: 'Financial Impact Study',
      file_extension: 'pdf',
      file_size: 307200, // 300 KB
      price: 24.99,
      description: 'A detailed budget breakdown for the financial year 2023.',
      highlighted: false
    },
    {
      id: 5,
      file_name: 'Competitive Analysis Study',
      file_extension: 'pptx',
      file_size: 1048576, // 1 MB
      price: 39.99,
      description: 'Presentation slides for the upcoming stakeholder meeting.',
      highlighted: false
    },
    {
      id: 6,
      file_name: 'Risk Assessment Study',
      file_extension: 'txt',
      file_size: 0, // 0 bytes
      price: 0.00,
      description: null, // No description provided
      highlighted: false
    },
  ];

  docActions: MenuItem[] = [
    {
      label: 'Edit',
      icon: 'ki-duotone ki-pencil',
      command: (event) => {
        if (event.item?.data) {
          this.editDocument(event.item.data, new Event('click'));
        }
      }
    },
    {
      label: 'Delete',
      icon: 'ki-duotone ki-trash',
      command: (event) => {
        if (event.item?.data) {
          this.deleteDocument(event.item.data, new Event('click'));
        }
      }
    }
    
  ];

  setMenuData(doc: DocumentInfo): void {
    this.docActions.forEach(item => {
      item.data = doc;
    });
  }

  constructor(
    injector: Injector,
    private route: ActivatedRoute,
    private knowledgeService: KnowledgeService,
    private addInsightStepsService: AddInsightStepsService,
    private knowledgeUpdateService: KnowledgeUpdateService,
    private fb: FormBuilder
  ) {
    super(injector);
    this.initDocForm();
    this.initInsightDocForm();
  }

  private initDocForm(): void {
    this.docForm = this.fb.group({
      file_name: ['', Validators.required],
      description: [''],
      table_of_content: this.fb.array([]),
      price: [0, [Validators.required, Validators.min(0)]],
      file: [null],
      file_extension: ['']
    });
    this.previewFilesDialog = [];
    this.addFormChapter(); // Add initial chapter
  }

  private initInsightDocForm(): void {
    this.insightDocForm = this.fb.group({
      file_name: ['', [Validators.required]],
      price: [0, [Validators.required, Validators.min(0)]],
      file: [null],
      filePreview: [false],
      fileIcon: [''],
      file_extension: [''],
      fromServer: [false],
      docId: [null],
      file_size: [null],
      docUrl: ['']
    });
  }

  get chapters(): FormArray {
    return this.docForm.get('table_of_content') as FormArray;
  }

  private createChapter(): FormGroup {
    return this.fb.group({
      chapter: this.fb.group({
        title: ['', Validators.required],
        sub_child: this.fb.array([])
      })
    });
  }

  addFormChapter(): void {
    if (!this.newChapterTitle || !this.newChapterTitle.trim()) {
      return; // Don't add empty chapters
    }
    
    this.stepperChapters.push({
      title: this.newChapterTitle.trim()
    });
    
    this.newChapterTitle = '';
  }

  removeFormChapter(index: number): void {
    this.stepperChapters.splice(index, 1);
  }

  loadChapters(chaptersData: any[]) {
    this.chapters.clear();
    if (chaptersData?.length) {
      chaptersData.forEach(ch => {
        const chapterGroup = this.createChapter();
        chapterGroup.patchValue({
          chapter: {
            title: ch.chapter?.title || ''
          }
        });
        this.chapters.push(chapterGroup);
      });
    } else {
      this.addFormChapter();
    }
  }

  ngOnInit(): void {
    // Get the ID from the parent route
    this.route.parent?.params.subscribe(params => {
      this.knowledgeId = params['id'];
      if (this.knowledgeId) {
        this.loadKnowledge();
        this.loadDocuments();
      }
    });

    // Initialize animation states for each document
    this.documents.forEach(doc => {
      this.animationStates[doc.id] = 'initial';
    });
  }

  private loadKnowledge(): void {
    this.isLoading = true;
    this.knowledgeService.getKnowledgeById(Number(this.knowledgeId))
      .subscribe({
        next: (response) => {
          this.knowledge = response.data;
          this.isLoading = false;
        },
        error: (error) => {
          console.error('Error loading knowledge:', error);
          this.isLoading = false;
        }
      });
  }

  private loadDocuments(): void {
    this.isLoading = true;
    this.knowledgeService.getListDocumentsInfo(Number(this.knowledgeId))
      .subscribe({
        next: (response) => {
          this.documents = response.data;
        
          this.isLoading = false;
        },
        error: (error) => {
          console.error('Error loading documents:', error);
          this.isLoading = false;
        }
      });
  }

  // Enhanced toggle collapse with animation
  toggleCollapse(docId: number, event: Event): void {
    event.stopPropagation();
    // Set the document data for menu items
    const doc = this.documents.find(d => d.id === docId);
    if (doc) {
      this.setMenuData(doc);
    }
    
    if (this.activeDocumentId === docId) {
      // If clicking the active document, deactivate it
      this.activeDocumentId = null;
    } else {
      // If clicking a new document, activate it
      this.activeDocumentId = docId;
    }
    this.animationStates[docId] = this.activeDocumentId === docId ? 'expanded' : 'collapsed';
  }

  // Enhanced hover handlers
  onDocumentMouseEnter(docId: number): void {
    this.hoveredDocumentId = docId;
    if (this.activeDocumentId !== docId) {
      this.animationStates[docId] = 'hovered';
    }
  }

  onDocumentMouseLeave(docId: number): void {
    this.hoveredDocumentId = null;
    if (this.activeDocumentId !== docId) {
      this.animationStates[docId] = 'initial';
    }
  }

  // Example file-icon mapping method
  getFileIconByExtension(fileExtension: string): string {
    // Adjust this method to match your current logic / icon paths
    const iconMap: { [key: string]: string } = {
      pdf: './assets/media/svg/new-files/pdf.svg',
      doc: './assets/media/svg/new-files/doc.svg',
      docx: './assets/media/svg/new-files/docx.svg',
      xls: './assets/media/svg/new-files/xls.svg',
      ppt: './assets/media/svg/new-files/ppt.svg',
      pptx: './assets/media/svg/new-files/pptx.svg',
      txt: './assets/media/svg/new-files/txt.svg',
      zip: './assets/media/svg/new-files/zip.svg',
      xlsx: './assets/media/svg/new-files/xlsx.svg',
      default: './assets/media/svg/new-files/default.svg',
    };
    const ext = fileExtension.toLowerCase();
    return iconMap[ext] || iconMap.default;
  }

  editDocument(doc: DocumentInfo, event: Event): void {
    this.editDocumentWithStepper(doc, event);
  }

  saveDocument(): void {
    if (this.docForm.invalid) {
      this.docForm.markAllAsTouched();
      return;
    }

    if (!this.docForm.get('file')?.value && !this.editingDocument) {
      Swal.fire({
        title: 'Error!',
        text: 'Please select a file to upload',
        icon: 'error',
        confirmButtonText: 'OK'
      });
      return;
    }

    this.isSaving = true;
    const formValue = this.docForm.value;

    const request: any = {
      file_name: formValue.file_name,
      price: formValue.price.toString(),
      description: formValue.description || '',
      status: 'active'
    };

    if (this.knowledge?.type !== 'insight') {
      // Add table of content for non-insight types
      request.table_of_content = this.chapters.controls.map(control => ({
        chapter: {
          title: control.get('chapter.title')?.value?.trim() || ''
        }
      })).filter(ch => ch.chapter.title !== '');
    }

    if (formValue.file) {
      request.file = formValue.file;
    }

    // If we have an editingDocument, it's an update operation
    // Otherwise, it's a new document
    const documentId = this.editingDocument?.id || Number(this.knowledgeId);
    const isUpdate = !!this.editingDocument;

    this.addInsightStepsService.step3AddKnowledgeDocument(
      documentId,
      request,
      isUpdate
    ).subscribe({
      next: () => {
        this.loadDocuments();
        this.closeDialog();
        Swal.fire({
          title: 'Success!',
          text: isUpdate ? 'Document updated successfully' : 'Document added successfully',
          icon: 'success',
          confirmButtonText: 'OK'
        });
      },
      error: (error) => {
        console.error('Error saving document:', error);
        Swal.fire({
          title: 'Error!',
          text: isUpdate ? 'Failed to update document' : 'Failed to add document',
          icon: 'error',
          confirmButtonText: 'OK'
        });
      },
      complete: () => {
        this.isSaving = false;
      }
    });
  }

  closeDialog(): void {
    this.displayDocumentDialog = false;
    this.editingDocument = null;
    this.initDocForm();
  }

  onFilesSelectedDialog(event: any): void {
    const files: FileList = event.target.files;
    if (files.length > 0) {
      const file = files[0];
      const fileExtension = this.getFileExtension(file.name);
      
      this.docForm.patchValue({ 
        file,
        file_extension: fileExtension
      });
      
      this.previewFilesDialog = [{
        file,
        name: file.name,
        size: file.size,
        preview: null,
        type: this.getFileTypeByExtension(file.name),
        icon: this.getFileIconByExtension(fileExtension)
      }];
    }
  }

  removeFileDialog(preview: any): void {
    this.previewFilesDialog = [];
    this.docForm.patchValue({ file: null });
  }

  private getFileTypeByExtension(fileName: string): string {
    const extension = (fileName.split('.').pop() || '').toLowerCase();
    const typeMap: { [key: string]: string } = {
      pdf: 'pdf',
      doc: 'word',
      docx: 'word',
      xls: 'excel',
      xlsx: 'excel',
      ppt: 'powerpoint',
      pptx: 'powerpoint',
      txt: 'text',
      zip: 'archive',
      rar: 'archive',
      csv: 'excel',
      rtf: 'document',
    };
    return typeMap[extension] || 'document';
  }

  private getFileExtension(filename: string): string {
    if (!filename) return '';
    const match = filename.match(/\.([^.]+)$/);
    return match ? match[1].toUpperCase() : '';
  }

  deleteDocument(doc: DocumentInfo, event: Event): void {
    event.stopPropagation();
    
    Swal.fire({
      title: 'Are you sure?',
      text: "You won't be able to revert this!",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33',
      confirmButtonText: 'Yes, delete it!'
    }).then((result) => {
      if (result.isConfirmed) {
        this.addInsightStepsService.deleteKnowledgeDocument(doc.id)
          .subscribe({
            next: () => {
              this.loadDocuments(); // Refresh the documents list
              
              // Notify the parent component to update total_price
              this.knowledgeUpdateService.notifyKnowledgeUpdate();
              
              Swal.fire(
                'Deleted!',
                'Document has been deleted.',
                'success'
              );
            },
            error: (error) => {
              console.error('Error deleting document:', error);
              Swal.fire(
                'Error!',
                'Failed to delete document.',
                'error'
              );
            }
          });
      }
    });
  }

  unpublishDocument(doc: DocumentInfo, event: Event): void {
    event.stopPropagation();
    
    Swal.fire({
      title: 'Unpublish Document',
      text: "Are you sure you want to unpublish this document?",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33',
      confirmButtonText: 'Yes, unpublish it!'
    }).then((result) => {
      if (result.isConfirmed) {
        const request = {
          status: 'draft',
          published_at: new Date().toISOString()
        };

        this.addInsightStepsService.publishKnowledge(doc.id, request)
          .subscribe({
            next: () => {
              this.loadDocuments(); // Refresh the documents list
              Swal.fire(
                'Unpublished!',
                'Document has been unpublished.',
                'success'
              );
            },
            error: (error) => {
              console.error('Error unpublishing document:', error);
              Swal.fire(
                'Error!',
                'Failed to unpublish document.',
                'error'
              );
            }
          });
      }
    });
  }

  openPreview(preview: any): void {
    if (preview.fromServer && preview.preview) {
      // Open server URL in new tab
      window.open(preview.preview, '_blank');
    } else if (preview.docId) {
      // If we don't have the URL yet, fetch it
      this.addInsightStepsService.getDocumentUrl(preview.docId).subscribe({
        next: (response) => {
          window.open(response.data.url, '_blank');
        },
        error: (error) => {
          console.error('Error getting document URL:', error);
          Swal.fire({
            title: 'Error!',
            text: 'Failed to open document',
            icon: 'error',
            confirmButtonText: 'OK'
          });
        }
      });
    } else if (preview.file) {
      // Handle local file preview (for newly uploaded files)
      const objectUrl = URL.createObjectURL(preview.file);
      window.open(objectUrl, '_blank');
      setTimeout(() => URL.revokeObjectURL(objectUrl), 100);
    }
  }

  saveInsightDocument(): void {
    if (this.insightDocForm.invalid) {
      this.insightDocForm.markAllAsTouched();
      return;
    }

    if (!this.insightDocForm.get('file')?.value && !this.editingDocument) {
      Swal.fire({
        title: 'Error!',
        text: 'Please select a file to upload',
        icon: 'error',
        confirmButtonText: 'OK'
      });
      return;
    }

    this.isSaving = true;
    const formValue = this.insightDocForm.value;

    const request: any = {
      file_name: formValue.file_name,
      price: formValue.price.toString(),
      status: 'active'
    };

    if (formValue.file) {
      request.file = formValue.file;
    }

    // If we have an editingDocument, it's an update operation
    // Otherwise, it's a new document
    const documentId = this.editingDocument?.id || Number(this.knowledgeId);
    const isUpdate = !!this.editingDocument;

    this.addInsightStepsService.step3AddKnowledgeDocument(
      documentId,
      request,
      isUpdate
    ).subscribe({
      next: () => {
        this.loadDocuments();
        this.closeInsightDialog();
        this.knowledgeUpdateService.notifyKnowledgeUpdate(); // Notify parent about the update
        Swal.fire({
          title: 'Success!',
          text: isUpdate ? 'Document updated successfully' : 'Document added successfully',
          icon: 'success',
          confirmButtonText: 'OK'
        });
      },
      error: (error) => {
        console.error('Error saving document:', error);
        Swal.fire({
          title: 'Error!',
          text: isUpdate ? 'Failed to update document' : 'Failed to add document',
          icon: 'error',
          confirmButtonText: 'OK'
        });
      },
      complete: () => {
        this.isSaving = false;
      }
    });
  }

  closeInsightDialog(): void {
    this.displayInsightDialog = false;
    this.editingDocument = null;
    this.initInsightDocForm();
  }

  onInsightFileSelected(event: any): void {
    const files: FileList = event.target.files;
    if (files.length > 0) {
      const file = files[0];
      const extension = this.getFileExtension(file.name);
      
      this.insightDocForm.patchValue({
        file: file,
        filePreview: true,
        fileIcon: this.getFileIconByExtension(extension),
        file_extension: extension,
        fromServer: false,
        docId: null,
        file_size: file.size
      });
    }
  }

  openNewDocumentDialog(): void {
    this.editingDocument = null;
    
    // First initialize the form
    if (this.knowledge?.type === 'insight') {
      this.initInsightDocForm();
      this.headerTitle = this.lang === 'en' ? 'Add New Document' : 'إضافة مستند جديد';
      
      // Then show dialog after a slight delay to ensure form is ready
      setTimeout(() => {
        this.displayInsightDialog = true;
      }, 0);
    } else {
      this.initDocForm();
      
      if (this.knowledge?.type === 'data') {
        this.headerTitle = this.lang === 'en' ? 'Add New Node' : 'إضافة عقدة جديدة';
      } else {
        this.headerTitle = this.lang === 'en' ? 'Add New Chapter' : 'إضافة فصل جديد';
      }
      
      // Then show dialog after a slight delay to ensure form is ready
      setTimeout(() => {
        this.displayDocumentDialog = true;
      }, 0);
    }
  }

  shouldShowTableOfContents(doc: DocumentInfo): boolean {
    return  !!doc?.table_of_content?.length;
  }

  isInsightType(): boolean {
    return this.knowledge?.type === 'insight';
  }

  editorInit = {
    height: 300,
    menubar: false,
    plugins: [
      'advlist autolink lists link image charmap print preview anchor',
      'searchreplace visualblocks code fullscreen',
      'insertdatetime media table paste code help wordcount'
    ],
    toolbar: 'undo redo | formatselect | bold italic backcolor | alignleft aligncenter alignright alignjustify | bullist numlist outdent indent | removeformat | help',
    branding: false,
    elementpath: false,
    setup: (editor: any) => {
      editor.on('init', () => {
        setTimeout(() => {
          editor.focus();
        }, 500);
      });
    }
  };

  private initDocumentForm(): void {
    this.documentForm = this.fb.group({
      file_name: ['', Validators.required],
      description: ['', Validators.required],
      price: [0, [Validators.required, Validators.min(0)]],
      isCharity: [false],
      file: [null],
      file_extension: [''],
      fileIcon: [''],
      docUrl: [''],
      fromServer: [false],
      id: [null]
    });

    // When isCharity changes, handle price validation
    this.documentForm.get('isCharity')?.valueChanges.subscribe(isCharity => {
      const priceControl = this.documentForm.get('price');
      if (isCharity) {
        priceControl?.setValue(0);
        priceControl?.disable();
      } else {
        priceControl?.enable();
      }
    });
  }

  openDocumentStepper(): void {
    this.showDocumentStepper = true;
    this.documentStep = 1;
    this.editingDocument = null;
    this.initDocumentForm();
    this.selectedFile = null;
    this.selectedFileName = '';
    this.selectedFileIcon = '';
    this.showChapters = false;
    this.stepperChapters = [];
    this.newChapterTitle = '';
  }

  closeDocumentStepper(): void {
    this.showDocumentStepper = false;
    this.documentStep = 1;
    this.editingDocument = null;
    this.selectedFile = null;
  }

  triggerFileInput(): void {
    document.getElementById('documentFileInput')?.click();
  }

  onFileSelected(event: any): void {
    const file = event.target.files[0];
    if (file) {
      this.selectedFile = file;
      this.selectedFileName = file.name;
      const extension = this.getFileExtension(file.name);
      this.selectedFileIcon = this.getFileIconByExtension(extension);
      
      // Update form values
      this.documentForm.patchValue({
        file: file,
        file_name: this.selectedFileName.substring(0, this.selectedFileName.lastIndexOf('.')),
        file_extension: extension
      });

      // If adding a new document (not editing), upload the file immediately
      if (!this.editingDocument) {
        this.uploadSelectedFile(file);
      }
    }
  }

  uploadSelectedFile(file: File): void {
    // Show loading indicator
    this.isLoading = true;
    const formData = new FormData();
    formData.append('file', file);
    
    this.addInsightStepsService.uploadKnowledgeDocument(+this.knowledgeId, formData)
      .subscribe({
        next: (response: any) => {
          this.isLoading = false;
          console.log('Upload response:', response); // Log the response for debugging
          
          // Handle both possible response structures
          const documentId = response?.data?.document_id || response?.data?.knowledge_document_id;
          
          if (documentId) {
            console.log('Document ID received:', documentId);
            
            // Store the document ID for later use
            this.documentForm.patchValue({
              id: documentId
            });
            
            // Show success message
            if(this.lang=='ar'){
              this.showSuccess('', 'تم رفع الملف بنجاح. يرجى إكمال تفاصيل المستند.');
            }else{
              this.showSuccess('', 'File uploaded successfully. Please complete the document details.');
            }
            // Don't update document details here, wait for Next button
          } else {
            console.error('No document ID in the response:', response);
            this.showError('', 'Error in server response: no document ID returned');
          }
        },
        error: (error) => {
          this.isLoading = false;
          console.error('Upload error:', error);
          this.showError('', error?.error?.message || 'Error uploading file');
          // Reset the file input
          this.selectedFile = null;
          this.selectedFileName = '';
          this.selectedFileIcon = '';
          this.documentForm.patchValue({
            file: null,
            file_extension: ''
          });
        }
      });
  }

  updateDocumentDetails(documentId: number): void {
    // Show loading indicator
    this.isSaving = true;
    
    // Update document details (title and price)
    const documentDetailsRequest = {
      documents: [{
        id: documentId,
        file_name: this.documentForm.get('file_name')?.value,
        price: this.documentForm.get('isCharity')?.value ? '0' : this.documentForm.get('price')?.value,
        ignore_mismatch: false
      }]
    };
    
    console.log('Updating document details with request:', documentDetailsRequest);
    
    this.addInsightStepsService.updateKnowledgeDocumentDetails(
      +this.knowledgeId,
      documentDetailsRequest.documents
    ).subscribe({
      next: (response) => {
        this.isSaving = false;
        console.log('Document details updated successfully:', response);
        this.showSuccess('', 'File uploaded and details saved. Please complete the document information.');
      },
      error: (error: any) => {
        this.isSaving = false;
        console.error('Error updating document details:', error);
        this.showError('', error?.error?.message || 'Error updating document details');
      }
    });
  }

  formatFileSize(size: number): string {
    if (size < 1024) {
      return size + ' bytes';
    } else if (size < 1024 * 1024) {
      return (size / 1024).toFixed(2) + ' KB';
    } else {
      return (size / (1024 * 1024)).toFixed(2) + ' MB';
    }
  }

  nextDocumentStep(): void {
    if (this.documentStep === 1 && this.isStep1Valid()) {
      // If this is a new document, update document details before moving to step 2
      if (!this.editingDocument) {
        // Get the document ID from the form (set during file upload)
        const documentId = this.documentForm.get('id')?.value;
        
        if (documentId) {
          // Show loading indicator
          this.isSaving = true;
          
          // Update document details (title and price) with language mismatch handling
          this.updateDocumentDetailsWithMismatchHandling(documentId, false)
            .then((success) => {
              this.isSaving = false;
              if (success) {
                console.log('Document details updated successfully');
                // Move to next step after successful update
                this.documentStep = 2;
              }
            })
            .catch((error: any) => {
              this.isSaving = false;
              console.error('Error updating document details:', error);
              this.showError('', error?.error?.message || 'Error updating document details');
            });
        } else {
          // No document ID found, either file wasn't uploaded or upload failed
          this.showError('', 'No document has been uploaded. Please select a file first.');
        }
      } else {
        // For editing, just move to the next step
        this.documentStep = 2;
      }
    }
  }

  prevDocumentStep(): void {
    if (this.documentStep === 2) {
      this.documentStep = 1;
    }
  }

  isStep1Valid(): boolean {
    // Check file name and file or editing existing
    const fileNameValid = this.documentForm.get('file_name')?.valid;
    const fileValid = !!this.selectedFile || !!this.editingDocument;
    const priceValid = this.documentForm.get('isCharity')?.value || this.documentForm.get('price')?.valid;
    
    return !!fileNameValid && fileValid && !!priceValid;
  }

  isStep2Valid(): boolean {
    return this.documentForm.get('description')?.valid === true;
  }

  handleEditorInit(event: any): void {
    this.editorInstance = event.editor;
    
    // Set up content change listener
    this.editorInstance.on('change', () => {
      const content = this.editorInstance.getContent();
      this.documentForm.patchValue({
        description: content
      });
    });
  }

  generateAIAbstract(docId: number): void {
    // Early return if no document ID is provided
    if (!docId) {
      console.error('No document ID provided for AI abstract generation');
      return;
    }
    
    // Check if there's existing content and confirm before overwriting
    const currentContent = this.editorInstance?.getContent();
    if (currentContent && currentContent.trim() !== '') {
      Swal.fire({
        title: 'Existing Content',
        text: 'This will replace your current description. Continue?',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Yes, generate new',
        cancelButtonText: 'Cancel'
      }).then((result) => {
        if (result.isConfirmed) {
          this.processAIAbstract(docId);
        }
      });
    } else {
      this.processAIAbstract(docId);
    }
  }

  private processAIAbstract(docId: number): void {
    if (!docId) return;
    
    this.isGeneratingAbstract = true;
    this.abstractError = false;
    
    // First trigger document parsing with POST request
    const parserSubscription = this.addInsightStepsService.runDocumentParser(docId)
      .subscribe({
        next: () => {
          // After successful parsing, start polling for results
          this.startSummaryPolling(docId);
        },
        error: (error: any) => {
          console.error(`Error starting document parsing for document ${docId}:`, error);
          this.isGeneratingAbstract = false;
          this.abstractError = true;
        }
      });
    
    this.unsubscribe.push(parserSubscription);
  }
  
  // Start polling for document summary
  private startSummaryPolling(docId: number): void {
    // Set maximum time to show loader (25 seconds)
    const maxWaitTime = 25000;
    const pollingInterval = 2000; // Check every 2 seconds
    let elapsedTime = 0;
    let polling: any;
    
    // Start polling
    polling = setInterval(() => {
      elapsedTime += pollingInterval;
      
      // Call the fetchDocumentSummary method to check for summary
      this.fetchDocumentSummary(docId, polling);
      
      // Stop polling if we've reached the max time
      if (elapsedTime >= maxWaitTime) {
        clearInterval(polling);
        
        // Ensure loading state is turned off after max time
        if (this.isGeneratingAbstract) {
          this.isGeneratingAbstract = false;
          this.abstractError = true; // Set error state if we couldn't get data after timeout
        }
      }
    }, pollingInterval);
  }

  // Fetch document summary from AI parser API
  private fetchDocumentSummary(docId: number, pollingIntervalId?: any): void {
    // Loading state is already set to true when this is called
    
    const summarySubscription = this.addInsightStepsService.getDocumentSummary(docId)
      .subscribe({
        next: (response: DocumentParserResponse) => {
          if (response.data) {
            // Check if data has a summary object with abstract property
            let summary = null;
            const responseData: any = response.data;
            
            if (typeof responseData === 'object' && responseData.summary && typeof responseData.summary === 'object') {
              summary = responseData.summary.abstract || null;
            } else if (typeof responseData === 'string') {
              summary = responseData;
            } else if (responseData.summary && typeof responseData.summary === 'string') {
              summary = responseData.summary;
            }
            
            if (summary) {
              // We have a valid abstract, use it directly
              const formattedDescription = summary;
              
              // Update editor content with the generated abstract
              if (this.editorInstance) {
                this.editorInstance.setContent(formattedDescription);
                this.documentForm.patchValue({
                  description: formattedDescription
                });
              }
              
              // Clear polling interval if we have a valid summary
              if (pollingIntervalId) {
                clearInterval(pollingIntervalId);
              }
              
              // Turn off loading
              this.isGeneratingAbstract = false;
              this.abstractError = false;
            } else {
              // No summary data returned
              // Don't set error yet - continue polling until timeout
              if (!pollingIntervalId) {
                this.abstractError = true;
                console.error(`No summary data returned for document ${docId}`);
                this.isGeneratingAbstract = false;
              }
            }
          } else {
            // No data returned
            // Don't set error yet - continue polling until timeout
            if (!pollingIntervalId) {
              this.abstractError = true;
              console.error(`No data returned for document ${docId}`);
              this.isGeneratingAbstract = false;
            }
          }
        },
        error: (error) => {
          console.error(`Error getting document summary for document ${docId}:`, error);
          
          // Check if this is the specific metadata error we want to ignore
          const isMetadataError = error?.error?.message?.includes('Attempt to read property "metadata" on null');
          
          // Only update UI state if this was the final request OR if it's not the specific error we're ignoring
          if (!pollingIntervalId || !isMetadataError) {
            this.isGeneratingAbstract = false;
            this.abstractError = true;
          }
          // If it's the metadata error and we're polling, we just continue polling until timeout
        }
      });
    
    this.unsubscribe.push(summarySubscription);
  }

  toggleChapters(): void {
    this.showChapters = !this.showChapters;
    
    // If we're editing and chapters are empty, but there are chapters in the document,
    // populate them from the editing document
    if (this.showChapters && 
        this.stepperChapters.length === 0 && 
        this.editingDocument && 
        this.editingDocument.table_of_content && 
        this.editingDocument.table_of_content.length > 0) {
      
      this.stepperChapters = this.editingDocument!.table_of_content!.map((item: any) => ({
        title: item.chapter?.title || ''
      })).filter((ch: ChapterItem) => ch.title !== '');
    }
    
    // Don't add an empty chapter by default
  }

  saveDocumentFromStepper(): void {
    if (!this.isStep2Valid()) {
      return;
    }

    this.isSaving = true;
    
    // Different flow for editing vs. adding
    if (this.editingDocument) {
      // EDITING EXISTING DOCUMENT
      // Use separate API calls for updating different aspects
      
      // 1. Update document details (title and price) with language mismatch handling
      this.updateDocumentDetailsWithMismatchHandling(this.editingDocument.id, false)
        .then((success: boolean) => {
          if (!success) {
            this.isSaving = false;
            return;
          }
          
          // 2. Update document description if it was changed
          const description = this.documentForm.get('description')?.value;
          
          // Create chapters array from stepperChapters if available
          const chapters = this.stepperChapters.length > 0 ? 
            this.stepperChapters.map(chapter => ({
              id: chapter.id,
              title: chapter.title,
              page_number: chapter.page_number
            })) : [];
            
          const abstractRequest: UpdateKnowledgeAbstractsRequest = {
            documents: [{
              id: this.editingDocument!.id,
              description: description || '',
              table_of_content: chapters // Use chapters if available, otherwise empty array
            }]
          };
          
          this.addInsightStepsService.updateKnowledgeAbstracts(
            +this.knowledgeId,
            abstractRequest
          ).subscribe({
            next: () => {
              this.showSuccess('', 'Document updated successfully');
              this.loadDocuments(); // Refresh documents list
              this.closeDocumentStepper();
              this.isSaving = false;
              
              // Notify the parent component to update total_price
              this.knowledgeUpdateService.notifyKnowledgeUpdate();
            },
            error: (error: any) => {
              this.showError('', error?.error?.message || 'Error updating document description');
              this.isSaving = false;
            }
          });
        })
        .catch((error: any) => {
          this.showError('', error?.error?.message || 'Error updating document details');
          this.isSaving = false;
        });
    } else {
      // ADDING NEW DOCUMENT
      // Since we now upload files immediately upon selection,
      // we only need to update details and description here
      
      // Get the document ID from the form (set during file upload)
      const documentId = this.documentForm.get('id')?.value;
      
      if (!documentId) {
        this.showError('', 'No document has been uploaded. Please select a file first.');
        this.isSaving = false;
        return;
      }
      
      // 1. Set document details (title and price) with language mismatch handling
      this.updateDocumentDetailsWithMismatchHandling(documentId, false)
        .then((success: boolean) => {
          if (!success) {
            this.isSaving = false;
            return;
          }
          // 2. Set document description
          const description = this.documentForm.get('description')?.value;
          
          // Create chapters array from stepperChapters if available
          const chapters = this.stepperChapters.length > 0 ? 
            this.stepperChapters.map(chapter => ({
              id: chapter.id,
              title: chapter.title,
              page_number: chapter.page_number
            })) : [];
            
          const abstractRequest: UpdateKnowledgeAbstractsRequest = {
            documents: [{
              id: documentId,
              description: description || '',
              table_of_content: chapters // Use chapters if available, otherwise empty array
            }]
          };
          
          this.addInsightStepsService.updateKnowledgeAbstracts(
            +this.knowledgeId,
            abstractRequest
          ).subscribe({
            next: () => {
              // 3. Set document chapters if applicable (placeholder for now)
              this.showSuccess('', 'Document added successfully');
              this.loadDocuments();
              this.closeDocumentStepper();
              this.isSaving = false;
              
              // Notify the parent component to update total_price
              this.knowledgeUpdateService.notifyKnowledgeUpdate();
            },
            error: (error: any) => {
              this.showError('', error?.error?.message || 'Error setting document description');
              this.isSaving = false;
            }
          });
        })
        .catch((error: any) => {
          this.showError('', error?.error?.message || 'Error setting document details');
          this.isSaving = false;
        });
    }
  }

  // Edit an existing document using the stepper
  editDocumentWithStepper(doc: DocumentInfo, event: Event): void {
    if (event) {
      event.stopPropagation();
    }
    
    // Cast to ExtendedDocumentInfo to add the custom properties
    const extendedDoc: ExtendedDocumentInfo = {
      ...doc,
      fileIcon: this.getFileIconByExtension(doc.file_extension),
      docUrl: '#' // Set a placeholder URL so the condition passes
    };
    
    this.editingDocument = extendedDoc;
    this.initDocumentForm();
    
    // Set initial values in the form
    this.documentForm.patchValue({
      id: doc.id,
      file_name: doc.file_name,
      description: doc.description || '',
      price: doc.price || '0',
      isCharity: doc.price === '0',
      file_extension: doc.file_extension,
      fileIcon: this.getFileIconByExtension(doc.file_extension),
      docUrl: '#', // Add a placeholder URL
      fromServer: true
    });
    
    // Set selected file properties for display
    this.selectedFileName = doc.file_name;
    this.selectedFileIcon = this.getFileIconByExtension(doc.file_extension);
    
    // Load chapters if available
    if (doc.table_of_content && doc.table_of_content.length > 0) {
      this.showChapters = true;
      this.stepperChapters = doc.table_of_content.map((item: any) => ({
        title: item.chapter?.title || ''
      })).filter((ch: ChapterItem) => ch.title !== '');
    } else {
      this.showChapters = false;
      this.stepperChapters = [];
    }
    
    // Show the stepper starting at step 1 instead of jumping to step 2
    this.showDocumentStepper = true;
    this.documentStep = 1;
  }

  handlePriceInput(event: Event): void {
    const inputElement = event.target as HTMLInputElement;
    const value = inputElement.value;
    
    // Remove leading zeros
    if (value.length > 1 && value.startsWith('0') && !value.startsWith('0.')) {
      // Get the numeric value without leading zeros
      const numericValue = parseInt(value, 10).toString();
      // Update the form control
      this.documentForm.get('price')?.setValue(numericValue, { emitEvent: false });
      // Set the input value directly to handle browser differences
      inputElement.value = numericValue;
    }
  }

  // Language mismatch handling methods
  private updateDocumentDetailsWithMismatchHandling(documentId: number, ignoreMismatch: boolean): Promise<boolean> {
    const documentDetailsRequest = {
      documents: [{
        id: documentId,
        file_name: this.documentForm.get('file_name')?.value,
        price: this.documentForm.get('isCharity')?.value ? '0' : this.documentForm.get('price')?.value,
        ignore_mismatch: ignoreMismatch
      }]
    };
    
    console.log('Updating document details with request:', documentDetailsRequest);

    return new Promise((resolve, reject) => {
      this.addInsightStepsService.updateKnowledgeDocumentDetails(
        +this.knowledgeId,
        documentDetailsRequest.documents
      ).subscribe({
        next: (response) => {
          console.log('Document details updated successfully:', response);
          resolve(true);
        },
        error: (error) => {
          console.error('Error updating document details:', error);
          
          // Check if this is a language mismatch error
          if (this.isLanguageMismatchError(error)) {
            this.handleLanguageMismatchError(error)
              .then((shouldIgnore) => {
                if (shouldIgnore) {
                  // Retry with ignore_mismatch: true
                  this.updateDocumentDetailsWithMismatchHandling(documentId, true)
                    .then(resolve)
                    .catch(reject);
                } else {
                  // User chose to edit, don't proceed
                  resolve(false);
                }
              })
              .catch(() => {
                // User cancelled or error occurred
                resolve(false);
              });
          } else {
            // Handle other errors normally
            reject(error);
          }
        }
      });
    });
  }

  private isLanguageMismatchError(error: any): boolean {
    return error.error && 
           error.error.message && 
           (error.error.message.includes('File name not match document language') ||
            error.error.message.includes('اسم الملف غير متطابق مع لغة المستند')) &&
           error.error.errors;
  }

  private handleLanguageMismatchError(error: any): Promise<boolean> {
    return new Promise((resolve, reject) => {
      try {
        console.log('Language mismatch error details:', {
          error: error.error,
          currentDocument: {
            id: this.editingDocument?.id || this.documentForm.get('id')?.value,
            file_name: this.documentForm.get('file_name')?.value
          }
        });
        
        // Extract document names from error
        const errorKeys = Object.keys(error.error.errors);
        const affectedDocumentNames: string[] = [];

        errorKeys.forEach(key => {
          // Extract index from keys like "documents.55", "documents.44"
          const match = key.match(/documents\.(\d+)/);
          if (match) {
            const fileName = this.documentForm.get('file_name')?.value;
            if (fileName) {
              affectedDocumentNames.push(fileName);
            }
          }
        });

        // Always show the dialog even if we couldn't extract specific document names
        if (affectedDocumentNames.length === 0) {
          affectedDocumentNames.push('Document');
        }
        
        // Store the affected documents for the modal
        this.languageMismatchDocuments = affectedDocumentNames;
        
        const message = this.translate.getTranslation('LANGUAGE_MISMATCH_MESSAGE');

        // Show confirmation dialog
        this.showConfirmationDialog(
          this.translate.getTranslation('LANGUAGE_MISMATCH_DETECTED'),
          message,
          this.translate.getTranslation('LANGUAGE_MISMATCH_EDIT'),
          this.translate.getTranslation('LANGUAGE_MISMATCH_IGNORE')
        ).then((result) => {
          if (result) {
            // User clicked "Ignore"
            resolve(true);
          } else {
            // User clicked "Edit" or cancelled
            resolve(false);
          }
        }).catch(() => {
          resolve(false);
        });

      } catch (parseError) {
        console.error('Error parsing language mismatch error:', parseError);
        resolve(false);
      }
    });
  }

  private showConfirmationDialog(title: string, message: string, cancelText: string, confirmText: string): Promise<boolean> {
    return new Promise((resolve) => {
      this.languageMismatchTitle = title;
      this.languageMismatchMessage = message;
      this.showLanguageMismatchDialog = true;
      this.languageMismatchResolver = resolve;
    });
  }

  onLanguageMismatchConfirm(): void {
    this.showLanguageMismatchDialog = false;
    if (this.languageMismatchResolver) {
      this.languageMismatchResolver(true); // User clicked "Ignore"
      this.languageMismatchResolver = null;
    }
  }

  onLanguageMismatchCancel(): void {
    this.showLanguageMismatchDialog = false;
    if (this.languageMismatchResolver) {
      this.languageMismatchResolver(false); // User clicked "Edit"
      this.languageMismatchResolver = null;
    }
  }
}