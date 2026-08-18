// Shared HTTP helpers for external data sources. One place to own timeouts and
// error semantics so every source client (and tool) behaves consistently.

export async function fetchWithTimeout(url: string, opts: RequestInit = {}, ms = 15000): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...opts, signal: ctrl.signal, cache: "no-store" });
  } finally {
    clearTimeout(timer);
  }
}

export async function getJson<T>(url: string, ms = 15000): Promise<T> {
  const res = await fetchWithTimeout(url, { headers: { accept: "application/json" } }, ms);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return (await res.json()) as T;
}
