import type { Variant } from '@ag/shared-types';
export function createClient(baseUrl: string, getHeaders: () => Record<string, string> = () => ({})) {
  async function req<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(baseUrl + path, { ...init, headers: { 'content-type': 'application/json', ...getHeaders(), ...(init?.headers ?? {}) } });
    if (!res.ok) throw new Error(`${res.status} ${path}`);
    return (await res.json()) as T;
  }
  return {
    listVariants: (category: string) => req<Variant[]>(`/commerce/catalog/variants?category=${encodeURIComponent(category)}`),
    currentCycle: (productClass: string) => req<{ cutoffAt: string }>(`/commerce/cycles/current?productClass=${productClass}`),
  };
}
