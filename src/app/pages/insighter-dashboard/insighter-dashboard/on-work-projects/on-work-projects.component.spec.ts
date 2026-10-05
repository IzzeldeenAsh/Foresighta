import { Injector } from '@angular/core';
import { Router } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';
import { TranslationService } from 'src/app/modules/i18n';
import { ProjectOffer, ProjectOffersService, ProjectReviewSubmission } from 'src/app/_fake/services/project-offers/project-offers.service';
import { OnWorkProjectsComponent } from './on-work-projects.component';

describe('Request Review deliverable selection', () => {
  let component: OnWorkProjectsComponent;
  let service: jasmine.SpyObj<ProjectOffersService>;
  let reviews: ProjectReviewSubmission[];

  const review = (id: number, status: string): ProjectReviewSubmission => ({
    uuid: `review-${id}`, deliverable: { id, title: `Deliverable ${id}` }, status,
    priority: { value: 'normal', label: 'Normal', color: null }, note: null, request_at: null,
    review_note: null, reviewed_at: null,
  });
  const values = () => component.availableReviewRequestTypeOptions.map(option => option.value);

  beforeEach(() => {
    const translation = { getSelectedLanguage: () => 'en', onLanguageChange: () => of('en') };
    const injector = { get: (token: unknown) => token === TranslationService ? translation : {} } as Injector;
    service = jasmine.createSpyObj('ProjectOffersService', ['getProjectReviewSubmissions', 'requestProjectReview', 'getProjectTimeline'], { isLoading$: of(false) });
    reviews = [review(1, 'pending'), review(2, 'approved'), review(3, 'changes_requested')];
    service.getProjectReviewSubmissions.and.callFake(() => of(reviews));
    component = new OnWorkProjectsComponent(injector, service, {} as Router);
    component.selectedProject = {
      uuid: 'project-1', status: 'in_progress', project: {
        uuid: 'project-1', deliverables: [1, 2, 3, 4].map(id => ({ id, title: `Deliverable ${id}` })),
      },
    } as ProjectOffer;
    component.reviewRequestNote = 'Please review this deliverable.';
    spyOn(component, 'showSuccess');
    spyOn(component, 'showError');
    spyOn<any>(component, 'handleServerErrors');
  });

  afterEach(() => component.ngOnDestroy());

  it('hides pending and approved deliveries, preserving revisions and new deliveries', () => {
    component.openReviewRequestDialog();
    expect(values()).toEqual(['deliverable_3', 'deliverable_4']);
    expect(component.reviewRequestType).toBe('deliverable_3');
    expect(component.canSubmitReviewRequest()).toBeFalse();
    expect(component.projectFileTypeOptions.map(option => option.value)).toContain('deliverable_2');
    expect(component.getReviewTypeLabel('deliverable_2')).toBe('Deliverable 2');
  });

  it('replaces a stale selection and also blocks stale or foreign IDs at submission', () => {
    component.reviewRequestType = 'deliverable_1';
    component.openReviewRequestDialog();
    expect(component.reviewRequestType).toBe('deliverable_3');
    for (const type of ['deliverable_1', 'deliverable_2', 'deliverable_999']) {
      component.reviewRequestType = type;
      expect(component.canSubmitReviewRequest()).toBeFalse();
      component.submitReviewRequest();
    }
    expect(service.requestProjectReview).not.toHaveBeenCalled();
  });

  it('leaves an empty selection when everything was submitted', () => {
    reviews = [1, 2, 3, 4].map(id => review(id, 'pending'));
    component.openReviewRequestDialog();
    expect(values()).toEqual([]);
    expect(component.reviewRequestType).toBe('');
    expect(component.canSubmitReviewRequest()).toBeFalse();
  });

  it('waits for review data and offers retry after a load failure', () => {
    const response = new Subject<ProjectReviewSubmission[]>();
    service.getProjectReviewSubmissions.and.returnValue(response);
    component.openReviewRequestDialog();
    expect(values()).toEqual([]);
    expect(component.canSubmitReviewRequest()).toBeFalse();
    response.error(new Error('Offline'));
    expect(component.reviewSubmissionsError).toBeTrue();
    expect(values()).toEqual([]);
    service.getProjectReviewSubmissions.and.returnValue(of(reviews));
    component.openReviewRequestDialog();
    expect(component.reviewSubmissionsError).toBeFalse();
    expect(values()).toEqual(['deliverable_3', 'deliverable_4']);
  });

  it('removes a newly submitted delivery after refreshing and selects the next one', () => {
    reviews = reviews.map(item => item.status === 'pending' ? { ...item, status: 'approved' } : item);
    component.openReviewRequestDialog();
    service.requestProjectReview.and.callFake(() => {
      reviews = [...reviews, review(3, 'pending')];
      return of({});
    });
    component.submitReviewRequest();
    expect(service.requestProjectReview).toHaveBeenCalledTimes(1);
    expect(values()).toEqual(['deliverable_4']);
    expect(component.reviewRequestType).toBe('deliverable_4');
    expect(component.reviewRequestDialogVisible).toBeFalse();
  });

  it('blocks another deliverable while any project review is pending', () => {
    component.openReviewRequestDialog();
    component.reviewRequestType = 'deliverable_4';
    component.submitReviewRequest();
    expect(service.requestProjectReview).not.toHaveBeenCalled();
    expect(component.reviewRequestError).toContain('pending review');
  });

  it('blocks submission before the first payment', () => {
    reviews = [];
    component.selectedProject!.project_status = 'payment';
    component.openReviewRequestDialog();
    expect(component.canSubmitReviewRequest()).toBeFalse();
    component.submitReviewRequest();
    expect(service.requestProjectReview).not.toHaveBeenCalled();
    expect(component.reviewRequestError).toContain('first installment');
  });

  it('keeps inputs and displays field errors inside the dialog after a 422', () => {
    reviews = [];
    const file = new File(['test'], 'delivery.txt', { type: 'text/plain' });
    component.selectedReviewRequestFiles = [file];
    service.requestProjectReview.and.returnValue(throwError(() => ({
      status: 422, error: { message: 'Validation failed', errors: { note: ['Note is invalid.'] } },
    })));
    component.openReviewRequestDialog();
    component.submitReviewRequest();
    expect(component.reviewRequestError).toBe('Note is invalid.');
    expect(component.reviewRequestDialogVisible).toBeTrue();
    expect(component.reviewRequestNote).toBe('Please review this deliverable.');
    expect(component.selectedReviewRequestFiles).toEqual([file]);
    expect(component.reviewRequestSubmitting).toBeFalse();
  });

  it('uses project status in the project badge', () => {
    component.selectedProject!.project_status = 'in_review';
    expect(component.getProjectStatusLabel(component.selectedProject!)).toBe('In review');
  });

  it('does not interpret a failed timeline review fetch as an empty review history', () => {
    service.getProjectTimeline.and.returnValue(of({ steps: [] } as any));
    service.getProjectReviewSubmissions.and.returnValue(throwError(() => new Error('Offline')));
    component.loadInsighterTimeline('project-1');
    expect(component.reviewSubmissionsError).toBeTrue();
    expect(values()).toEqual([]);
    expect(component.canSubmitReviewRequest()).toBeFalse();
  });
});
