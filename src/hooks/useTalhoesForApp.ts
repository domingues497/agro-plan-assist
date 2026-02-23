import { useQuery } from "@tanstack/react-query";
import { getApiBaseUrl } from "@/lib/utils";
import { Fazenda } from "./useFazendas";

export type TalhaoOption = {
  id: string;
  nome: string;
  area: number;
};

export function useTalhoesForApp(
  produtorNumerocm: string,
  area: string,
  safraId: string,
  fazendas: Fazenda[] = []
) {
  return useQuery({
    queryKey: ["talhoes-for-app", produtorNumerocm, area, safraId],
    queryFn: async () => {
      const base = getApiBaseUrl();
      const token = sessionStorage.getItem("auth_token");
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      if (!produtorNumerocm || !area || !safraId) {
        return { options: [] as TalhaoOption[], fallbackArea: 0, fromFazenda: false };
      }

      const fazendaUuid = (() => {
        const target = String(area || "").trim().toUpperCase();
        const f = fazendas.find((fz) => String(fz.nomefazenda || "").trim().toUpperCase() === target);
        return f?.id ? String(f.id) : "";
      })();

      // 1. Buscar programações com filtro
      const params = new URLSearchParams();
      if (safraId) params.set("safra_id", safraId);
      // Note: area (nomefazenda) is not directly supported by list_programacoes without fazenda_id
      // But we can filter client-side for area if needed, or if we had fazenda_id
      
      const res = await fetch(`${base}/programacoes?${params.toString()}&limit=1000`, { headers });
      if (!res.ok) throw new Error("Falha ao buscar programações");
      const j = await res.json();
      const items = (j?.items || []) as any[];
      
      const progs = items.filter((p: any) => {
        // Produtor and Safra are already filtered by backend, but double check doesn't hurt
        const sameProd = String(p.produtor_numerocm || "").trim() === String(produtorNumerocm || "").trim();
        const sameArea = String(p.area || "").trim().toUpperCase() === String(area || "").trim().toUpperCase();
        const sameFazenda = fazendaUuid ? String(p.fazenda_uuid || "").trim() === String(fazendaUuid).trim() : true;
        const safraOk = String(p.safra_id || "").trim() === String(safraId || "").trim();
        return sameProd && sameArea && sameFazenda && safraOk;
      });

      // Helper para fallback da fazenda
      const getFazendaFallback = () => {
        const fazenda = fazendas.find((f) => String(f.nomefazenda) === String(area));
        return {
          options: [] as TalhaoOption[],
          fallbackArea: Number(fazenda?.area_cultivavel || 0),
          fromFazenda: true
        };
      };

      if (!progs || progs.length === 0) {
        // Fallback: tentar carregar talhões pela fazenda diretamente na safra
        if (fazendaUuid) {
          const paramsTalhao = new URLSearchParams();
          paramsTalhao.set("fazenda_id", fazendaUuid);
          paramsTalhao.set("safra_id", String(safraId));
          const r = await fetch(`${base}/talhoes?${paramsTalhao.toString()}`, { headers });
          if (r.ok) {
            const j2 = await r.json();
            const items2 = (j2?.items || []) as any[];
            const options = items2.map((t: any) => ({
              id: String(t.id),
              nome: String(t.nome || "Talhão"),
              area: Number(t.area || 0) || 0
            }));
            if (options.length > 0) {
              return { options, fallbackArea: 0, fromFazenda: true };
            }
          }
        }
        return getFazendaFallback();
      }

      // 2. Buscar talhões de cada programação
      const talhaoSet = new Set<string>();
      for (const prog of progs) {
        const rc = await fetch(`${base}/programacoes/${prog.id}/children`, { headers });
        if (!rc.ok) continue;
        const children = await rc.json();
        const talhoesRaw = (children?.talhoes || []) as any[];
        for (const t of talhoesRaw) {
          const id = typeof t === "string" ? t : t?.id;
          if (id) talhaoSet.add(String(id));
        }
      }

      if (talhaoSet.size === 0) {
        // fallback por fazenda/safra
        if (fazendaUuid) {
          const paramsTalhao = new URLSearchParams();
          paramsTalhao.set("fazenda_id", fazendaUuid);
          paramsTalhao.set("safra_id", String(safraId));
          const r = await fetch(`${base}/talhoes?${paramsTalhao.toString()}`, { headers });
          if (r.ok) {
            const j2 = await r.json();
            const items2 = (j2?.items || []) as any[];
            const options = items2.map((t: any) => ({
              id: String(t.id),
              nome: String(t.nome || "Talhão"),
              area: Number(t.area || 0) || 0
            }));
            if (options.length > 0) {
              return { options, fallbackArea: 0, fromFazenda: true };
            }
          }
        }
        return getFazendaFallback();
      }

      // 3. Buscar detalhes dos talhões
      const talhoesParams = new URLSearchParams();
      talhoesParams.set("ids", Array.from(talhaoSet).join(","));
      if (safraId) talhoesParams.set("safra_id", String(safraId));
      
      const r2 = await fetch(`${base}/talhoes?${talhoesParams.toString()}`, { headers });
      if (!r2.ok) throw new Error("Falha ao buscar detalhes dos talhões");
      
      const j2 = await r2.json();
      const items2 = (j2?.items || []) as any[];
      
      const options = items2.map((t: any) => ({
        id: String(t.id),
        nome: String(t.nome || "Talhão"),
        area: Number(t.area || 0) || 0
      }));

      if (options.length === 0) {
        // fallback por fazenda/safra se não retornou pelos ids
        if (fazendaUuid) {
          const paramsTalhao = new URLSearchParams();
          paramsTalhao.set("fazenda_id", fazendaUuid);
          paramsTalhao.set("safra_id", String(safraId));
          const r = await fetch(`${base}/talhoes?${paramsTalhao.toString()}`, { headers });
          if (r.ok) {
            const j3 = await r.json();
            const items3 = (j3?.items || []) as any[];
            const opts3 = items3.map((t: any) => ({
              id: String(t.id),
              nome: String(t.nome || "Talhão"),
              area: Number(t.area || 0) || 0
            }));
            if (opts3.length > 0) {
              return { options: opts3, fallbackArea: 0, fromFazenda: true };
            }
          }
        }
        return getFazendaFallback();
      }

      return { options, fallbackArea: 0, fromFazenda: false };
    },
    enabled: !!produtorNumerocm && !!area && !!safraId,
    staleTime: 1000 * 60 * 5, // 5 minutos
  });
}
