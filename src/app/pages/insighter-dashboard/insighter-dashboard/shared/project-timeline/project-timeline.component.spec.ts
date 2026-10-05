import { HttpClient } from '@angular/common/http';
import { ProjectTimelineComponent } from './project-timeline.component';
import { ProjectTimelineStep } from 'src/app/_fake/services/project-timeline/project-timeline.model';

describe('Installment dates', () => {
  const component = new ProjectTimelineComponent({} as HttpClient);
  it('retains the planned due date after payment without using the payment date', () => {
    const step = { step_no: 1, title: 'Installment', display: true, status: 'paid', amount: 10, party: null, key: 'payment_installment_1', state: 'completed', date: '2026-10-04',
      meta: { due_type: 'date', calculated_date: '2026-10-20' } } as ProjectTimelineStep;
    expect(component.installmentDueLabel(step)).toBe(component.dateLabel({ ...step, date: '2026-10-20' }));
    expect(component.installmentDueLabel(step)).not.toBe(component.dateLabel(step));
  });
  it('shows only review events belonging to the deliverable', () => {
    component.reviews = [
      { uuid: 'a', deliverable: { id: 1 }, request_at: '2026-10-04' },
      { uuid: 'b', deliverable: { id: 2 }, request_at: '2026-10-05' },
    ] as any;
    const step = { key: 'deliverable_1', meta: {} } as ProjectTimelineStep;
    expect(component.deliverableReviews(step).map(review => review.uuid)).toEqual(['a']);
    expect(component.reviewEventDate(step, null)).toBe('');
  });
  it('retains the signing trigger after payment', () => {
    expect(component.installmentDueLabel({ step_no: 1, title: 'Installment', display: true, status: 'paid', amount: 10, party: null, date: null, key: 'payment_installment_1', state: 'completed',
      meta: { due_type: 'contract' } } as ProjectTimelineStep)).toBe('On contract signing');
  });
});
