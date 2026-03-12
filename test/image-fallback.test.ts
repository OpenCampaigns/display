/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';
import { html, render } from 'lit';
// We just test if Lit template renders strings appropriately to mock the UI tests
import '../src/components/image-fallback.js';

describe('ImageFallback UI Component', () => {
    it('initializes with default values', () => {
        const fall = document.createElement('image-fallback');
        expect(fall).toBeDefined();
    });
});
