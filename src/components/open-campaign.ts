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

/**
 * Task 3.1: Develop Web Component <open-campaign> 
 * Task 3.2: Implement Discovery Logic
 * Task 3.3: Build Contextual Filtering by tags
 * Task 3.4: Implement Secure Redirects
 */
@customElement('open-campaign')
export class OpenCampaign extends LitElement {
    static styles = css`
    :host {
      display: block;
      font-family: system-ui, -apple-system, sans-serif;
    }
    
    .campaign-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 16px;
    }
    
    .campaign-card {
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      background: #fff;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
      transition: transform 0.2s, box-shadow 0.2s;
    }
    
    .campaign-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    }
    
    .image-container {
      height: 160px;
      width: 100%;
      background: #f8fafc;
    }
    
    .content {
      padding: 12px 16px;
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
  `;

    // Comma-separated list of relays
    @property({ type: String }) relays: string = 'wss://relay.damus.io';

    // Comma-separated list of tags to filter
    @property({ type: String }) tags: string = '';

    @state() private campaigns: ValidatedCampaign[] = [];
    private client?: NostrRelayClient;
    private processedPubkeys = new Set<string>();

    connectedCallback() {
        super.connectedCallback();
        this.startDiscovery();
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        if (this.client) {
            this.client.close();
        }
    }

    private startDiscovery() {
        const relayList = this.relays.split(',').map(r => r.trim()).filter(Boolean);
        if (relayList.length === 0) return;

        this.client = new NostrRelayClient(relayList);

        this.client.subscribeToCampaigns(this.handleNostrEvent.bind(this));
    }

    private async handleNostrEvent(event: any) {
        // Avoid double-processing the same publisher
        if (this.processedPubkeys.has(event.pubkey)) {
            return;
        }

        // Extract domain from tags: e.g. ["domain", "ergoseat.com"]
        const domainTag = event.tags?.find((t: string[]) => t[0] === 'domain');
        if (!domainTag || !domainTag[1]) return;

        const domain = domainTag[1];

        try {
            this.processedPubkeys.add(event.pubkey);

            // Task 3.2: Trigger SDK Validation
            const config = await fetchAndValidateIdentity(domain);

            // Check if event pubkey matches the config pubkey
            if (config.publisher.pubkey !== event.pubkey) {
                console.warn(`Mismatch pubkey for ${domain}: ${event.pubkey} != ${config.publisher.pubkey}`);
                return;
            }

            // Filter and add campaigns
            const validCampaigns = config.campaigns.filter(c => this.matchesTags(c.tags));

            const mappedCampaigns: ValidatedCampaign[] = validCampaigns.map(c => ({
                ...c,
                publisherDomain: domain,
                publisherName: config.publisher.name
            }));

            this.campaigns = [...this.campaigns, ...mappedCampaigns];

        } catch (err) {
            console.error(`Validating identity block failed for ${domain}:`, err);
        }
    }

    // Task 3.3: Contextual filtering
    private matchesTags(campaignTags?: string[]): boolean {
        if (!this.tags) return true; // Accept all if no tags specified
        if (!campaignTags || campaignTags.length === 0) return false;

        const targetTags = this.tags.split(',').map(t => t.trim().toLowerCase());
        const cTags = campaignTags.map(t => t.toLowerCase());

        return targetTags.some(t => cTags.includes(t));
    }

    // Task 3.4: Secure redirects using SDK tracking engine
    private handleCampaignClick(e: Event, campaign: ValidatedCampaign) {
        e.preventDefault();
        try {
            const finalUrl = constructTrackingUrl(campaign);
            window.open(finalUrl, '_blank', 'noopener,noreferrer');
        } catch (error) {
            console.error('Failed to resolve secure redirect URL', error);
            // Fallback
            window.open(campaign.url, '_blank', 'noopener,noreferrer');
        }
    }

    render() {
        if (this.campaigns.length === 0) {
            return html`
        <div style="padding: 20px; text-align: center; color: #888; border: 1px dashed #ccc; border-radius: 8px;">
          Listening for OpenCampaigns on Nostr...
        </div>
      `;
        }

        return html`
      <div class="campaign-grid">
        ${this.campaigns.map(c => html`
          <div class="campaign-card">
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
