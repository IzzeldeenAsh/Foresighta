import { CommonModule } from '@angular/common';
import { Component, HostListener, Injector, OnInit } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { BaseComponent } from 'src/app/modules/base.component';
import { environment } from 'src/environments/environment';

@Component({
  selector: 'app-back-to-feed-button',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div
      *ngIf="visible && !dismissed"
      class="back-to-feed-control"
      [class.is-rtl]="lang === 'ar'"
      [class.is-dragging]="isDragging"
      [style.left.px]="position?.x"
      [style.top.px]="position?.y"
      [style.right]="position ? 'auto' : null"
      [style.bottom]="position ? 'auto' : null"
      (pointerdown)="startDrag($event)"
      (pointermove)="moveDrag($event)"
      (pointerup)="finishDrag($event)"
      (pointercancel)="finishDrag($event)"
    >
      <a
        [href]="feedUrl"
        draggable="false"
        class="back-to-feed-btn"
        [attr.aria-label]="label"
        [attr.title]="dragLabel"
        (dragstart)="$event.preventDefault()"
        (click)="handleClick($event)"
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
      <button
        type="button"
        class="dismiss-btn"
        [attr.aria-label]="dismissLabel"
        [attr.title]="dismissLabel"
        (pointerdown)="$event.stopPropagation()"
        (click)="dismissed = true"
      >
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true">
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>
    </div>
    <button
      *ngIf="visible && showBackToTop"
      type="button"
      class="back-to-top-btn"
      [class.is-rtl]="lang === 'ar'"
      [attr.aria-label]="backToTopLabel"
      [attr.title]="backToTopLabel"
      (click)="scrollToTop()"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2.25"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <path d="M6 15l6 -6l6 6" />
      </svg>
    </button>
  `,
  styles: [`
    .back-to-feed-control {
      position: fixed;
      bottom: 1.5rem;
      right: 1.25rem;
      z-index: 1000;
      cursor: grab;
      touch-action: none;
      user-select: none;
      -webkit-user-select: none;
    }

    .back-to-feed-control.is-rtl {
      right: auto;
      left: 1.25rem;
    }

    .back-to-feed-control.is-dragging {
      cursor: grabbing;
      transform: scale(1.02);
      box-shadow: 0 14px 30px rgba(255, 107, 53, 0.28);
    }

    .back-to-feed-btn {
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

    .dismiss-btn {
      position: absolute;
      top: -0.5rem;
      right: -0.5rem;
      z-index: 1;
      display: inline-flex;
      width: 24px;
      height: 24px;
      align-items: center;
      justify-content: center;
      padding: 0;
      border: 1px solid #cbd5e1;
      border-radius: 999px;
      background: #ffffff;
      box-shadow: 0 4px 10px rgba(15, 23, 42, 0.16);
      color: #475569;
      cursor: pointer;
      transition: transform 0.15s ease, border-color 0.15s ease, color 0.15s ease;
    }

    .back-to-feed-control.is-rtl .dismiss-btn {
      right: auto;
      left: -0.5rem;
    }

    .dismiss-btn:hover {
      transform: scale(1.1);
      border-color: #94a3b8;
      color: #0f172a;
    }

    .dismiss-btn:focus-visible {
      outline: none;
      box-shadow: 0 0 0 2px #ffffff, 0 0 0 4px #FF6B35;
    }

    .back-to-feed-icon {
      flex: 0 0 18px;
      width: 18px;
      height: 18px;
    }

    .back-to-top-btn {
      position: fixed;
      bottom: 1.5rem;
      left: 1.25rem;
      z-index: 1000;
      display: inline-flex;
      width: 48px;
      height: 48px;
      align-items: center;
      justify-content: center;
      padding: 0;
      border: 1px solid #6aa6f5;
      border-radius: 999px;
      background: linear-gradient(135deg, #2378e8, #2b9dea);
      box-shadow: 0 8px 22px rgba(35, 120, 232, 0.28);
      color: #ffffff;
      cursor: pointer;
      animation: back-to-top-enter 180ms ease-out;
      transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.2s ease;
    }

    .back-to-top-btn:hover {
      transform: translateY(-2px) scale(1.04);
      box-shadow: 0 11px 26px rgba(35, 120, 232, 0.34);
    }

    .back-to-top-btn:active {
      transform: translateY(0) scale(0.98);
    }

    .back-to-top-btn:focus-visible {
      outline: none;
      box-shadow: 0 0 0 2px #ffffff, 0 0 0 4px #2378e8;
    }

    .back-to-top-btn.is-rtl {
      right: 1.25rem;
      left: auto;
    }

    @keyframes back-to-top-enter {
      from {
        opacity: 0;
        transform: translateY(8px) scale(0.92);
      }
      to {
        opacity: 1;
        transform: translateY(0) scale(1);
      }
    }

    @media (min-width: 640px) {
      .back-to-feed-control {
        bottom: 1.75rem;
        right: 1.75rem;
      }

      .back-to-feed-control.is-rtl {
        right: auto;
        left: 1.75rem;
      }

      .back-to-top-btn {
        bottom: 1.75rem;
        left: 1.75rem;
      }

      .back-to-top-btn.is-rtl {
        right: 1.75rem;
        left: auto;
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .back-to-top-btn {
        animation: none;
        transition: none;
      }
    }
  `],
})
export class BackToFeedButtonComponent extends BaseComponent implements OnInit {
  private static readonly positionStorageKey = 'floating-feed-button-position';
  private static readonly viewportMargin = 12;
  private static readonly dragThreshold = 5;

  visible = false;
  showBackToTop = false;
  dismissed = false;
  position: { x: number; y: number } | null = null;
  isDragging = false;
  private dragState: {
    pointerId: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  } | null = null;
  private wasDragged = false;

  constructor(injector: Injector, private readonly router: Router) {
    super(injector);
  }

  ngOnInit(): void {
    this.updateVisibility(this.router.url);
    this.updateBackToTopVisibility();
    this.restorePosition();

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

  get backToTopLabel(): string {
    return this.lang === 'ar' ? 'العودة إلى أعلى الصفحة' : 'Back to top';
  }

  get dragLabel(): string {
    return this.lang === 'ar'
      ? 'اسحب لتغيير موضع زر العودة إلى الموجز'
      : 'Drag to reposition the Back to Feed button';
  }

  get dismissLabel(): string {
    return this.lang === 'ar' ? 'إخفاء زر العودة إلى الموجز' : 'Hide Back to Feed button';
  }

  @HostListener('window:scroll')
  onWindowScroll(): void {
    this.updateBackToTopVisibility();
  }

  @HostListener('window:resize')
  onWindowResize(): void {
    if (this.position) {
      this.position = this.clampPosition(this.position);
    }
  }

  startDrag(event: PointerEvent): void {
    if (event.pointerType === 'mouse' && event.button !== 0) return;

    const element = event.currentTarget as HTMLElement;
    const rect = element.getBoundingClientRect();
    this.dragState = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: rect.left,
      originY: rect.top,
    };
    this.wasDragged = false;
    element.setPointerCapture(event.pointerId);
  }

  moveDrag(event: PointerEvent): void {
    if (!this.dragState || this.dragState.pointerId !== event.pointerId) return;

    const deltaX = event.clientX - this.dragState.startX;
    const deltaY = event.clientY - this.dragState.startY;
    if (!this.wasDragged && Math.hypot(deltaX, deltaY) < BackToFeedButtonComponent.dragThreshold) return;

    this.wasDragged = true;
    this.isDragging = true;
    this.position = this.clampPosition({
      x: this.dragState.originX + deltaX,
      y: this.dragState.originY + deltaY,
    });
    event.preventDefault();
  }

  finishDrag(event: PointerEvent): void {
    if (!this.dragState || this.dragState.pointerId !== event.pointerId) return;

    const element = event.currentTarget as HTMLElement;
    this.dragState = null;
    this.isDragging = false;
    if (element.hasPointerCapture(event.pointerId)) {
      element.releasePointerCapture(event.pointerId);
    }

    if (this.wasDragged && this.position) {
      this.position = this.clampPosition(this.position);
      localStorage.setItem(BackToFeedButtonComponent.positionStorageKey, JSON.stringify(this.position));
    }
  }

  handleClick(event: MouseEvent): void {
    if (this.wasDragged) {
      event.preventDefault();
      this.wasDragged = false;
    }
  }

  scrollToTop(): void {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: 0, behavior: prefersReducedMotion ? 'auto' : 'smooth' });
  }

  private updateVisibility(url: string): void {
    this.visible = url.startsWith('/app');
  }

  private updateBackToTopVisibility(): void {
    this.showBackToTop = typeof window !== 'undefined' && window.scrollY > 320;
  }

  private restorePosition(): void {
    if (typeof window === 'undefined') return;

    const savedPosition = localStorage.getItem(BackToFeedButtonComponent.positionStorageKey);
    if (!savedPosition) return;

    try {
      const parsed = JSON.parse(savedPosition) as { x: number; y: number };
      if (Number.isFinite(parsed.x) && Number.isFinite(parsed.y)) {
        setTimeout(() => {
          this.position = this.clampPosition(parsed);
        });
      }
    } catch {
      localStorage.removeItem(BackToFeedButtonComponent.positionStorageKey);
    }
  }

  private clampPosition(next: { x: number; y: number }): { x: number; y: number } {
    const element = document.querySelector('.back-to-feed-control') as HTMLElement | null;
    if (!element) return next;

    const margin = BackToFeedButtonComponent.viewportMargin;
    return {
      x: Math.min(Math.max(next.x, margin), Math.max(margin, window.innerWidth - element.offsetWidth - margin)),
      y: Math.min(Math.max(next.y, margin), Math.max(margin, window.innerHeight - element.offsetHeight - margin)),
    };
  }
}
