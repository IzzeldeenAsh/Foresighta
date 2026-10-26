import { Injector } from '@angular/core';
import { fakeAsync, tick } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { of } from 'rxjs';
import { TranslationService } from 'src/app/modules/i18n';
import { ProjectOffer, ProjectOffersService } from 'src/app/_fake/services/project-offers/project-offers.service';
import { InstallmentDraft, SendProposalComponent } from './send-proposal.component';
import { MissingOfferRequirements } from 'src/app/_fake/services/project-phase2/project-requirements.model';

describe('Proposal payment duration', () => {
  let component: SendProposalComponent;
  let payment: InstallmentDraft;

  beforeEach(() => {
    const translation = { getSelectedLanguage: () => 'en', onLanguageChange: () => of('en') };
    const injector = { get: (token: unknown) => token === TranslationService ? translation : {} } as Injector;
    component = new SendProposalComponent(injector, {} as ActivatedRoute, {} as Router, {} as ProjectOffersService);
    component.proposal = {
      project: { schedule: { duration_days: 30 }, deliverables: [{ id: 1, title: 'Final report', period_days: 31 }] },
    } as ProjectOffer;
    component.setPaymentPlan('full');
    payment = component.installments[0];
    payment.title = 'Full payment';
  });

  afterEach(() => component.ngOnDestroy());

  it('fills project-end payment with the full duration and submits the existing duration format', () => {
    component.setProjectEnd(payment);
    expect(payment.isProjectEnd).toBeTrue();
    expect(payment.period_days).toBe(30);
    expect(component.isPaymentPlanInvalid()).toBeFalse();
    const payload: FormData = (component as any).buildProposalFormData();
    expect(payload.get('installments[0][due_type]')).toBe('date');
    expect(payload.get('installments[0][period_days]')).toBe('30');
    component.setDueType(payment, 'date');
    expect(payment.isProjectEnd).toBeFalse();
    payment.period_days = 15;
    component.onInstallmentChanged(payment);
    expect(payment.period_days).toBe(15);
  });

  it('starts payment titles, percentages and linked deliverables empty and blocks the next step until filled', () => {
    component.coverLetter = 'My approach';
    component.fixedPrice = 100;
    component.setPaymentPlan('partial');
    const [first, second] = component.installments;
    expect(component.installments.map(item => [item.title, item.percentage])).toEqual([['', null], ['', null]]);
    expect(second.due_type).toBe('deliverable');
    expect(component.getInstallmentErrors(second)).toEqual(['Give the payment a title.', 'Percentage must be between 1 and 100.', 'Pick the linked deliverable.']);
    component.selectTab('payment');
    expect(component.selectTab('summary')).toBeFalse();
    expect(component.activeTab).toBe('payment');
    expect(component.showInstallmentErrors).toBeTrue();
    first.title = 'Contract payment'; first.percentage = 30;
    second.title = 'Report payment'; second.percentage = 70;
    component.selectInstallmentDeliverable(second, 1);
    component.proposal!.project.deliverables[0].period_days = 20;
    expect(component.selectTab('summary')).toBeTrue();
  });

  it('rejects durations past the project end for full and partial payment plans', () => {
    for (const plan of ['full', 'partial'] as const) {
      component.setPaymentPlan(plan);
      payment = component.installments[0];
      payment.title = 'Payment';
      payment.percentage = plan === 'full' ? 100 : 30;
      component.setDueType(payment, 'date');
      for (const days of [0, 30]) {
        payment.period_days = days;
        expect(component.getInstallmentErrors(payment)).toEqual([]);
      }
      payment.period_days = 31;
      expect(component.getInstallmentErrors(payment)).toContain('Payment duration cannot exceed the project duration (30 days).');
      expect(component.isPaymentPlanInvalid()).toBeTrue();
    }
  });

  it('rejects empty, negative and fractional durations without silently replacing an empty field', () => {
    component.setDueType(payment, 'date');
    for (const days of [null, -1, 1.5]) {
      payment.period_days = days;
      component.onInstallmentChanged(payment);
      expect(payment.period_days).toBe(days);
      expect(component.getInstallmentErrors(payment)).toContain('Enter the number of days from the project start.');
    }
  });

  it('rejects linked deliverables after the project end', () => {
    component.setDueType(payment, 'deliverable');
    component.selectInstallmentDeliverable(payment, 1);
    expect(component.getInstallmentErrors(payment)).toContain('Payment duration cannot exceed the project duration (30 days).');
  });

  it('does not invent a project-end duration when the schedule is missing', () => {
    component.proposal!.project.schedule.duration_days = null;
    component.setProjectEnd(payment);
    expect(payment.isProjectEnd).toBeFalsy();
    expect(payment.due_type).toBe('contract');
    component.proposal!.project.schedule.duration_days = 0;
    component.setProjectEnd(payment);
    expect(payment.isProjectEnd).toBeTrue();
    expect(payment.period_days).toBe(0);
  });

  const missingRequirements = (): MissingOfferRequirements => ({
    scopes: [{ project_service_id: 264, required_in_offer: true }],
    project_components: [{ component_id: 3, project_service_id: null, ownership_level: 'project', required_in_offer: true, component: { id: 3, slug: 'data-sources-expected', name: 'Data sources' } }],
    service_components: [264, 265].map(id => ({ project_service_id: id, component_id: 1, ownership_level: 'project_service', required_in_offer: true, component: { id: 1, slug: 'deliverable-stage', name: 'Deliverable Stage' } })),
  });

  const offerDeliverables = (): any[] => [
    { key: 'frontend-deliverable-1', title: 'First report', period_days: 10, way: { selected: 'session' } },
    { key: 'frontend-deliverable-2', title: 'Second report', period_days: 20, way: { selected: 'session' } },
  ];
  const draftWith = (deliverables: any[]) => ({ offer_scopes: [], offer_components: [{ project_service_id: 264, component_id: 1, value: { deliverables } }] });

  it('links insighter deliverables by the same key in installments and offer components', () => {
    component.proposal!.project.deliverables = [];
    component.onDeliverablesDraftChanged(draftWith(offerDeliverables()));
    expect(component.isDueTypeDisabled(payment, 'deliverable')).toBeFalse();
    component.setDueType(payment, 'deliverable');
    expect(payment.deliverable_key).toBeNull();
    expect(component.getInstallmentErrors(payment)).toContain('Pick the linked deliverable.');
    component.selectInstallmentDeliverable(payment, 'frontend-deliverable-1');
    expect(payment.deliverable_key).toBe('frontend-deliverable-1');
    expect(payment.project_service_deliverable_id).toBeNull();
    expect(component.getInstallmentErrors(payment)).toEqual([]);
    const payload: FormData = (component as any).buildProposalFormData();
    expect(payload.get('installments[0][deliverable_key]')).toBe(payload.get('offer_components[0][value][deliverables][0][key]'));
    expect(payload.has('installments[0][project_service_deliverable_id]')).toBeFalse();
    component.setDueType(payment, 'date');
    expect(((component as any).buildProposalFormData() as FormData).has('installments[0][deliverable_key]')).toBeFalse();
  });

  it('preserves client IDs and switches exclusively between ID and key in a mixed project', () => {
    component.onDeliverablesDraftChanged(draftWith(offerDeliverables()));
    component.setDueType(payment, 'deliverable');
    component.selectInstallmentDeliverable(payment, 1);
    let payload: FormData = (component as any).buildProposalFormData();
    expect(payload.get('installments[0][project_service_deliverable_id]')).toBe('1');
    expect(payload.has('installments[0][deliverable_key]')).toBeFalse();
    component.selectInstallmentDeliverable(payment, 'frontend-deliverable-2');
    payload = (component as any).buildProposalFormData();
    expect(payload.get('installments[0][deliverable_key]')).toBe('frontend-deliverable-2');
    expect(payload.has('installments[0][project_service_deliverable_id]')).toBeFalse();
    component.selectInstallmentDeliverable(payment, 1);
    expect(payment.deliverable_key).toBeNull();
  });

  it('uses live draft dates and requires reselecting a deleted deliverable', () => {
    component.proposal!.project.deliverables = [];
    component.proposal!.project.schedule.planned_start_date = '2026-10-14';
    const deliverables = offerDeliverables();
    component.onDeliverablesDraftChanged(draftWith(deliverables));
    component.setDueType(payment, 'deliverable');
    component.selectInstallmentDeliverable(payment, deliverables[0].key);
    expect(component.installmentDate(payment)).toBe('2026-10-24');
    deliverables[0].title = 'Updated report';
    deliverables[0].period_days = 31;
    component.onDeliverablesDraftChanged(draftWith(deliverables));
    expect(payment.deliverable_key).toBe(deliverables[0].key);
    expect(component.getInstallmentErrors(payment)).toContain('Payment duration cannot exceed the project duration (30 days).');
    component.onDeliverablesDraftChanged(draftWith(deliverables.slice(1)));
    component.onInstallmentChanged(payment);
    expect(payment.deliverable_key).toBeNull();
    expect(component.getInstallmentErrors(payment)).toContain('Pick the linked deliverable.');
    payment.deliverable_key = 'deleted-key';
    expect(component.isPaymentPlanInvalid()).toBeTrue();
  });

  it('prevents duplicate installments for both saved and drafted deliverables', () => {
    component.onDeliverablesDraftChanged(draftWith(offerDeliverables()));
    component.setPaymentPlan('partial');
    const [first, second] = component.installments;
    expect(second.due_type).toBe('deliverable');
    expect(component.installmentDeliverableReference(second)).toBeNull();
    component.setDueType(first, 'deliverable');
    component.selectInstallmentDeliverable(first, 'frontend-deliverable-1');
    expect(component.getAvailableDeliverables(second).map(item => item.reference)).toEqual([1, 'frontend-deliverable-2']);
    component.selectInstallmentDeliverable(second, first.deliverable_key!);
    expect(component.getInstallmentErrors(second)).toContain('This deliverable is already linked to another payment.');
    component.selectInstallmentDeliverable(first, 1);
    component.selectInstallmentDeliverable(second, 1);
    expect(component.getInstallmentErrors(second)).toContain('This deliverable is already linked to another payment.');
  });

  it('separates deliverables from scope fields and keeps editor inputs stable between tabs', () => {
    component.proposal!.missing_offer_requirements = missingRequirements();
    expect(component.tabs.map(tab => tab.key)).toEqual(['cover', 'scope', 'deliverables', 'pricing', 'payment', 'summary']);
    const scopeInput = component.scopeRequirements, deliverablesInput = component.deliverablesRequirements;
    expect(scopeInput.service_components).toEqual([]);
    expect(scopeInput.project_components.map(item => item.component_id)).toEqual([3]);
    expect(deliverablesInput.scopes).toEqual([]);
    expect(deliverablesInput.service_components.map(item => item.project_service_id)).toEqual([264, 265]);
    component.activeTab = 'scope';
    expect(component.nextTab?.key).toBe('deliverables');
    component.activeTab = 'deliverables';
    expect(component.scopeRequirements).toBe(scopeInput);
    expect(component.deliverablesRequirements).toBe(deliverablesInput);
    expect(component.nextTab?.key).toBe('pricing');
  });

  it('shows the deliverables tab for deliverables-only requests and hides empty requirement tabs', () => {
    component.proposal!.missing_offer_requirements = { ...missingRequirements(), scopes: [], project_components: [] };
    expect(component.tabs.map(tab => tab.key)).toEqual(['cover', 'deliverables', 'pricing', 'payment', 'summary']);
    expect(component.nextTab?.key).toBe('deliverables');
    component.proposal!.missing_offer_requirements = undefined;
    expect(component.tabs.map(tab => tab.key)).toEqual(['cover', 'pricing', 'payment', 'summary']);
    expect(component.requirementsValid).toBeTrue();
  });

  it('validates each service delivery and submits both tab drafts in the same offer payload', () => {
    component.proposal!.missing_offer_requirements = missingRequirements();
    component.coverLetter = 'My approach';
    component.scopeDraft = { offer_scopes: [{ project_service_id: 264, scope: 'Market sizing' }], offer_components: [{ project_service_id: null, component_id: 3, value: 'both' }] };
    expect((component as any).firstInvalidTab()).toBe('deliverables');
    component.deliverablesDraft = { offer_scopes: [], offer_components: [264, 265].map(id => ({ project_service_id: id, component_id: 1, value: { deliverables: [{ title: `Report ${id}`, period_days: 15, report_type: ['pdf'], way: { selected: 'on_platform' } }] } })) };
    expect(component.requirementsValid).toBeTrue();
    component.selectTab('scope');
    component.selectTab('deliverables');
    const payload: FormData = (component as any).buildProposalFormData();
    expect(payload.get('offer_scopes[0][scope]')).toBe('Market sizing');
    expect(payload.get('offer_components[0][component_id]')).toBe('3');
    expect(payload.get('offer_components[1][project_service_id]')).toBe('264');
    expect(payload.get('offer_components[2][project_service_id]')).toBe('265');
    expect(payload.get('offer_components[1][value][deliverables][0][title]')).toBe('Report 264');
    component.deliverablesDraft.offer_components[1].value.deliverables[0].title = '';
    expect(component.requirementsValid).toBeFalse();
    expect((component as any).firstInvalidTab()).toBe('deliverables');
  });

  it('blocks Next for empty or whitespace-only cover letters and reveals untouched field errors', fakeAsync(() => {
    const model = { touched: false, dirty: false, invalid: true } as any;
    for (const value of ['', '   ']) {
      component.coverLetter = value;
      component.goToNextTab();
      expect(component.activeTab).toBe('cover');
      expect(component.shouldShowFieldError(model, component.isCoverLetterInvalid())).toBeTrue();
      expect(component.hasAttemptedTab('pricing')).toBeFalse();
    }
    component.coverLetter = 'My approach';
    component.goToNextTab();
    expect(component.activeTab).toBe('pricing');
    expect(component.shouldShowFieldError(model, component.isFixedPriceInvalid())).toBeFalse();
    tick();
  }));

  it('blocks incomplete scopes and each service deliverable, then advances after they are completed', fakeAsync(() => {
    component.proposal!.missing_offer_requirements = missingRequirements();
    component.coverLetter = 'My approach';
    component.goToNextTab();
    expect(component.activeTab).toBe('scope');
    component.goToNextTab();
    expect(component.activeTab).toBe('scope');
    expect(component.hasAttemptedTab('scope')).toBeTrue();
    expect(component.hasAttemptedTab('deliverables')).toBeFalse();
    component.scopeDraft = { offer_scopes: [{ project_service_id: 264, scope: 'Market sizing' }], offer_components: [{ project_service_id: null, component_id: 3, value: 'both' }] };
    component.goToNextTab();
    expect(component.activeTab).toBe('deliverables');
    component.deliverablesDraft = { offer_scopes: [], offer_components: [264, 265].map(id => ({ project_service_id: id, component_id: 1, value: { deliverables: [{ title: `Report ${id}`, period_days: 15, way: { selected: 'session' } }] } })) };
    const deliverable = component.deliverablesDraft.offer_components[1].value.deliverables[0];
    for (const [field, empty] of [['title', '   '], ['period_days', null], ['way', { selected: null }], ['way', { selected: 'physical_workshop', address: '   ' }]] as const) {
      const original = deliverable[field];
      deliverable[field] = empty;
      component.goToNextTab();
      expect(component.activeTab).toBe('deliverables');
      expect(component.hasAttemptedTab('deliverables')).toBeTrue();
      deliverable[field] = original;
    }
    component.goToNextTab();
    expect(component.activeTab).toBe('pricing');
    tick();
  }));

  it('blocks invalid pricing for all price types and allows a valid price to reach payment', fakeAsync(() => {
    component.coverLetter = 'My approach';
    component.selectTab('pricing');
    for (const priceType of ['fixed', 'hourly', 'daily'] as const) {
      component.priceType = priceType;
      component.fixedPrice = component.hourlyRate = component.dailyRate = 100;
      component.estimatedHours = component.estimatedDays = 2;
      const fields = priceType === 'fixed' ? ['fixedPrice'] as const : priceType === 'hourly' ? ['hourlyRate', 'estimatedHours'] as const : ['dailyRate', 'estimatedDays'] as const;
      for (const field of fields) {
        const original = component[field];
        for (const value of [null, 0, -1]) {
          component[field] = value;
          component.goToNextTab();
          expect(component.activeTab).toBe('pricing');
          expect(component.hasAttemptedTab('pricing')).toBeTrue();
        }
        component[field] = original;
      }
    }
    component.goToNextTab();
    expect(component.activeTab).toBe('payment');
    tick();
  }));

  it('guards direct navigation to later steps while allowing backward navigation', fakeAsync(() => {
    component.selectTab('payment');
    expect(component.activeTab).toBe('cover');
    component.coverLetter = 'My approach';
    component.selectTab('payment');
    expect(component.activeTab).toBe('pricing');
    component.selectTab('cover');
    expect(component.activeTab).toBe('cover');
    component.fixedPrice = 100;
    component.selectTab('payment');
    expect(component.activeTab).toBe('payment');
    component.coverLetter = '';
    component.selectTab('pricing');
    component.goToNextTab();
    expect(component.activeTab).toBe('cover');
    tick();
  }));

  it('hides the offer total until pricing has a value and ends on the financial summary', fakeAsync(() => {
    component.fixedPrice = 100;
    expect(component.showOfferTotal).toBeFalse();
    component.coverLetter = 'My approach';
    component.selectTab('pricing');
    expect(component.showOfferTotal).toBeTrue();
    component.fixedPrice = 0;
    expect(component.showOfferTotal).toBeFalse();
    component.fixedPrice = 100;
    component.selectTab('summary');
    expect(component.activeTab).toBe('summary');
    expect(component.nextTab).toBeNull();
    expect(component.summaryScheduleRows.reduce((sum, row) => sum + row.amount, 0)).toBe(100);
    component.goToPreviousTab();
    expect(component.activeTab).toBe('payment');
    tick();
  }));
});
