export interface CatalogTool {
  name: string;
  description: string;
}

export interface CatalogResponse {
  tools: CatalogTool[];
}

const CATALOG_CACHE_KEY = 'stellar_route_ai_catalog';
const CATALOG_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

interface CachedCatalog {
  data: CatalogResponse;
  timestamp: number;
}

function isAiAgentEnabled(): boolean {
  if (typeof window !== 'undefined') {
    const flags = (window as unknown as { __STELLAR_ROUTE_FLAGS__?: Record<string, boolean> })
      .__STELLAR_ROUTE_FLAGS__;
    if (flags?.ai_agent !== undefined) {
      return Boolean(flags.ai_agent);
    }
  }
  return process.env.NEXT_PUBLIC_AI_AGENT === 'true' || process.env.NEXT_PUBLIC_AI_AGENT === '1';
}

export async function fetchCatalog(): Promise<CatalogResponse | null> {
  if (!isAiAgentEnabled()) {
    return null;
  }

  // Check cache
  if (typeof window !== 'undefined') {
    try {
      const cached = localStorage.getItem(CATALOG_CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached) as CachedCatalog;
        if (Date.now() - parsed.timestamp < CATALOG_CACHE_TTL_MS) {
          return parsed.data;
        }
      }
    } catch (error) {
      console.error('Failed to load catalog from cache:', error);
    }
  }

  try {
    const response = await fetch('/api/v1/agent/catalog');
    if (response.status === 404) {
      return null;
    }
    if (!response.ok) {
      console.error('Failed to fetch catalog:', response.status);
      return null;
    }

    const data = (await response.json()) as CatalogResponse;

    // Cache the result
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(CATALOG_CACHE_KEY, JSON.stringify({ data, timestamp: Date.now() }));
      } catch (error) {
        console.error('Failed to cache catalog:', error);
      }
    }

    return data;
  } catch (error) {
    console.error('Failed to fetch catalog:', error);
    return null;
  }
}
