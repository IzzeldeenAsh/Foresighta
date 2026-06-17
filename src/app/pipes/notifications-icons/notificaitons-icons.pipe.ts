import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'notificationsIcons',
  standalone: true
})
export class NotificationsIconsPipe implements PipeTransform {
  transform(type: string, subTypeValue?: string): string {
    // "Reviewed" notifications share one sub_type for both Approved and
    // Changes Requested, so disambiguate by the localized status label.
    if (type === 'project_review_submission_reviewed') {
      const label = (subTypeValue ?? '').toLowerCase();
      const isChanges =
        label.includes('change') || // en: "Changes Requested"
        label.includes('تعديل');     // ar: "مطلوب تعديلات" / "طلب تعديل"
      return isChanges
        ? 'duotune/art/art005.svg'   // pencil = revision needed
        : 'duotune/files/fil025.svg'; // file-check = approved
    }

    switch (type) {
      case 'sale': // used as sub_type for order notifications
        return 'duotune/finance/Knlg010.svg';
      case 'deactivate_company':
      case 'deactivate_company_with_delete':
      case 'deactivate_insighter':
      case 'deactivate_insighter_with_delete':
        return 'duotune/general/gen047.svg';
      case 'activate_company':
      case 'activate_insighter':
        return 'duotune/arrows/arr086.svg';
      case 'accept_knowledge':
        return 'duotune/files/fil025.svg';
      case 'client_meeting_insighter_approved':
      case 'client_meeting_new':
        return 'duotune/general/gen014.svg';
      case 'insighter_meeting_client_new':
      case 'insighter_meeting_approved':
        return 'duotune/general/gen014.svg'
      case 'client_meeting_insighter_postponed':
        return 'duotune/general/gen014.svg';
      case 'client_meeting_reschedule':
        return 'duotune/general/gen014.svg';
      case 'insighter_meeting_client_reschedule':
        return 'duotune/general/gen014.svg';
      case 'insighter_meeting_reminder':
        return 'duotune/general/gen014.svg';
      case 'stripe':
        return 'duotune/general/Capa_1.svg';
      case 'project_proposal_offer':
        return 'duotune/files/fil025.svg';
      // Project notifications
      case 'project_proposal': // new project request / invitation
        return 'duotune/files/fil024.svg';
      case 'project': // contract signed / offer accepted
        return 'duotune/files/fil025.svg';
      case 'project_closed': // project closed
        return 'duotune/general/gen040.svg';
      case 'project_service': // project service started (ready to begin)
        return 'duotune/art/art007.svg'; // rocket = ready to launch/start
      case 'project_review_submission': // review submitted to client
        return 'duotune/files/fil004.svg';
      // 'project_review_submission_reviewed' is handled above (status-dependent)
      case 'project_file_uploaded': // file uploaded to project
        return 'duotune/files/fil018.svg';
      case 'client_meeting_reminder':
        return 'duotune/general/gen014.svg';
        case 'ask_question':
        return 'duotune/communication/com007.svg';
      case 'answer_question':
        return 'duotune/communication/com007.svg';
      default:
        return 'duotune/general/gen007.svg';
    }
  }
}
