import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useCultivaresCatalog } from "@/hooks/useCultivaresCatalog";
import { useTratamentosSementes } from "@/hooks/useTratamentosSementes";
import { useTratamentosPorCultivar } from "@/hooks/useTratamentosPorCultivar";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useBulkLinkCultivaresTratamentosMutation, useSetTratamentosForCultivarMutation } from "@/hooks/useCultivaresTratamentosMutations";

export const ImportCultivaresTratamentos = () => {
  const { data: cultivares } = useCultivaresCatalog();
  const { data: tratamentos } = useTratamentosSementes();
  const [selectedTratamento, setSelectedTratamento] = useState<string>("");
  const [selectedCultivares, setSelectedCultivares] = useState<string[]>([]);
  const [modo, setModo] = useState<"por_tratamento" | "por_cultivar">("por_tratamento");
  const [selectedCultivar, setSelectedCultivar] = useState<string>("");
  const { data: tratamentosDoCultivar = [] } = useTratamentosPorCultivar(selectedCultivar || undefined);
  
  const bulkLinkMutation = useBulkLinkCultivaresTratamentosMutation();
  const setTratamentosMutation = useSetTratamentosForCultivarMutation();
  
  const loading = bulkLinkMutation.isPending || setTratamentosMutation.isPending;

  // Sincroniza checkboxes ao selecionar cultivar
  // Atualiza apenas em modo por_cultivar
  if (modo === "por_cultivar" && selectedCultivar && selectedCultivares.length === 0 && tratamentosDoCultivar.length > 0) {
    const ids = tratamentosDoCultivar.map((t: any) => String(t.id));
    // Evita loops: só aplica quando ainda não há itens marcados
    setSelectedCultivares(ids);
  }

  const handleToggleCultivar = (cultivar: string) => {
    setSelectedCultivares(prev => 
      prev.includes(cultivar)
        ? prev.filter(c => c !== cultivar)
        : [...prev, cultivar]
    );
  };

  const handleSave = async () => {
    if (!selectedTratamento && modo === "por_tratamento") {
      toast.error("Selecione um tratamento");
      return;
    }

    if (selectedCultivares.length === 0 && modo === "por_tratamento") {
      toast.error("Selecione pelo menos um cultivar");
      return;
    }

    try {
      if (modo === "por_tratamento") {
        bulkLinkMutation.mutate({
          tratamentoId: selectedTratamento,
          cultivares: selectedCultivares
        }, {
          onSuccess: () => {
            toast.success("Cultivares vinculados ao tratamento com sucesso!");
            setSelectedTratamento("");
            setSelectedCultivares([]);
          },
          onError: (error) => {
             toast.error("Erro ao salvar vínculos");
          }
        });
      } else {
        if (!selectedCultivar) {
          toast.error("Selecione um cultivar");
          return;
        }
        const tratamentoIdsSelecionados = selectedCultivares; // reutiliza selectedCultivares como ids
        
        setTratamentosMutation.mutate({
          cultivar: selectedCultivar,
          tratamentoIds: tratamentoIdsSelecionados
        }, {
          onSuccess: () => {
            toast.success("Tratamentos vinculados ao cultivar com sucesso!");
            setSelectedCultivar("");
            setSelectedCultivares([]);
          },
          onError: (error) => {
             toast.error("Erro ao salvar vínculos");
          }
        });
      }
    } catch (error) {
      toast.error("Erro ao salvar vínculos");
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Vínculos entre Cultivares e Tratamentos</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-4 items-end">
          <div className="space-y-2">
            <Label>Modo</Label>
            <Select value={modo} onValueChange={(v) => setModo(v as any)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="por_tratamento">Por Tratamento</SelectItem>
                <SelectItem value="por_cultivar">Por Cultivar</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {modo === "por_tratamento" ? (
            <div className="flex-1">
              <Label>Tratamento</Label>
              <Select value={selectedTratamento} onValueChange={setSelectedTratamento}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um tratamento" />
                </SelectTrigger>
                <SelectContent>
                  {tratamentos?.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="flex-1">
              <Label>Cultivar</Label>
              <Select value={selectedCultivar} onValueChange={(v) => {
                setSelectedCultivar(v);
                // Pré-carregar tratamentos marcados
                // Como selectedCultivares é usado como 'ids' nesse modo, sincronizamos
                setSelectedCultivares([]);
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um cultivar" />
                </SelectTrigger>
                <SelectContent>
                  {cultivares?.map((c) => (
                    <SelectItem key={c.cultivar} value={c.cultivar}>
                      {c.cultivar} - {c.cultura}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {modo === "por_tratamento" && selectedTratamento && (
          <div className="space-y-2">
            <Label>Cultivares Disponíveis</Label>
            <div className="border rounded-md p-4 space-y-2 max-h-64 overflow-y-auto">
              {cultivares?.map((c) => (
                <div key={c.cultivar} className="flex items-center space-x-2">
                  <Checkbox
                    id={c.cultivar}
                    checked={selectedCultivares.includes(c.cultivar)}
                    onCheckedChange={() => handleToggleCultivar(c.cultivar)}
                  />
                  <Label htmlFor={c.cultivar} className="cursor-pointer">
                    {c.cultivar} - {c.cultura}
                  </Label>
                </div>
              ))}
            </div>
          </div>
        )}

        {modo === "por_cultivar" && selectedCultivar && (
          <div className="space-y-2">
            <Label>Tratamentos Disponíveis</Label>
            <div className="border rounded-md p-4 space-y-2 max-h-64 overflow-y-auto">
              {tratamentos?.map((t) => (
                <div key={t.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={t.id}
                    checked={selectedCultivares.includes(t.id)}
                    onCheckedChange={() => handleToggleCultivar(t.id)}
                  />
                  <Label htmlFor={t.id} className="cursor-pointer">
                    {t.nome} {t.cultura ? `- ${t.cultura}` : ""}
                  </Label>
                </div>
              ))}
            </div>
          </div>
        )}

        <Button onClick={handleSave} disabled={loading || (modo === "por_tratamento" ? !selectedTratamento : !selectedCultivar)}>
          {loading ? "Salvando..." : "Salvar Vínculos"}
        </Button>
      </CardContent>
    </Card>
  );
};
