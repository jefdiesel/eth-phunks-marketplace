import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class TicParentService {
  private readonly PARENT_TX = '0xadcbda2a277d01434e887f14c762ee7e8f242ec10af69e29372c27988dea1037';

  /**
   * Get the current owner of the parent TIC token
   */
  async getParentOwner(): Promise<string | null> {
    try {
      const response = await fetch(`https://api.ethscriptions.com/api/ethscriptions/${this.PARENT_TX}`);
      const data = await response.json();
      
      if (data.current_owner) {
        console.log('Parent owner:', data.current_owner);
        return data.current_owner.toLowerCase();
      }
      return null;
    } catch (err) {
      console.error('Failed to get parent owner:', err);
      return null;
    }
  }
}
