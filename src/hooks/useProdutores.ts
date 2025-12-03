import { useQuery } from "@tanstack/react-query";

export type Produtor = {
  id: string;
  numerocm: string;
  nome: string;
  numerocm_consultor: string;
  consultor: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export const useProdutores = () => {
  const { data, isLoading, error } = useQuery({
    queryKey: ["produtores", "by-consultor"],
    queryFn: async () => {
      const { getApiBaseUrl } = await import("@/lib/utils");
      const baseUrl = getApiBaseUrl();

      const token = typeof localStorage !== "undefined" ? localStorage.getItem("auth_token") : null;

      let isAdmin = false;
      let isGestor = false;
      try {
        const roleRes = await fetch(`${baseUrl}/user_roles/me`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!roleRes.ok) {
          const txt = await roleRes.text();
          throw new Error(txt || "Falha ao obter role do usuário");
        }
        const roleJson = await roleRes.json();
        const userRole = String(roleJson?.role || "consultor").toLowerCase();
        isAdmin = userRole === "admin";
        isGestor = userRole === "gestor";
      } catch (e: any) {
        throw new Error(e?.message || "Falha ao verificar papel do usuário");
      }

      let url = `${baseUrl}/produtores`;
      let cmConsultor: string | undefined;
      let consultorNome: string | undefined;
      if (!isAdmin && !isGestor) {
        let email: string | undefined;
        const meRes = await fetch(`${baseUrl}/auth/me`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
        if (meRes.ok) {
          const meJson = await meRes.json();
          cmConsultor = meJson?.user?.numerocm_consultor as string | undefined;
          consultorNome = (meJson?.user?.nome || undefined) as string | undefined;
          email = (meJson?.user?.email || "") as string;
        }
        if (!cmConsultor && email) {
          const byEmailRes = await fetch(`${baseUrl}/consultores/by_email?email=${encodeURIComponent(String(email).toLowerCase())}`,
            { headers: token ? { Authorization: `Bearer ${token}` } : {} }
          );
          if (byEmailRes.ok) {
            const json = await byEmailRes.json();
            cmConsultor = json?.item?.numerocm_consultor as string | undefined;
          }
        }
        if (cmConsultor) url = `${baseUrl}/produtores?numerocm_consultor=${encodeURIComponent(cmConsultor)}`;
      }

      const res = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt);
      }
      const json = await res.json();
      let items = (json?.items || []) as Produtor[];

      // Fallback: se consultor estiver logado e não retornar nada, obter todos e filtrar client-side por numerocm_consultor (case-insensitive)
      if ((!isAdmin && !isGestor) && (!items || items.length === 0)) {
        const resAll = await fetch(`${baseUrl}/produtores`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
        if (resAll.ok) {
          const jsonAll = await resAll.json();
          const arr = (jsonAll?.items || []) as Produtor[];
          if (cmConsultor) {
            const cmLower = String(cmConsultor).toLowerCase();
            items = arr.filter((p) => String(p.numerocm_consultor || "").toLowerCase() === cmLower);
          } else if (consultorNome) {
            const nomeLower = String(consultorNome).toLowerCase();
            items = arr.filter((p) => String(p.consultor || "").toLowerCase() === nomeLower);
          } else {
            items = arr;
          }
        }
      }

      return items;
    },
  });

  return { data: data ?? [], isLoading, error };
};
