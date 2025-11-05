import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-subscriptions-test',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="tic-container">
      <h1>TIC Subscriptions ({{ items.length }})</h1>
      <div class="tic-grid">
        @for (item of items; track item.tx) {
          <img 
            [src]="imageMap[item.tx] || 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22128%22 height=%22128%22%3E%3Crect fill=%22%23ddd%22 width=%22128%22 height=%22128%22/%3E%3C/svg%3E'"
            class="tic-img"
            [title]="item.fullName"
            (error)="onImageError($event, item.tx)">
        }
      </div>
    </div>
  `,
  styles: [`
    :host {
      all: initial;
      display: block;
    }

    .tic-container {
      all: revert;
      padding: 20px 40px;
      background: #ffff00;
      min-height: 100vh;
    }
    
    .tic-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(96px, 1fr));
      gap: 10px;
    }
    
    .tic-img {
      width: 96px;
      height: 96px;
      image-rendering: pixelated;
      cursor: pointer;
      border: none;
      padding: 0;
      margin: 0;
    }
  `]
})
export class SubscriptionsTestComponent implements OnInit {
  items: any[] = [];
  imageMap: { [tx: string]: string } = {};

  constructor(private http: HttpClient) {}

  ngOnInit() {
    this.http.get<any[]>('assets/tic-data.json').subscribe(data => {
      this.items = data;
      console.log('Loaded', data.length, 'items');
      this.loadAllImages();
    });
  }

  loadAllImages() {
    this.items.forEach(item => this.loadTICImage(item.tx));
  }

  async loadTICImage(tx: string) {
    try {
      const response = await fetch(`https://api.ethscriptions.com/api/ethscriptions/${tx}`);
      const data = await response.json();
      
      if (!data.content_uri) return;
      
      const commaIndex = data.content_uri.indexOf(',');
      if (commaIndex === -1) return;
      
      const jsonStr = data.content_uri.slice(commaIndex + 1);
      const ticJson = JSON.parse(jsonStr);
      const content = JSON.parse(ticJson.content);
      
      if (!content.images?.small?.data) return;
      
      const mimeType = content.images.small.mimeType || 'image/png';
      const base64 = content.images.small.data;
      this.imageMap[tx] = `data:${mimeType};base64,${base64}`;
    } catch (err) {
      console.error('Error:', tx, err);
    }
  }

  onImageError(event: any, tx: string) {
    console.error('Image error for', tx);
  }
}
