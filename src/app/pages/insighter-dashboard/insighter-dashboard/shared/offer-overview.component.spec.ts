import { OfferOverviewComponent } from './offer-overview.component';

describe('Client offer deliverables', () => {
  let view: OfferOverviewComponent;
  beforeEach(() => {
    view = new OfferOverviewComponent({} as any, {} as any);
    view.context = 'client';
    view.services = [{ id: 12, title: 'Research', position: 1, scopes: [], deliverables: [{ title: 'Client requirement', period_days: 10 }] }] as any;
  });
  it('shows the latest saved offer deliverables instead of stale component copies', () => {
    view.offer = {
      cover_letter: 'Our approach',
      offer_deliverables: [{ project_service_id: 12, title: 'Revised report', period_days: 20, position: 1 }],
      offer_components: [{ project_service_id: 12, value: { deliverables: [{ title: 'Old report' }] } }],
    } as any;
    view.ngOnChanges();
    expect(view.groups[0].deliverables.map(item => item.title)).toEqual(['Revised report']);
    expect(view.offer.cover_letter).toBe('Our approach');
  });
  it('retains client-defined deliverables when the offer does not replace them', () => {
    view.offer = { offer_deliverables: [] } as any;
    view.ngOnChanges();
    expect(view.groups[0].deliverables.map(item => item.title)).toEqual(['Client requirement']);
  });
  it('supports older offers that only carry deliverables in components', () => {
    view.offer = { offer_components: [{ project_service_id: 12, value: { deliverables: [{ title: 'Legacy offer report' }] } }] } as any;
    view.ngOnChanges();
    expect(view.groups[0].deliverables.map(item => item.title)).toEqual(['Legacy offer report']);
  });
});
