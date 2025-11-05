import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type Safra = {
  id: string;
  nome: string;
  is_default: boolean;
  ativa: boolean;
  ano_inicio: number | null;
  ano_fim: number | null;
  created_at: string;
  updated_at: string;
};

export type CreateSafra = Omit<Safra, "id" | "created_at" | "updated_at">;

export const useSafras = () => {
  const queryClient = useQueryClient();

  const { data: safras, isLoading, error } = useQuery({
    queryKey: ["safras"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("safras")
        .select("*")
        .order("nome", { ascending: false });

      if (error) throw error;
      return data as Safra[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (safra: CreateSafra) => {
      // Se marcar como padrão, desmarcar outras
      if (safra.is_default) {
        await supabase
          .from("safras")
          .update({ is_default: false })
          .neq("id", "00000000-0000-0000-0000-000000000000");
      }

      const { data, error } = await supabase
        .from("safras")
        .insert(safra)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["safras"] });
      toast.success("Safra criada com sucesso");
    },
    onError: (error: Error) => {
      toast.error(`Erro ao criar safra: ${error.message}`);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Safra> & { id: string }) => {
      // Se marcar como padrão, desmarcar outras
      if (updates.is_default) {
        await supabase
          .from("safras")
          .update({ is_default: false })
          .neq("id", id);
      }

      const { data, error } = await supabase
        .from("safras")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["safras"] });
      toast.success("Safra atualizada com sucesso");
    },
    onError: (error: Error) => {
      toast.error(`Erro ao atualizar safra: ${error.message}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("safras")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["safras"] });
      toast.success("Safra excluída com sucesso");
    },
    onError: (error: Error) => {
      toast.error(`Erro ao excluir safra: ${error.message}`);
    },
  });

  const defaultSafra = safras?.find((s) => s.is_default);

  return {
    safras: safras ?? [],
    isLoading,
    error,
    create: createMutation.mutate,
    update: updateMutation.mutate,
    remove: deleteMutation.mutate,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
    defaultSafra,
  };
};
