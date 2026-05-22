import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { FileSizePipe } from './file-size.pipe';
import { trigger, transition, style, animate } from '@angular/animations';

interface FilePreview {
  file: File;
  name: string;
  size: number;
  preview: string | null;
  type: string;
  icon?: string;
}

@Component({
  selector: 'app-file-uploader',
  templateUrl: './file-uploader.component.html',
  styleUrls: ['./file-uploader.component.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, FileSizePipe],
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
export class FileUploaderComponent {
  @Input() maxFiles: number = 1;
  @Input() maxFileSize: number = 10; // MB
  @Input() acceptedFiles: string = '';
  @Input() lang: string = 'en';
  @Input() uploadUrl: string = 'https://insightabusiness.com';
  @Output() onFileUploaded = new EventEmitter<File[]>();
  @Output() onFileRemoved = new EventEmitter<File>();

  selectedFiles: File[] = [];
  previewFiles: FilePreview[] = [];

  get showUploadContainer(): boolean {
    if (this.maxFiles === 1) {
      return this.previewFiles.length === 0;
    }
    return this.previewFiles.length < this.maxFiles;
  }

  onFilesSelected(event: any) {
    const files: FileList = event.target.files;
    for (let i = 0; i < files.length; i++) {
      if (this.selectedFiles.length >= this.maxFiles) {
        break;
      }
      const file = files[i];
      if (this.validateFile(file)) {
        this.selectedFiles.push(file);
        this.createFilePreview(file);
      }
    }
    this.onFileUploaded.emit(this.selectedFiles);
  }

  private createFilePreview(file: File) {
    const preview: FilePreview = {
      file: file,
      name: file.name,
      size: file.size,
      preview: null,
      type: this.getFileType(file)
    };

    if (this.isImage(file)) {
      const reader = new FileReader();
      reader.onload = (e: ProgressEvent<FileReader>) => {
        const result = e.target?.result;
        if (typeof result === 'string') {
          preview.preview = result;
          preview.icon = result;
        }
      };
      reader.readAsDataURL(file);
    } else {
      preview.icon = this.getFileIcon(file);
    }

    this.previewFiles.push(preview);
  }

  private getFileType(file: File): string {
    if (this.isImage(file)) return 'image';
    const extension = file.name.split('.').pop()?.toLowerCase() || '';
    
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
      rar: 'archive'
    };

    return typeMap[extension] || 'document';
  }

  private getFileIcon(file: File): string {
    const type = this.getFileType(file);
    const iconMap: { [key: string]: string } = {
      pdf: './assets/media/svg/files/pdf.svg',
      word: './assets/media/svg/files/doc.svg', 
      excel: './assets/media/svg/files/xls.svg',
      powerpoint: './assets/media/svg/files/ppt.svg',
      text: './assets/media/svg/files/txt.svg',
      archive: './assets/media/svg/files/zip.svg',
      document: './assets/media/svg/files/default.svg'
    };

    return iconMap[type] || iconMap.document;
  }

  validateFile(file: File): boolean {
    const isValidSize = file.size / 1024 / 1024 <= this.maxFileSize;
    const isValidType = this.acceptedFiles
      ? !!file.type.match(this.acceptedFiles)
      : true;
    return isValidSize && isValidType;
  }

  isImage(file: File): boolean {
    return file.type.startsWith('image/');
  }

  uploadFiles() {
    const formData = new FormData();
    this.selectedFiles.forEach(file => {
      formData.append('files', file, file.name);
    });

    // Perform the upload (using HttpClient)
    // Example:
    /*
    this.http.post(this.uploadUrl, formData).subscribe(
      (response) => {
        this.onFileUploaded.emit(this.selectedFiles);
        // Handle response
      },
      (error) => {
        // Handle error
      }
    );
    */
  }

  removeFile(file: any) {
    const index = this.selectedFiles.indexOf(file.file);
    if (index > -1) {
      this.selectedFiles.splice(index, 1);
      this.previewFiles.splice(index, 1);
      this.onFileRemoved.emit(file.file);
      this.onFileUploaded.emit(this.selectedFiles);
    }
  }

  ngOnDestroy() {
    // Revoke object URLs to avoid memory leaks
    this.previewFiles.forEach(file => {
      if (file.preview) {
        URL.revokeObjectURL(file.preview);
      }
    });
  }
}