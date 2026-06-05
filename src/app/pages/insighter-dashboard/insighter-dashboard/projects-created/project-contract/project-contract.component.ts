import { Component, ElementRef, Injector, OnInit, ViewChild } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { ActivatedRoute, Router } from '@angular/router';
import { finalize, switchMap, takeUntil } from 'rxjs/operators';
import Swal from 'sweetalert2';
import { CountriesService, Country } from 'src/app/_fake/services/countries/countries.service';
import {
  CreatedProjectContract,
  CreatedProject,
  PrepareStandardProjectContractPayload,
  ProjectsCreatedService,
} from 'src/app/_fake/services/projects-created/projects-created.service';
import { BaseComponent } from 'src/app/modules/base.component';

type ClientContractMode = 'default' | 'custom';
type ContractLanguage = 'ar' | 'en';

@Component({
  selector: 'app-project-contract',
  templateUrl: './project-contract.component.html',
  styleUrl: './project-contract.component.scss',
})
export class ProjectContractComponent extends BaseComponent implements OnInit {
  @ViewChild('agreementContent') agreementContent?: ElementRef<HTMLElement>;

  project: CreatedProject | null = null;
  contract: CreatedProjectContract | null = null;
  projectUuid = '';
  contractUuid = '';
  selectedMode: ClientContractMode | null = null;
  contractHtml: SafeHtml | null = null;
  contractLanguage: ContractLanguage | null = null;
  readonly contractLanguageOptions: Array<{ label: string; value: ContractLanguage; arLabel: string }> = [
    { label: 'English', value: 'en', arLabel: 'الإنجليزية' },
    { label: 'Arabic', value: 'ar', arLabel: 'العربية' },
  ];
  courtCountries: Country[] = [];
  selectedCourtCountryId: number | null = null;
  isLoadingProject = false;
  isLoadingContract = false;
  isLoadingCountries = false;
  isPreparingContract = false;
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
    private countriesService: CountriesService,
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
      this.selectedFile = null;
      this.ensureCountriesLoaded();
      this.applyPreparedContractView(this.contract);
      return;
    }

    this.contractHtml = null;
  }

  selectContractLanguage(language: ContractLanguage): void {
    this.contractLanguage = language;
    this.errorMessage = '';
  }

  onCourtCountrySelected(country: Country): void {
    this.selectedCourtCountryId = country?.id || null;
    this.errorMessage = '';
  }

  onCourtCountryCleared(): void {
    this.selectedCourtCountryId = null;
  }

  prepareStandardContract(): void {
    if (!this.contractUuid || !this.contractLanguage || !this.selectedCourtCountryId || this.isPreparingContract) {
      return;
    }

    const payload: PrepareStandardProjectContractPayload = {
      contract_language: this.contractLanguage,
      court_country_id: this.selectedCourtCountryId,
    };

    this.isPreparingContract = true;
    this.isLoadingContract = true;
    this.errorMessage = '';
    this.successMessage = '';
    this.contractHtml = null;
    this.canSignDefault = false;

    this.projectsCreatedService.prepareStandardProjectContract(this.contractUuid, payload)
      .pipe(
        takeUntil(this.unsubscribe$),
        switchMap(() => this.projectsCreatedService.getProjectContract(this.contractUuid)),
        finalize(() => {
          this.isPreparingContract = false;
          this.isLoadingContract = false;
        })
      )
      .subscribe({
        next: contract => {
          this.applyContractState(contract);
          if (!this.contractHtml) {
            this.errorMessage = this.lang === 'ar'
              ? 'تم إعداد العقد، لكن لم يتم العثور على محتوى العقد.'
              : 'The contract was prepared, but no contract content was returned.';
          }
        },
        error: err => {
          this.errorMessage = this.getServerErrorMessage(err);
          this.handleServerErrors(err);
        },
      });
  }

  onAgreementScroll(): void {
    this.updateCanSignDefault();
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement | null;
    this.selectedFile = input?.files?.[0] || null;
    this.errorMessage = '';
  }

  async signDefaultContract(): Promise<void> {
    if (!this.contractUuid || !this.contractHtml || !this.canSignDefault || this.isSubmitting || this.isContractSigned) return;
    const confirmed = await this.confirmSignContract();
    if (!confirmed) return;

    const formData = new FormData();
    formData.append('is_attach_type', '0');
    formData.append('accept_contract', 'true');

    this.submitContract(formData);
  }

  async signCustomContract(): Promise<void> {
    if (!this.contractUuid || this.isSubmitting || this.isContractSigned) return;
    if (!this.selectedFile) {
      this.errorMessage = this.lang === 'ar'
        ? 'يرجى رفع ملف العقد المخصص.'
        : 'Please upload the custom contract file.';
      return;
    }

    const confirmed = await this.confirmSignContract();
    if (!confirmed) return;

    const formData = new FormData();
    formData.append('is_attach_type', '1');
    formData.append('accept_contract', 'true');
    formData.append('file', this.selectedFile);

    this.submitContract(formData);
  }

  get canSubmitCustom(): boolean {
    return !!this.contractUuid && !!this.selectedFile && !this.isSubmitting && !this.isContractSigned;
  }

  get canPrepareStandardContract(): boolean {
    return !!this.contractUuid
      && !!this.contractLanguage
      && !!this.selectedCourtCountryId
      && !this.isPreparingContract
      && !this.isContractSigned;
  }

  get selectedFileIcon(): string {
    if (!this.selectedFile?.name) {
      return '';
    }

    return this.getFileIconByExtension(this.getFileExtension(this.selectedFile.name));
  }

  get hasPreparedStandardContract(): boolean {
    return !!this.contractHtml;
  }

  get selectedContractLanguageLabel(): string {
    const option = this.contractLanguageOptions.find(item => item.value === this.contractLanguage);
    if (!option) return '';

    return this.lang === 'ar' ? option.arLabel : option.label;
  }

  get selectedCourtCountryName(): string {
    const country = this.courtCountries.find(item => item.id === this.selectedCourtCountryId);
    if (country) {
      return this.lang === 'ar' ? country.names?.ar || country.name : country.names?.en || country.name;
    }

    const contractCountry = this.contract?.court_country;
    if (!contractCountry) return '';

    if (typeof contractCountry.name === 'object') {
      return this.lang === 'ar'
        ? contractCountry.name?.ar || contractCountry.name?.en || ''
        : contractCountry.name?.en || contractCountry.name?.ar || '';
    }

    return contractCountry.names
      ? (this.lang === 'ar' ? contractCountry.names?.ar || contractCountry.names?.en : contractCountry.names?.en || contractCountry.names?.ar)
      : contractCountry.name || '';
  }

  get contractDisplayName(): string {
    return this.contract?.name
      || (this.lang === 'ar' ? 'عقد خدمة مشروع' : 'Project Service Contract');
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
    this.contract = null;
    this.contractUuid = '';
    this.isContractSigned = false;
    this.selectedMode = null;
    this.contractHtml = null;
    this.contractLanguage = null;
    this.selectedCourtCountryId = null;
    this.canSignDefault = false;

    this.projectsCreatedService.getProject(this.projectUuid)
      .pipe(
        takeUntil(this.unsubscribe$),
        finalize(() => (this.isLoadingProject = false))
      )
      .subscribe({
        next: project => {
          this.project = project;
          this.contractUuid = project.contract?.uuid || project.contract_uuid || '';
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
        error: err => {
          if (!this.contract) {
            this.errorMessage = this.getServerErrorMessage(err);
          }
        },
      });
  }

  private applyContractState(contract: CreatedProjectContract): void {
    this.contract = contract;
    this.isContractSigned = contract.user_sign_at;
    this.hydratePreparationFields(contract);

    const hasContractBody = this.applyPreparedContractView(contract);
    if (hasContractBody || this.isContractSigned) {
      this.selectedMode = contract.is_attach_type ? 'custom' : 'default';
    }

    if (!this.isContractSigned) return;

    this.successMessage = this.lang === 'ar'
      ? 'تم توقيع العقد من طرفك. بانتظار توقيع الخبير.'
      : 'You have signed this contract. Waiting for the insighter signature.';

    if (!contract.is_attach_type && !hasContractBody) {
      this.errorMessage = this.lang === 'ar'
        ? 'لم يتم العثور على محتوى العقد.'
        : 'Contract content was not found.';
    }
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
          this.contract = this.contract
            ? { ...this.contract, user_sign_at: true }
            : this.contract;
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

  private updateCanSignDefault(): void {
    const el = this.agreementContent?.nativeElement;
    if (!el || this.isLoadingContract || !this.contractHtml) {
      this.canSignDefault = false;
      return;
    }

    this.canSignDefault = el.scrollHeight <= el.clientHeight + 2
      || el.scrollTop + el.clientHeight >= el.scrollHeight - 4;
  }

  private ensureCountriesLoaded(): void {
    if (this.courtCountries.length || this.isLoadingCountries) return;

    this.isLoadingCountries = true;
    this.countriesService.getCountries()
      .pipe(
        takeUntil(this.unsubscribe$),
        finalize(() => (this.isLoadingCountries = false))
      )
      .subscribe({
        next: countries => {
          this.courtCountries = (countries || []).map(country => ({
            ...country,
            showFlag: true,
          }));
        },
        error: err => {
          this.errorMessage = this.getServerErrorMessage(err);
        },
      });
  }

  private applyPreparedContractView(contract: CreatedProjectContract | null): boolean {
    if (!contract || contract.is_attach_type) {
      this.contractHtml = null;
      this.canSignDefault = false;
      return false;
    }

    const html = this.getContractBody(contract);
    if (!html) {
      this.contractHtml = null;
      this.canSignDefault = false;
      return false;
    }

    this.contractHtml = this.sanitizer.bypassSecurityTrustHtml(html);
    setTimeout(() => this.updateCanSignDefault());
    return true;
  }

  private getContractBody(contract: CreatedProjectContract): string {
    return contract.rendered_guideline
      || contract.guideline
      || contract.contract?.rendered_guideline
      || contract.contract?.guideline
      || '';
  }

  private getFileExtension(filename: string): string {
    return filename.split('.').pop()?.toLowerCase() || '';
  }

  private getFileIconByExtension(extension: string): string {
    const iconMap: Record<string, string> = {
      pdf: './assets/media/svg/new-files/pdf.svg',
      doc: './assets/media/svg/new-files/doc.svg',
      docx: './assets/media/svg/new-files/docx.svg',
      jpg: './assets/media/svg/new-files/jpg.svg',
      jpeg: './assets/media/svg/new-files/jpg.svg',
      png: './assets/media/svg/new-files/jpg.svg',
    };

    return iconMap[extension] || './assets/media/svg/files/default.svg';
  }

  private hydratePreparationFields(contract: CreatedProjectContract): void {
    const language = this.normalizeContractLanguage(
      contract.language || contract.contract_language || contract.contract?.language
    );
    if (language) {
      this.contractLanguage = language;
    }

    const courtCountryId = this.extractCourtCountryId(contract);
    if (courtCountryId) {
      this.selectedCourtCountryId = courtCountryId;
    }
  }

  private normalizeContractLanguage(language: any): ContractLanguage | null {
    if (!language) return null;
    const normalized = String(language).toLowerCase();
    return normalized === 'ar' || normalized === 'en' ? normalized : null;
  }

  private extractCourtCountryId(contract: CreatedProjectContract): number | null {
    const rawId = contract.court_country_id
      ?? contract.court_country?.id
      ?? contract.contract?.court_country_id
      ?? contract.contract?.court_country?.id;
    const id = Number(rawId);

    return Number.isFinite(id) && id > 0 ? id : null;
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
