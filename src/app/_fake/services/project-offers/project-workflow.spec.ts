import { TestBed } from '@angular/core/testing';
import { CommonModule } from '@angular/common';
import { ProjectServicesComponent } from '../../../pages/insighter-dashboard/insighter-dashboard/shared/project-services/project-services.component';
import { OfferInstallmentsComponent } from '../../../pages/insighter-dashboard/insighter-dashboard/shared/offer-installments/offer-installments.component';
import { of, Subject, throwError } from 'rxjs';
import { OnWorkProjectsComponent } from '../../../pages/insighter-dashboard/insighter-dashboard/on-work-projects/on-work-projects.component';
import { ProjectDetailComponent } from '../../../pages/insighter-dashboard/insighter-dashboard/projects-created/project-detail/project-detail.component';
import { validCalendarDate, appendInstallments, canRespondToProposal, contractFirst, installmentTotal, mapProjectServices, OfferInstallment, offerTimelinePreview, ProjectDeliverable, validInstallments, validProjectFile } from './project-workflow';
import { ProjectTimelineComponent } from '../../../pages/insighter-dashboard/insighter-dashboard/shared/project-timeline/project-timeline.component';
import { SendProposalComponent } from '../../../pages/insighter-dashboard/insighter-dashboard/project-offers/send-proposal/send-proposal.component';
import { ProjectsCreatedService } from '../projects-created/projects-created.service';
import { ProjectTimelineStep } from '../project-timeline/project-timeline.model';
import { ProjectOffersService } from './project-offers.service';

describe('Project offers and installment API contract', () => {
  const deliverables: ProjectDeliverable[] = [
    { id: 10, title: 'Market map', position: 1, project_service_id: 5, date: '2026-08-20', report_type: ['pdf'], way: { selected: 'on_platform' } },
    { id: 11, title: 'Report', position: 2, project_service_id: 5, date: '2026-09-01', report_type: ['docx'], way: { selected: 'session' } },
  ];
  const rows: OfferInstallment[] = [
    { title: 'Contract', percentage: 40, due_type: 'contract' },
    { title: 'Start', percentage: 20, due_type: 'date', due_date: '2026-08-05' },
    { title: 'Middle', percentage: 10, due_type: 'date', due_date: '2026-08-25' },
    { title: 'Map approval', percentage: 20, due_type: 'deliverable', project_service_deliverable_id: 10 },
    { title: 'Report approval', percentage: 10, due_type: 'deliverable', project_service_deliverable_id: 11 },
  ];
  it('maps service-owned deliverables and preserves calendar dates', () => {
    const services = mapProjectServices([{ id: 5, position: 2, title: 'Research', components: [{ 'deliverable-stage': { deliverables } }] }]);
    expect(services[0].deliverables[0].date).toBe('2026-08-20');
    expect(services[0].deliverables[1].project_service_id).toBe(5);
    expect(services[0].deliverables[0].service_title).toBe('Research');
    expect(services[0].scopes).toEqual([]);
  });
  it('pins the contract without mutating remaining row order', () => {
    const input = [rows[1], rows[2], rows[0], rows[3]];
    expect(contractFirst(input)).toEqual([rows[0], rows[1], rows[2], rows[3]]);
    expect(input[0]).toBe(rows[1]);
  });
  it('accepts four-decimal totals, repeated deliverables and past dates', () => {
    const repeated: OfferInstallment[] = [
      { ...rows[3], percentage: 33.3333 }, { ...rows[3], percentage: 33.3333 },
      { ...rows[1], due_date: '2020-01-01', percentage: 33.3334 },
    ];
    expect(installmentTotal(repeated)).toBe(100);
    expect(validInstallments(repeated, deliverables)).toBeTrue();
  });
  it('rejects duplicate contracts, missing triggers, foreign deliverables and invalid totals', () => {
    expect(validInstallments([{ ...rows[0], percentage: 50 }, { ...rows[0], percentage: 50 }], deliverables)).toBeFalse();
    expect(validInstallments([{ ...rows[0], percentage: 50 }, { ...rows[1], percentage: 50, due_date: null }], deliverables)).toBeFalse();
    expect(validInstallments([{ ...rows[0], percentage: 50 }, { ...rows[3], percentage: 50, project_service_deliverable_id: 999 }], deliverables)).toBeFalse();
    expect(validInstallments([{ ...rows[0], percentage: 100 }], deliverables)).toBeFalse();
    expect(validInstallments([{ ...rows[0], percentage: 20 }, { ...rows[3], percentage: 50 }], deliverables)).toBeFalse();
  });
  it('serializes only the applicable trigger fields and pins the contract', () => {
    const data = new FormData();
    appendInstallments(data, [{ ...rows[3], due_date: '2026-01-01' }, { ...rows[0], project_service_deliverable_id: 11 }]);
    expect(data.get('installments[0][due_type]')).toBe('contract');
    expect(data.has('installments[0][project_service_deliverable_id]')).toBeFalse();
    expect(data.get('installments[1][project_service_deliverable_id]')).toBe('10');
    expect(data.has('installments[1][due_date]')).toBeFalse();
  });
  it('composes full offers without any installment or old split fields', () => {
    const form = Object.create(SendProposalComponent.prototype) as SendProposalComponent;
    Object.assign(form, { hourlyRate: 100, estimateAmount: 2, estimateUnit: 'days', coverLetter: 'Offer', paymentPlan: 'full', installments: rows, selectedAttachments: [] });
    const data = (form as any).buildProposalFormData() as FormData;
    expect(data.get('payment_plan')).toBe('full');
    expect(data.get('estimated_hours')).toBe('16');
    expect(data.has('installments[0][title]')).toBeFalse();
    expect(data.has('down_payment_percentage')).toBeFalse();
    expect(data.has('final_payment_percentage')).toBeFalse();
  });
  it('previews payment 4 before payment 3 and the existing API repeated-payment insertion order', () => {
    const preview = offerTimelinePreview(deliverables, rows);
    expect(preview.map(step => step.title)).toEqual(['Contract', 'Start', 'Market map', 'Map approval', 'Middle', 'Report', 'Report approval']);
    const repeated = offerTimelinePreview(deliverables, [...rows, { ...rows[3], title: 'Second map payment' }]);
    expect(repeated.map(step => step.title).slice(2, 5)).toEqual(['Market map', 'Second map payment', 'Map approval']);
  });
  it('selects the latest detailed proposal without requiring backend sorting or extra list fields', () => {
    const service = Object.create(ProjectOffersService.prototype) as any;
    const mapped = service.mapInsighterProject({ uuid: 'project', proposals: [
      { uuid: 'old', created_at: '2026-08-01 10:00:00', match: { uuid: 'old-match' } },
      { uuid: 'new', created_at: '2026-09-01 10:00:00', match: { uuid: 'new-match' } },
    ] });
    expect(mapped.match_uuid).toBe('new-match');
    expect(service.mapInsighterProject({ uuid: 'project', proposals: [{ uuid: 'summary', action_status: 'viewed' }] }).match_uuid).toBeNull();
  });
  it('keeps client review submissions visible when the API omits deliverable details', () => {
    const component = Object.create(ProjectDetailComponent.prototype) as ProjectDetailComponent;
    Object.assign(component, { selectedReviewDeliverableId: 10, reviewSubmissions: [{ uuid: 'review', status: 'pending' }] });
    expect(component.canFilterReviewsByDeliverable).toBeFalse();
    expect(component.getSortedReviewSubmissions().map(review => review.uuid)).toEqual(['review']);
  });
  it('orders completed timeline steps first and numbers by displayed position', () => {
    const timeline = new ProjectTimelineComponent({} as any);
    const step = (key: string, step_no: number, state: any, extra = {}): ProjectTimelineStep => ({ key, step_no, state, display: true, title: key, status: 'pending', amount: null, date: null, party: null, meta: {}, ...extra });
    timeline.steps = [step('contracting', 1, 'in_progress'), step('client_info', 2, 'completed'), step('payment_installment_4', 3, 'locked', { amount: '200.00' }), step('payment_installment_3', 4, 'locked'), step('closed_project', 5, 'locked')];
    expect(timeline.visibleSteps.map(item => item.key)).toEqual(['client_info', 'contracting', 'payment_installment_4', 'payment_installment_3', 'closed_project']);
    expect(timeline.stepNumberLabel(timeline.steps[1])).toBe('Step 1');
    expect(timeline.stepNumberLabel(timeline.steps[0])).toBe('Step 2');
    expect(timeline.progress).toBe('0%');
    expect(timeline.isPayment(timeline.steps[2])).toBeTrue();
    expect(timeline.amountLabel(timeline.steps[2])).toBe('$200.00');
    expect(timeline.visibleSteps[4].state).toBe('locked');
    timeline.audience = 'insighter';
    expect(timeline.actionType(step('deliverable_10', 6, 'in_progress', { status: 'changes_requested', meta: { project_service_deliverable_id: 10 } }))).toBe('open_review');
  });
  it('blocks expired and closed proposal actions independently of old action status', () => {
    const offer = { stage: 'proposal', action_status: 'viewed', project_status: 'submitted', project: { deadline_offer: '2026-08-01T10:00:00Z' } };
    expect(canRespondToProposal(offer, Date.parse('2026-08-01T09:00:00Z'))).toBeTrue();
    expect(canRespondToProposal(offer, Date.parse('2026-08-01T10:00:00Z'))).toBeFalse();
    expect(canRespondToProposal({ ...offer, project_status: 'cancelled' }, Date.parse('2026-08-01T09:00:00Z'))).toBeFalse();
  });
  it('validates file formats and the 50 MB boundary', () => {
    expect(validProjectFile({ name: 'brief.PDF', size: 50 * 1024 * 1024 })).toBeTrue();
    expect(validProjectFile({ name: 'brief.pdf', size: 50 * 1024 * 1024 + 1 })).toBeFalse();
    expect(validProjectFile({ name: 'brief.exe', size: 100 })).toBeFalse();
  });
  it('checks out the numeric order installment, not the project UUID or start/end', () => {
    const http = jasmine.createSpyObj('HttpClient', ['post']);
    http.post.and.returnValue(of({}));
    const translation = { getSelectedLanguage: () => 'en', onLanguageChange: () => of('en') };
    const service = new ProjectsCreatedService(http, translation as any);
    service.checkoutProjectInstallment(104, 'manual').subscribe();
    expect(http.post.calls.mostRecent().args[0]).toMatch(/\/checkout\/104$/);
    expect(http.post.calls.mostRecent().args[1]).toEqual({ payment_method: 'manual' });
  });
  function workspace(): any {
    const component = Object.create(OnWorkProjectsComponent.prototype);
    Object.assign(component, {
      lang: 'en', unsubscribe$: new Subject<void>(),
      selectedProject: { uuid: 'project-id', project_status: 'in_progress', project: { uuid: 'project-id', project_services: [{ deliverables }] } },
      reviewSubmissions: [], timelineSteps: [], selectedReviewRequestFiles: [], reviewDeliverableId: 10,
      reviewRequestPriority: 'normal', reviewRequestNote: 'Please review', reviewRequestSubmitting: false,
      reviewSubmissionsLoading: false, projectFilesUploading: false, projectFileType: 'deliverable',
      projectFileDeliverableId: 10, projectFileName: 'Reports',
      showSuccess: jasmine.createSpy('success'), showError: jasmine.createSpy('error'), handleServerErrors: jasmine.createSpy('serverError'),
      loadInsighterProjectDetails: jasmine.createSpy('details'), loadProjectReviewSubmissions: jasmine.createSpy('reviews'), loadInsighterTimeline: jasmine.createSpy('timeline'),
    });
    return component;
  }
  it('submits a deliverable ID and blocks a pending review on a different deliverable', () => {
    const component = workspace();
    const request = jasmine.createSpy('review').and.returnValue(of({}));
    component.projectOffersService = { requestProjectReview: request };
    component.submitReviewRequest();
    const data: FormData = request.calls.mostRecent().args[1];
    expect(data.get('project_service_deliverable_id')).toBe('10');
    expect(data.has('type')).toBeFalse();
    component.reviewRequestNote = 'Another';
    component.reviewSubmissions = [{ status: 'pending', deliverable: { id: 11 } }];
    expect(component.canSubmitReviewRequest()).toBeFalse();
    component.submitReviewRequest();
    expect(request.calls.count()).toBe(1);
  });
  it('uploads one file per request and retries only the failed remainder', () => {
    const component = workspace();
    const first = new File(['first'], 'first.pdf');
    const second = new File(['second'], 'second.pdf');
    component.selectedProjectFiles = [first, second];
    const upload = jasmine.createSpy('upload').and.returnValues(of({}), throwError(() => new Error('Offline')));
    component.projectOffersService = { uploadInsighterProjectFile: upload };
    component.submitProjectFileUpload();
    expect(upload.calls.count()).toBe(2);
    expect((upload.calls.argsFor(0)[1] as FormData).getAll('file')).toEqual([first]);
    expect((upload.calls.argsFor(1)[1] as FormData).get('deliverable_id')).toBe('10');
    expect(component.selectedProjectFiles).toEqual([second]);
    upload.and.returnValue(of({}));
    component.submitProjectFileUpload();
    expect(upload.calls.count()).toBe(3);
    expect((upload.calls.argsFor(2)[1] as FormData).getAll('file')).toEqual([second]);
    expect(component.selectedProjectFiles).toEqual([]);
  });
  it('uses the clicked active installment amount instead of the whole order', () => {
    const component = Object.create(ProjectDetailComponent.prototype) as ProjectDetailComponent;
    const active: ProjectTimelineStep = { key: 'payment_installment_4', step_no: 6, title: 'Approval', display: true, state: 'in_progress', status: 'pending', amount: '200.00', date: null, party: null, meta: { order_installment_id: 104 } };
    Object.assign(component, { project: { uuid: 'project-id', status: 'in_progress', order: { amount: 1000 } }, timelineSteps: [active], selectedPaymentStep: active });
    expect(component.getRequiredProjectPaymentAmount({ amount: 1000 } as any)).toBe(200);
    expect(component.shouldShowProjectPayment()).toBeTrue();
    active.state = 'completed';
    expect(component.shouldShowProjectPayment()).toBeFalse();
  });

  it('renders service-owned requirements and delivery methods in both languages', async () => {
    await TestBed.configureTestingModule({ imports: [CommonModule], declarations: [ProjectServicesComponent] }).compileComponents();
    const fixture = TestBed.createComponent(ProjectServicesComponent);
    fixture.componentInstance.services = mapProjectServices([{ id: 5, position: 1, title: 'Research', prompt_ai: 'Research the market', scopes: [{ scope: 'Market sizing', children: [{ scope: 'Segments' }] }], components: [{ 'deliverable-stage': { deliverables } }, { 'data-sources-expected': 'both' }] }]);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('.dl-item').length).toBe(2);
    expect(fixture.nativeElement.textContent).toContain('Research the market');
    expect(fixture.nativeElement.textContent).toContain('Primary and secondary data');
    expect(fixture.nativeElement.textContent).toContain('On the platform');
    fixture.componentInstance.lang = 'ar';
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('بيانات أولية وثانوية');
    expect(fixture.nativeElement.textContent).toContain('على المنصة');
  });
  it('renders every payment and its linked deliverable condition', async () => {
    await TestBed.configureTestingModule({ imports: [CommonModule], declarations: [OfferInstallmentsComponent] }).compileComponents();
    const fixture = TestBed.createComponent(OfferInstallmentsComponent);
    Object.assign(fixture.componentInstance, { rows, deliverables, price: 1000 });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('tbody tr').length).toBe(5);
    expect(fixture.nativeElement.textContent).toContain('$400.00');
    expect(fixture.nativeElement.textContent).toContain('After approval: Market map');
  });

  it('rejects impossible dates without imposing a minimum date', () => {
    expect(validCalendarDate('2026-02-31')).toBeFalse();
    expect(validCalendarDate('2024-02-29')).toBeTrue();
    expect(validCalendarDate('2026-02-29')).toBeFalse();
  });

});
