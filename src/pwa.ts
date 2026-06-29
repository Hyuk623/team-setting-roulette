export function registerServiceWorker(): void {
  if (!('serviceWorker' in navigator) || !import.meta.env.PROD) {
    return;
  }

  window.addEventListener('load', () => {
    const baseUrl = import.meta.env.BASE_URL;

    navigator.serviceWorker
      .register(`${baseUrl}sw.js`, { scope: baseUrl })
      .then(async (registration) => {
        await navigator.serviceWorker.ready;
        const urlsToCache = collectPageAssetUrls();
        registration.active?.postMessage({
          type: 'CACHE_URLS',
          urls: urlsToCache,
        });
      })
      .catch((error: unknown) => {
        console.warn('Service worker registration failed.', error);
      });
  });
}

function collectPageAssetUrls(): string[] {
  const assetUrls = Array.from(
    document.querySelectorAll<HTMLScriptElement | HTMLLinkElement>(
      'script[src], link[rel="stylesheet"][href], link[rel="manifest"][href], link[rel="icon"][href]',
    ),
  )
    .map((element) =>
      element instanceof HTMLScriptElement ? element.src : element.href,
    )
    .filter(Boolean);

  return Array.from(new Set([window.location.href, ...assetUrls]));
}

