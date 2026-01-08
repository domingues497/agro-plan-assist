import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getApiBaseUrl } from "@/lib/utils";

export function useCultivaresCounts() {
  return useQuery({
    queryKey: ["cultivares-counts"],
    queryFn: async () => {
      const baseUrl = getApiBaseUrl();
      const res = await fetch(`${baseUrl}/cultivares_catalog`);
      if (!res.ok) {
        return {
            catalogTotal: 0,
            cultureCounts: {},
            catalogSemCultura: 0
        };
      }
      const json = await res.json();
      const items = (json?.items || []) as any[];
      const countsMap = new Map<string, number>();
      let nullCount = 0;
      for (const row of items) {
        const c = row.cultura as string | null;
        if (!c) { nullCount++; continue; }
        const key = c.toString().toUpperCase().trim();
        countsMap.set(key, (countsMap.get(key) || 0) + 1);
      }
      const sortedEntries = Array.from(countsMap.entries()).sort(([a], [b]) => a.localeCompare(b));
      return {
        catalogTotal: items.length,
        cultureCounts: Object.fromEntries(sortedEntries),
        catalogSemCultura: nullCount
      };
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

export function useImportCultivaresMutation() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ items, limparAntes, userId, fileName }: { items: any[], limparAntes: boolean, userId: string | undefined, fileName: string }) => {
      const baseUrl = getApiBaseUrl();
      const res = await fetch(`${baseUrl}/cultivares_catalog/bulk`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items, limparAntes, user_id: userId, arquivo_nome: fileName }),
      });
      
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || "Falha na importação");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cultivares-counts"] });
    }
  });
}

export function useCreateCultivarMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ item, userId }: { item: any, userId: string | undefined }) => {
        const baseUrl = getApiBaseUrl();
        const token = sessionStorage.getItem("auth_token");
        
        // Verificar duplicidade
        try {
            const listRes = await fetch(`${baseUrl}/cultivares_catalog`);
            if (listRes.ok) {
                const listJson = await listRes.json().catch(() => ({ items: [] }));
                const items = (listJson?.items || []) as any[];
                const exists = items.some((it) => {
                    const ci = String(it.cultivar || "").toUpperCase().trim();
                    const cu = (it.cultura == null ? null : String(it.cultura).toUpperCase().trim());
                    return ci === item.cultivar && cu === item.cultura;
                });
                if (exists) {
                    throw new Error("Essa combinação de cultivar e cultura já existe no catálogo");
                }
            }
        } catch (e) {
            if (e instanceof Error && e.message.includes("já existe")) {
                throw e;
            }
            // Ignore fetch errors for checking duplicates, proceed to try insert
        }

        const res = await fetch(`${baseUrl}/cultivares_catalog/bulk`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ items: [item], limparAntes: false, user_id: userId, arquivo_nome: null }),
        });

        if (!res.ok) {
            const txt = await res.text();
            throw new Error(txt);
        }
        return res.json();
    },
    onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["cultivares-counts"] });
    }
  });
}
