const NETWORK_URL_STORAGE_KEY = "guardian-angel-network-url";

/**
 * Get the shareable game URL
 * Uses network URL instead of localhost when available
 */
export function getShareableGameUrl(path: string): string {
  if (typeof window === "undefined") return "";

  const origin = window.location.origin;
  const hostname = window.location.hostname;
  const port = window.location.port;

  // Check if we're on localhost
  if (hostname === "localhost" || hostname === "127.0.0.1") {
    // Try to get network URL from environment variable first (bundled by Next.js)
    let networkUrl = process.env.NEXT_PUBLIC_NETWORK_URL;

    // Fallback: Check localStorage for manually set network URL
    if (!networkUrl) {
      networkUrl = localStorage.getItem(NETWORK_URL_STORAGE_KEY);
    }

    if (networkUrl) {
      // Ensure networkUrl doesn't already have the path
      const baseUrl = networkUrl.endsWith("/")
        ? networkUrl.slice(0, -1)
        : networkUrl;
      return `${baseUrl}${path}`;
    }

    // If no network URL is configured, return localhost
    // (This will work for same-device testing)
    return `${origin}${path}`;
  }

  // Not on localhost, use the origin as-is
  return `${origin}${path}`;
}

/**
 * Set the network URL manually (useful if env var isn't set)
 */
export function setNetworkUrl(url: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(NETWORK_URL_STORAGE_KEY, url);
}

/**
 * Get the current origin, preferring network URL over localhost
 */
export function getPreferredOrigin(): string {
  if (typeof window === "undefined") return "";

  const origin = window.location.origin;

  // If on localhost, try to use network URL
  if (origin.includes("localhost") || origin.includes("127.0.0.1")) {
    const networkUrl = process.env.NEXT_PUBLIC_NETWORK_URL;
    if (networkUrl) {
      // Extract just the origin from the network URL
      try {
        const url = new URL(networkUrl);
        return url.origin;
      } catch {
        return networkUrl;
      }
    }
  }

  return origin;
}
