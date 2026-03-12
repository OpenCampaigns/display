# @opencampaigns/display

The UI/UX rendering layer for the OpenCampaigns decentralized ad network.

This package contains lightweight, encapsulated Web Components built with Lit. It is designed to be embedded on any third-party website securely and autonomously.

## Components

### `<open-campaign>`
The flagship component. Points to specific user intents (via the `tags` property), automatically connects to Nostr relays, discovers active campaigns matching the criteria, validates their digital signatures using `@opencampaigns/sdk`, and renders the visual banner grid securely.

### `<image-fallback>`
A resilient `<picture>`-like component that prioritizes incredibly fast HTTP CDN endpoints for ad banners, but gracefully falls back to decentralized IPFS URIs if the CDN drops or deletes the file, ensuring ads remain forever visible.

## License
MIT
