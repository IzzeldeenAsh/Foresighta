import { Component, OnDestroy, OnInit } from '@angular/core';
import { KnowledgeService } from 'src/app/_fake/services/knowledge/knowledge.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-my-knowledge',
  templateUrl: './my-knowledge.component.html',
  styleUrl: './my-knowledge.component.scss'
})
export class MyKnowledgeComponent implements OnInit, OnDestroy {
  hasKnowledge: boolean = true;
  loading: boolean = true;
  private subscription = new Subscription();

  constructor(private knowledgeService: KnowledgeService) {}

  ngOnInit() {
    this.checkForKnowledge(true);
    this.subscription.add(
      this.knowledgeService.knowledgeStatusStatisticsChanged$.subscribe(() => {
        this.checkForKnowledge(false);
      })
    );
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }

  private checkForKnowledge(showLoader: boolean = true) {
    if (showLoader) this.loading = true;
    this.knowledgeService.getListKnowledge().subscribe(
      (response) => {
        this.hasKnowledge = response.data && response.data.length > 0;
        if (showLoader) this.loading = false;
      },
      (error) => {
        console.error('Error checking for knowledge:', error);
        this.hasKnowledge = false;
        if (showLoader) this.loading = false;
      }
    );
  }
}
