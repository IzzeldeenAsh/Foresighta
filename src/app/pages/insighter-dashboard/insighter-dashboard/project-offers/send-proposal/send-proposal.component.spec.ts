import { Injector } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { of } from 'rxjs';
import { TranslationService } from 'src/app/modules/i18n';
import { ProjectOffer, ProjectOffersService } from 'src/app/_fake/services/project-offers/project-offers.service';
import { InstallmentDraft, SendProposalComponent } from './send-proposal.component';

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

  it('rejects durations past the project end for full and partial payment plans', () => {
    for (const plan of ['full', 'partial'] as const) {
      component.setPaymentPlan(plan);
      payment = component.installments[0];
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
});
