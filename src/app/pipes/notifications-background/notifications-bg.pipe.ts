import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'notificationsBg',
  standalone: true
})
export class NotificationsBgPipe implements PipeTransform {
  transform(type: string, subTypeValue?: string): string {
    // "Reviewed" shares one sub_type for Approved and Changes Requested.
    if (type === 'project_review_submission_reviewed') {
      const label = (subTypeValue ?? '').toLowerCase();
      const isChanges = label.includes('change') || label.includes('تعديل');
      return isChanges ? 'warning' : 'success';
    }

    switch (type) {
      case 'knowledge': // used as sub_type for order notifications
        return 'success';
      case 'activate_company':
        return 'success';
      case 'deactivate_company':
      case 'deactivate_company_with_delete':
      case 'deactivate_delete_company':
      case 'deactivate_insighter':
      case 'deactivate_insighter_with_delete':
      case 'deactivate_delete_insighter':
        return 'danger';
      case 'activate_insighter':
        return 'success';
      case 'deactivate_insighter':
      case 'deactivate_insighter_with_delete':
      case 'deactivate_delete_insighter':
        return 'danger';
      case 'accept_knowledge':
        return 'success';
      case 'activate_insighter':
      case 'accept_knowledge':
      case 'knowledge_accept':
      case 'approved':
      case 'download':
      case 'view':
      case 'project_proposal_offer':
        return 'success';
      // Project notifications
      case 'project': // contract signed / offer accepted
      case 'project_service': // service started
        return 'success';
      case 'project_closed': // project closed
        return 'danger';
      default:
        return 'info';
    }
  }
}
