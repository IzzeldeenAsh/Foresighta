import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NgbTooltipModule } from '@ng-bootstrap/ng-bootstrap';
import { HorizontalComponent } from './horizontal/horizontal.component';
import { WizardsRoutingModule } from './wizards-routing.module';
import { WizardsComponent } from './wizards.component';
import { Step1Component } from './steps/step1/step1.component';
import { Step2Component } from './steps/step2/step2.component';
import { Step3Component } from './steps/step3/step3.component';
import { Step4Component } from './steps/step4/step4.component';
import { Step5Component } from './steps/step5/step5.component';
import { SharedModule } from "../../_metronic/shared/shared.module";
import { TranslationModule } from 'src/app/modules/i18n';
import { InputTextModule } from 'primeng/inputtext';
import { EditorModule } from '@tinymce/tinymce-angular';
import { DropdownModule } from 'primeng/dropdown';
import { IndustrySelectorComponent } from 'src/app/reusable-components/industry-selector/industry-selector.component';
import { SelectButtonModule } from 'primeng/selectbutton';
import { SelectEconomicBlockComponent } from 'src/app/reusable-components/select-economic-block/select-economic-block.component';
import { SelectRegionComponent } from 'src/app/reusable-components/select-region/select-region.component';
import { GetHsCodeByIsicComponent } from 'src/app/reusable-components/get-hs-code-by-isic/get-hs-code-by-isic.component';
import { ToastModule } from 'primeng/toast';
import { FileUploadModule } from 'primeng/fileupload';
import { InputNumberModule } from 'primeng/inputnumber';
import { FileUploaderComponent } from 'src/app/reusable-components/file-uploader/file-uploader.component';
import { TableOfContentComponent } from 'src/app/reusable-components/table-of-content/table-of-content.component';
import { FileSizePipe } from './steps/step3/file-size.pipe';
import { TagInputModule } from 'ngx-chips';
import { Step6Component } from './steps/step6/step6.component';
import { DialogModule } from 'primeng/dialog';
@NgModule({
  declarations: [
    HorizontalComponent,
    WizardsComponent,
    Step1Component,
    Step2Component,
    Step3Component,
    Step4Component,
    Step5Component,
    Step6Component,
  ],
  imports: [
    CommonModule,
    WizardsRoutingModule,
    ReactiveFormsModule,
    EditorModule,
    DialogModule,
    FormsModule,
    TranslationModule,
    FileSizePipe,
    FileUploaderComponent,
    IndustrySelectorComponent,
    InputTextModule,
    NgbTooltipModule,
    SelectEconomicBlockComponent,
    FileUploadModule,
    TableOfContentComponent,
    GetHsCodeByIsicComponent,
    InputNumberModule,
    TagInputModule,
    SharedModule,
    DropdownModule,
    SelectRegionComponent,
    SelectButtonModule,
    ToastModule
  ],
})
export class WizardsModule {}
