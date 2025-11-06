import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useProdutores } from "@/hooks/useProdutores";
import { useFazendas } from "@/hooks/useFazendas";
import { useCultivaresCatalog } from "@/hooks/useCultivaresCatalog";
import { useFertilizantesCatalog } from "@/hooks/useFertilizantesCatalog";
import { useSafras } from "@/hooks/useSafras";
import { useTratamentosSementes } from "@/hooks/useTratamentosSementes";
import { useJustificativasAdubacao } from "@/hooks/useJustificativasAdubacao";
import { Plus, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { CreateProgramacao, ItemCultivar, ItemAdubacao } from "@/hooks/useProgramacoes";

interface FormProgramacaoProps {
  onSubmit: (data: CreateProgramacao) => void;
  onCancel: () => void;
}

export const FormProgramacao = ({ onSubmit, onCancel }: FormProgramacaoProps) => {
  const { toast } = useToast();
  const { data: produtores = [] } = useProdutores();
  const { data: fazendas = [] } = useFazendas();
  const { data: cultivares = [] } = useCultivaresCatalog();
  const { data: fertilizantes = [] } = useFertilizantesCatalog();
  const { safras = [] } = useSafras();
  const { data: justificativas = [] } = useJustificativasAdubacao();

  const [produtorNumerocm, setProdutorNumerocm] = useState("");
  const [fazendaIdfazenda, setFazendaIdfazenda] = useState("");
  const [area, setArea] = useState("");
  const [areaHectares, setAreaHectares] = useState("");
  const [safraId, setSafraId] = useState("");
  const [naoFazerAdubacao, setNaoFazerAdubacao] = useState(false);

  const [itensCultivar, setItensCultivar] = useState<ItemCultivar[]>([
    { 
      cultivar: "", 
      percentual_cobertura: 0, 
      tipo_embalagem: "BAG 5000K" as const,
      tipo_tratamento: "NÃO" as const
    }
  ]);

  const [itensAdubacao, setItensAdubacao] = useState<ItemAdubacao[]>([
    { formulacao: "", dose: 0, percentual_cobertura: 0 }
  ]);

  const [fazendaFiltrada, setFazendaFiltrada] = useState<any[]>([]);

  useEffect(() => {
    if (produtorNumerocm) {
      const filtered = fazendas.filter(f => f.numerocm === produtorNumerocm);
      setFazendaFiltrada(filtered);
      setFazendaIdfazenda("");
      setArea("");
    }
  }, [produtorNumerocm, fazendas]);

  const handleAddCultivar = () => {
    setItensCultivar([...itensCultivar, { 
      cultivar: "", 
      percentual_cobertura: 0,
      tipo_embalagem: "BAG 5000K" as const,
      tipo_tratamento: "NÃO" as const
    }]);
  };

  const handleRemoveCultivar = (index: number) => {
    setItensCultivar(itensCultivar.filter((_, i) => i !== index));
  };

  const handleCultivarChange = (index: number, field: keyof ItemCultivar, value: any) => {
    const newItems = [...itensCultivar];
    newItems[index] = { ...newItems[index], [field]: value };
    setItensCultivar(newItems);
  };

  const handleAddAdubacao = () => {
    setItensAdubacao([...itensAdubacao, { formulacao: "", dose: 0, percentual_cobertura: 0 }]);
  };

  const handleRemoveAdubacao = (index: number) => {
    setItensAdubacao(itensAdubacao.filter((_, i) => i !== index));
  };

  const handleAdubacaoChange = (index: number, field: keyof ItemAdubacao, value: any) => {
    const newItems = [...itensAdubacao];
    newItems[index] = { ...newItems[index], [field]: value };
    setItensAdubacao(newItems);
  };

  const getTotalCultivar = () => {
    return itensCultivar.reduce((sum, item) => sum + (Number(item.percentual_cobertura) || 0), 0);
  };

  const getTotalAdubacao = () => {
    return itensAdubacao.reduce((sum, item) => sum + (Number(item.percentual_cobertura) || 0), 0);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const totalCultivar = getTotalCultivar();
    if (Math.abs(totalCultivar - 100) > 0.01) {
      toast({
        title: "Erro de validação",
        description: "O percentual de cobertura das cultivares deve somar exatamente 100%",
        variant: "destructive"
      });
      return;
    }

    const data: CreateProgramacao = {
      produtor_numerocm: produtorNumerocm,
      fazenda_idfazenda: fazendaIdfazenda,
      area,
      area_hectares: Number(areaHectares),
      safra_id: safraId || undefined,
      cultivares: itensCultivar.filter(item => item.cultivar),
      adubacao: itensAdubacao.filter(item => item.formulacao)
    };

    onSubmit(data);
  };

  return (
    <Card className="p-6 mb-6">
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Produtor</Label>
            <Select value={produtorNumerocm} onValueChange={setProdutorNumerocm}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o produtor" />
              </SelectTrigger>
              <SelectContent>
                {produtores.map((p) => (
                  <SelectItem key={p.numerocm} value={p.numerocm}>
                    {p.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Fazenda</Label>
            <Select value={fazendaIdfazenda} onValueChange={setFazendaIdfazenda} disabled={!produtorNumerocm}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a fazenda" />
              </SelectTrigger>
              <SelectContent>
                {fazendaFiltrada.map((f) => (
                  <SelectItem key={f.idfazenda} value={f.idfazenda}>
                    {f.nomefazenda}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Área (nome/talhão)</Label>
            <Input
              value={area}
              onChange={(e) => setArea(e.target.value)}
              placeholder="Ex: Talhão A"
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Área (hectares)</Label>
            <Input
              type="number"
              step="0.01"
              value={areaHectares}
              onChange={(e) => setAreaHectares(e.target.value)}
              placeholder="0.00"
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Safra</Label>
            <Select value={safraId} onValueChange={setSafraId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a safra" />
              </SelectTrigger>
              <SelectContent>
                {safras.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Seção Cultivares */}
        <div className="border-t pt-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Cultivares / Sementes</h3>
            <Button type="button" onClick={handleAddCultivar} variant="outline" size="sm">
              <Plus className="h-4 w-4 mr-1" />
              Adicionar
            </Button>
          </div>

          <div className="space-y-4">
            {itensCultivar.map((item, index) => {
              const cultivarSelecionado = cultivares.find(c => c.item === item.cultivar);
              const cultura = (cultivarSelecionado as any)?.cultura;
              const { data: tratamentosDisponiveis = [] } = useTratamentosSementes(cultura);
              
              return (
                <div key={index} className="space-y-3 p-4 border rounded-lg">
                  <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                    <div className="space-y-2">
                      <Label>Cultivar</Label>
                      <Select
                        value={item.cultivar}
                        onValueChange={(value) => handleCultivarChange(index, "cultivar", value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                        <SelectContent>
                          {cultivares.map((c) => (
                            <SelectItem key={c.cod_item} value={c.item || ""}>
                              {c.item}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Tipo Embalagem</Label>
                      <Select
                        value={item.tipo_embalagem}
                        onValueChange={(value) => handleCultivarChange(index, "tipo_embalagem", value)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="BAG 5000K">BAG 5000K</SelectItem>
                          <SelectItem value="SACAS 200K">SACAS 200K</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Tipo Tratamento</Label>
                      <Select
                        value={item.tipo_tratamento}
                        onValueChange={(value) => handleCultivarChange(index, "tipo_tratamento", value)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="NÃO">NÃO</SelectItem>
                          <SelectItem value="NA FAZENDA">NA FAZENDA</SelectItem>
                          <SelectItem value="INDUSTRIAL">INDUSTRIAL</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>% Cobertura</Label>
                      <Input
                        type="number"
                        step="0.01"
                        max="100"
                        value={item.percentual_cobertura}
                        onChange={(e) => handleCultivarChange(index, "percentual_cobertura", Number(e.target.value))}
                      />
                    </div>

                    <div className="flex items-end">
                      <Button
                        type="button"
                        variant="destructive"
                        size="icon"
                        onClick={() => handleRemoveCultivar(index)}
                        disabled={itensCultivar.length === 1}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {item.cultivar && item.tipo_tratamento !== "NÃO" && (
                    <div className="space-y-2">
                      <Label>Tratamento Específico</Label>
                      <Select
                        value={item.tratamento_id || ""}
                        onValueChange={(value) => handleCultivarChange(index, "tratamento_id", value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o tratamento" />
                        </SelectTrigger>
                        <SelectContent>
                          {tratamentosDisponiveis.map((t) => (
                            <SelectItem key={t.id} value={t.id}>
                              {t.nome}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className={`mt-2 text-sm font-medium ${getTotalCultivar() === 100 ? "text-green-600" : "text-red-600"}`}>
            Total: {getTotalCultivar().toFixed(2)}% {getTotalCultivar() !== 100 && "(deve ser 100%)"}
          </div>
        </div>

        {/* Seção Adubação */}
        <div className="border-t pt-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Adubação</h3>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={naoFazerAdubacao}
                  onChange={(e) => setNaoFazerAdubacao(e.target.checked)}
                  className="rounded"
                />
                Não fazer adubação
              </label>
              {!naoFazerAdubacao && (
                <Button type="button" onClick={handleAddAdubacao} variant="outline" size="sm">
                  <Plus className="h-4 w-4 mr-1" />
                  Adicionar
                </Button>
              )}
            </div>
          </div>

          {naoFazerAdubacao ? (
            <div className="space-y-2">
              <Label>Justificativa para não fazer adubação *</Label>
              <Select
                value={itensAdubacao[0]?.justificativa_nao_adubacao_id || ""}
                onValueChange={(value) => {
                  const newItems = [...itensAdubacao];
                  if (newItems.length === 0) {
                    newItems.push({ 
                      formulacao: "", 
                      dose: 0, 
                      percentual_cobertura: 0,
                      justificativa_nao_adubacao_id: value 
                    });
                  } else {
                    newItems[0].justificativa_nao_adubacao_id = value;
                  }
                  setItensAdubacao(newItems);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a justificativa" />
                </SelectTrigger>
                <SelectContent>
                  {justificativas.map((j) => (
                    <SelectItem key={j.id} value={j.id}>
                      {j.descricao}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="space-y-4">
              {itensAdubacao.map((item, index) => (
                <div key={index} className="grid grid-cols-1 md:grid-cols-4 gap-3 p-4 border rounded-lg">
                  <div className="space-y-2">
                    <Label>Formulação</Label>
                    <Select
                      value={item.formulacao}
                      onValueChange={(value) => handleAdubacaoChange(index, "formulacao", value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        {fertilizantes.map((f) => (
                          <SelectItem key={f.cod_item} value={f.item || ""}>
                            {f.item}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Dose (kg/ha)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={item.dose}
                      onChange={(e) => handleAdubacaoChange(index, "dose", Number(e.target.value))}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>% Cobertura</Label>
                    <Input
                      type="number"
                      step="0.01"
                      max="100"
                      value={item.percentual_cobertura}
                      onChange={(e) => handleAdubacaoChange(index, "percentual_cobertura", Number(e.target.value))}
                    />
                  </div>

                  <div className="flex items-end">
                    <Button
                      type="button"
                      variant="destructive"
                      size="icon"
                      onClick={() => handleRemoveAdubacao(index)}
                      disabled={itensAdubacao.length === 1}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="mt-2 text-sm font-medium text-muted-foreground">
            {!naoFazerAdubacao && `Total: ${getTotalAdubacao().toFixed(2)}% (não precisa ser 100%)`}
          </div>
        </div>

        <div className="flex gap-3 justify-end">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
          <Button type="submit">
            Salvar Programação
          </Button>
        </div>
      </form>
    </Card>
  );
};
