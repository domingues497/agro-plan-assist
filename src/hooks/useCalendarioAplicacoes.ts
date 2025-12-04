import { useQuery } from "@tanstack/react-query";
import { getApiBaseUrl } from "@/lib/utils";
// Migração para API Flask

export type CalendarioAplicacao = {
  id?: string;
  cod_aplic?: string | number | null;
  descr_aplicacao?: string | null;
  cod_aplic_ger?: string | number | null;
  cod_classe?: string | number | null;
  descricao_classe?: string | null;
  trat_sementes?: string | null;
};

export const useCalendarioAplicacoes = () => {
  return useQuery({
    queryKey: ["calendario-aplicacoes"],
    queryFn: async () => {
      const baseUrl = getApiBaseUrl();
      const res = await fetch(`${baseUrl}/calendario_aplicacoes`);
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt);
      }
      const json = await res.json();
      const rows = (json?.items || []) as CalendarioAplicacao[];

      // Agrupa aplicações por descrição da classe
      const classes = Array.from(
        new Set(rows.map((r) => String(r.descricao_classe || "").trim()).filter(Boolean))
      );

      const aplicacoesPorClasse: Record<string, string[]> = {};
      for (const r of rows) {
        const cls = String(r.descricao_classe || "").trim();
        const ap = String(r.descr_aplicacao || "").trim();
        if (!cls || !ap) continue;
        if (!aplicacoesPorClasse[cls]) aplicacoesPorClasse[cls] = [];
        if (!aplicacoesPorClasse[cls].includes(ap)) aplicacoesPorClasse[cls].push(ap);
      }

      return { rows, classes, aplicacoesPorClasse };
    },
  });
};
