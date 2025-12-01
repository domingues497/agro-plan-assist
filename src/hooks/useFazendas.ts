import { useQuery } from "@tanstack/react-query";

export type Fazenda = {
  id: string;
  numerocm: string;
  idfazenda: string;
  nomefazenda: string;
  numerocm_consultor: string;
  area_cultivavel: number | null;
  created_at: string | null;
  updated_at: string | null;
};

export const useFazendas = (produtorNumerocm?: string) => {
  const { data, isLoading, error } = useQuery({
    queryKey: ["fazendas", produtorNumerocm || "by-consultor"],
    queryFn: async () => {
      const { getApiBaseUrl } = await import("@/lib/utils");
      const baseUrl = getApiBaseUrl();
      const token = localStorage.getItem("auth_token") || "";

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

      let url = `${baseUrl}/fazendas`;
      if (produtorNumerocm) {
        url = `${baseUrl}/fazendas?numerocm=${encodeURIComponent(produtorNumerocm)}`;
      } else if (!isAdmin && !isGestor) {
        // Consultor: obter numerocm_consultor via /auth/me
        const meRes = await fetch(`${baseUrl}/auth/me`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
        if (!meRes.ok) {
          const txt = await meRes.text();
          throw new Error(txt || "Falha ao obter perfil");
        }
        const meJson = await meRes.json();
        const cmConsultor = meJson?.user?.numerocm_consultor as string | undefined;
        if (cmConsultor) url = `${baseUrl}/fazendas?numerocm_consultor=${encodeURIComponent(cmConsultor)}`;
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
      const token = localStorage.getItem("auth_token") || "";
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
