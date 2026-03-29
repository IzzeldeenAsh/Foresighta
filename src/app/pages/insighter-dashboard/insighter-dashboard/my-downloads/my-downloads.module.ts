import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Routes } from '@angular/router';
import { MyDownloadsComponent } from './my-downloads.component';
import { TranslationModule } from 'src/app/modules/i18n';
import { InlineSVGModule } from 'ng-inline-svg-2';
import { TranslateModule } from '@ngx-translate/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { TruncateTextPipe } from 'src/app/pipes/truncate-pipe/truncate-text.pipe';
import { FileSizePipe } from 'src/app/pipes/file-size-pipe/file-size.pipe';
import { ProgressBarModule } from 'primeng/progressbar';
import { TooltipModule } from 'primeng/tooltip';
import { DialogModule } from 'primeng/dialog';
import { InsighterDashboardSharedModule } from '../shared/shared.module';
import { PendingChangesGuard } from 'src/app/guards/pending-changes.guard';
const routes: Routes = [
  {
    path: '',
    component: MyDownloadsComponent,
    canDeactivate: [PendingChangesGuard]
  }
];

@NgModule({
  declarations: [
    MyDownloadsComponent,
  ],
  imports: [
    CommonModule,
    RouterModule.forChild(routes),
    TranslationModule,
    InlineSVGModule,
    TranslateModule,
    FormsModule,
    ReactiveFormsModule,
    TruncateTextPipe,
    ProgressBarModule,
    FileSizePipe,
    TooltipModule,
    DialogModule,
    InsighterDashboardSharedModule
  ]
})
export class MyDownloadsModule { }
