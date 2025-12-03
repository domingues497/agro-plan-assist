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

export const useFazendas = (produtorNumerocm?: string, safraId?: string) => {
  const { data, isLoading, error } = useQuery({
    queryKey: ["fazendas", produtorNumerocm || "by-consultor", safraId || "all-safras"],
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

      const params = new URLSearchParams();
      if (safraId) params.set("safra_id", String(safraId));
      let url = `${baseUrl}/fazendas${params.toString() ? `?${params.toString()}` : ""}`;
      if (produtorNumerocm) {
        const p2 = new URLSearchParams(params);
        p2.set("numerocm", String(produtorNumerocm));
        url = `${baseUrl}/fazendas?${p2.toString()}`;
      } else if (!isAdmin && !isGestor) {
        // Consultor: obter numerocm_consultor via /auth/me
        const meRes = await fetch(`${baseUrl}/auth/me`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
        if (!meRes.ok) {
          const txt = await meRes.text();
          throw new Error(txt || "Falha ao obter perfil");
        }
        const meJson = await meRes.json();
        const cmConsultor = meJson?.user?.numerocm_consultor as string | undefined;
        if (cmConsultor) {
          const p3 = new URLSearchParams(params);
          p3.set("numerocm_consultor", String(cmConsultor));
          url = `${baseUrl}/fazendas?${p3.toString()}`;
        }
        // Fallback: se retornar vazio, buscar todas e filtrar client-side por numerocm_consultor (case-insensitive)
        const resTest = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
        if (resTest.ok) {
          const j = await resTest.json();
          const items = (j?.items || []) as any[];
          if (!items || items.length === 0) {
            const resAll = await fetch(`${baseUrl}/fazendas`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
            if (resAll.ok) {
              const jsonAll = await resAll.json();
              const arr = (jsonAll?.items || []) as any[];
              const cmLower = String(cmConsultor || "").toLowerCase();
              const filteredByConsultor = arr.filter((f: any) => String(f.numerocm_consultor || "").toLowerCase() === cmLower);
              if (safraId) {
                // filtra client-side por safra usando talhoes endpoint
                try {
                  const ids = filteredByConsultor.map((f: any) => f.id);
                  const pTal = new URLSearchParams({ ids: ids.join(","), safra_id: String(safraId) });
                  const resTal = await fetch(`${baseUrl}/talhoes?${pTal.toString()}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
                  if (resTal.ok) {
                    const jt = await resTal.json();
                    const allowedFazendaIds = new Set(((jt?.items || []) as any[]).map((t: any) => t.fazenda_id));
                    return filteredByConsultor.filter((f: any) => allowedFazendaIds.has(f.id)) as Fazenda[];
                  }
                } catch {}
              }
              return filteredByConsultor as Fazenda[];
            }
          } else {
            return items as Fazenda[];
          }
        }
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
