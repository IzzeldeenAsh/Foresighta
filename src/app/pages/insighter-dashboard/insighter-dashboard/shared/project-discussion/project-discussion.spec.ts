import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { of, Subject, throwError } from 'rxjs';
import { TranslationService } from 'src/app/modules/i18n';
import { environment } from 'src/environments/environment';
import { ProjectDiscussionComponent } from './project-discussion.component';
import { ProjectDiscussionMessage, ProjectDiscussionService } from './project-discussion.service';

const translation = { getSelectedLanguage: () => 'en', onLanguageChange: () => new Subject<string>() };
const apiMessage = (body: string, extra: any = {}) => ({
  stage: 'proposal', visibility: 'private_offer', project_proposal_offer_id: 91, body,
  sender: { uuid: 'client-uuid', name: 'Client Name' }, date: '2026-10-20 12:30:00', ...extra,
});
const message = (body: string, extra: Partial<ProjectDiscussionMessage> = {}): ProjectDiscussionMessage => ({
  id: body, stage: 'proposal', visibility: 'private_offer', project_proposal_offer_id: 91, body, sender: 'Client Name',
  date: null, uuid: 'client-uuid', profile_photo_url: null, is_read: true, ...extra,
});

describe('Project discussion service — private offer threads', () => {
  let service: ProjectDiscussionService;
  let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [{ provide: TranslationService, useValue: translation }],
    });
    service = TestBed.inject(ProjectDiscussionService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('reads the offer thread from the role-specific endpoint and follows every page', () => {
    let result: ProjectDiscussionMessage[] = [];
    service.listOfferMessages('insighter', 'project-uuid', 'offer-uuid').subscribe(messages => result = messages);
    const url = `${environment.apiBaseUrl}/insighter/project/discussion/offer/project-uuid/offer-uuid`;
    const first = http.expectOne(req => req.url === url && req.params.get('page') === '1');
    expect(first.request.params.get('per_page')).toBe('100');
    first.flush({ data: [apiMessage('First')], meta: { last_page: 2 } });
    http.expectOne(req => req.url === url && req.params.get('page') === '2')
      .flush({ data: [apiMessage('Second', { visibility: 'public', project_proposal_offer_id: null })], meta: { last_page: 2 } });
    expect(result.map(item => [item.body, item.visibility, item.project_proposal_offer_id]))
      .toEqual([['First', 'private_offer', 91], ['Second', 'public', null]]);
    expect(new Set(result.map(item => item.id)).size).toBe(2);
  });

  it('posts the body to the client offer endpoint and accepts the empty 204 answer', () => {
    let sent: any = 'pending';
    service.sendOfferMessage('client', 'project-uuid', 'offer-uuid', 'Can you clarify the timeline?').subscribe(value => sent = value);
    const req = http.expectOne(`${environment.apiBaseUrl}/account/project/discussion/messages/offer/project-uuid/offer-uuid`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ body: 'Can you clarify the timeline?' });
    req.flush(null, { status: 204, statusText: 'No Content' });
    expect(sent).toBeNull();
  });

  it('marks an offer thread read with PUT and announces it for the notification bell', () => {
    const announced = jasmine.createSpy('offerThreadRead');
    service.offerThreadRead$.subscribe(announced);
    service.markOfferThreadRead('insighter', 'project-uuid', 'offer-uuid').subscribe();
    const req = http.expectOne(`${environment.apiBaseUrl}/insighter/project/discussion/offer/read/project-uuid/offer-uuid`);
    expect(req.request.method).toBe('PUT');
    req.flush(null, { status: 204, statusText: 'No Content' });
    expect(announced).toHaveBeenCalledTimes(1);
  });
});

describe('Project discussion component — private offer threads', () => {
  let component: ProjectDiscussionComponent;
  let api: jasmine.SpyObj<ProjectDiscussionService>;
  const injector: any = { get: (token: any) => token === TranslationService ? translation : {} };
  const create = (context: 'client' | 'insighter', messages: ProjectDiscussionMessage[]) => {
    api = jasmine.createSpyObj('ProjectDiscussionService', ['listMessages', 'sendMessage', 'listOfferMessages', 'sendOfferMessage', 'markOfferThreadRead']);
    api.markOfferThreadRead.and.returnValue(of(undefined));
    api.listOfferMessages.and.returnValue(of(messages));
    api.listMessages.and.returnValue(of(messages));
    api.sendOfferMessage.and.returnValue(of(null));
    component = new ProjectDiscussionComponent(injector, api, {} as any);
    component.context = context;
    component.projectUuid = 'project-uuid';
    component.offerUuid = 'offer-uuid';
  };

  it('keeps the Insighter composer locked until the client message loads', () => {
    create('insighter', []);
    component.loadMessages();
    expect(api.listOfferMessages).toHaveBeenCalledWith('insighter', 'project-uuid', 'offer-uuid');
    expect(component.isAwaitingClient).toBeTrue();
    expect(component.canCompose).toBeFalse();
    component.draft = 'Hello';
    component.sendMessage();
    expect(api.sendOfferMessage).not.toHaveBeenCalled();

    api.listOfferMessages.and.returnValue(of([message('Client question')]));
    component.loadMessages();
    expect(component.canCompose).toBeTrue();
    component.sendMessage();
    expect(api.sendOfferMessage).toHaveBeenCalledWith('insighter', 'project-uuid', 'offer-uuid', 'Hello');
  });

  it('marks incoming unread messages read only after the API confirms, then reports it', () => {
    create('client', [message('Unread reply', { is_read: false, uuid: 'insighter-uuid' })]);
    const read = jasmine.createSpy('threadRead');
    component.threadRead.subscribe(read);
    component.loadMessages();
    expect(api.markOfferThreadRead).toHaveBeenCalledWith('client', 'project-uuid', 'offer-uuid');
    expect(component.messages[0].is_read).toBeTrue();
    expect(read).toHaveBeenCalledTimes(1);

    component.loadMessages(true);
    expect(api.markOfferThreadRead).toHaveBeenCalledTimes(2);
  });

  it('does not call the read endpoint when everything is already read', () => {
    create('client', [message('Old reply')]);
    component.loadMessages();
    expect(api.markOfferThreadRead).not.toHaveBeenCalled();
  });

  it('lets the client open an empty thread', () => {
    create('client', []);
    component.loadMessages();
    expect(component.canCompose).toBeTrue();
  });

  it('reports a closed thread (403) so the page can switch to the project discussion', () => {
    create('client', []);
    api.listOfferMessages.and.returnValue(throwError(() => ({ status: 403 })));
    const closed = jasmine.createSpy('accessClosed');
    component.accessClosed.subscribe(closed);
    component.loadMessages(true);
    expect(closed).toHaveBeenCalled();
  });

  it('hides private offer messages from the project discussion', () => {
    create('client', [message('Private'), message('Public', { visibility: 'public', project_proposal_offer_id: null })]);
    component.offerUuid = null;
    component.loadMessages();
    expect(api.listMessages).toHaveBeenCalled();
    expect(component.messages.map(item => item.body)).toEqual(['Public']);
  });
});
