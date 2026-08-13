import { CommonModule } from '@angular/common';
import { Component, Injector, OnInit } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { BaseComponent } from 'src/app/modules/base.component';
import { environment } from 'src/environments/environment';

@Component({
  selector: 'app-back-to-feed-button',
  standalone: true,
  imports: [CommonModule],
  template: `
    <a
      *ngIf="visible"
      [href]="feedUrl"
      class="back-to-feed-btn"
      [class.is-rtl]="lang === 'ar'"
      [attr.aria-label]="label"
    >
      <svg
        class="back-to-feed-icon"
        xmlns="http://www.w3.org/2000/svg"
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2.1"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <path stroke="none" d="M0 0h24v24H0z" fill="none" />
        <path d="M13 5h8" />
        <path d="M13 9h5" />
        <path d="M13 15h8" />
        <path d="M13 19h5" />
        <path d="M3 4m0 1a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v4a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1z" />
        <path d="M3 14m0 1a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v4a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1z" />
      </svg>
      <span>{{ label }}</span>
    </a>
  `,
  styles: [`
    .back-to-feed-btn {
      position: fixed;
      bottom: 1.5rem;
      right: 1.25rem;
      z-index: 1000;
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      min-height: 48px;
      padding: 0 1.25rem;
      border-radius: 999px;
      border: 1px solid #FFB37A;
      background: linear-gradient(to right, #FF8A3D, #FF6B35);
      color: #ffffff;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      font-size: 0.8125rem;
      font-weight: 600;
      text-decoration: none;
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
      outline: none;
    }

    .back-to-feed-btn:hover {
      transform: translateY(-2px) scale(1.03);
      color: #ffffff;
    }

    .back-to-feed-btn:active {
      transform: translateY(0) scale(1);
    }

    .back-to-feed-btn:focus-visible {
      outline: none;
      box-shadow: 0 0 0 2px #ffffff, 0 0 0 4px #FF6B35;
    }

    .back-to-feed-btn.is-rtl {
      right: auto;
      left: 1.25rem;
    }

    .back-to-feed-icon {
      flex: 0 0 18px;
      width: 18px;
      height: 18px;
    }

    @media (min-width: 640px) {
      .back-to-feed-btn {
        bottom: 1.75rem;
        right: 1.75rem;
      }

      .back-to-feed-btn.is-rtl {
        right: auto;
        left: 1.75rem;
      }
    }
  `],
})
export class BackToFeedButtonComponent extends BaseComponent implements OnInit {
  visible = false;

  constructor(injector: Injector, private readonly router: Router) {
    super(injector);
  }

  ngOnInit(): void {
    this.updateVisibility(this.router.url);

    const sub = this.router.events.subscribe((event) => {
      if (event instanceof NavigationEnd) {
        this.updateVisibility(event.urlAfterRedirects);
      }
    });

    this.unsubscribe.push(sub);
  }

  get label(): string {
    return this.lang === 'ar' ? 'العودة إلى الموجز' : 'Back to Feed';
  }

  get feedUrl(): string {
    const locale = this.lang === 'ar' ? 'ar' : 'en';
    const mainAppUrl = environment.mainAppUrl.replace(/\/+$/, '');
    return `${mainAppUrl}/${locale}`;
  }

  private updateVisibility(url: string): void {
    this.visible = url.startsWith('/app');
  }
}
