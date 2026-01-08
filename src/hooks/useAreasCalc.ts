import { useQuery } from "@tanstack/react-query";
import { getApiBaseUrl } from "@/lib/utils";
import type { AplicacaoDefensivo } from "./useAplicacoesDefensivos";

export function useAreasCalc(
  aplicacoes: AplicacaoDefensivo[],
  programacoes: any[],
  fazendasAll: any[]
) {
  return useQuery({
    queryKey: ["areas-calc", aplicacoes.length, programacoes.length, fazendasAll.length],
    queryFn: async () => {
      const base = getApiBaseUrl();
      const token = typeof sessionStorage !== "undefined" ? sessionStorage.getItem("auth_token") : null;
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const updates: Record<string, number> = {};

      // Evita chamadas desnecessárias se não houver dados
      if (aplicacoes.length === 0 || programacoes.length === 0) return {};

      // Agrupa chamadas para evitar muitas requisições sequenciais
      const promises = aplicacoes.map(async (ap) => {
        const defs = (ap.defensivos || []) as any[];
        const safraId = (() => {
          const d = defs.find((it: any) => it && it.safra_id);
          return String(d?.safra_id || "").trim();
        })();

        const key = `${String(ap.produtor_numerocm)}|${String(ap.area)}|${safraId}`;
        
        // Se não tiver safra, pula
        if (!safraId) return null;

        const progs = programacoes.filter((p: any) => {
          const sameProd = String(p.produtor_numerocm) === String(ap.produtor_numerocm);
          const sameArea = String(p.area) === String(ap.area);
          const safraOk = String(p.safra_id || "") === safraId;
          return sameProd && sameArea && safraOk;
        });

        if (!progs || progs.length === 0) return null;

        const talhaoSet = new Set<string>();
        
        // Busca talhões de cada programação (idealmente o backend deveria fornecer isso agregado, mas mantendo a lógica atual)
        for (const prog of progs) {
          try {
            const res = await fetch(`${base}/programacoes/${prog.id}/children`, { headers });
            if (!res.ok) continue;
            const children = await res.json();
            const talhoes: string[] = (children?.talhoes || []).filter((t: any) => !!t);
            talhoes.forEach((t) => talhaoSet.add(String(t)));
          } catch {}
        }

        if (talhaoSet.size === 0) return null;

        const fazendaObj = fazendasAll.find((f: any) => String(f.nomefazenda) === String(ap.area) && String(f.numerocm) === String(ap.produtor_numerocm));
        const fazendaUuid = fazendaObj?.id ? String(fazendaObj.id) : "";
        
        const params = new URLSearchParams();
        if (fazendaUuid) params.set("fazenda_id", fazendaUuid);
        if (safraId) params.set("safra_id", safraId);

        try {
          const r2 = await fetch(`${base}/talhoes?${params.toString()}`, { headers });
          if (!r2.ok) return null;
          const j2 = await r2.json();
          const items = ((j2?.items || []) as any[]).filter((t: any) => talhaoSet.has(String(t.id)));
          const sum = items.reduce((acc, t: any) => acc + (Number(t.area || 0) || 0), 0);
          
          if (sum > 0) return { key, sum };
        } catch {}
        return null;
      });

      const results = await Promise.all(promises);
      
      results.forEach(res => {
        if (res) {
          updates[res.key] = res.sum;
        }
      });

      return updates;
    },
    enabled: aplicacoes.length > 0 && programacoes.length > 0,
    staleTime: 5 * 60 * 1000, // Pode cachear por 5 minutos pois área não muda com frequência
  });
}
