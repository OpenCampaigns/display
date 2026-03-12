import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { resolveAssetUri, validateMediaConstraints } from '@opencampaigns/sdk';

/**
 * Task 2.5: Image Fallback Component
 * Handles HTTPS -> IPFS failover automatically with a shimmer/placeholder effect.
 */
@customElement('image-fallback')
export class ImageFallback extends LitElement {
    static styles = css`
    :host {
      display: block;
      position: relative;
      overflow: hidden;
      width: 100%;
      height: 100%;
      background: #f0f0f0;
    }

    .shimmer {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: linear-gradient(to right, #f6f7f8 4%, #edeef1 25%, #f6f7f8 36%);
      background-size: 1000px 100%;
      animation: placeholderShimmer 2s linear infinite forwards;
    }

    @keyframes placeholderShimmer {
      0% { background-position: -1000px 0; }
      100% { background-position: 1000px 0; }
    }

    img {
      display: block;
      width: 100%;
      height: 100%;
      object-fit: contain;
      opacity: 0;
      transition: opacity 0.3s ease-in-out;
    }

    img.loaded {
      opacity: 1;
    }
  `;

    @property({ type: String }) src?: string;
    @property({ type: String }) fallbackSrc?: string;
    @property({ type: String }) alt: string = 'Campaign Image';

    @state() private _currentSrc?: string;
    @state() private _loaded = false;
    @state() private _error = false;

    connectedCallback() {
        super.connectedCallback();
        this._initImageLoad();
    }

    private async _initImageLoad() {
        this._loaded = false;
        this._error = false;

        // Priority 1: Try the fallback HTTPS link first (faster, CDN)
        if (this.fallbackSrc) {
            const isValid = await this._tryLoad(this.fallbackSrc);
            if (isValid) return;
        }

        // Priority 2: If fallback fails or isn't provided, try the primary IPFS CID
        if (this.src) {
            const resolvedIpfsUrl = resolveAssetUri(this.src);
            const isValid = await this._tryLoad(resolvedIpfsUrl);
            if (isValid) return;
        }

        // If both fail
        this._error = true;
    }

    private _tryLoad(url: string): Promise<boolean> {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                this._currentSrc = url;
                this._loaded = true;
                resolve(true);
            };
            img.onerror = () => {
                resolve(false);
            };
            img.src = url;
        });
    }

    render() {
        if (this._error) {
            return html`
        <div class="error-container" style="display: flex; align-items: center; justify-content: center; height: 100%; color: #888;">
          <span>Image unavailable</span>
        </div>
      `;
        }

        return html`
      ${!this._loaded ? html`<div class="shimmer"></div>` : ''}
      ${this._currentSrc ? html`
        <img 
          src=${this._currentSrc} 
          alt=${this.alt}
          loading="lazy"
          class=${this._loaded ? 'loaded' : ''}
        />
      ` : ''}
    `;
    }
}

declare global {
    interface HTMLElementTagNameMap {
        'image-fallback': ImageFallback;
    }
}
