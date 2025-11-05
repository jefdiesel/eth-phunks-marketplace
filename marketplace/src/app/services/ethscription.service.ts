import { Injectable } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';

import { fromHex } from 'viem';

import { Phunk } from '@/models/db';
import { DecodedData, MIME_TYPE_MAP } from '@/models/ethscriptions';

import { Web3Service } from './web3.service';
import { ImageService } from './image.service';

@Injectable({
  providedIn: 'root'
})
export class EthscriptionService {

  constructor(
    private web3Svc: Web3Service,
    private sanitizer: DomSanitizer,
    private imageSvc: ImageService
  ) {}

  /**
   * Extracts image from TIC (Tiny Image Comments) protocol via Calldata API
   * @param tx Transaction hash of the Ethscription
   * @returns Data URI string or null
   */
  private async extractTICImage(tx: string): Promise<string | null> {
    try {
      // Use v2 Calldata API - faster, smaller, cached
      const response = await fetch(`https://api.ethscriptions.com/api/ethscriptions/${tx}/calldata`);
      const data = await response.json();
      
      if (!data.calldata) return null;
      
      // Extract JSON from data URI - everything after the comma
      const commaIndex = data.calldata.indexOf(',');
      if (commaIndex === -1) return null;
      
      const jsonStr = data.calldata.slice(commaIndex + 1);
      const ticJson = JSON.parse(jsonStr);
      const content = JSON.parse(ticJson.content);
      
      if (!content.images?.small?.data) return null;
      
      const mimeType = content.images.small.mimeType || 'image/png';
      const base64 = content.images.small.data;
      
      // Return data URI - browser native support
      return `data:${mimeType};base64,${base64}`;
    } catch (err) {
      console.error('Failed to extract TIC image from', tx, err);
      return null;
    }
  }

  /**
   * Processes a phunk's image data from the blockchain
   * @param phunk The phunk object containing the hash ID
   */
  async processImage(phunk: Phunk | null): Promise<DecodedData | null> {
    if (!phunk) return null;

    // Try TIC protocol extraction first
    const ticImage = await this.extractTICImage(phunk.hashId as string);
    if (ticImage) {
      return this.decodeDataURI(ticImage);
    }

    // Fall back to existing logic
    let imageData;
    if (phunk?.isSupported) {
      imageData = await this.fetchHostedImage(phunk);
    } else {
      const inscriptionTx = await this.web3Svc.getTransactionL1(phunk?.hashId as string);
      const txData = fromHex(inscriptionTx.input || inscriptionTx.data, 'string');
      imageData = txData.replace(/\x00/g, '').replace(/^0x/, '');
    }

    if (!imageData) return null;
    return this.decodeDataURI(imageData);
  }

  async fetchHostedImage(phunk: Phunk | null): Promise<string | null> {
    const image = await this.imageSvc.fetchSupportedImageBySha(phunk?.sha as string);
    const uint8Array = new Uint8Array(image);
    const binaryString = uint8Array.reduce((str, byte) => str + String.fromCharCode(byte), '');
    const base64String = btoa(binaryString);
    return `data:image/png;base64,${base64String}`;
  }

  private decodeDataURI(dataURI: string): DecodedData {
    if (!dataURI) return { type: 'unsupported', mimeType: '', data: 'No Data URI' };
    if (dataURI.startsWith('https://')) return { type: 'url', mimeType: '', data: dataURI };

    const match = dataURI.match(/^data:([^;,]*)(;[^,]*)?,(.*)$/);
    if (!match) return { type: 'unsupported', mimeType: '', data: 'Invalid Data URI' };

    const mimeType = match[1] || '';
    const isBase64 = match[2]?.includes('base64');
    let data = match[3];

    const makeDataURI = (type: string, d: string, base64 = false) =>
      `data:${type}${base64 ? ';base64' : ''},${d}`;

    const mappedType = MIME_TYPE_MAP[mimeType] || 'unsupported';
    switch (mappedType) {
      case 'image':
        return { type: 'image', mimeType, data: makeDataURI(mimeType, data, isBase64) };
      case 'video':
        return { type: 'video', mimeType, data: makeDataURI(mimeType, data, isBase64) };
      case 'html':
        try {
          const decoded = isBase64 ? atob(data) : decodeURIComponent(data);
          const injectContent = `
            <style>
              html, body {
                margin: 0;
                padding: 0;
                display: flex;
                justify-content: center;
                align-items: center;
                min-height: 100vh;
                width: 100%;
                background: none;
              }
              body > * {
                margin: 0 auto;
                max-width: 100%;
              }
            </style>
          `;
          const enhancedHTML = decoded.includes('</head>')
            ? decoded.replace('</head>', `${injectContent}</head>`)
            : `<head>${injectContent}</head>${decoded}`;

          return { type: 'html', mimeType, data: this.sanitizer.bypassSecurityTrustHtml(enhancedHTML) as string };
        } catch (error) {
          console.error('Error processing HTML content:', error);
          return { type: 'unsupported', mimeType, data: 'Error processing HTML content' };
        }
      case 'json':
        try {
          const decoded = isBase64 ? atob(data) : decodeURIComponent(data);
          const json = JSON.parse(decoded);
          return { type: 'json', mimeType, data: JSON.stringify(json, null, 2) };
        } catch {
          return { type: 'unsupported', mimeType, data: 'Error parsing JSON' };
        }
      case 'text':
        try {
          const decoded = isBase64 ? atob(data) : decodeURIComponent(data);
          return { type: 'text', mimeType, data: decoded };
        } catch {
          return { type: 'unsupported', mimeType, data: 'Error decoding text' };
        }
      default:
        return { type: 'unsupported', mimeType, data: `Unsupported MIME type: ${mimeType}` };
    }
  }
}
