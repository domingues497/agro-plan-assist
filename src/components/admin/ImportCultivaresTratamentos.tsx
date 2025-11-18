import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Trash2, Plus } from "lucide-react";
import { useCultivaresCatalog } from "@/hooks/useCultivaresCatalog";
import { useTratamentosSementes } from "@/hooks/useTratamentosSementes";

export const ImportCultivaresTratamentos = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [cultivarCodItem, setCultivarCodItem] = useState("");
  const [tratamentoId, setTratamentoId] = useState("");
  
  const { data: cultivares } = useCultivaresCatalog();
  const { data: tratamentos } = useTratamentosSementes();

  const { data: vinculosExistentes = [] } = useQuery({
    queryKey: ["cultivares-tratamentos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cultivares_tratamentos")
        .select(`
          id,
          cultivar_cod_item,
          tratamento_id,
          cultivares_catalog!inner(cultivar, cultura),
          tratamentos_sementes!inner(nome)
        `)
        .order("cultivares_catalog(cultivar)", { ascending: true });
      
      if (error) throw error;
      return data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("cultivares_tratamentos")
        .insert({ 
          cultivar_cod_item: cultivarCodItem, 
          tratamento_id: tratamentoId 
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cultivares-tratamentos"] });
      toast({ title: "Vínculo criado com sucesso!" });
      setCultivarCodItem("");
      setTratamentoId("");
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao criar vínculo",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("cultivares_tratamentos")
        .delete()
        .eq("id", id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cultivares-tratamentos"] });
      toast({ title: "Vínculo excluído com sucesso!" });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao excluir vínculo",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cultivarCodItem || !tratamentoId) {
      toast({
        title: "Erro",
        description: "Selecione o cultivar e o tratamento",
        variant: "destructive",
      });
      return;
    }
    createMutation.mutate();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Vincular Tratamentos aos Cultivares</CardTitle>
        <CardDescription>
          Configure quais tratamentos estão disponíveis para cada cultivar
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Cultivar</label>
              <Select value={cultivarCodItem} onValueChange={setCultivarCodItem}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {cultivares?.map((c) => (
                    <SelectItem key={c.cod_item} value={c.cod_item}>
                      {c.cultivar} ({c.cultura})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Tratamento</label>
              <Select value={tratamentoId} onValueChange={setTratamentoId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {tratamentos?.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.nome} - {t.cultura}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex items-end">
              <Button type="submit" className="w-full" disabled={createMutation.isPending}>
                <Plus className="h-4 w-4 mr-2" />
                Vincular
              </Button>
            </div>
          </div>
        </form>

        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cultivar</TableHead>
                <TableHead>Cultura</TableHead>
                <TableHead>Tratamento</TableHead>
                <TableHead className="w-[100px]">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {vinculosExistentes.map((v: any) => (
                <TableRow key={v.id}>
                  <TableCell>{v.cultivares_catalog.cultivar}</TableCell>
                  <TableCell>{v.cultivares_catalog.cultura}</TableCell>
                  <TableCell>{v.tratamentos_sementes.nome}</TableCell>
                  <TableCell>
                    <Button
                      variant="destructive"
                      size="icon"
                      onClick={() => deleteMutation.mutate(v.id)}
                      disabled={deleteMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};
