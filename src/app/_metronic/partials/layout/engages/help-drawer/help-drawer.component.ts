import {Component, OnInit} from '@angular/core';
import {environment} from 'src/environments/environment';

@Component({
  selector: 'app-help-drawer',
  templateUrl: './help-drawer.component.html',
})
export class HelpDrawerComponent implements OnInit {
  env = environment;
  appThemeName: string = 'tst';
  appPurchaseUrl: string = 'tstl';

  constructor() {
  }

  ngOnInit(): void {
  }
}
