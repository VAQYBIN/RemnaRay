import { describe, expect, it } from 'vitest';

import { deepLinkFor } from '../app/[locale]/open/[client]/open-client';

const subscription = 'https://sub.example/abc?x=1';
const fragment = `#${encodeURIComponent(subscription)}`;

describe('sub:clients bridge page', () => {
  it("builds the client's deep link from the fragment the bot sent", () => {
    expect(deepLinkFor('happ://add/{url}', fragment)).toBe(
      `happ://add/${encodeURIComponent(subscription)}`,
    );
    expect(deepLinkFor('clash://install-config?url={url}', fragment)).toBe(
      `clash://install-config?url=${encodeURIComponent(subscription)}`,
    );
  });

  it('opens nothing without an http(s) subscription link in the fragment', () => {
    expect(deepLinkFor('happ://add/{url}', '')).toBeNull();
    expect(deepLinkFor('happ://add/{url}', '#%E0%A4%A')).toBeNull();
    expect(
      deepLinkFor('happ://add/{url}', `#${encodeURIComponent('javascript:alert(1)')}`),
    ).toBeNull();
    expect(deepLinkFor('happ://add/{url}', '#not a url')).toBeNull();
  });

  it('never follows a template that would run in the page', () => {
    for (const template of ['javascript:alert({url})', 'data:text/html,{url}', 'no-scheme/{url}'])
      expect(deepLinkFor(template, fragment)).toBeNull();
  });
});
