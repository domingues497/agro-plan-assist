import { useQuery } from "@tanstack/react-query";

export type Fazenda = {
  id: string;
  numerocm: string;
  idfazenda: string;
  nomefazenda: string;
  numerocm_consultor: string;
  cadpro?: string;
  cod_imovel?: string;
  area_cultivavel: number | null;
  created_at: string | null;
  updated_at: string | null;
};

export const useFazendas = (produtorNumerocm?: string, safraId?: string) => {
  const { data, isLoading, error } = useQuery({
    queryKey: ["fazendas", produtorNumerocm || "by-consultor", safraId || "all-safras"],
    queryFn: async () => {
      const { getApiBaseUrl } = await import("@/lib/utils");
      const baseUrl = getApiBaseUrl();
      const token = sessionStorage.getItem("auth_token") || "";

      // Obtém role via API
      const roleRes = await fetch(`${baseUrl}/user_roles/me`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      if (!roleRes.ok) {
        const txt = await roleRes.text();
        throw new Error(txt || "Falha ao obter role do usuário");
      }
      const roleJson = await roleRes.json();
      const userRole = (roleJson?.role || "consultor").toLowerCase();
      const isAdmin = userRole === "admin";
      const isGestor = userRole === "gestor";

      const params = new URLSearchParams();
      if (safraId) params.set("safra_id", String(safraId));
      let url = `${baseUrl}/fazendas${params.toString() ? `?${params.toString()}` : ""}`;
      if (produtorNumerocm) {
        const p2 = new URLSearchParams(params);
        p2.set("numerocm", String(produtorNumerocm));
        url = `${baseUrl}/fazendas?${p2.toString()}`;
      }
      
      const res = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt);
      }
      const json = await res.json();
      const data = (json?.items || []) as any[];
      return data as Fazenda[];
    },
  });

  return { data: data ?? [], isLoading, error };
};

// Busca fazendas pertencentes a múltiplos produtores
export const useFazendasMulti = (produtoresNumerocm: string[] = []) => {
  const key = produtoresNumerocm.slice().sort().join(",");
  const { data, isLoading, error } = useQuery({
    queryKey: ["fazendas-multi", key],
    queryFn: async () => {
      const { getApiBaseUrl } = await import("@/lib/utils");
      const baseUrl = getApiBaseUrl();
      let url = `${baseUrl}/fazendas`;
      const token = sessionStorage.getItem("auth_token") || "";
      if (produtoresNumerocm && produtoresNumerocm.length > 0) {
        // sem endpoint IN; obter tudo e filtrar client-side se necessário
        url = `${baseUrl}/fazendas`;
      }
      const res = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt);
      }
      const json = await res.json();
      const data = (json?.items || []) as any[];
      return data as Fazenda[];
    },
  });

  return { data: data ?? [], isLoading, error };
};
