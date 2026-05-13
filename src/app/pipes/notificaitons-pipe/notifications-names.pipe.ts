import { Pipe, PipeTransform } from '@angular/core';
import { TranslationService } from 'src/app/modules/i18n'; // <-- Make sure this import path is correct!

@Pipe({
  name: 'notificationsNames',
  standalone: true
})
export class NotificationsNamesPipe implements PipeTransform {

  // 1. Inject your TranslationService in the constructor
  constructor(private translationService: TranslationService) {}

  // 2. We change the data structure to hold both languages
  private readonly nameMap: Record<string, { en: string; ar: string }> = {
    'activate_company': { en: 'Activate Company', ar: 'تفعيل الشركة' },
    'deactivate_company': { en: 'Deactivate Company', ar: 'إلغاء تفعيل الشركة' },
    'deactivate_company_with_delete': { en: 'Deactivate Company with Delete', ar: 'إلغاء تفعيل وحذف الشركة' },
    'deactivate_delete_company': { en: 'Deactivate Delete Company', ar: 'إلغاء تفعيل وحذف الشركة' },
    'activate_insighter': { en: 'Activate Insighter', ar: 'تفعيل الخبير' },
    'deactivate_insighter': { en: 'Deactivate Insighter', ar: 'إلغاء تفعيل الخبير' },
    'deactivate_insighter_with_delete': { en: 'Deactivate Insighter with Delete', ar: 'إلغاء تفعيل وحذف الخبير' },
    'sale': { en: 'Sales Order', ar: 'طلب شراء' },
    'deactivate_delete_insighter': { en: 'Deactivate Delete Insighter', ar: 'إلغاء تفعيل وحذف الخبير' },
    'verified_company': { en: 'Verified Company', ar: 'شركة موثقة' },
    'verified_insighter': { en: 'Verified Insighter', ar: 'خبير موثق' },
    'accept_knowledge': { en: 'Knowledge Request', ar: 'طلب موافقة الرؤية' },
    'insighter_meeting_reminder': { en: 'Session Reminder', ar: 'تذكير بالجلسة الاستشارية' },
    'client_meeting_reminder': { en: 'Session Reminder', ar: 'تذكير بالجلسة الاستشارية' },
    'question_received': { en: 'Question Received', ar: 'تم استلام سؤال' },
    'client_meeting_new': { en: 'New Session Request', ar: 'طلب جلسة استشارية جديدة' },
    'insighter_meeting_client_new': { en: 'New Session Request', ar: 'طلب جلسة استشارية جديدة' },
    'insighter_meeting_approved': { en: 'Session Approved', ar: 'تمت الموافقة على الجلسة الاستشارية' },
    'client_meeting_insighter_approved': { en: 'Session Approved', ar: 'تمت الموافقة على الجلسة الاستشارية' },
    'client_meeting_insighter_postponed': { en: 'Session Postponed', ar: 'تم تأجيل الجلسة الاستشارية' },
    'client_meeting_reschedule': { en: 'Session Rescheduled', ar: 'تمت إعادة جدولة الجلسة الاستشارية' },
    'insighter_meeting_client_reschedule': { en: 'Session Rescheduled', ar: 'تمت إعادة جدولة الجلسة الاستشارية' },
    'project_proposal_offer': { en: 'Project Proposal Offer', ar: 'عرض مقترح مشروع' },
    // Add any other keys from your first example if needed
    'declined': { en: 'Knowledge Declined', ar: 'رفض المعرفة' },
    'approved': { en: 'Knowledge Approved', ar: 'الموافقة على المعرفة' },
    'download': { en: 'Download', ar: 'تنزيل' },
    'upload': { en: 'Upload', ar: 'رفع' },
    'comment': { en: 'Comment', ar: 'تعليق' },
    'reply': { en: 'Reply', ar: 'رد' },
    'like': { en: 'Like', ar: 'إعجاب' },
    'save': { en: 'Save', ar: 'حفظ' },
    'share': { en: 'Share', ar: 'مشاركة' },
    'view': { en: 'View', ar: 'عرض' },
  };

  // 3. The transform logic now uses the language to decide which text to show
  transform(value: string): string {
    // Get the current language ('en', 'ar', etc.) from the service
    const lang = this.translationService.getSelectedLanguage();
    
    const names = this.nameMap[value];

    if (!names) {
      // If we don't have a translation, return the original key
      return value;
    }

    // If the language is Arabic, return the 'ar' version; otherwise, default to English
    return lang === 'ar' ? names.ar : names.en;
  }
}
