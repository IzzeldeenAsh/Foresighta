import { Component, ElementRef, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { KnowledgeService, KnowledgeTypeStatistic } from 'src/app/_fake/services/knowledge/knowledge.service';

@Component({
  selector: 'app-knowledge-filter-chips',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  templateUrl: './knowledge-filter-chips.component.html',
  styleUrls: ['./knowledge-filter-chips.component.scss']
})
export class KnowledgeFilterChipsComponent implements OnInit, OnChanges {
  @Input() selectedKnowledgeType: string = '';
  @Input() status?: string; // Filter knowledges by status (e.g., 'published', 'unpublished', 'scheduled')
  @Input() showChips: boolean = true; // Control whether to show chips
  @Output() typeFilter = new EventEmitter<string>();

  @ViewChild('chipsScroller') chipsScroller?: ElementRef<HTMLElement>;

  typeCounts: { [key: string]: number } = {};
  totalCount = 0;
  isDragging = false;

  private dragPointerId: number | null = null;
  private dragStartX = 0;
  private dragStartScrollLeft = 0;
  private dragDistance = 0;

  /** Movement past this many pixels counts as a drag rather than a chip tap. */
  private static readonly DRAG_CLICK_THRESHOLD_PX = 6;

  /** Localized type labels (en + ar) mapped back to the enum keys used for filtering. */
  private static readonly TYPE_LABEL_KEYS: { [label: string]: string } = {
    'data': 'data',
    'بيانات': 'data',
    'statistics': 'statistic',
    'statistic': 'statistic',
    'إحصائية': 'statistic',
    'report': 'report',
    'التقرير': 'report',
    'manual': 'manual',
    'اليدوية': 'manual',
    'course': 'course',
    'دورة': 'course',
    'media': 'media',
    'الوسائط': 'media',
  };

  constructor(private knowledgeService: KnowledgeService) {}

  ngOnInit(): void {
    this.loadAllKnowledges();
  }

  ngOnChanges(changes: SimpleChanges): void {
    // Reload when status changes
    if (changes['status'] && !changes['status'].firstChange) {
      this.loadAllKnowledges();
    }
  }

  loadAllKnowledges(): void {
    // Counts come from the statistics endpoint so every status is represented;
    // the library list endpoint only returns published items, which left the
    // chips empty on the Drafts and Scheduled tabs.
    this.knowledgeService.getKnowledgeTypeStatistics(this.status).subscribe(
      (response) => {
        this.calculateTypeCounts(response.data ?? []);
      },
      (error) => {
        console.error('Error loading knowledge type statistics for filter chips:', error);
        this.typeCounts = {};
        this.totalCount = 0;
      }
    );
  }

  private calculateTypeCounts(statistics: KnowledgeTypeStatistic[]): void {
    this.typeCounts = {};
    this.totalCount = 0;

    statistics.forEach(statistic => {
      const type = this.resolveTypeKey(statistic.type);
      const count = Number(statistic.count) || 0;
      if (!type || count <= 0) {
        return;
      }

      this.typeCounts[type] = (this.typeCounts[type] || 0) + count;
      this.totalCount += count;
    });
  }

  /**
   * Some endpoints return `type` as a translated label ("Report", "التقرير")
   * rather than the enum key the chips filter on, so map those back.
   */
  private resolveTypeKey(type: string | null | undefined): string | null {
    const label = (type ?? '').toString().trim();
    if (!label) {
      return null;
    }

    return KnowledgeFilterChipsComponent.TYPE_LABEL_KEYS[label.toLowerCase()] ?? label.toLowerCase();
  }

  getTypeCount(type: string): number {
    return this.typeCounts[type] || 0;
  }

  filterByType(type: string): void {
    // A drag that ended on a chip should scroll the row, not select a filter.
    if (this.dragDistance > KnowledgeFilterChipsComponent.DRAG_CLICK_THRESHOLD_PX) {
      return;
    }
    this.selectedKnowledgeType = type;
    this.typeFilter.emit(type);
  }

  onDragStart(event: PointerEvent): void {
    const scroller = this.chipsScroller?.nativeElement;
    if (!scroller || scroller.scrollWidth <= scroller.clientWidth) {
      return;
    }

    this.dragPointerId = event.pointerId;
    this.dragStartX = event.clientX;
    this.dragStartScrollLeft = scroller.scrollLeft;
    this.dragDistance = 0;
    this.isDragging = true;
  }

  onDragMove(event: PointerEvent): void {
    const scroller = this.chipsScroller?.nativeElement;
    if (!scroller || !this.isDragging || event.pointerId !== this.dragPointerId) {
      return;
    }

    const delta = event.clientX - this.dragStartX;
    this.dragDistance = Math.max(this.dragDistance, Math.abs(delta));
    scroller.scrollLeft = this.dragStartScrollLeft - delta;
  }

  onDragEnd(event: PointerEvent): void {
    if (event.pointerId !== this.dragPointerId) {
      return;
    }

    this.isDragging = false;
    this.dragPointerId = null;
    // Cleared after the click that follows pointerup has been handled.
    setTimeout(() => (this.dragDistance = 0));
  }
}