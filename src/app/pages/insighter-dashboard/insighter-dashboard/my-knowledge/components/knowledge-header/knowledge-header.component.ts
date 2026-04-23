import { Component, Injector, OnInit } from '@angular/core';
import { BaseComponent } from 'src/app/modules/base.component';
import { KnowledgeService, KnowledgeTypeStatisticsResponse } from 'src/app/_fake/services/knowledge/knowledge.service';

interface KnowledgeTypeInfo {
  iconName: string;
  iconClass: string;
  label: string;
}

type KnowledgeTypeMap = {
  [key: string]: KnowledgeTypeInfo;
}

@Component({
  selector: 'app-knowledge-header',
  templateUrl: './knowledge-header.component.html',
  styleUrls: ['./knowledge-header.scss'],
})
export class KnowledgeHeaderComponent extends BaseComponent implements OnInit {
  totalSize: string = '2.6 GB';
  totalItems: number = 758;
  screenWidth: number = window.innerWidth;
  statistics: KnowledgeTypeStatisticsResponse;

  // Knowledge type icon and style mapping
  private knowledgeTypeMap: KnowledgeTypeMap = {
    'data': { iconName: 'data', iconClass: 'primary', label: 'DATA' },
    'statistic': { iconName: 'chart-line', iconClass: 'success', label: 'INSIGHTS' },
    'report': { iconName: 'document', iconClass: 'info', label: 'REPORTS' },
    'manual': { iconName: 'book', iconClass: 'warning', label: 'MANUAL' },
    'course': { iconName: 'teacher', iconClass: 'success', label: 'COURSE' },
    'media': { iconName: 'youtube', iconClass: 'danger', label: 'MEDIA' }
  };

  constructor(
    injector: Injector,
    private knowledgeService: KnowledgeService
  ) {
    super(injector);
    // Listen for window resize events
    window.addEventListener('resize', () => {
      this.screenWidth = window.innerWidth;
    });
  }
  
  ngOnInit(): void {
    this.loadStatistics();
  }

  loadStatistics(): void {
    const subscription = this.knowledgeService.getKnowledgeTypeStatistics()
      .subscribe({
        next: (response) => {
          this.statistics = response;
        },
        error: (error) => {
          console.error('Error loading knowledge statistics', error);
        }
      });
    
    this.unsubscribe.push(subscription);
  }

  getIconName(type: string): string {
    return this.knowledgeTypeMap[type]?.iconName || 'document';
  }

  getIconClass(type: string): string {
    return this.knowledgeTypeMap[type]?.iconClass || 'primary';
  }

  getTypeLabel(type: string): string {
    return this.knowledgeTypeMap[type]?.label || type.toUpperCase();
  }

  get totalKnowledgeCount(): number {
    return this.statistics?.data?.reduce((sum, item) => sum + item.count, 0) || 0;
  }
} 
