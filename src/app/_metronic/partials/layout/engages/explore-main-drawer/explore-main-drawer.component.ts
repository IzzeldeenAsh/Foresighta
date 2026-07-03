import {Component, OnInit} from '@angular/core';
import { environment } from 'src/environments/environment';

@Component({
  selector: 'app-explore-main-drawer',
  templateUrl: './explore-main-drawer.component.html',
})
export class ExploreMainDrawerComponent implements OnInit {
  env = environment;
  appThemeName: string = 'sts';
  appPurchaseUrl: string ='sts';
  appPreviewUrl: string ='sts';
  appDemos ='sts';

  constructor() {
  }

  ngOnInit(): void {
  }
}
