import { useQuery } from "@tanstack/react-query";

export type Talhao = {
  id: string;
  fazenda_id: string;
  nome: string;
  area: number;
  arrendado: boolean;
  created_at: string;
  updated_at: string;
  tem_programacao?: boolean;
};

export const useTalhoes = (fazendaId?: string) => {
  return useQuery({
    queryKey: ["talhoes", fazendaId],
    queryFn: async () => {
      // Se não houver fazendaId, retornar array vazio ao invés de buscar todos
      if (!fazendaId) {
        return [] as Talhao[];
      }
      const { getApiBaseUrl } = await import("@/lib/utils");
      const baseUrl = getApiBaseUrl();
      const res = await fetch(`${baseUrl}/talhoes?fazenda_id=${encodeURIComponent(fazendaId)}`);
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt);
      }
      const json = await res.json();
      return (json?.items || []) as Talhao[];
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
      const res = await fetch(`${baseUrl}/talhoes?ids=${encodeURIComponent(fazendaIds.join(","))}`);
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
