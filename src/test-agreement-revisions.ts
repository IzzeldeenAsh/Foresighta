import 'zone.js/testing';
import { getTestBed } from '@angular/core/testing';
import { BrowserDynamicTestingModule, platformBrowserDynamicTesting } from '@angular/platform-browser-dynamic/testing';
getTestBed().initTestEnvironment(BrowserDynamicTestingModule, platformBrowserDynamicTesting());
import './app/pages/insighter-dashboard/insighter-dashboard/shared/agreement-revisions/agreement-revisions.component.spec';
import './app/_fake/services/agreement-revisions/agreement-revisions.service.spec';

import './app/pages/insighter-dashboard/insighter-dashboard/project-offers/send-proposal/edit-offer.component.spec';
import './app/pages/insighter-dashboard/insighter-dashboard/project-offers/send-proposal/send-proposal.component.spec';
import './app/pages/insighter-dashboard/insighter-dashboard/shared/offer-requirements-editor.component.spec';
