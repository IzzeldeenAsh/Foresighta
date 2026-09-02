import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import {
  DASHBOARD_NAV_ICON_PATHS,
  DashboardNavIconName,
} from './dashboard-nav-icons';

/**
 * Renders one of the dashboard sidebar icons inline, so a page header shows the
 * same icon as the sidebar item that links to it.
 */
@Component({
  selector: 'app-dashboard-nav-icon',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dashboard-nav-icon.component.html',
  styleUrl: './dashboard-nav-icon.component.scss',
})
export class DashboardNavIconComponent {
  @Input({ required: true }) name!: DashboardNavIconName;

  /** Rendered size in pixels. Page headers are larger than the sidebar's 18px. */
  @Input() size = 28;

  get paths(): string[] {
    return DASHBOARD_NAV_ICON_PATHS[this.name] ?? [];
  }
}
