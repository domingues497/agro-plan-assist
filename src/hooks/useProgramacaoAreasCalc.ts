import { useQuery } from "@tanstack/react-query";
import { getApiBaseUrl } from "@/lib/utils";

export function useProgramacaoAreasCalc(
  programacoes: any[],
  fazendas: any[]
) {
  return useQuery({
    queryKey: ["programacao-areas-calc", programacoes.length, fazendas.length],
    queryFn: async () => {
      const base = getApiBaseUrl();
      const token = typeof sessionStorage !== "undefined" ? sessionStorage.getItem("auth_token") : null;
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      
      const updates: Record<string, number> = {};
      const countUpdates: Record<string, number> = {};

      if (programacoes.length === 0) return { updates: {}, countUpdates: {} };

      const promises = programacoes.map(async (p) => {
        try {
          const res = await fetch(`${base}/programacoes/${p.id}/children`, { headers });
          if (!res.ok) {
            return { id: p.id, count: 0, area: 0 };
          }
          const children = await res.json();
          const talhoes: string[] = (children?.talhoes || []).filter((t: any) => !!t);
          
          const count = talhoes.length;
          
          if (count === 0) {
            return { id: p.id, count: 0, area: 0 };
          }

          const fazendaObj = fazendas.find((f: any) => f.idfazenda === p.fazenda_idfazenda && f.numerocm === p.produtor_numerocm);
          const fazendaUuid = fazendaObj?.id ? String(fazendaObj.id) : "";
          const params = new URLSearchParams();
          if (fazendaUuid) params.set("fazenda_id", fazendaUuid);
          if (p.safra_id) params.set("safra_id", String(p.safra_id));
          
          const r2 = await fetch(`${base}/talhoes?${params.toString()}`, { headers });
          if (!r2.ok) {
            return { id: p.id, count, area: 0 };
          }
          const j2 = await r2.json();
          const items = ((j2?.items || []) as any[]).filter((t: any) => talhoes.includes(String(t.id)));
          const sum = items.reduce((acc, t: any) => acc + (Number(t.area || 0) || 0), 0);
          
          return { id: p.id, count, area: sum };
        } catch {
          return null;
        }
      });

      const results = await Promise.all(promises);

      results.forEach(res => {
        if (res) {
          updates[res.id] = res.area;
          countUpdates[res.id] = res.count;
        }
      });

      return { updates, countUpdates };
    },
    enabled: programacoes.length > 0,
    staleTime: 5 * 60 * 1000,
  });
}
