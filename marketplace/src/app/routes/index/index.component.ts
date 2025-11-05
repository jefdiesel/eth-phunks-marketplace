import { Component, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { WaIntersectionObserver } from '@ng-web-apis/intersection-observer';

import { Store } from '@ngrx/store';
import { TimeagoModule } from 'ngx-timeago';
import { LazyLoadImageModule } from 'ng-lazyload-image';

import { PhunkGridComponent } from '@/components/phunk-grid/phunk-grid.component';
import { RecentActivityComponent } from '@/components/recent-activity/recent-activity.component';
import { SplashComponent } from '@/components/splash/splash.component';
import { BrbComponent } from '@/components/brb/brb.component';
import { MintComponent } from '@/components/mint/mint.component';
import { CalcPipe } from '@/pipes/calculate.pipe';

import { DataService } from '@/services/data.service';
import { ThemeService } from '@/services/theme.service';

import { GlobalState } from '@/models/global-state';

import * as dataStateSelectors from '@/state/selectors/data-state.selectors';
import * as appStateSelectors from '@/state/selectors/app-state.selectors';
import * as marketStateSelectors from '@/state/selectors/market-state.selectors';
import * as marketStateActions from '@/state/actions/market-state.actions';import { tap } from 'rxjs';
import * as dataStateActions from '@/state/actions/data-state.actions';
@Component({
  standalone: true,
  imports: [
    CommonModule,
    TimeagoModule,
    RouterModule,
    LazyLoadImageModule,
    WaIntersectionObserver,

    SplashComponent,
    PhunkGridComponent,
    RecentActivityComponent,
    BrbComponent,
    MintComponent,
    CalcPipe,
  ],
  selector: 'app-index',
  templateUrl: './index.component.html',
  styleUrls: ['./index.component.scss']
})

export class IndexComponent implements OnInit {

  walletAddress$ = this.store.select(appStateSelectors.selectWalletAddress);
  activeCollection$ = this.store.select(dataStateSelectors.selectActiveCollection);

  owned$ = this.store.select(marketStateSelectors.selectOwned);
  listings$ = this.store.select(marketStateSelectors.selectListings);
  bids$ = this.store.select(marketStateSelectors.selectBids);
  all$ = this.store.select(marketStateSelectors.selectAll);

  isMobile$ = this.store.select(appStateSelectors.selectIsMobile);
  usd$ = this.store.select(dataStateSelectors.selectUsd);

  config$ = this.store.select(appStateSelectors.selectConfig);

  mintImage = signal<string | null>(null);

  constructor(
    private store: Store<GlobalState>,
    public themeSvc: ThemeService,
    public dataSvc: DataService,
    public route: ActivatedRoute
  ) {}
}

  ngOnInit() {
    this.route.params.subscribe(params => {
      const slug = params['slug'];
      if (slug === 'subscriptions') {
        const mockCollection = {
          slug: 'subscriptions',
          name: 'Subscriptions',
          supply: 69,
          image: null,
          mintEnabled: false,
          isMinting: false,
          description: 'TIC Protocol Subscriptions'
        };
        this.store.dispatch(dataStateActions.setActiveCollection({ collection: mockCollection }));
      }
      console.log("Route slug:", slug);
      if (slug) {
        this.store.dispatch(marketStateActions.setMarketSlug({ marketSlug: slug }));
      }
    });
  }
