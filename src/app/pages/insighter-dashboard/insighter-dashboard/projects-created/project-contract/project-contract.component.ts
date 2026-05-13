import { Component, ElementRef, Injector, OnInit, ViewChild } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { ActivatedRoute, Router } from '@angular/router';
import { finalize, takeUntil } from 'rxjs/operators';
import { GuidelineDetail, GuidelinesService } from 'src/app/_fake/services/guidelines/guidelines.service';
import {
  CreatedProjectContract,
  CreatedProject,
  ProjectsCreatedService,
} from 'src/app/_fake/services/projects-created/projects-created.service';
import { BaseComponent } from 'src/app/modules/base.component';

type ClientContractMode = 'default' | 'custom';

@Component({
  selector: 'app-project-contract',
  templateUrl: './project-contract.component.html',
  styleUrl: './project-contract.component.scss',
})
export class ProjectContractComponent extends BaseComponent implements OnInit {
  @ViewChild('agreementContent') agreementContent?: ElementRef<HTMLElement>;

  project: CreatedProject | null = null;
  projectUuid = '';
  contractUuid = '';
  selectedMode: ClientContractMode | null = null;
  guideline: GuidelineDetail | null = null;
  guidelineHtml: SafeHtml | null = null;
  isLoadingProject = false;
  isLoadingGuideline = false;
  isSubmitting = false;
  isContractSigned = false;
  canSignDefault = false;
  selectedFile: File | null = null;
  errorMessage = '';
  successMessage = '';

  constructor(
    injector: Injector,
    private route: ActivatedRoute,
    private router: Router,
    private projectsCreatedService: ProjectsCreatedService,
    private guidelinesService: GuidelinesService,
    private sanitizer: DomSanitizer,
  ) {
    super(injector);
  }

  ngOnInit(): void {
    this.route.paramMap
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe(params => {
        this.projectUuid = params.get('uuid') || '';
        if (this.projectUuid) {
          this.loadProject();
        }
      });
  }

  goBack(): void {
    if (this.projectUuid) {
      this.router.navigate(['/app/insighter-dashboard/projects-created', this.projectUuid]);
      return;
    }

    this.router.navigate(['/app/insighter-dashboard/projects-created']);
  }

  selectMode(mode: ClientContractMode): void {
    this.selectedMode = mode;
    this.errorMessage = '';
    this.successMessage = '';
    this.canSignDefault = false;

    if (mode === 'default') {
      this.loadDefaultContract();
      return;
    }

    this.guideline = null;
    this.guidelineHtml = null;
  }

  onAgreementScroll(): void {
    this.updateCanSignDefault();
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement | null;
    this.selectedFile = input?.files?.[0] || null;
    this.errorMessage = '';
  }

  signDefaultContract(): void {
    if (!this.contractUuid || !this.canSignDefault || this.isSubmitting || this.isContractSigned) return;

    const formData = new FormData();
    formData.append('is_attach_type', '0');
    formData.append('accept_contract', 'true');

    this.submitContract(formData);
  }

  signCustomContract(): void {
    if (!this.contractUuid || this.isSubmitting || this.isContractSigned) return;
    if (!this.selectedFile) {
      this.errorMessage = this.lang === 'ar'
        ? 'يرجى رفع ملف العقد المخصص.'
        : 'Please upload the custom contract file.';
      return;
    }

    const formData = new FormData();
    formData.append('is_attach_type', '1');
    formData.append('accept_contract', 'true');
    formData.append('file', this.selectedFile);

    this.submitContract(formData);
  }

  get canSubmitCustom(): boolean {
    return !!this.contractUuid && !!this.selectedFile && !this.isSubmitting && !this.isContractSigned;
  }

  get contractUnavailableMessage(): string {
    return this.lang === 'ar'
      ? 'لم يتم إنشاء عقد لهذا المشروع بعد.'
      : 'A contract has not been created for this project yet.';
  }

  getBackIcon(): string {
    return this.lang === 'ar' ? 'ki-arrow-right' : 'ki-arrow-left';
  }

  private loadProject(): void {
    this.isLoadingProject = true;
    this.errorMessage = '';
    this.project = null;
    this.contractUuid = '';
    this.isContractSigned = false;
    this.selectedMode = null;

    this.projectsCreatedService.getProject(this.projectUuid)
      .pipe(
        takeUntil(this.unsubscribe$),
        finalize(() => (this.isLoadingProject = false))
      )
      .subscribe({
        next: project => {
          this.project = project;
          this.contractUuid = project.contract_uuid || '';
          if (project.contract) {
            this.applyContractState(project.contract);
          }

          if (!this.contractUuid) {
            this.errorMessage = this.contractUnavailableMessage;
            return;
          }

          this.loadContractState();
        },
        error: err => {
          this.errorMessage = this.getServerErrorMessage(err);
          this.handleServerErrors(err);
        },
      });
  }

  private loadContractState(): void {
    this.projectsCreatedService.getProjectContract(this.contractUuid)
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe({
        next: contract => this.applyContractState(contract),
        error: () => {
          // Some environments only include contract metadata in project/show.
          // Signing remains available if the dedicated contract lookup is unavailable.
        },
      });
  }

  private applyContractState(contract: CreatedProjectContract): void {
    this.isContractSigned = contract.user_sign_at;
    if (!this.isContractSigned) return;

    this.selectedMode = contract.is_attach_type ? 'custom' : 'default';
    this.successMessage = this.lang === 'ar'
      ? 'تم توقيع العقد من طرفك. بانتظار توقيع الخبير.'
      : 'You have signed this contract. Waiting for the insighter signature.';

    if (this.selectedMode === 'default' && !this.guidelineHtml) {
      this.loadDefaultContract();
    }
  }

  private loadDefaultContract(): void {
    this.isLoadingGuideline = true;
    this.errorMessage = '';
    this.guideline = null;
    this.guidelineHtml = null;

    this.guidelinesService.getCurrentGuidelineByType('contract')
      .pipe(
        takeUntil(this.unsubscribe$),
        finalize(() => (this.isLoadingGuideline = false))
      )
      .subscribe({
        next: guideline => {
          this.guideline = guideline;
          this.guidelineHtml = this.sanitizer.bypassSecurityTrustHtml(guideline.guideline || '');
          setTimeout(() => this.updateCanSignDefault());
        },
        error: err => {
          this.errorMessage = this.getServerErrorMessage(err);
        },
      });
  }

  private submitContract(formData: FormData): void {
    this.isSubmitting = true;
    this.errorMessage = '';
    this.successMessage = '';

    this.projectsCreatedService.signProjectContract(this.contractUuid, formData)
      .pipe(
        takeUntil(this.unsubscribe$),
        finalize(() => (this.isSubmitting = false))
      )
      .subscribe({
        next: () => {
          this.isContractSigned = true;
          this.successMessage = this.lang === 'ar'
            ? 'تم توقيع العقد بنجاح. بانتظار توقيع الخبير.'
            : 'Contract signed successfully. Waiting for the insighter signature.';
          this.showSuccess(
            this.lang === 'ar' ? 'نجاح' : 'Success',
            this.successMessage
          );
        },
        error: err => {
          this.errorMessage = this.getServerErrorMessage(err);
          this.handleServerErrors(err);
        },
      });
  }

  private updateCanSignDefault(): void {
    const el = this.agreementContent?.nativeElement;
    if (!el || this.isLoadingGuideline) {
      this.canSignDefault = false;
      return;
    }

    this.canSignDefault = el.scrollHeight <= el.clientHeight + 2
      || el.scrollTop + el.clientHeight >= el.scrollHeight - 4;
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

  private handleServerErrors(error: any): void {
    this.showError(
      this.lang === 'ar' ? 'حدث خطأ' : 'An error occurred',
      this.getServerErrorMessage(error)
    );
  }
}
