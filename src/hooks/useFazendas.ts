import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

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
      const { data: auth } = await supabase.auth.getUser();
      const user = auth?.user;
      if (!user) throw new Error("Usuário não autenticado");

      // Busca role do usuário
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

      let url = `${baseUrl}/fazendas`;
      if (produtorNumerocm) {
        url = `${baseUrl}/fazendas?numerocm=${encodeURIComponent(produtorNumerocm)}`;
      } else if (!isAdmin && !isGestor) {
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
        if (cmConsultor) url = `${baseUrl}/fazendas?numerocm_consultor=${encodeURIComponent(cmConsultor)}`;
      }

      const res = await fetch(url);
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
      const envUrl = (import.meta as any).env?.VITE_API_URL;
      const host = typeof window !== "undefined" ? window.location.hostname : "127.0.0.1";
      const baseUrl = envUrl || `http://${host}:5000`;
      let url = `${baseUrl}/fazendas`;
      if (produtoresNumerocm && produtoresNumerocm.length > 0) {
        // sem endpoint IN; obter tudo e filtrar client-side se necessário
        url = `${baseUrl}/fazendas`;
      }
      const res = await fetch(url);
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
