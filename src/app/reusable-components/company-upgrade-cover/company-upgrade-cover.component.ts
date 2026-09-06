import { Component, ElementRef, EventEmitter, OnDestroy, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { TranslationService } from 'src/app/modules/i18n';

/**
 * Intro cover for the company account page.
 *
 * Same design family as `insighter-setup-cover` (the onboarding covers) — the
 * markup, sizes and colours are kept in sync with that component's stylesheet.
 * The difference is that this one has nowhere to route to: it opens over the
 * upgrade form, so both the CTA and the skip just close it.
 *
 * Mounted into `document.body` on init: the dashboard shell translates
 * `.responsive-cont` on wide screens, and a transformed ancestor becomes the
 * containing block for `position: fixed`, which would size the backdrop to the
 * whole page instead of the viewport. Same reason the PrimeNG dialogs across
 * this app are declared with `appendTo="body"`.
 */
@Component({
  selector: 'app-company-upgrade-cover',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './company-upgrade-cover.component.html',
  styleUrls: ['./company-upgrade-cover.component.scss'],
})
export class CompanyUpgradeCoverComponent implements OnInit, OnDestroy {
  /** Emitted whenever the user closes the cover (close, skip or CTA). */
  @Output() closed = new EventEmitter<void>();

  lang = 'en';
  open = true;

  private readonly subscriptions: Subscription[] = [];

  constructor(
    private readonly host: ElementRef<HTMLElement>,
    private readonly translationService: TranslationService
  ) {}

  ngOnInit(): void {
    this.lang = this.translationService.getSelectedLanguage() || 'en';
    this.subscriptions.push(
      this.translationService.onLanguageChange().subscribe((lang) => (this.lang = lang))
    );
    document.body.appendChild(this.host.nativeElement);
    document.body.style.overflow = 'hidden';
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach((sub) => sub.unsubscribe());
    document.body.style.overflow = '';
    // Angular would remove the host from where it *was* declared, so take it
    // out of body ourselves.
    this.host.nativeElement.remove();
  }

  close(): void {
    if (!this.open) {
      return;
    }

    this.open = false;
    document.body.style.overflow = '';
    this.closed.emit();
  }
}
