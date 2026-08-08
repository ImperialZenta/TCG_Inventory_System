import type { ImportedOrderDTO } from "@/lib/orders/types";
import { normalizeOrderFromApi } from "@/lib/manapool/normalize-order";

export interface ManaPoolClientConfig {
  email: string;
  token: string;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
}

export class ManaPoolApiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "ManaPoolApiError";
  }
}

const DEFAULT_BASE_URL = "https://manapool.com/api/v1";
const REQUEST_TIMEOUT_MS = 15_000;

export function getManaPoolConfigFromEnv(): ManaPoolClientConfig | null {
  const email = process.env.MANAPOOL_EMAIL?.trim();
  const token = process.env.MANAPOOL_API_TOKEN?.trim();
  if (!email || !token) return null;
  return {
    email,
    token,
    baseUrl: process.env.MANAPOOL_API_BASE_URL?.trim() || DEFAULT_BASE_URL,
  };
}

export function createManaPoolClient(config: ManaPoolClientConfig) {
  const baseUrl = (config.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, "");
  const fetchImpl = config.fetchImpl ?? fetch;

  async function request<T>(path: string, init?: RequestInit): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const res = await fetchImpl(`${baseUrl}${path}`, {
        ...init,
        signal: controller.signal,
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "X-ManaPool-Email": config.email,
          Authorization: `Bearer ${config.token}`,
          ...(init?.headers ?? {}),
        },
      });

      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new ManaPoolApiError(
          body ? `Mana Pool API error: ${body}` : `Mana Pool API error (${res.status})`,
          res.status,
        );
      }

      return (await res.json()) as T;
    } catch (error) {
      if (error instanceof ManaPoolApiError) throw error;
      if (error instanceof Error && error.name === "AbortError") {
        throw new ManaPoolApiError("Mana Pool API request timed out");
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  return {
    async listSellOrders(limit = 50, offset = 0): Promise<ImportedOrderDTO[]> {
      const data = await request<{ orders?: unknown[]; data?: unknown[] }>(
        `/seller/orders?limit=${limit}&offset=${offset}`,
      );
      const rows = data.orders ?? data.data ?? [];
      return rows.map((row) => normalizeOrderFromApi(row));
    },

    async getSellOrderById(id: string): Promise<ImportedOrderDTO> {
      const data = await request<{ order?: unknown } | unknown>(`/seller/orders/${id}`);
      if (data && typeof data === "object" && "order" in data) {
        return normalizeOrderFromApi((data as { order: unknown }).order);
      }
      return normalizeOrderFromApi(data);
    },
  };
}

export type ManaPoolClient = ReturnType<typeof createManaPoolClient>;

export function getManaPoolClient(): ManaPoolClient | null {
  const config = getManaPoolConfigFromEnv();
  if (!config) return null;
  return createManaPoolClient(config);
}
