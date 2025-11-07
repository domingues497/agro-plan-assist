import { useState, useEffect, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList, CommandInput } from "@/components/ui/command";
import { Checkbox } from "@/components/ui/checkbox";
import { ChevronsUpDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";
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
  title?: string;
  submitLabel?: string;
  initialData?: Partial<CreateProgramacao>;
}

export const FormProgramacao = ({ onSubmit, onCancel, title, submitLabel, initialData }: FormProgramacaoProps) => {
  const { toast } = useToast();
  const { data: produtores = [] } = useProdutores();
  const { data: fazendas = [] } = useFazendas();
  const { data: cultivares = [] } = useCultivaresCatalog();
  const { data: fertilizantes = [] } = useFertilizantesCatalog();
  const { safras = [], defaultSafra } = useSafras();
  const { data: justificativas = [] } = useJustificativasAdubacao();

  // Evita duplicatas de itens de fertilizantes pelo nome exibido
  const fertilizantesDistinct = useMemo(() => {
    const seen = new Set<string>();
    return (fertilizantes || [])
      .filter((f) => {
        const nome = String(f.item || "").trim();
        if (!nome || seen.has(nome)) return false;
        seen.add(nome);
        return true;
      });
  }, [fertilizantes]);

  const [produtorNumerocm, setProdutorNumerocm] = useState(initialData?.produtor_numerocm || "");
  const [fazendaIdfazenda, setFazendaIdfazenda] = useState(initialData?.fazenda_idfazenda || "");
  const [area, setArea] = useState(initialData?.area || "");
  const [areaHectares, setAreaHectares] = useState(String(initialData?.area_hectares || ""));
  const [safraId, setSafraId] = useState(initialData?.safra_id || "");
  const [naoFazerAdubacao, setNaoFazerAdubacao] = useState(false);

  const [itensCultivar, setItensCultivar] = useState<ItemCultivar[]>(
    initialData?.cultivares && initialData.cultivares.length > 0
      ? initialData.cultivares
      : [{
          cultivar: "",
          percentual_cobertura: 0,
          tipo_embalagem: "BAG 5000K" as const,
          tipo_tratamento: "NÃO" as const
        }]
  );

  const [itensAdubacao, setItensAdubacao] = useState<ItemAdubacao[]>(
    initialData?.adubacao && initialData.adubacao.length > 0
      ? initialData.adubacao
      : [{ formulacao: "", dose: 0, percentual_cobertura: 0 }]
  );

  const [fazendaFiltrada, setFazendaFiltrada] = useState<any[]>([]);

  // Seleciona automaticamente a safra padrão, se disponível
  useEffect(() => {
    if (!safraId && defaultSafra?.id) {
      setSafraId(defaultSafra.id);
    }
  }, [defaultSafra, safraId]);

  // Atualiza estados quando initialData mudar (quando abrimos edição)
  useEffect(() => {
    if (!initialData) return;
    if (typeof initialData.produtor_numerocm === "string") setProdutorNumerocm(initialData.produtor_numerocm);
    if (typeof initialData.fazenda_idfazenda === "string") setFazendaIdfazenda(initialData.fazenda_idfazenda);
    if (typeof initialData.area === "string") setArea(initialData.area);
    if (typeof initialData.area_hectares !== "undefined") setAreaHectares(String(initialData.area_hectares || ""));
    if (typeof initialData.safra_id === "string") setSafraId(initialData.safra_id);
    if (Array.isArray(initialData.cultivares)) setItensCultivar(initialData.cultivares as ItemCultivar[]);
    if (Array.isArray(initialData.adubacao)) setItensAdubacao(initialData.adubacao as ItemAdubacao[]);
  }, [initialData]);

  useEffect(() => {
    if (produtorNumerocm) {
      const filtered = fazendas.filter(f => f.numerocm === produtorNumerocm);
      setFazendaFiltrada(filtered);
      setFazendaIdfazenda("");
      setArea("");
      // Resetar hectares ao trocar de produtor para evitar resquícios
      setAreaHectares("");
    }
  }, [produtorNumerocm, fazendas]);

  // Auto-preenche área em hectares com o valor de area_cultivavel da fazenda selecionada
  useEffect(() => {
    if (!fazendaIdfazenda) return;
    const fazendaSelecionada = fazendaFiltrada.find((f) => f.idfazenda === fazendaIdfazenda);
    const areaCultivavel = fazendaSelecionada?.area_cultivavel;
    // Sincroniza o campo de "área" (nome da fazenda) com a fazenda selecionada
    setArea(fazendaSelecionada?.nomefazenda || "");
    if (areaCultivavel && areaCultivavel > 0) {
      setAreaHectares(String(areaCultivavel));
    } else {
      // Se não existir ou for 0/null, não define valor para obrigar preenchimento manual
      setAreaHectares("");
    }
  }, [fazendaIdfazenda, fazendaFiltrada]);

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

    // Garante consistência: área (nome) e hectares vindos da fazenda selecionada
    const fazendaSelecionada =
      fazendas.find((f) => f.idfazenda === fazendaIdfazenda) ||
      fazendaFiltrada.find((f) => f.idfazenda === fazendaIdfazenda);

    const areaNome = fazendaSelecionada?.nomefazenda || area;
    const areaHectaresFinal =
      (fazendaSelecionada?.area_cultivavel && Number(fazendaSelecionada.area_cultivavel) > 0)
        ? Number(fazendaSelecionada.area_cultivavel)
        : Number(areaHectares);

    if (!fazendaIdfazenda) {
      toast({
        title: "Erro de validação",
        description: "Selecione a fazenda antes de salvar",
        variant: "destructive"
      });
      return;
    }

    if (!areaNome) {
      toast({
        title: "Erro de validação",
        description: "Nome da área não definido. Selecione a fazenda novamente.",
        variant: "destructive"
      });
      return;
    }

    if (!areaHectaresFinal || Number.isNaN(areaHectaresFinal) || areaHectaresFinal <= 0) {
      toast({
        title: "Erro de validação",
        description: "Preencha a área (hectares) com um valor válido",
        variant: "destructive"
      });
      return;
    }

    const data: CreateProgramacao = {
      produtor_numerocm: produtorNumerocm,
      fazenda_idfazenda: fazendaIdfazenda,
      area: areaNome,
      area_hectares: areaHectaresFinal,
      safra_id: safraId || undefined,
      cultivares: itensCultivar.filter(item => item.cultivar),
      adubacao: itensAdubacao.filter(item => item.formulacao)
    };

    onSubmit(data);
  };

  return (
    <Card className="p-6 mb-6">
      <form onSubmit={handleSubmit} className="space-y-6">
        {title && (
          <div className="mb-2">
            <h3 className="text-lg font-semibold">{title}</h3>
          </div>
        )}
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
                {(safras || []).filter((s) => s.ativa).map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.nome}{s.is_default ? " (Padrão)" : ""}
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
              const cultivarSelecionado = cultivares.find(c => c.cultivar === item.cultivar);
              const cultura = (cultivarSelecionado as any)?.cultura;
              const { data: tratamentosDisponiveis = [] } = useTratamentosSementes(cultura);
              const cultivaresDistinct = useMemo(() => {
                const seen = new Set<string>();
                return (cultivares || [])
                  .filter((c) => {
                    const nome = String(c.cultivar || "").trim();
                    if (!nome || seen.has(nome)) return false;
                    seen.add(nome);
                    return true;
                  });
              }, [cultivares]);
              
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
                          {cultivaresDistinct.map((c) => (
                            <SelectItem key={c.cultivar} value={c.cultivar || ""}>
                              {c.cultivar}
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
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            role="combobox"
                            className="w-full justify-between"
                          >
                            {Array.isArray((item as any).tratamento_ids) && (item as any).tratamento_ids.length > 0
                              ? `${(item as any).tratamento_ids.length} selecionado(s)`
                              : "Selecione o(s) tratamento(s)..."}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-full p-0">
                          <Command shouldFilter={true}>
                            <CommandInput placeholder="Buscar tratamento..." />
                            <CommandList>
                              <CommandEmpty>Nenhum tratamento encontrado.</CommandEmpty>
                              <CommandGroup>
                                {tratamentosDisponiveis.map((t) => {
                                  const selected = Array.isArray((item as any).tratamento_ids)
                                    ? (item as any).tratamento_ids.includes(t.id)
                                    : false;
                                  return (
                                    <CommandItem
                                      key={t.id}
                                      value={`${t.nome}`}
                                      onSelect={() => {
                                        const current = Array.isArray((item as any).tratamento_ids)
                                          ? [...(item as any).tratamento_ids]
                                          : [];
                                        const exists = current.includes(t.id);
                                        const next = exists
                                          ? current.filter((id) => id !== t.id)
                                          : [...current, t.id];
                                        handleCultivarChange(index, "tratamento_ids" as any, next);
                                      }}
                                    >
                                      <Check className={cn("mr-2 h-4 w-4", selected ? "opacity-100" : "opacity-0")} />
                                      {t.nome}
                                    </CommandItem>
                                  );
                                })}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
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
                        {fertilizantesDistinct.map((f) => (
                          <SelectItem key={f.cod_item ?? f.item} value={f.item || ""}>
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
            {!naoFazerAdubacao}
          </div>
        </div>

        <div className="flex gap-3 justify-end">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
          <Button type="submit">
            {submitLabel || "Salvar Programação"}
          </Button>
        </div>
      </form>
    </Card>
  );
};
