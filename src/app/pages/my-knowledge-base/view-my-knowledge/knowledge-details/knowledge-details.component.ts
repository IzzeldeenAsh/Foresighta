import { Component, Injector, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { DocumentInfo, AddInsightStepsService } from 'src/app/_fake/services/add-insight-steps/add-insight-steps.service';
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
  editingDocument: DocumentInfo | null = null;
  docForm: FormGroup;
  previewFilesDialog: any[] = [];
  isSaving: boolean = false;
  headerTitle = 'Document Details';
  isUploadAreaHovered = false;

  // Add animation states
  hoveredDocumentId: number | null = null;
  activeDocumentId: number | null = 2;
  animationStates: { [key: number]: string } = {};

  // Add new properties for insight documents
  insightDocForm: FormGroup;
  displayInsightDialog = false;

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
    this.addChapter(); // Add initial chapter
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
        title: ['', Validators.required]
      })
    });
  }

  addChapter(): void {
    this.chapters.push(this.createChapter());
  }

  removeChapter(index: number): void {
    this.chapters.removeAt(index);
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
      this.addChapter();
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
    event.stopPropagation();
    this.editingDocument = doc;

    if (this.knowledge?.type === 'insight') {
      // Handle insight type documents
      this.displayInsightDialog = true;
      this.headerTitle = this.lang === 'en' ? 'Document Details' : 'تفاصيل المستند';

      this.insightDocForm.patchValue({
        file_name: doc.file_name,
        description: doc.description || '',
        price: doc.price || 0,
        file_extension: doc.file_extension || '',
        filePreview: true,
        fileIcon: this.getFileIconByExtension(doc.file_extension),
        fromServer: true,
        docId: doc.id,
        file_size: doc.file_size
      });

      // Get document URL
      this.addInsightStepsService.getDocumentUrl(doc.id).subscribe({
        next: (response) => {
          this.insightDocForm.patchValue({
            docUrl: response.data.url
          });
        },
        error: (error) => {
          console.error('Error getting document URL:', error);
        }
      });
    } else {
      // Handle other document types (existing logic)
      this.displayDocumentDialog = true;
      
      if (this.knowledge?.type === 'data') {
        this.headerTitle = this.lang === 'en' ? 'Node Details' : 'معلومات العقدة';
      } else {
        this.headerTitle = this.lang === 'en' ? 'Chapter Details' : 'تفاصيل الفصل';
      }

      this.docForm.patchValue({
        file_name: doc.file_name,
        description: doc.description || '',
        price: doc.price || 0,
        file_extension: doc.file_extension || ''
      });

      this.loadChapters(doc.table_of_content || []);

      // Set file preview
      this.addInsightStepsService.getDocumentUrl(doc.id).subscribe({
        next: (response) => {
          this.previewFilesDialog = [{
            name: doc.file_name,
            size: doc.file_size,
            preview: response.data.url,
            type: this.getFileTypeByExtension(doc.file_extension),
            icon: this.getFileIconByExtension(doc.file_extension),
            docId: doc.id,
            fromServer: true
          }];
        },
        error: (error) => {
          console.error('Error getting document URL:', error);
          this.previewFilesDialog = [{
            name: doc.file_name,
            size: doc.file_size,
            preview: null,
            type: this.getFileTypeByExtension(doc.file_extension),
            icon: this.getFileIconByExtension(doc.file_extension),
            docId: doc.id,
            fromServer: true
          }];
        }
      });
    }
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
    if (this.knowledge?.type === 'insight') {
      this.displayInsightDialog = true;
      this.headerTitle = this.lang === 'en' ? 'Add New Document' : 'إضافة مستند جديد';
      this.initInsightDocForm();
    } else {
      this.displayDocumentDialog = true;
      if (this.knowledge?.type === 'data') {
        this.headerTitle = this.lang === 'en' ? 'Add New Node' : 'إضافة عقدة جديدة';
      } else {
        this.headerTitle = this.lang === 'en' ? 'Add New Chapter' : 'إضافة فصل جديد';
      }
      this.initDocForm();
    }
  }

  shouldShowTableOfContents(doc: DocumentInfo): boolean {
    return  !!doc?.table_of_content?.length;
  }

  isInsightType(): boolean {
    return this.knowledge?.type === 'insight';
  }
} 