import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class MarketContractService {
  // New market contract with royalties support
  readonly MARKET_CONTRACT_ADDRESS = '0xa8501386B31163A187218628e0a1cC1AFDA3515d';
  readonly PARENT_TX = '0xadcbda2a277d01434e887f14c762ee7e8f242ec10af69e29372c27988dea1037';

  constructor() {}

  getMarketAddress(): string {
    return this.MARKET_CONTRACT_ADDRESS;
  }

  getParentTx(): string {
    return this.PARENT_TX;
  }
}
