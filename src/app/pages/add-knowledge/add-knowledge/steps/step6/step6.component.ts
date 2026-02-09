import { Component, Input, Injector, OnInit } from '@angular/core';
import { ICreateKnowldege } from '../../create-account.helper';
import { Router } from '@angular/router';
import { BaseComponent } from 'src/app/modules/base.component';
import { KnowledgeService, Knowledge } from 'src/app/_fake/services/knowledge/knowledge.service';
import { TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'app-step6',
  templateUrl: './step6.component.html',
  styles: [`
    /* Fixed height for consistent card heights */
    .fixed-height-card {
      min-height: 180px;
      align-items: center;
    }

    /* Ensure proper spacing between cards */
    .notice + .notice {
      margin-top: 1.5rem;
    }

    /* Social share button styles */
    .social-share-btn {
      width: 50px;
      height: 50px;
      border-radius: 50%;
      transition: all 0.2s ease;
      border: none;
    }

    .social-share-btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    }

    .social-share-btn:active {
      transform: translateY(0);
    }

    .social-share-btn i {
      font-size: 20px !important;
      line-height: 1;
    }

    /* Ensure consistent sizing across all buttons */
    .social-share-btn.btn-primary,
    .social-share-btn.btn-dark,
    .social-share-btn.btn-info,
    .social-share-btn.btn-success {
      width: 50px;
      height: 50px;
      min-width: 50px;
      padding: 0;
    }

    /* Custom Modal Styles */
    .custom-modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 9999;
      backdrop-filter: blur(4px);
      animation: fadeIn 0.3s ease;
    }

    .custom-modal-container {
      width: 90%;
      max-width: 600px;
      max-height: 90vh;
      overflow-y: auto;
      animation: scaleIn 0.3s ease;
    }

    .custom-modal-overlay .custom-modal-container .modal-content {
      border-radius: 12px !important;
      overflow: hidden;
      border: none !important;
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
      position: relative;
      background: white !important;
    }

    .custom-modal-overlay .custom-modal-container .modal-content::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 200px;
      background: #e9deff;
      background: linear-gradient(180deg, rgba(233, 222, 255, 1) 0%, rgba(255, 255, 255, 1) 100%);
      z-index: 1;
      border-top-left-radius: 12px;
      border-top-right-radius: 12px;
    }

    .custom-modal-overlay .custom-modal-container .modal-content .modal-body {
      border-radius: 0 0 12px 12px !important;
      box-shadow: 0 -5px 20px rgba(0, 0, 0, 0.05);
      background: none !important;
      background-color: transparent !important;
      position: relative;
      z-index: 2;
    }

    .custom-modal-overlay .modal-body.bg-white,
    .custom-modal-overlay .modal-body.bg-light,
    .custom-modal-overlay .modal-body[class*="bg-"] {
      background: none !important;
      background-color: transparent !important;
    }

    .custom-modal-overlay .motive-title {
      position: relative;
      z-index: 2;
    }

    .motive-title-image img {
      height: 220px;
    }

    @keyframes fadeIn {
      from {
        opacity: 0;
      }
      to {
        opacity: 1;
      }
    }

    @keyframes scaleIn {
      from {
        transform: scale(0.9);
        opacity: 0;
      }
      to {
        transform: scale(1);
        opacity: 1;
      }
    }

    /* Share CTA glow button */
    .btn-glow-primary {
      position: relative;
      animation: glowPulse 2.2s ease-in-out infinite;
      box-shadow: 0 0 0 0 rgba(13, 110, 253, 0.55);
    }

    .btn-glow-primary:hover {
      box-shadow: 0 0 18px rgba(13, 110, 253, 0.5), 0 0 36px rgba(13, 110, 253, 0.3);
    }

    .btn-glow-primary:focus-visible {
      outline: 2px solid #0d6efd;
      outline-offset: 2px;
    }

    @keyframes glowPulse {
      0% {
        box-shadow: 0 0 0 0 rgba(13, 110, 253, 0.55);
      }
      70% {
        box-shadow: 0 0 0 12px rgba(13, 110, 253, 0);
      }
      100% {
        box-shadow: 0 0 0 0 rgba(13, 110, 253, 0);
      }
    }

    @media (max-width: 768px) {
      .custom-modal-container {
        width: 95%;
        margin: 1rem;
      }

      .custom-modal-overlay .modal-body {
        padding: 1.5rem 1rem !important;
      }
    }
  `]
})
export class Step6Component extends BaseComponent implements OnInit {
  @Input() defaultValues: Partial<ICreateKnowldege>;

  // Share functionality properties
  publishedKnowledge: Knowledge | null = null;
  isSocialShareModalVisible: boolean = false;
  customShareMessage: string = "";
  linkCopied: boolean = false;

  constructor(
    injector: Injector,
    private router: Router,
    private knowledgeService: KnowledgeService,
    private translateService: TranslateService
  ) {
    super(injector);
    this.addTranslations();
  }

  private addTranslations() {
    // Add translation keys for share functionality
    const translations = {
      'en': {
        'SHARE_YOUR_KNOWLEDGE': 'Share Your Knowledge',
        'SHARE_KNOWLEDGE_DESCRIPTION': 'Spread the word and help others discover your valuable insights. Sharing your knowledge increases its reach and impact in the community.',
        'SHARE_NOW': 'Share Now',
        'KNOWLEDGE_SENT_FOR_REVIEW': 'Insight Sent for Review',
        'KNOWLEDGE_REVIEW_MESSAGE': 'Your Insight has been successfully sent for manager review. You will be notified once the review is complete.',
        'COPY_LINK': 'Copy Link',
        'LINK_COPIED': 'Link Copied!'
      },
      'ar': {
        'SHARE_YOUR_KNOWLEDGE': 'شارك معرفتك',
        'SHARE_KNOWLEDGE_DESCRIPTION': 'انشر الكلمة وساعد الآخرين في اكتشاف رؤاك القيمة. مشاركة معرفتك تزيد من انتشارها وتأثيرها في المجتمع.',
        'SHARE_NOW': 'شارك الآن',
        'KNOWLEDGE_SENT_FOR_REVIEW': 'تم إرسال المعرفة للمراجعة',
        'KNOWLEDGE_REVIEW_MESSAGE': 'تم إرسال معرفتك بنجاح لمراجعة المدير. سيتم إشعارك بمجرد اكتمال المراجعة.',
        'COPY_LINK': 'نسخ الرابط',
        'LINK_COPIED': 'تم نسخ الرابط!'
      }
    };

    // Add translations for each language
    for (const [lang, trans] of Object.entries(translations)) {
      this.translateService?.setTranslation(lang, trans, true);
    }
  }

  ngOnInit(): void {
    // If knowledge is published, fetch its details
    if (this.defaultValues.publish_status === 'published' && this.defaultValues.knowledgeId) {
      this.loadKnowledgeDetails();
    }
  }

  private loadKnowledgeDetails(): void {
    if (this.defaultValues.knowledgeId) {
      this.knowledgeService.getKnowledgeById(this.defaultValues.knowledgeId).subscribe({
        next: (response) => {
          this.publishedKnowledge = response.data;
          // Auto-open the social share modal once knowledge data is loaded
          if (this.defaultValues.publish_status === 'published' && this.publishedKnowledge) {
            this.openSocialShareModal();
          }
        },
        error: (error) => {
          console.error('Error fetching knowledge details:', error);
        }
      });
    }
  }

  navigateToStepper() {
    // Try with the full absolute path
    window.location.reload();
  }

  openSocialShareModal(): void {
    this.isSocialShareModalVisible = true;
    this.linkCopied = false;
    // Initialize with default message if empty
    if (!this.customShareMessage) {
      this.customShareMessage = this.getDefaultShareMessage();
    }
  }

  closeSocialShareModal(): void {
    this.isSocialShareModalVisible = false;
  }

  getShareableLink(): string {
    if (!this.publishedKnowledge) return '';
    const knowledgeType = this.publishedKnowledge.type?.toLowerCase() || 'statistic';
    const slug = this.publishedKnowledge.slug || '';
    return `https://foresighta.co/${this.lang}/knowledge/${knowledgeType}/${slug}`;
  }

  getSocialShareTitle(): string {
    if (!this.publishedKnowledge) return 'Knowledge';
    const knowledgeType = this.publishedKnowledge.type ? this.publishedKnowledge.type.charAt(0).toUpperCase() + this.publishedKnowledge.type.slice(1) : 'Knowledge';
    const title = this.publishedKnowledge.title || 'Amazing Knowledge';
    return `${knowledgeType} - ${title}`;
  }


  private translateKnowledgeTypeToArabic(type: string): string {
    if (!type) return 'معرفة';
    const normalized = type.toLowerCase();
    switch (normalized) {
      case 'data':
        return 'بيانات';
      case 'statistic':
      case 'insights':
        return 'رؤية';
      case 'report':
      case 'reports':
        return 'تقرير';
      case 'manual':
      case 'manuals':
        return 'دليل';
      case 'course':
      case 'courses':
        return 'دورة';
      case 'media':
        return 'وسائط';
      case 'knowledge':
        return 'معرفة';
      default:
        return type;
    }
  }

  getDefaultShareMessage(): string {
    if (!this.publishedKnowledge) {
      if (this.lang === 'ar') {
        return "اكتب رسالة المشاركة الخاصة بك";
      }
      return "Write your share message";
    }

    const knowledgeType = this.publishedKnowledge.type || 'knowledge';

    if (this.lang === 'ar') {
      const knowledgeTypeAr = this.translateKnowledgeTypeToArabic(knowledgeType);
      return `لقد نشرت ${knowledgeTypeAr} جديد في ...`;
    }
    return `I just published a business ${knowledgeType} in ...`;
  }


  shareToSocial(platform: string): void {
    const shareUrl = this.getSocialShareLinkWithCustomMessage(platform);
    window.open(shareUrl, '_blank', 'width=600,height=400');
    this.closeSocialShareModal();
  }

  getSocialShareLinkWithCustomMessage(platform: string): string {
    const shareUrl = this.getShareableLink();
    const message = this.customShareMessage +' '
    const title = this.getSocialShareTitle();

    switch(platform) {
      case 'facebook':
        return `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}&quote=${encodeURIComponent(message)}`;
      case 'twitter':
        return `https://twitter.com/intent/tweet?text=${encodeURIComponent(message)}&url=${encodeURIComponent(shareUrl)}`;
      case 'linkedin':
        return `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}&title=${encodeURIComponent(title)}&summary=${encodeURIComponent(message)}`;
      case 'whatsapp':
        return `https://api.whatsapp.com/send?text=${encodeURIComponent(message)}%20${encodeURIComponent(shareUrl)}`;
      default:
        return '';
    }
  }

  copyToClipboard(text: string): void {
    navigator.clipboard.writeText(text).then(() => {
      this.linkCopied = true;
      setTimeout(() => {
        this.linkCopied = false;
      }, 3000);
    });
  }
} 