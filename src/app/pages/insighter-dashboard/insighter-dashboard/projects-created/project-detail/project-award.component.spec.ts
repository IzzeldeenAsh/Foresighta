import { fakeAsync, flushMicrotasks } from '@angular/core/testing';
import { Subject, of, throwError } from 'rxjs';
import { ProjectDetailComponent } from './project-detail.component';

describe('Offer award flow', () => {
  let component: ProjectDetailComponent;
  let state: any;
  let invite: any;
  let service: any;

  beforeEach(() => {
    component = Object.create(ProjectDetailComponent.prototype);
    state = component as any;
    invite = { offer: { uuid: 'offer-one', status: 'pending' } };
    service = {
      decideProposalOfferTechnically: jasmine.createSpy('accept').and.returnValue(of(null)),
      awardProposalOffer: jasmine.createSpy('award').and.returnValue(of(null)),
    };
    Object.assign(state, {
      lang: 'en', project: { uuid: 'project-one', status: 'submitted', matching_mode: 'general', invited: [invite] },
      invitedInsighters: [invite], selectedInvite: invite, offerActionUuid: null, offerActionKind: null, unsubscribe$: new Subject<void>(),
      projectsCreatedService: service, router: { navigate: jasmine.createSpy('navigate') },
      confirmAwardOffer: jasmine.createSpy('confirm').and.resolveTo('award'),
      loadProject: jasmine.createSpy('load'), showSuccess: jasmine.createSpy('success'),
      showError: jasmine.createSpy('error'), closeProposalDrawer: jasmine.createSpy('close'),
      openProposalDrawer: jasmine.createSpy('open'),
    });
  });

  afterEach(() => { state.unsubscribe$.next(); state.unsubscribe$.complete(); });

  it('accepts a single invitation before awarding it', fakeAsync(() => {
    const acceptance = new Subject<void>();
    service.decideProposalOfferTechnically.and.returnValue(acceptance);
    component.awardOffer(invite); flushMicrotasks();
    expect(service.decideProposalOfferTechnically).toHaveBeenCalledWith('offer-one', 'technical_accepted');
    expect(service.awardProposalOffer).not.toHaveBeenCalled();
    acceptance.next(); acceptance.complete();
    expect(service.awardProposalOffer).toHaveBeenCalledOnceWith('offer-one');
    expect(invite.offer.status).toBe('awarded');
  }));

  it('does not award when technical acceptance fails', fakeAsync(() => {
    service.decideProposalOfferTechnically.and.returnValue(throwError(() => new Error('accept failed')));
    component.awardOffer(invite); flushMicrotasks();
    expect(service.awardProposalOffer).not.toHaveBeenCalled();
    expect(invite.offer.status).toBe('pending');
    expect(state.offerActionUuid).toBeNull();
    expect(state.showError).toHaveBeenCalled();
  }));

  it('retains successful acceptance when awarding fails, so a retry does not accept twice', fakeAsync(() => {
    service.awardProposalOffer.and.returnValue(throwError(() => new Error('award failed')));
    component.awardOffer(invite); flushMicrotasks();
    expect(invite.offer.status).toBe('technical_accepted');
    expect(state.offerActionUuid).toBeNull();
    service.awardProposalOffer.and.returnValue(of(null));
    component.awardOffer(invite); flushMicrotasks();
    expect(service.decideProposalOfferTechnically).toHaveBeenCalledTimes(1);
    expect(invite.offer.status).toBe('awarded');
  }));

  it('keeps multiple invitations blocked until technically accepted and the deadline passes', () => {
    state.project.invited.push({});
    state.project.last_proposal_deadline = new Date(Date.now() + 86400000).toISOString();
    expect(component.canAwardOffer(invite)).toBeFalse();
    invite.offer.status = 'technical_accepted';
    expect(component.canAwardOffer(invite)).toBeFalse();
    state.project.last_proposal_deadline = new Date(Date.now() - 1000).toISOString();
    expect(component.canAwardOffer(invite)).toBeTrue();
  });

  it('allows a specific request to use the combined action', () => {
    state.project.matching_mode = 'specific'; state.project.invited.push({});
    expect(component.canAwardOffer(invite)).toBeTrue();
  });

  it('opens private messages without changing the offer when the client stops', fakeAsync(() => {
    state.confirmAwardOffer.and.resolveTo('message');
    component.awardOffer(invite); flushMicrotasks();
    expect(state.openProposalDrawer).toHaveBeenCalledWith(invite, 'discussion');
    expect(service.decideProposalOfferTechnically).not.toHaveBeenCalled();
    expect(service.awardProposalOffer).not.toHaveBeenCalled();
  }));

  it('rechecks eligibility after confirmation and rejects terminal offers', fakeAsync(() => {
    component.awardOffer(invite); state.project.status = 'cancelled'; flushMicrotasks();
    expect(service.awardProposalOffer).not.toHaveBeenCalled();
    state.project.status = 'submitted'; invite.offer.status = 'not_selected';
    expect(component.canAwardOffer(invite)).toBeFalse();
  }));
});
