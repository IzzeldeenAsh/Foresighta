import { trigger, transition, style, animate } from '@angular/animations';
import { ChangeDetectorRef, Component, Injector, Input, OnInit } from '@angular/core';
import { BaseComponent } from 'src/app/modules/base.component';
import { ICreateKnowldege } from '../../../create-account.helper';
import { FormBuilder, FormGroup, FormArray, Validators } from '@angular/forms';
import { AddInsightStepsService } from 'src/app/_fake/services/add-insight-steps/add-insight-steps.service';

interface Chapter {
  chapter: {
    title: string;
  }
}

interface FilePreview {
  file: File | null;
  name: string;
  size: number;      
  preview: string | null; 
  type: string;      
  icon?: string;     
  docId?: number;    
  fromServer?: boolean; 
  isExisting?: boolean;
}

@Component({
  selector: 'app-sub-step-chapters',
  templateUrl: './sub-step-chapters.component.html',
  styleUrl: './sub-step-chapters.component.scss',
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
export class SubStepChaptersComponent extends BaseComponent implements OnInit {
  @Input('updateParentModel') updateParentModel: (
    part: Partial<ICreateKnowldege>,
    isFormValid: boolean
  ) => void;

  @Input() defaultValues: Partial<ICreateKnowldege>;
  @Input() knowledgeId!: number;

  documents: any[] = [];
  docForm: FormGroup;
  previewFilesDialog: FilePreview[] = [];
  displayDocumentDialog = false;
  editingIndex = -1;
  headerTitle = 'CHAPTERS';
  totalPrice: number = 0;

  constructor(
    injector: Injector,
    private fb: FormBuilder,
    private cdr: ChangeDetectorRef,
    private addInsightStepsService: AddInsightStepsService
  ) {
    super(injector);
  }

  ngOnInit() {
    // Initialize empty documents array
    this.documents = [];
    
    // Initialize form
    this.initDocForm();
    
    // Set header title based on knowledge type
    if(this.defaultValues.knowledgeType === 'data'){
      this.headerTitle = this.lang ==='en' ? 'Node Details' : 'معلومات العقدة';
    } else {
      this.headerTitle = this.lang ==='en' ? 'Chapter details' : 'معلومات الفصل';
    }

    // Load documents either from server or default values
    if (this.defaultValues.knowledgeId) {
      this.fetchDocumentsFromServer();
    } else if (this.defaultValues.documents?.length) {
      this.documents = [...this.defaultValues.documents];
      this.updateParentModel({ documents: this.documents }, this.checkParentValidator());
      this.calculateTotalPrice();
    }
  }

  initDocForm(): void {
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

  saveDocument(): void {
    if (this.docForm.invalid) {
      this.docForm.markAllAsTouched();
      return;
    }

    const fileName = this.docForm.value.file_name || '';
    const file: File | null = this.docForm.value.file;

    // Get chapters from form array and ensure correct structure
    const tableOfContent = this.chapters.controls.map(control => ({
      chapter: {
        title: control.get('chapter.title')?.value?.trim() || ''
      }
    })).filter(ch => ch.chapter.title !== '');

    const newDoc: any = {
      file_name: fileName,
      description: this.docForm.value.description || '',
      table_of_content: tableOfContent,
      price: this.docForm.value.price || 0,
      status: 'active'
    };

    if (file) {
      newDoc.file = file;
      newDoc.file_extension = this.getFileExtension(file.name);
    } else if (this.editingIndex >= 0) {
      const existingDoc = this.documents[this.editingIndex];
      newDoc.docUrl = existingDoc.docUrl;
      newDoc.id = existingDoc.id;
      newDoc.fromServer = existingDoc.fromServer;
      newDoc.file_extension = existingDoc.file_extension;
      newDoc.file_size = existingDoc.file_size;
    }

    if (this.editingIndex >= 0) {
      this.documents[this.editingIndex] = { ...this.documents[this.editingIndex], ...newDoc };
    } else {
      this.documents.push(newDoc);
    }

    this.updateParentModel({ documents: this.documents }, this.checkParentValidator());
    this.initDocForm();
    this.closeDialog();
    this.calculateTotalPrice();
  }

  checkParentValidator(): boolean {
    if (!this.documents.length) {
      return false;
    }
    return this.documents.every(doc => 
      doc.file_name && 
      doc.price !== null && 
      doc.price >= 0 && 
      doc.table_of_content && 
      Array.isArray(doc.table_of_content) && 
      doc.table_of_content.length > 0 && 
      doc.table_of_content.every((item: any) => 
        item && 
        item.chapter && 
        typeof item.chapter.title === 'string' && 
        item.chapter.title.trim() !== ''
      )
    );
  }

  private transformTableOfContent(tocData: any): any[] {
    try {
      // Handle empty or null cases
      if (!tocData) return [];
      
      // If it's a string (from JSON), parse it
      if (typeof tocData === 'string') {
        try {
          tocData = JSON.parse(tocData);
        } catch (e) {
          console.error('Failed to parse table of content string:', e);
          return [];
        }
      }

      // Handle single object case (wrap in array)
      if (!Array.isArray(tocData) && typeof tocData === 'object') {
        tocData = [tocData];
      }

      // If it's not an array at this point, return empty array
      if (!Array.isArray(tocData)) {
        console.warn('Table of content data is not in expected format:', tocData);
        return [];
      }

      // Transform to correct format
      return tocData.map(item => {
        // Handle case where item is already in correct format
        if (item.chapter?.title) {
          return item;
        }
        
        // Handle case where item is just the chapter object
        if (item.title) {
          return {
            chapter: {
              title: item.title
            }
          };
        }

        // Handle case where item might be nested differently
        const title = item.chapter?.title || item.title || '';
        return {
          chapter: {
            title
          }
        };
      });
    } catch (e) {
      console.error('Error transforming table of content:', e);
      return [];
    }
  }

  private fetchDocumentsFromServer() {
    this.addInsightStepsService.getListDocumentsInfo(this.defaultValues.knowledgeId || this.knowledgeId)
      .subscribe({
        next: (response) => {
          const documentInfos = response.data;
          // Clear existing documents before adding server documents
          this.documents = [];
          
          documentInfos.forEach(docInfo => {
            this.addInsightStepsService.getDocumentUrl(docInfo.id)
              .subscribe({
                next: (urlResponse) => {
                  const serverDoc = {
                    id: docInfo.id,
                    file_name: docInfo.file_name || 'Untitled Document',
                    file_extension: docInfo.file_extension || this.getFileExtension(docInfo.file_name || ''),
                    description: docInfo.description || '',
                    table_of_content: this.transformTableOfContent(docInfo.table_of_content),
                    price: docInfo.price || 0,
                    docUrl: urlResponse.data.url,
                    fromServer: true,
                    file: null,
                    status: 'active',
                    file_size: docInfo.file_size || 0
                  };
                  
                  this.documents.push(serverDoc);
                  this.updateParentModel({ documents: this.documents }, this.checkParentValidator());
                  this.calculateTotalPrice();
                },
                error: (error) => {
                  console.error(`Error fetching URL for document ${docInfo.id}:`, error);
                }
              });
          });
        },
        error: (error) => {
          console.error('Error fetching documents:', error);
        }
      });
  }

  openDocumentDialog(docIndex = -1): void {
    this.editingIndex = docIndex;
    this.displayDocumentDialog = true;
    this.initDocForm();

    // Set default description if knowledgeType is not 'insight'
    if (this.defaultValues.knowledgeType !== 'insight') {
      this.docForm.patchValue({
        description: this.lang === 'en' ? '' : ""
      });
    }

    if (docIndex >= 0) {
      const existingDoc = this.documents[docIndex];
      const tableOfContent = this.transformTableOfContent(existingDoc.table_of_content);

      this.docForm.patchValue({
        file_name: existingDoc.file_name || '',
        description: existingDoc.description || '',
        price: existingDoc.price || 0,
        file_extension: existingDoc.file_extension || '',
        file: existingDoc.file || null,
      });

      // Load chapters
      this.loadChapters(tableOfContent);

      if (existingDoc.file) {
        // Document has a file uploaded on the client side
        this.previewFilesDialog = [{
          file: existingDoc.file,
          name: existingDoc.file.name,
          size: existingDoc.file.size,
          preview: null,
          type: this.getFileTypeByExtension(existingDoc.file.name),
          icon: this.getFileIconByExtension(existingDoc.file.name)
        }];
      } else if (existingDoc.fromServer) {
        // Document exists on the server
        const preview: FilePreview = {
          file: null,
          name: existingDoc.file_name,
          size: existingDoc.file_size || 0,
          preview: existingDoc.docUrl || '',
          type: this.getFileTypeByExtension(existingDoc.file_name),
          icon: this.getFileIconByExtension(existingDoc.file_name + '.' + (existingDoc.file_extension || '')),
          docId: existingDoc.id,
          fromServer: true,
          isExisting: true // Mark as existing
        };
        this.previewFilesDialog = [preview];
      }
    }
  }

  removeDocument(index: number) {
    if (index >= 0 && index < this.documents.length) {
      this.documents.splice(index, 1);
      this.updateParentModel({ documents: this.documents }, this.checkParentValidator());
    }
  }

  closeDialog(): void {
    this.displayDocumentDialog = false;
    this.editingIndex = -1;
    this.initDocForm();
  }

  onFilesSelectedDialog(event: any): void {
    const files: FileList = event.target.files;
    if (files.length > 0) {
      const file = files[0];
      const fileExtension = file.name.split('.').pop()?.toUpperCase() || '';
      
      this.docForm.patchValue({ 
        file,
        file_extension: fileExtension
      });
      
      const preview: FilePreview = {
        file,
        name: file.name,
        size: file.size,
        preview: null,
        type: this.getFileTypeByExtension(file.name),
        icon: this.getFileIconByExtension(file.name)
      };
      this.previewFilesDialog = [preview];
    }
  }

  removeFileDialog(preview: FilePreview): void {
    this.previewFilesDialog = [];
    this.docForm.patchValue({ file: null });
  }

  handleTocChange(chapters: any[]) {
    if (!Array.isArray(chapters)) {
      console.warn('Received invalid chapters data:', chapters);
      return;
    }

    // Transform to server format
    const serverFormat = chapters.map(chapter => ({
      chapter: {
        title: chapter.chapter?.title?.trim() || ''
      }
    }));

    this.docForm.patchValue({ 
      table_of_content: serverFormat
    });
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

   getFileIconByExtension(fileName: string): string {
    const fileType = this.getFileTypeByExtension(fileName);
    const iconMap: { [key: string]: string } = {
      pdf: './assets/media/svg/new-files/pdf.svg',
      word: './assets/media/svg/new-files/doc.svg',
      excel: './assets/media/svg/new-files/xls.svg',
      powerpoint: './assets/media/svg/new-files/ppt.svg',
      text: './assets/media/svg/new-files/txt.svg',
      archive: './assets/media/svg/new-files/zip.svg',
      document: './assets/media/svg/new-files/default.svg'
    };
    return iconMap[fileType] || iconMap.document;
  }

  private getFileExtension(fileName: string): string {
    if (!fileName) return '';
    
    const parts = fileName.split('.');
    if (parts.length <= 1) return '';
    
    return parts[parts.length - 1].toUpperCase();
  }

  calculateTotalPrice(): void {
    this.totalPrice = this.documents.reduce((sum, doc) => {
      const price = typeof doc.price === 'string' ? parseFloat(doc.price) : (doc.price || 0);
      return sum + price;
    }, 0);
  }
}

