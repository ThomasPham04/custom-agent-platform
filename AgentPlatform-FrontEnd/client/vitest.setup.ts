import '@testing-library/jest-dom/vitest';

// jsdom implements no layout, so scrollIntoView is missing. MessageList calls it
// to keep the newest turn in view.
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}

// jsdom does not implement matchMedia, which useMediaQuery needs.
if (!window.matchMedia) {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList;
}

// jsdom does not implement ResizeObserver, which the walkthrough uses to keep
// the cutout aligned when a target resizes without a scroll or resize event.
if (!globalThis.ResizeObserver) {
  // Cast for the same reason the matchMedia stub above casts: a stub only has
  // to satisfy the calls this app makes, not the whole DOM interface.
  globalThis.ResizeObserver = class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as typeof ResizeObserver;
}
