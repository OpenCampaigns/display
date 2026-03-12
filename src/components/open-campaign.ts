import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import {
  NostrRelayClient,
  fetchAndValidateIdentity,
  constructTrackingUrl,
  type Campaign
} from '@opencampaigns/sdk';

import './image-fallback.js';

interface ValidatedCampaign extends Campaign {
  publisherDomain: string;
  publisherName: string;
}

@customElement('open-campaign')
export class OpenCampaign extends LitElement {
  static styles = css`
    :host {
      display: block;
      font-family: 'Inter', system-ui, -apple-system, sans-serif;
    }
    
    .campaign-container {
      width: 100%;
    }

    .orientation-vertical .campaign-grid {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .orientation-horizontal .campaign-grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: 16px;
    }
    
    .campaign-card {
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      overflow: hidden;
      display: flex;
      background: #fff;
      box-shadow: 0 1px 3px rgba(0,0,0,0.05);
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      position: relative;
    }

    .orientation-vertical .campaign-card {
       flex-direction: column;
    }

    .orientation-horizontal .campaign-card {
       flex-direction: row;
       height: auto;
       min-height: 120px;
    }
    
    .campaign-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 12px 20px -8px rgba(0,0,0,0.1);
      border-color: #cbd5e1;
    }
    
    .image-container {
      background: #f8fafc;
      position: relative;
      overflow: hidden;
    }

    .orientation-vertical .image-container {
      height: 180px;
      width: 100%;
    }

    .orientation-horizontal .image-container {
      width: 180px;
      height: 100%;
      flex-shrink: 0;
    }
    
    .content {
      padding: 16px;
      display: flex;
      flex-direction: column;
      flex: 1;
    }
    
    .title {
      margin: 0 0 8px 0;
      font-size: 1.1rem;
      font-weight: 600;
      color: #1e293b;
    }
    
    .description {
      margin: 0 0 12px 0;
      font-size: 0.9rem;
      color: #64748b;
      line-height: 1.4;
      flex: 1;
    }
    
    .publisher {
      font-size: 0.8rem;
      color: #94a3b8;
      margin-bottom: 12px;
    }
    
    .tags {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
      margin-bottom: 12px;
    }
    
    .tag {
      background: #f1f5f9;
      color: #475569;
      font-size: 0.75rem;
      padding: 2px 6px;
      border-radius: 4px;
    }
    
    .cta-button {
      display: inline-block;
      width: 100%;
      text-align: center;
      background: #3b82f6;
      color: white;
      text-decoration: none;
      padding: 8px 0;
      border-radius: 6px;
      font-weight: 600;
      font-size: 0.9rem;
      transition: background 0.2s;
    }
    
    .cta-button:hover {
      background: #2563eb;
    }

    .badge {
      position: absolute;
      bottom: 6px;
      right: 6px;
      display: flex;
      align-items: center;
      background: rgba(255, 255, 255, 0.85);
      backdrop-filter: blur(4px);
      padding: 2px 6px;
      border-radius: 4px;
      box-shadow: 0 1px 2px rgba(0,0,0,0.1);
      z-index: 10;
      pointer-events: none;
      border: 1px solid rgba(0,0,0,0.05);
    }

    .badge svg {
      width: 14px;
      height: 14px;
      margin-right: 4px;
    }

    .badge-text {
      font-size: 9px;
      font-weight: 600;
      color: #64748b;
      letter-spacing: 0.02em;
    }
  `;

  @property({ type: String }) relays: string = 'wss://relay.damus.io,wss://nos.lol,wss://relay.snort.social,wss://offchain.pub,wss://relay.nostr.band,wss://purplepag.es';
  @property({ type: String }) tags: string = '';
  @property({ type: String, attribute: 'excluded-tags' }) excludedTags: string = '';
  @property({ type: String }) orientation: 'horizontal' | 'vertical' = 'vertical';
  @property({ type: Number }) limit: number = 1;
  @property({ type: Boolean }) shuffle: boolean = true;

  @state() private allCampaigns: ValidatedCampaign[] = [];
  @state() private selectedCampaigns: ValidatedCampaign[] = [];
  @state() private status: string = 'Initializing...';
  @state() private eventsCount: number = 0;
  private client?: NostrRelayClient;
  private processedPubkeys = new Set<string>();
  private selectionTimeout: any = null;

  updated(changedProperties: Map<string, any>) {
    if (changedProperties.has('allCampaigns') ||
      changedProperties.has('tags') ||
      changedProperties.has('excludedTags') ||
      changedProperties.has('limit')) {
      this._requestSelectionUpdate();
    }
  }

  private _requestSelectionUpdate() {
    if (this.selectionTimeout) clearTimeout(this.selectionTimeout);
    this.selectionTimeout = setTimeout(() => this._updateSelection(), 300);
  }

  private _updateSelection() {
    let filtered = this.allCampaigns.filter((c: ValidatedCampaign) => {
      if (!c.tags) return false;
      const cTags = c.tags.map((t: string) => t.toLowerCase());

      // Rule 1: Explicit Exclusion
      if (this.excludedTags) {
        const excluded = this.excludedTags.split(',').map((t: string) => t.trim().toLowerCase()).filter(Boolean);
        if (excluded.some((t: string) => cTags.includes(t))) return false;
      }

      // Rule 2: Positive Matching
      if (!this.tags) return true;
      const targetTags = this.tags.split(',').map((t: string) => t.trim().toLowerCase()).filter(Boolean);
      return targetTags.some((t: string) => cTags.includes(t));
    });

    if (this.shuffle && filtered.length > 1) {
      filtered = [...filtered].sort(() => Math.random() - 0.5);
    }

    if (this.limit > 0) {
      filtered = filtered.slice(0, this.limit);
    }

    this.selectedCampaigns = filtered;
  }

  connectedCallback() {
    super.connectedCallback();
    this.startDiscovery();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    if (this.client) {
      this.client.close();
    }
    if (this.selectionTimeout) clearTimeout(this.selectionTimeout);
  }

  private startDiscovery() {
    this.status = 'Connecting to Nostr...';
    const relayList = this.relays.split(',').map(r => r.trim()).filter(Boolean);
    if (relayList.length === 0) {
      this.status = 'No relays configured.';
      return;
    }

    this.client = new NostrRelayClient(relayList);
    this.status = `Searching for ads on ${relayList.length} relays...`;

    this.client.subscribeToCampaigns((event: any) => {
      this.status = `Found ad! Validating...`;
      this.eventsCount++;
      this.handleNostrEvent(event);
    });
  }

  private async handleNostrEvent(event: any) {
    if (this.processedPubkeys.has(event.pubkey)) return;

    // Support both NIP-78 'd' tag and legacy 'domain' tag
    const domainTag = event.tags?.find((t: string[]) => t[0] === 'd' || t[0] === 'domain');
    if (!domainTag || !domainTag[1]) return;

    const domain = domainTag[1];

    try {
      this.processedPubkeys.add(event.pubkey);
      const config = await fetchAndValidateIdentity(domain);

      if (config.publisher.pubkey !== event.pubkey) {
        console.warn(`Mismatch pubkey for ${domain}`);
        return;
      }

      const mappedCampaigns: ValidatedCampaign[] = config.campaigns.map(c => ({
        ...c,
        publisherDomain: domain,
        publisherName: config.publisher.name
      }));

      this.allCampaigns = [...this.allCampaigns, ...mappedCampaigns];

    } catch (err) {
      console.error(`Validation failed for ${domain}:`, err);
    }
  }

  private handleCampaignClick(e: Event, campaign: ValidatedCampaign) {
    e.preventDefault();
    try {
      const finalUrl = constructTrackingUrl(campaign);
      window.open(finalUrl, '_blank', 'noopener,noreferrer');
    } catch (error) {
      window.open(campaign.url, '_blank', 'noopener,noreferrer');
    }
  }

  render() {
    if (this.selectedCampaigns.length === 0) {
      return html`
        <div style="padding: 30px; text-align: center; color: #64748b; border: 1px dashed #cbd5e1; border-radius: 12px; background: #f8fafc;">
          <div style="margin-bottom: 12px; font-weight: 600;">OpenCampaigns Decentralized Discovery</div>
          <div style="font-size: 0.9rem;">${this.status}</div>
          <div style="font-size: 0.8rem; margin-top: 8px; color: #94a3b8;">
            Events processed: ${this.eventsCount}
          </div>
        </div>
      `;
    }

    return html`
      <div class="campaign-container orientation-${this.orientation}">
        <div class="campaign-grid">
          ${this.selectedCampaigns.map((c: ValidatedCampaign) => html`
            <div class="campaign-card">
              <div class="badge">
                <svg viewBox="0 0 2800 1000" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <!-- Official logo icon path -->
                  <path fill="#3d8b8d" d="m 218 564 c -7.5 -2.2 -13.1 -9.6 -14.4 -19.1 -0.7 -5.2 -0.7 -5.2 -13.2 -9.1 -6.9 -2.2 -29.8 -9.6 -51 -16.5 -21.2 -6.9 -40.4 -13.1 -42.7 -13.8 -4.2 -1.3 -4.2 -1.3 -9 3.5 -15.9 15.8 -44.7 0.2 -39.3 -21.2 0.6 -2.3 1.3 -5.2 1.6 -6.3 0.4 -1.7 -8.1 -10.6 -45.8 -48.2 -54.5 -54.2 -50.5 -50.7 -55.2 -48.7 -24.4 10.2 -43.5 -21.6 -24.4 -40.5 4.6 -4.5 4.6 -4.5 -10.8 -65.5 -9.1 -36.1 -15.9 -61.3 -16.7 -61.7 -0.7 -0.4 -2.9 -1 -4.8 -1.3 -24.6 -4 -21.7 -46.3 3.1 -46.5 2.3 0 2.8 -0.6 3.9 -4.8 0.7 -2.6 2.1 -7.9 3.1 -11.7 1.7 -6.4 11 -44.1 12.9 -52.5 0.4 -1.9 3.5 -14.4 6.9 -27.8 7.2 -28.6 7.1 -27 2.5 -31.2 -20.2 -18.4 -2.2 -46.1 25.6 -39.5" />
                </svg>
                <span class="badge-text">OpenCampaigns</span>
              </div>
            <div class="image-container">
              <image-fallback 
                .src=${c.image} 
                .fallbackSrc=${c.image_fallback}
                .alt=${c.title}
              ></image-fallback>
            </div>
            <div class="content">
              <h3 class="title">${c.title}</h3>
              <p class="description">${c.description}</p>
              
              <div class="tags">
                ${c.tags?.map(t => html`<span class="tag">${t}</span>`) || ''}
              </div>
              
              <div class="publisher">
                Powered by ${c.publisherName}
              </div>
 
              <a href="#" 
                 class="cta-button" 
                 @click=${(e: Event) => this.handleCampaignClick(e, c)}>
                View ${c.type === 'offer' ? 'Offer' : 'Product'}
              </a>
            </div>
          </div>
        `)}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'open-campaign': OpenCampaign;
  }
}
