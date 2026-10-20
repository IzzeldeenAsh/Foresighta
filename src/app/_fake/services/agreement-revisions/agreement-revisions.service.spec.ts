import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { AgreementRevisionsService } from './agreement-revisions.service';
import { TranslationService } from 'src/app/modules/i18n';
import { environment } from 'src/environments/environment';
import { agreementFormData, agreementPaymentStarted, emptiedScopeFiles, offerDurationSuggestion, onlyChangedScopeFiles, scopeDraft, scopeEditorDraft } from './agreement-revisions.model';

describe('Agreement revision API boundaries', () => {
  let service: AgreementRevisionsService;
  let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HttpClientTestingModule], providers: [AgreementRevisionsService, {provide: TranslationService, useValue: { getSelectedLanguage: () => 'ar' }}] });
    service = TestBed.inject(AgreementRevisionsService); http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());
  it('uses the client match context and keeps an empty full-list deletion in the overridden PATCH body', () => {
    service.update('client', 'match-uuid', {scopes: [{ project_service_id: 44, items: [] }]}).subscribe();
    const request = http.expectOne(`${environment.apiBaseUrl}/account/project/agreement/client-requirements/match-uuid`);
    expect(request.request.method).toBe('POST'); expect(request.request.body._method).toBe('PATCH'); expect(request.request.headers.get('Accept-Language')).toBe('ar');
    expect(request.request.body.scopes[0].items).toEqual([]); request.flush({data:{id:1}});
  });
  it('opens an insighter revision with the offer context, separately from project routing', () => {
    service.show('insighter', 'offer-uuid', 7).subscribe();
    const request = http.expectOne(`${environment.apiBaseUrl}/insighter/project/agreement-revisions/offer-uuid/7`);
    expect(request.request.method).toBe('GET'); request.flush({data:{id:7}});
  });
  it('supports later pages of the revision timeline', () => {
    service.list('client', 'match-uuid', 2).subscribe();
    const request = http.expectOne(req => req.url.endsWith('/agreement-revisions/match-uuid'));
    expect(request.request.params.get('page')).toBe('2'); request.flush({data:[],meta:{last_page:2}});
  });
  it('switches to multipart with the method override when offer files are uploaded', () => {
    const file = new File(['x'], 'revised-pricing.pdf');
    service.update('insighter', 'offer-uuid', { cover_letter: 'Updated', attachment_uuids: ['keep-me'], suggested_duration_days: 45 }, [file]).subscribe();
    const request = http.expectOne(`${environment.apiBaseUrl}/insighter/project/agreement/insighter-requirements/offer-uuid`);
    const body = request.request.body as FormData;
    expect(body instanceof FormData).toBeTrue();
    expect(body.get('_method')).toBe('PATCH'); expect(body.get('cover_letter')).toBe('Updated');
    expect(body.getAll('attachment_uuids[0]')).toEqual(['keep-me']); expect(body.get('suggested_duration_days')).toBe('45');
    expect((body.get('files[0]') as File).name).toBe('revised-pricing.pdf');
    request.flush({data:{id:2}});
  });
  it('encodes nested revision groups and nulls for a multipart body', () => {
    const body = agreementFormData({ deliverables: [{ project_service_id: 44, items: [{ id: 15, title: 'Report', period_days: 45, report_type: ['pdf'], way: { selected: 'on_platform', address: null } }] }] }, []);
    expect(body.get('deliverables[0][items][0][period_days]')).toBe('45');
    expect(body.get('deliverables[0][items][0][report_type][0]')).toBe('pdf');
    expect(body.get('deliverables[0][items][0][way][address]')).toBe('');
  });
  it('sends sub-scope uploads as multipart under the sub-scope with the retained file list', () => {
    const file = new File(['x'], 'market-sizing.pdf');
    service.update('insighter', 'offer-uuid', { scopes: [{ project_service_id: 44, items: [{ id: 10, scope: 'Market sizing', description: null,
      subscopes: [{ id: 11, scope: 'TAM', description: 'Updated', subscopes: [], file_uuids: ['keep-me'], file: [file] }] }] }] }).subscribe();
    const request = http.expectOne(`${environment.apiBaseUrl}/insighter/project/agreement/insighter-requirements/offer-uuid`);
    const body = request.request.body as FormData;
    expect(body instanceof FormData).toBeTrue();
    expect(body.get('scopes[0][items][0][subscopes][0][file_uuids][0]')).toBe('keep-me');
    expect((body.get('scopes[0][items][0][subscopes][0][file][0]') as File).name).toBe('market-sizing.pdf');
    request.flush({data:{id:3}});
  });
  it('keeps sub-scope file fields only where the attachments changed', () => {
    const saved = [scopeEditorDraft({ id: 10, scope: 'Market sizing', children: [
      { id: 11, scope: 'TAM', files: [{ uuid: 'a', name: 'a.pdf' }, { uuid: 'b', name: 'b.pdf' }] },
      { id: 12, scope: 'SAM', files: [{ uuid: 'c', name: 'c.pdf' }] },
      { id: 13, scope: 'SOM', have_attachments: true },
    ] })];
    const original = saved.map(scopeDraft);
    const edited = JSON.parse(JSON.stringify(saved));
    edited[0].subscopes[0].files = [{ uuid: 'a', name: 'a.pdf' }];
    edited[0].subscopes[1].description = 'Now described';
    const [scope] = onlyChangedScopeFiles(edited.map(scopeDraft), original);
    expect(scope.subscopes[0].file_uuids).toEqual(['a']);
    expect('file_uuids' in scope.subscopes[1]).toBeFalse();
    // Files the API only reports as present are never resent, so they stay untouched.
    expect('file_uuids' in scope.subscopes[2]).toBeFalse();
    expect(emptiedScopeFiles({ scopes: [{ project_service_id: 44, items: [{ ...scope, subscopes: [{ ...scope.subscopes[0], file_uuids: [] }] }] }] })).toBeTrue();
  });
  it('reads a suggested duration only when it extends the project', () => {
    expect(offerDurationSuggestion({ suggested_duration_days: 45 }, 30)).toBe(45);
    expect(offerDurationSuggestion({ suggested_duration_days: 30 }, 30)).toBeNull();
    expect(offerDurationSuggestion({ suggested_duration_days: null }, 30)).toBeNull();
  });
  it('locks commercial changes for started payments, including pending and refunded ones', () => {
    expect(agreementPaymentStarted({installments:[{status:'pending'}]})).toBeTrue();
    expect(agreementPaymentStarted({payments:[{status:'awaiting_charge'}]})).toBeTrue();
    expect(agreementPaymentStarted({installments:[{status:'refunded'}]})).toBeTrue();
    expect(agreementPaymentStarted({payments:[{status:'failed'}]})).toBeFalse();
  });
});
