import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { DASHBOARD_NAV_ICONS } from './dashboard-nav-icons';

/**
 * Hidden SVG sprite holding every dashboard nav icon as `#feed-icon-<name>`.
 * The sidebar references these symbols with `<use href="#feed-icon-...">`.
 */
@Component({
  selector: 'app-dashboard-nav-icon-sprite',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dashboard-nav-icon-sprite.component.html',
  styleUrl: './dashboard-nav-icon-sprite.component.scss',
})
export class DashboardNavIconSpriteComponent {
  readonly icons = DASHBOARD_NAV_ICONS;
}
