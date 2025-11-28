import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export type Usuario = {
  id: string;
  email: string;
  nome: string | null;
  numerocm_consultor: string | null;
  ativo: boolean;
  role: string | null;
  created_at: string;
};

export const useUsuarios = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: usuarios, isLoading, error } = useQuery({
    queryKey: ["usuarios"],
    queryFn: async () => {
      // Buscar todos os usuários com seus perfis e roles
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });

      if (profilesError) throw profilesError;

      // Buscar roles de cada usuário
      const usuariosComRoles: Usuario[] = [];
      
      for (const profile of profiles || []) {
        const { data: roleData } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", profile.user_id)
          .maybeSingle();

        usuariosComRoles.push({
          id: profile.user_id,
          email: profile.user_id, // Será atualizado na próxima iteração
          nome: profile.nome,
          numerocm_consultor: profile.numerocm_consultor,
          ativo: profile.ativo,
          role: roleData?.role || null,
          created_at: profile.created_at || "",
        });
      }

      return usuariosComRoles;
    },
  });

  const updateUsuario = useMutation({
    mutationFn: async ({
      userId,
      updates,
    }: {
      userId: string;
      updates: {
        nome?: string;
        numerocm_consultor?: string;
        ativo?: boolean;
        role?: string;
      };
    }) => {
      // Atualizar profile
      const { nome, numerocm_consultor, ativo, role } = updates;
      
      if (nome !== undefined || numerocm_consultor !== undefined || ativo !== undefined) {
        const { error: profileError } = await supabase
          .from("profiles")
          .update({
            ...(nome !== undefined && { nome }),
            ...(numerocm_consultor !== undefined && { numerocm_consultor }),
            ...(ativo !== undefined && { ativo }),
          })
          .eq("user_id", userId);

        if (profileError) throw profileError;
      }

      // Atualizar role se fornecido
      if (role !== undefined) {
        // Primeiro, remover role existente
        await supabase.from("user_roles").delete().eq("user_id", userId);

        // Depois, adicionar nova role se não for vazio
        if (role) {
          const { error: roleError } = await supabase
            .from("user_roles")
            .insert([{ 
              user_id: userId, 
              role: role as "admin" | "user" 
            }]);

          if (roleError) throw roleError;
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["usuarios"] });
      toast({
        title: "Usuário atualizado",
        description: "As informações foram salvas com sucesso.",
      });
    },
    onError: (error) => {
      toast({
        title: "Erro ao atualizar usuário",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return {
    usuarios,
    isLoading,
    error,
    updateUsuario: updateUsuario.mutate,
    isUpdating: updateUsuario.isPending,
  };
};
