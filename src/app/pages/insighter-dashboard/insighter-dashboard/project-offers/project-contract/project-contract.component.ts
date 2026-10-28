import { AgreementRevisionsService } from 'src/app/_fake/services/agreement-revisions/agreement-revisions.service';
import { Component, Injector, OnInit } from '@angular/core';
import { DomSanitizer, SafeHtml, SafeResourceUrl } from '@angular/platform-browser';
import { ActivatedRoute, Router } from '@angular/router';
import { combineLatest, of } from 'rxjs';
import { catchError, finalize, map, switchMap, takeUntil } from 'rxjs/operators';
import Swal from 'sweetalert2';
import {
  ProjectContract,
  ProjectContractFile,
  ProjectOffersService,
} from 'src/app/_fake/services/project-offers/project-offers.service';
import { BaseComponent } from 'src/app/modules/base.component';
import { ProjectScheduleFields } from 'src/app/_fake/services/project-phase2/project-phase2.model';
import { ProjectParty } from 'src/app/_fake/services/project-phase2/project-party.model';

@Component({
  selector: 'app-insighter-project-contract',
  templateUrl: './project-contract.component.html',
  styleUrl: './project-contract.component.scss',
})
export class ProjectContractComponent extends BaseComponent implements OnInit {
  contractUuid = '';
  contract: ProjectContract | null = null;
  projectSchedule: ProjectScheduleFields | null = null;
  client: ProjectParty | null = null;
  contractHtml: SafeHtml | null = null;
  agreementChanged = false;
  filePreviewUrl: SafeResourceUrl | null = null;
  isLoadingContract = false;
  isSigning = false;
  errorMessage = '';
  successMessage = '';
  returnUrl = '/app/insighter-dashboard/project-offers';

  constructor(
    injector: Injector,
    private route: ActivatedRoute,
    private router: Router,
    private projectOffersService: ProjectOffersService,
    private sanitizer: DomSanitizer,
  ) {
    super(injector);
  }

  ngOnInit(): void {
    this.injector.get(AgreementRevisionsService).changed$.pipe(takeUntil(this.unsubscribe$)).subscribe(event => {
      if (event.projectUuid !== this.route.snapshot.queryParamMap.get('projectUuid')) return;
      this.agreementChanged = true;
      this.contractHtml = null;
      this.filePreviewUrl = null;
    });
    combineLatest([this.route.paramMap, this.route.queryParamMap])
      .pipe(
        switchMap(([params, query]) => {
          this.returnUrl = query.get('returnUrl') || '/app/insighter-dashboard/project-offers';
          this.contractUuid = params.get('contractUuid') || '';
          this.projectSchedule = null;
          this.client = null;
          if (this.contractUuid) this.loadContract();

          const projectUuid = query.get('projectUuid');
          const contractUuid = this.contractUuid;
          if (!projectUuid || !contractUuid) return of(null);

          return this.projectOffersService.getInsighterProjectDetails(projectUuid).pipe(
            map(project => {
              // Only show details from the project belonging to this contract.
              const projectContractUuid = project.contract_uuid
                || project.project.contract_uuid || project.offer?.contract_uuid;
              return projectContractUuid === contractUuid ? project.project : null;
            }),
            // Project details are supplementary; their failure must not block signing.
            catchError(() => of(null)),
          );
        }),
        takeUntil(this.unsubscribe$),
      )
      .subscribe(project => {
        this.projectSchedule = project?.schedule ?? null;
        this.client = project?.client ?? null;
      });
  }

  goBack(): void {
    this.router.navigateByUrl(this.returnUrl);
  }

  async signContract(): Promise<void> {
    const contractUuid = this.getActiveContractUuid();
    if (this.agreementChanged || this.contract?.requires_prepare || !contractUuid || this.isSigning || !this.contract?.user_sign_at || this.contract.insighter_sign_at || this.contract.status !== 'awaiting_insighter_signature') {
      return;
    }

    const confirmed = await this.confirmSignContract();
    if (!confirmed || this.agreementChanged || this.contract?.requires_prepare) return;

    this.isSigning = true;
    this.errorMessage = '';
    this.successMessage = '';

    this.projectOffersService.signProjectContract(contractUuid)
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
          void Swal.fire({
            icon: 'success',
            title: this.lang === 'ar' ? 'تم توقيع العقد' : 'Contract signed',
            text: this.successMessage,
            confirmButtonText: this.lang === 'ar' ? 'تم' : 'Done',
            allowOutsideClick: false,
          });
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

  private async confirmSignContract(): Promise<boolean> {
    const result = await Swal.fire({
      title: this.lang === 'ar' ? 'تأكيد توقيع العقد' : 'Confirm contract signature',
      text: this.lang === 'ar'
        ? 'هل أنت متأكد أنك تريد توقيع هذا العقد؟'
        : 'Are you sure you want to sign this contract?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: this.lang === 'ar' ? 'نعم، وقّع العقد' : 'Yes, sign contract',
      cancelButtonText: this.lang === 'ar' ? 'إلغاء' : 'Cancel',
      reverseButtons: this.lang === 'ar',
      buttonsStyling: false,
      customClass: {
        confirmButton: 'btn btn-info',
        cancelButton: 'btn btn-light me-3',
      },
    });

    return result.isConfirmed;
  }

  getBackIcon(): string {
    return this.lang === 'ar' ? 'ki-arrow-right' : 'ki-arrow-left';
  }

  get contractDisplayName(): string {
    return this.contract?.name
      || (this.lang === 'ar' ? 'عقد خدمة مشروع' : 'Project Service Contract');
  }

  get selectedContractLanguageLabel(): string {
    const language = this.normalizeContractLanguage(this.contract?.language || this.contract?.contract_language);
    if (!language) return '';

    if (language === 'ar') return this.lang === 'ar' ? 'العربية' : 'Arabic';
    return this.lang === 'ar' ? 'الإنجليزية' : 'English';
  }

  get selectedCourtCountryName(): string {
    const country = this.contract?.court_country;
    if (!country) return '';

    if (typeof country.name === 'object') {
      return this.lang === 'ar'
        ? country.name?.ar || country.name?.en || ''
        : country.name?.en || country.name?.ar || '';
    }

    if (country.names) {
      return this.lang === 'ar'
        ? country.names?.ar || country.names?.en || ''
        : country.names?.en || country.names?.ar || '';
    }

    return country.name || '';
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

  refreshAgreementContract(): void { this.agreementChanged = false; this.loadContract(); }

  private loadContract(): void {
    this.isLoadingContract = true;
    this.errorMessage = '';
    this.successMessage = '';
    this.contract = null;
    this.contractHtml = null;
    this.filePreviewUrl = null;

    this.projectOffersService.getProjectContract(this.contractUuid)
      .pipe(
        takeUntil(this.unsubscribe$),
        finalize(() => (this.isLoadingContract = false))
      )
      .subscribe({
        next: contract => {
          this.contract = contract;
          if (contract.uuid) {
            this.contractUuid = contract.uuid;
          }

          if (contract.requires_prepare && !contract.is_attach_type) {
            this.errorMessage = this.lang === 'ar' ? 'يجب على العميل تحديث معاينة العقد قبل التوقيع.' : 'The Client needs to prepare the updated contract before signing.';
            return;
          }
          if (!contract.user_sign_at) return;

          if (contract.is_attach_type) {
            this.setFilePreview(contract.file);
            return;
          }

          const contractBody = this.getContractBody(contract);
          if (contractBody) {
            this.contractHtml = this.sanitizer.bypassSecurityTrustHtml(contractBody);
            return;
          }

          this.errorMessage = this.lang === 'ar'
            ? 'لم يتم العثور على محتوى العقد.'
            : 'Contract content was not found.';
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

  private setFilePreview(file: ProjectContractFile | null): void {
    if (!file?.url) {
      this.filePreviewUrl = null;
      return;
    }

    this.filePreviewUrl = this.sanitizer.bypassSecurityTrustResourceUrl(file.url);
  }

  private getContractBody(contract: ProjectContract): string {
    return contract.rendered_guideline
      || contract.guideline
      || contract.contract?.rendered_guideline
      || contract.contract?.guideline
      || '';
  }

  private getActiveContractUuid(): string {
    return this.contract?.uuid || this.contractUuid;
  }

  private normalizeContractLanguage(language: any): 'ar' | 'en' | null {
    if (!language) return null;
    const normalized = String(language).toLowerCase();
    return normalized === 'ar' || normalized === 'en' ? normalized : null;
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
