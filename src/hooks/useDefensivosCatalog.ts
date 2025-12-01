import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const useDefensivosCatalog = () => {
  return useQuery({
    queryKey: ["defensivos-catalog"],
    queryFn: async () => {
      const envUrl = (import.meta as any).env?.VITE_API_URL;
      const host = typeof window !== "undefined" ? window.location.hostname : "127.0.0.1";
      const baseUrl = envUrl || `http://${host}:5000`;
      let items: any[] = [];
      try {
        const res = await fetch(`${baseUrl}/defensivos`, { credentials: "omit" });
        if (!res.ok) throw new Error(`Erro ao carregar defensivos: ${res.status}`);
        const json = await res.json();
        items = (json?.items ?? []) as any[];
      } catch (_) {
        items = [];
      }

      if (items.length > 0) return items;

      try {
        const { data, error } = await supabase
          .from("defensivos_catalog")
          .select("cod_item, item, grupo, marca, principio_ativo, saldo")
          .order("item", { ascending: true });
        if (!error && Array.isArray(data) && data.length > 0) {
          return data as any[];
        }
      } catch (_) {}
      return items;
    },
  });
};
