import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

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
      const { data: auth } = await supabase.auth.getUser();
      const user = auth?.user;
      if (!user) throw new Error("Usuário não autenticado");

      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .maybeSingle();
      const userRole = roleData?.role;
      const isAdmin = userRole === "admin";
      const isGestor = userRole === "gestor";

      const envUrl = (import.meta as any).env?.VITE_API_URL;
      const host = typeof window !== "undefined" ? window.location.hostname : "127.0.0.1";
      const baseUrl = envUrl || `http://${host}:5000`;

      let url = `${baseUrl}/produtores`;
      if (!isAdmin && !isGestor) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("numerocm_consultor, email")
          .eq("user_id", user.id)
          .maybeSingle();
        let cmConsultor = profile?.numerocm_consultor as string | null | undefined;
        if (!cmConsultor && profile?.email) {
          const res = await fetch(`${baseUrl}/consultores/by_email?email=${encodeURIComponent(String(profile.email).toLowerCase())}`);
          if (res.ok) {
            const json = await res.json();
            cmConsultor = json?.item?.numerocm_consultor;
          }
        }
        if (cmConsultor) url = `${baseUrl}/produtores?numerocm_consultor=${encodeURIComponent(cmConsultor)}`;
      }

      const res = await fetch(url);
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
