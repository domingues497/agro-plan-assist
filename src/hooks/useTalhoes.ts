import { useQuery } from "@tanstack/react-query";

export type Talhao = {
  id: string;
  fazenda_id: string;
  nome: string;
  area: number;
  arrendado: boolean;
  safras_todas?: boolean;
  allowed_safras?: string[];
  kml_name?: string | null;
  kml_uploaded_at?: string | null;
  geojson?: any;
  centroid_lat?: number | null;
  centroid_lng?: number | null;
  bbox_min_lat?: number | null;
  bbox_min_lng?: number | null;
  bbox_max_lat?: number | null;
  bbox_max_lng?: number | null;
  created_at: string;
  updated_at: string;
  tem_programacao?: boolean;
  conflito_programacao?: {
    id: string;
    epoca_id: string;
    epoca_nome: string;
  } | null;
  /** @deprecated use conflito_programacao instead */
  tem_programacao_safra?: boolean;
};

export const useTalhoes = (fazendaId?: string, safraId?: string, epocaId?: string) => {
  return useQuery({
    queryKey: ["talhoes", fazendaId, safraId, epocaId],
    queryFn: async () => {
      // Se não houver fazendaId, retornar array vazio ao invés de buscar todos
      if (!fazendaId) {
        return [] as Talhao[];
      }
      const { getApiBaseUrl } = await import("@/lib/utils");
      const baseUrl = getApiBaseUrl();
      const params = new URLSearchParams({ fazenda_id: String(fazendaId) });
      if (safraId) params.set("safra_id", String(safraId));
      if (epocaId) params.set("epoca_id", String(epocaId));
      const token = typeof localStorage !== "undefined" ? localStorage.getItem("auth_token") : null;
      const res = await fetch(`${baseUrl}/talhoes?${params.toString()}` , { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt);
      }
  const json = await res.json();
  const items = (json?.items || []) as any[];
  items.forEach((t) => {
    t.id = String(t.id);
    t.fazenda_id = String(t.fazenda_id);
    if (typeof t.geojson === "string" && t.geojson) {
      try { t.geojson = JSON.parse(t.geojson); } catch {}
    }
  });
  return items as Talhao[];
    },
    enabled: !!fazendaId,
  });
};

export const useTalhoesMultiFazendas = (fazendaIds?: string[]) => {
  return useQuery({
    queryKey: ["talhoes-multi", fazendaIds],
    queryFn: async () => {
      if (!fazendaIds || fazendaIds.length === 0) return [];
      const { getApiBaseUrl } = await import("@/lib/utils");
      const baseUrl = getApiBaseUrl();
      const token = typeof localStorage !== "undefined" ? localStorage.getItem("auth_token") : null;
      const res = await fetch(`${baseUrl}/talhoes?ids=${encodeURIComponent(fazendaIds.join(","))}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt);
      }
      const json = await res.json();
      return (json?.items || []) as Talhao[];
    },
    enabled: !!fazendaIds && fazendaIds.length > 0,
  });
};
