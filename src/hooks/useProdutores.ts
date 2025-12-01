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
      if (!isAdmin && !isGestor) {
        let cmConsultor: string | undefined;
        let email: string | undefined;
        const meRes = await fetch(`${baseUrl}/auth/me`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
        if (meRes.ok) {
          const meJson = await meRes.json();
          cmConsultor = meJson?.user?.numerocm_consultor as string | undefined;
          email = (meJson?.user?.email || "") as string;
        }
        if (!cmConsultor && email) {
          const byEmailRes = await fetch(`${baseUrl}/consultores/by_email?email=${encodeURIComponent(String(email).toLowerCase())}`);
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
      return (json?.items || []) as Produtor[];
    },
  });

  return { data: data ?? [], isLoading, error };
};
