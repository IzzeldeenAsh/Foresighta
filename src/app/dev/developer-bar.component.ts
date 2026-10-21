import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Component, Inject, isDevMode, NgZone, OnDestroy, OnInit, PLATFORM_ID } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { environment } from '../../environments/environment';
import { componentSources } from './component-sources';

type SourceEntry = typeof componentSources[number];
type DebugApi = {
  getComponent(element: Element): object | null;
  getOwningComponent(element: Element): object | null;
};

@Component({
  selector: 'app-developer-bar',
  standalone: true,
  imports: [CommonModule],
  template: `
    <aside *ngIf="enabled" data-developer-bar [attr.data-collapsed]="collapsed" aria-label="Developer component bar" dir="ltr">
      <button class="badge" (click)="collapsed = !collapsed" [attr.aria-expanded]="!collapsed" title="Toggle developer bar">DEV · Angular</button>
      <ng-container *ngIf="!collapsed">
        <strong>{{ current?.name || 'Page' }}</strong>
        <span class="files" [title]="current?.files?.join('\n') || ''">{{ current?.files?.join('  ·  ') || 'No project component source found' }}</span>
        <button (click)="toggleInspect()" [attr.aria-pressed]="inspecting">{{ inspecting ? 'Inspecting · Esc' : 'Inspect' }}</button>
        <button (click)="copyPaths()" [disabled]="!current">{{ copied ? 'Copied' : 'Copy paths' }}</button>
      </ng-container>
    </aside>
  `,
  styleUrls: ['./developer-bar.component.scss'],
})
export class DeveloperBarComponent implements OnInit, OnDestroy {
  enabled = false;
  collapsed = false;
  inspecting = false;
  copied = false;
  current: SourceEntry | undefined;
  private page: SourceEntry | undefined;
  private subscription?: Subscription;
  private copyTimer?: ReturnType<typeof setTimeout>;

  constructor(private router: Router, private zone: NgZone, @Inject(PLATFORM_ID) private platform: object) {}

  ngOnInit(): void {
    this.enabled = !environment.production && isDevMode() && isPlatformBrowser(this.platform);
    if (!this.enabled) return;
    this.updatePage();
    this.subscription = this.router.events.subscribe(event => {
      if (event instanceof NavigationEnd) this.updatePage();
    });
    this.zone.runOutsideAngular(() => {
      document.addEventListener('pointerover', this.inspect, { passive: true });
      document.addEventListener('focusin', this.inspect);
      document.addEventListener('keydown', this.onKeydown);
    });
  }

  private updatePage(): void {
    const visit = (route: typeof this.router.routerState.snapshot.root): SourceEntry | undefined => {
      for (const child of route.children) {
        const entry = visit(child);
        if (entry) return entry;
      }
      const name = typeof route.component === 'function' ? route.component.name : undefined;
      const matches = componentSources.filter(entry => entry.name === name);
      return matches.length === 1 ? matches[0] : undefined;
    };
    this.page = visit(this.router.routerState.snapshot.root);
    this.current = this.page;
    this.copied = false;
  }

  private inspect = (event: Event): void => {
    if (!this.inspecting || !(event.target instanceof Element) || event.target.closest('[data-developer-bar]')) return;
    const debug = (window as unknown as { ng?: DebugApi }).ng;
    if (!debug) return;
    let element: Element | null = event.target;
    let found: SourceEntry | undefined;
    while (element && !found) {
      try {
        const instance = debug.getComponent(element) || debug.getOwningComponent(element);
        if (instance) {
          const matches = componentSources.filter(entry => entry.name === instance.constructor.name);
          if (matches.length === 1) found = matches[0];
          else found = matches.find(entry => entry.selector && element!.closest(entry.selector));
        }
      } catch { /* Unmanaged DOM or third-party nodes: try their parent. */ }
      element = element.parentElement;
    }
    const next = found || this.page;
    if (next !== this.current) this.zone.run(() => { this.current = next; this.copied = false; });
  };

  private onKeydown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape' && this.inspecting) this.zone.run(() => { this.inspecting = false; this.current = this.page; });
  };

  toggleInspect(): void {
    this.inspecting = !this.inspecting;
    this.current = this.page;
  }

  async copyPaths(): Promise<void> {
    if (!this.current) return;
    try {
      await navigator.clipboard.writeText(this.current.files.join('\n'));
      this.copied = true;
      clearTimeout(this.copyTimer);
      this.copyTimer = setTimeout(() => this.copied = false, 1500);
    } catch { this.copied = false; }
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
    clearTimeout(this.copyTimer);
    if (!this.enabled) return;
    document.removeEventListener('pointerover', this.inspect);
    document.removeEventListener('focusin', this.inspect);
    document.removeEventListener('keydown', this.onKeydown);
  }
}
