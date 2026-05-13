import { Component, Injector, OnInit } from '@angular/core';
import { DomSanitizer, SafeHtml, SafeResourceUrl } from '@angular/platform-browser';
import { ActivatedRoute, Router } from '@angular/router';
import { finalize, takeUntil } from 'rxjs/operators';
import { GuidelineDetail, GuidelinesService } from 'src/app/_fake/services/guidelines/guidelines.service';
import {
  ProjectContract,
  ProjectContractFile,
  ProjectOffersService,
} from 'src/app/_fake/services/project-offers/project-offers.service';
import { BaseComponent } from 'src/app/modules/base.component';

@Component({
  selector: 'app-insighter-project-contract',
  templateUrl: './project-contract.component.html',
  styleUrl: './project-contract.component.scss',
})
export class ProjectContractComponent extends BaseComponent implements OnInit {
  contractUuid = '';
  contract: ProjectContract | null = null;
  guideline: GuidelineDetail | null = null;
  guidelineHtml: SafeHtml | null = null;
  filePreviewUrl: SafeResourceUrl | null = null;
  isLoadingContract = false;
  isLoadingGuideline = false;
  isSigning = false;
  errorMessage = '';
  successMessage = '';
  returnUrl = '/app/insighter-dashboard/project-offers';

  constructor(
    injector: Injector,
    private route: ActivatedRoute,
    private router: Router,
    private projectOffersService: ProjectOffersService,
    private guidelinesService: GuidelinesService,
    private sanitizer: DomSanitizer,
  ) {
    super(injector);
  }

  ngOnInit(): void {
    this.route.queryParamMap
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe(params => {
        this.returnUrl = params.get('returnUrl') || '/app/insighter-dashboard/project-offers';
      });

    this.route.paramMap
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe(params => {
        this.contractUuid = params.get('contractUuid') || '';
        if (this.contractUuid) {
          this.loadContract();
        }
      });
  }

  goBack(): void {
    this.router.navigateByUrl(this.returnUrl);
  }

  signContract(): void {
    if (!this.contractUuid || this.isSigning || !this.contract?.user_sign_at || this.contract.insighter_sign_at) {
      return;
    }

    this.isSigning = true;
    this.errorMessage = '';
    this.successMessage = '';

    this.projectOffersService.signProjectContract(this.contractUuid)
      .pipe(
        takeUntil(this.unsubscribe$),
        finalize(() => (this.isSigning = false))
      )
      .subscribe({
        next: response => {
          this.contract = this.contract
            ? { ...this.contract, insighter_sign_at: true, status: 'completed' }
            : this.contract;
          this.successMessage = response?.message
            || (this.lang === 'ar' ? 'تم توقيع العقد بنجاح.' : 'Contract signed successfully.');
          this.showSuccess(
            this.lang === 'ar' ? 'نجاح' : 'Success',
            this.successMessage
          );
        },
        error: err => {
          this.errorMessage = this.getServerErrorMessage(err);
          this.showError(
            this.lang === 'ar' ? 'حدث خطأ' : 'An error occurred',
            this.errorMessage
          );
        },
      });
  }

  getBackIcon(): string {
    return this.lang === 'ar' ? 'ki-arrow-right' : 'ki-arrow-left';
  }

  getFileName(file: ProjectContractFile | null | undefined): string {
    if (file?.name) return file.name;
    const rawName = (file?.url || '').split('/').pop()?.split('?')[0];
    return rawName ? decodeURIComponent(rawName) : (this.lang === 'ar' ? 'ملف العقد' : 'Contract file');
  }

  getFileExtension(file: ProjectContractFile | null | undefined): string {
    const name = this.getFileName(file);
    if (name.includes('.')) return (name.split('.').pop() || '').toLowerCase();

    const urlPath = (file?.url || '').split('?')[0];
    return urlPath.includes('.') ? (urlPath.split('.').pop() || '').toLowerCase() : '';
  }

  isImageFile(file: ProjectContractFile | null | undefined): boolean {
    return ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(this.getFileExtension(file));
  }

  isPdfFile(file: ProjectContractFile | null | undefined): boolean {
    return this.getFileExtension(file) === 'pdf';
  }

  openContractFile(): void {
    const url = this.contract?.file?.url;
    if (url) window.open(url, '_blank', 'noopener,noreferrer');
  }

  private loadContract(): void {
    this.isLoadingContract = true;
    this.errorMessage = '';
    this.successMessage = '';
    this.contract = null;
    this.guideline = null;
    this.guidelineHtml = null;
    this.filePreviewUrl = null;

    this.projectOffersService.getProjectContract(this.contractUuid)
      .pipe(
        takeUntil(this.unsubscribe$),
        finalize(() => (this.isLoadingContract = false))
      )
      .subscribe({
        next: contract => {
          this.contract = contract;
          if (!contract.user_sign_at) return;

          if (contract.is_attach_type) {
            this.setFilePreview(contract.file);
            return;
          }

          if (contract.guideline) {
            this.guidelineHtml = this.sanitizer.bypassSecurityTrustHtml(contract.guideline);
            return;
          }

          this.loadDefaultContract();
        },
        error: err => {
          this.errorMessage = this.getServerErrorMessage(err);
          this.showError(
            this.lang === 'ar' ? 'حدث خطأ' : 'An error occurred',
            this.errorMessage
          );
        },
      });
  }

  private loadDefaultContract(): void {
    this.isLoadingGuideline = true;

    this.guidelinesService.getCurrentGuidelineByType('contract')
      .pipe(
        takeUntil(this.unsubscribe$),
        finalize(() => (this.isLoadingGuideline = false))
      )
      .subscribe({
        next: guideline => {
          this.guideline = guideline;
          this.guidelineHtml = this.sanitizer.bypassSecurityTrustHtml(guideline.guideline || '');
        },
        error: err => {
          this.errorMessage = this.getServerErrorMessage(err);
        },
      });
  }

  private setFilePreview(file: ProjectContractFile | null): void {
    if (!file?.url) {
      this.filePreviewUrl = null;
      return;
    }

    this.filePreviewUrl = this.sanitizer.bypassSecurityTrustResourceUrl(file.url);
  }

  private getServerErrorMessage(error: any): string {
    const serverErrors = error?.error?.errors;
    if (serverErrors && typeof serverErrors === 'object') {
      for (const key of Object.keys(serverErrors)) {
        const messages = serverErrors[key];
        if (Array.isArray(messages) && messages.length) return messages.join(', ');
        if (typeof messages === 'string' && messages.trim()) return messages;
      }
    }

    return error?.error?.message
      || error?.message
      || (this.lang === 'ar' ? 'حدث خطأ غير متوقع.' : 'An unexpected error occurred.');
  }
}
