// Test-environment polyfills: jsdom does not implement these browser APIs.
// Guarded so node-environment test files can share this setup file.

if (typeof window !== 'undefined') {
  class MockIntersectionObserver implements IntersectionObserver {
    readonly root: Element | null = null
    readonly rootMargin: string = ''
    readonly thresholds: ReadonlyArray<number> = []
    constructor(private callback: IntersectionObserverCallback) {}
    observe() {
      // Immediately report the element as intersecting so reveal animations complete.
      this.callback(
        [
          {
            isIntersecting: true,
            intersectionRatio: 1,
            target: document.body,
            time: 0,
            boundingClientRect: document.body.getBoundingClientRect(),
            intersectionRect: document.body.getBoundingClientRect(),
            rootBounds: null,
          },
        ],
        this as unknown as IntersectionObserver,
      )
    }
    unobserve() {}
    disconnect() {}
    takeRecords(): IntersectionObserverEntry[] {
      return []
    }
  }

  Object.defineProperty(window, 'IntersectionObserver', {
    writable: true,
    configurable: true,
    value: MockIntersectionObserver,
  })

  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  })
}
