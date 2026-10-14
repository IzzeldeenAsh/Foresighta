import { Component, Input } from '@angular/core';
import { DefinitionMode } from 'src/app/_fake/services/project-phase2/project-requirements.model';

/** Basic (`simple`) projects leave scopes and deliverables to the Insighter; advanced ones are client-defined. */
@Component({
  selector: 'app-definition-mode-badge',
  template: `
    <span *ngIf="mode" class="dm-badge" [class.dm-badge--advanced]="advanced" [pTooltip]="hint" tooltipPosition="top">
      <span class="dm-badge__dot" aria-hidden="true"></span>{{ label }}<span class="dm-badge__sr">: {{ hint }}</span>
    </span>`,
  styles: [`:host{display:inline-flex;vertical-align:middle}.dm-badge{display:inline-flex;align-items:center;gap:6px;border-radius:999px;padding:3px 10px;background:#e0f2fe;color:#0369a1;font-size:12px;font-weight:600;line-height:1.4;white-space:nowrap}.dm-badge--advanced{background:#f3e8ff;color:#7e22ce}.dm-badge__dot{width:6px;height:6px;border-radius:50%;background:currentColor}.dm-badge__sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}`],
})
export class DefinitionModeBadgeComponent {
  @Input() mode: DefinitionMode | null | undefined = null;
  @Input() lang = 'en';
  get advanced(): boolean { return this.mode === 'advanced'; }
  get label(): string {
    return this.lang === 'ar' ? (this.advanced ? 'متقدم' : 'أساسي') : (this.advanced ? 'Advanced' : 'Basic');
  }
  get hint(): string {
    if (this.lang === 'ar') return this.advanced ? 'حدد العميل النطاقات والمخرجات.' : 'يحدد الإنسايتر النطاقات والمخرجات ضمن عرضه.';
    return this.advanced ? 'The client defined the scopes and deliverables.' : 'The Insighter defines the scopes and deliverables in their offer.';
  }
}
