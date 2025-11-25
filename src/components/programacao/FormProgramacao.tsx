import { useState, useEffect, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList, CommandInput } from "@/components/ui/command";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { ChevronsUpDown, Check } from "lucide-react";
import { cn, safeRandomUUID } from "@/lib/utils";
import { useProdutores } from "@/hooks/useProdutores";
import { useFazendas } from "@/hooks/useFazendas";
import { useCultivaresCatalog } from "@/hooks/useCultivaresCatalog";
import { useFertilizantesCatalog } from "@/hooks/useFertilizantesCatalog";
import { useSafras } from "@/hooks/useSafras";
import { useTratamentosSementes } from "@/hooks/useTratamentosSementes";
import { useTratamentosPorCultivar } from "@/hooks/useTratamentosPorCultivar";
import { useJustificativasAdubacao } from "@/hooks/useJustificativasAdubacao";
import { useDefensivosCatalog } from "@/hooks/useDefensivosCatalog";
import { useTalhoes } from "@/hooks/useTalhoes";
import { Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useProfile } from "@/hooks/useProfile";
import { useAdminRole } from "@/hooks/useAdminRole";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { CreateProgramacao, ItemCultivar, ItemAdubacao } from "@/hooks/useProgramacoes";

interface FormProgramacaoProps {
  onSubmit: (data: CreateProgramacao) => void;
  onCancel: () => void;
  title?: string;
  submitLabel?: string;
  initialData?: Partial<CreateProgramacao> & { talhoes_ids?: string[] };
}

// Tipo para defensivo dentro da cultivar
type DefensivoNaFazenda = {
  tempId: string;
  classe: string;
  aplicacao: string;
  defensivo: string;
  dose: number;
  cobertura: number;
  total: number;
  produto_salvo: boolean;
  porcentagem_salva: number;
};

// Linha separada: subcomponente para uma linha de cultivar
type CultivarRowProps = {
  item: ItemCultivar & { uiId?: string; defensivos_fazenda?: DefensivoNaFazenda[] };
  index: number;
  cultivaresDistinct: Array<{ cultivar: string | null }>;
  cultivaresCatalog: Array<{ cultivar: string | null; cultura: string | null; cod_item: string }>;
  canRemove: boolean;
  areaHectares: number;
  onChange: (index: number, field: keyof ItemCultivar, value: any) => void;
  onRemove: (index: number) => void;
};

function CultivarRow({ item, index, cultivaresDistinct, cultivaresCatalog, canRemove, areaHectares, onChange, onRemove }: CultivarRowProps) {
  const { toast } = useToast();
  const cultivarSelecionado = cultivaresCatalog.find(c => c.cultivar === item.cultivar);
  const codItem = cultivarSelecionado?.cod_item;
  const { data: tratamentosDisponiveis = [] } = useTratamentosPorCultivar(codItem);
  const { data: defensivosCatalog = [] } = useDefensivosCatalog();
  
  const [defensivosFazenda, setDefensivosFazenda] = useState<DefensivoNaFazenda[]>(
    item.defensivos_fazenda || [
      {
        tempId: safeRandomUUID(),
        classe: "",
        aplicacao: "Tratamento de Semente - TS",
        defensivo: "",
        dose: 0,
        cobertura: 100,
        total: 0,
        produto_salvo: false,
        porcentagem_salva: 100,
      }
    ]
  );

  useEffect(() => {
    onChange(index, "defensivos_fazenda" as any, defensivosFazenda);
  }, [defensivosFazenda]);

  const handleAddDefensivo = () => {
    setDefensivosFazenda([
      ...defensivosFazenda,
      {
        tempId: safeRandomUUID(),
        classe: "",
        aplicacao: "Tratamento de Semente - TS",
        defensivo: "",
        dose: 0,
        cobertura: 100,
        total: 0,
        produto_salvo: false,
        porcentagem_salva: 100,
      }
    ]);
  };

  const handleRemoveDefensivo = (tempId: string) => {
    if (defensivosFazenda.length === 1) return;
    setDefensivosFazenda(defensivosFazenda.filter(d => d.tempId !== tempId));
  };

  const handleDefensivoChange = (tempId: string, field: keyof DefensivoNaFazenda, value: any) => {
    // Se está alterando o defensivo, verifica se pode repetir o produto
    if (field === 'defensivo' && value) {
      const produtoExistente = defensivosFazenda.find((def) => 
        def.tempId !== tempId && 
        def.defensivo === value &&
        !def.produto_salvo
      );
      
      if (produtoExistente) {
        toast({
          title: "Produto não pode ser repetido",
          description: "Para repetir este produto, marque a flag 'Produto salvo' no registro anterior.",
          variant: "destructive",
        });
        return;
      }
    }
    
    // Se está desmarcando a flag, verifica se tem outro produto IGUAL sem flag marcada
    if (field === 'produto_salvo' && !value) {
      const defensivoAtual = defensivosFazenda.find(d => d.tempId === tempId);
      if (defensivoAtual?.defensivo) {
        const outrosProdutosIguaisSemFlag = defensivosFazenda.filter((def) => 
          def.tempId !== tempId && 
          def.defensivo === defensivoAtual.defensivo &&
          !def.produto_salvo
        );
        
        if (outrosProdutosIguaisSemFlag.length > 0) {
          toast({
            title: "Não é possível desmarcar",
            description: "Existe outro produto igual sem a flag marcada. Ao menos um deve ter a flag 'Produto salvo' marcada.",
            variant: "destructive",
          });
          return;
        }
      }
    }
    
    setDefensivosFazenda(prev => 
      prev.map(d => {
        if (d.tempId === tempId) {
          const updated = { ...d, [field]: value };
          if (field === "dose" || field === "cobertura") {
            const dose = Number(field === "dose" ? value : d.dose) || 0;
            const cobertura = Math.min(100, Math.max(0, Number(field === "cobertura" ? value : d.cobertura) || 100));
            updated.total = dose * (areaHectares || 0) * (cobertura / 100);
            updated.cobertura = cobertura;
          }
          return updated;
        }
        return d;
      })
    );
  };

  return (
    <div className="space-y-3 p-4 border rounded-lg">
      <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
        <div className="space-y-2">
          <Label>Cultivar</Label>
          <Select value={item.cultivar} onValueChange={(value) => onChange(index, "cultivar", value)}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              {Array.isArray(cultivaresDistinct) && cultivaresDistinct.filter(c => c && c.cultivar).map((c) => {
                if (!c || !c.cultivar) return null;
                return (
                  <SelectItem key={`cult-${c.cultivar}`} value={c.cultivar}>
                    {c.cultivar}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Tipo Embalagem</Label>
          <Select value={item.tipo_embalagem} onValueChange={(value) => onChange(index, "tipo_embalagem", value)}>
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
            onValueChange={(value) => {
              onChange(index, "tipo_tratamento", value);
              // Se usuário escolher "NÃO", limpamos os tratamentos específicos selecionados
              if (value === "NÃO") {
                onChange(index, "tratamento_ids" as any, []);
                // Também limpar o tratamento único para evitar regravação indevida
                onChange(index, "tratamento_id", undefined as any);
              }
            }}
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
          <Label>Data provável de plantio</Label>
          <Input
            type="date"
            value={item.data_plantio || ""}
            onChange={(e) => onChange(index, "data_plantio", e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label>% Cobertura</Label>
          <Input
            type="number"
            step="0.1"
            min="1"
            max="100"
            value={item.percentual_cobertura ?? 100}
            onChange={(e) => {
              const raw = Number(e.target.value);
              const val = Number.isFinite(raw) ? Math.min(100, Math.max(1, raw)) : 100;
              onChange(index, "percentual_cobertura", val);
            }}
          />
        </div>

        <div className="flex items-end">
          <Button type="button" variant="destructive" size="icon" onClick={() => onRemove(index)} disabled={!canRemove}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {item.cultivar && item.tipo_tratamento !== "NÃO" && item.tipo_tratamento !== "NA FAZENDA" && (
        <div className="space-y-2">
          <Label>Tratamento Específico</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" type="button" role="combobox" className="w-full justify-between">
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
                    {Array.isArray(tratamentosDisponiveis) && tratamentosDisponiveis.filter(t => t && t.id && t.nome).map((t) => {
                      if (!t || !t.id || !t.nome) return null;
                      const selected = Array.isArray((item as any).tratamento_ids)
                        ? (item as any).tratamento_ids.includes(t.id)
                        : false;
                      return (
                        <CommandItem
                          key={t.id}
                          value={t.nome}
                          onSelect={() => {
                            const current = Array.isArray((item as any).tratamento_ids)
                              ? [...(item as any).tratamento_ids]
                              : [];
                            const exists = current.includes(t.id);
                            const next = exists ? current.filter((id) => id !== t.id) : [...current, t.id];
                            onChange(index, "tratamento_ids" as any, next);
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

      {item.cultivar && item.tipo_tratamento === "NA FAZENDA" && (
        <div className="space-y-3 pt-3 border-t">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-semibold">Defensivos aplicados</Label>
            <Button type="button" variant="outline" size="sm" onClick={handleAddDefensivo}>
              <Plus className="h-4 w-4 mr-1" />
              Adicionar defensivo
            </Button>
          </div>

          {Array.isArray(defensivosFazenda) && defensivosFazenda.filter(d => d && d.tempId).map((defensivo, defIndex) => {
            if (!defensivo || !defensivo.tempId) return null;
            return (
            <div key={defensivo.tempId} className="space-y-3 p-3 border rounded-md bg-muted/30">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Aplicação</Label>
                  <Input
                    value="Tratamento de Semente - TS"
                    disabled
                    className="bg-muted"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Defensivo *</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" type="button" role="combobox" className="w-full justify-between">
                        {defensivo.defensivo || "Selecione..."}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-full p-0">
                      <Command shouldFilter={true}>
                        <CommandInput placeholder="Buscar defensivo..." />
                        <CommandList>
                          <CommandEmpty>Nenhum defensivo encontrado.</CommandEmpty>
                          <CommandGroup>
                            {Array.isArray(defensivosCatalog) && defensivosCatalog.filter(d => d && d.item && d.cod_item).map((d) => (
                              <CommandItem
                                key={d.cod_item}
                                value={`${d.item || ''}`}
                                onSelect={() => handleDefensivoChange(defensivo.tempId, "defensivo", d.item)}
                              >
                                <Check className={cn("mr-2 h-4 w-4", defensivo.defensivo === d.item ? "opacity-100" : "opacity-0")} />
                                {d.item || 'Sem nome'}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div className="space-y-2">
                  <Label>Dose *</Label>
                  <Input
                    type="text"
                    inputMode="decimal"
                    value={String(defensivo.dose || "")}
                    onChange={(e) => {
                      let value = e.target.value.replace(',', '.');
                      // Permitir apenas números e um ponto decimal
                      if (value === '' || /^\d*\.?\d*$/.test(value)) {
                        // Manter como string durante a digitação para preservar "0.0" e "0.01"
                        handleDefensivoChange(defensivo.tempId, "dose", value as any);
                      }
                    }}
                    onBlur={(e) => {
                      // No blur, converter para número
                      let value = e.target.value.replace(',', '.');
                      const numValue = value === '' ? 0 : parseFloat(value);
                      if (!isNaN(numValue)) {
                        handleDefensivoChange(defensivo.tempId, "dose", numValue);
                      } else {
                        handleDefensivoChange(defensivo.tempId, "dose", 0);
                      }
                    }}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Cobertura em %</Label>
                  <Input
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    value={defensivo.cobertura}
                    onChange={(e) => handleDefensivoChange(defensivo.tempId, "cobertura", parseFloat(e.target.value) || 100)}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Total</Label>
                  <Input
                    type="number"
                    value={defensivo.total.toFixed(2)}
                    disabled
                    className="bg-muted"
                  />
                </div>

                <div className="flex items-end justify-between gap-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id={`produto-salvo-${defensivo.tempId}`}
                      checked={defensivo.produto_salvo}
                      onCheckedChange={(checked) => handleDefensivoChange(defensivo.tempId, "produto_salvo", !!checked)}
                    />
                    <Label htmlFor={`produto-salvo-${defensivo.tempId}`} className="text-sm">
                      Produto salvo (RN012)
                    </Label>
                  </div>
                  {defensivosFazenda.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveDefensivo(defensivo.tempId)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
            );
          })}
        </div>
      )}
      <div className="flex items-center gap-2">
        <Checkbox
          id={`cultivar-salvo-${item.uiId || index}`}
          checked={!!item.semente_propria}
          onCheckedChange={(checked) => onChange(index, "semente_propria", !!checked)}
        />
        <Label htmlFor={`cultivar-salvo-${item.uiId || index}`}>Semente salva de safra anterior (RN012)</Label>
      </div>
    </div>
  );
}

export const FormProgramacao = ({ onSubmit, onCancel, title, submitLabel, initialData }: FormProgramacaoProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { profile } = useProfile();
  const { data: adminRole } = useAdminRole();
  const isAdmin = !!adminRole?.isAdmin;
  const isConsultor = !!profile?.numerocm_consultor && !isAdmin;
  const { data: produtores = [] } = useProdutores();
  const { data: fazendas = [] } = useFazendas();
  const { data: cultivares = [] } = useCultivaresCatalog();
  const { data: fertilizantes = [] } = useFertilizantesCatalog();
  const { safras = [], defaultSafra } = useSafras();
  const { data: justificativas = [] } = useJustificativasAdubacao();

  // Normaliza valores vindos do banco para o enum do select
  const normalizeTipoTratamento = (s?: string): ItemCultivar["tipo_tratamento"] => {
    const t = String(s || "").toUpperCase().trim();
    if (t === "NÃO" || t === "NAO") return "NÃO";
    if (t === "NA FAZENDA" || t.includes("FAZENDA")) return "NA FAZENDA";
    if (t === "INDUSTRIAL" || t.startsWith("INDUSTR")) return "INDUSTRIAL";
    return "NÃO";
  };

  // Evita duplicatas de itens de fertilizantes pelo nome exibido
  const fertilizantesDistinct = useMemo(() => {
    const seen = new Set<string>();
    return (fertilizantes || [])
      .filter((f) => {
        const nome = String(f.item || "").trim();
        if (!nome || nome === "null" || nome === "undefined" || seen.has(nome)) return false;
        seen.add(nome);
        return true;
      });
  }, [fertilizantes]);

  const cultivaresDistinct = useMemo(() => {
    const seen = new Set<string>();
    return (cultivares || [])
      .filter((c) => {
        const nome = String(c.cultivar || "").trim();
        if (!nome || nome === "null" || nome === "undefined" || seen.has(nome)) return false;
        seen.add(nome);
        return true;
      });
  }, [cultivares]);

  const [produtorNumerocm, setProdutorNumerocm] = useState(initialData?.produtor_numerocm || "");
  const [fazendaIdfazenda, setFazendaIdfazenda] = useState(initialData?.fazenda_idfazenda || "");
  const [area, setArea] = useState(initialData?.area || "");
  const [areaHectares, setAreaHectares] = useState(String(initialData?.area_hectares || ""));
  const [safraId, setSafraId] = useState(initialData?.safra_id || "");
  const [naoFazerAdubacao, setNaoFazerAdubacao] = useState(false);

  // Itens de cultivares com id estável para chaves de lista
  const makeUiId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  const [itensCultivar, setItensCultivar] = useState<(ItemCultivar & { uiId: string })[]>(
    initialData?.cultivares && initialData.cultivares.length > 0
      ? initialData.cultivares.map((c) => ({ ...c, uiId: makeUiId() }))
      : [{
          uiId: makeUiId(),
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
  const [talhoesSelecionados, setTalhoesSelecionados] = useState<string[]>([]);
  const [dialogTalhoesAberto, setDialogTalhoesAberto] = useState(false);
  const [novosTalhoes, setNovosTalhoes] = useState<Array<{ nome: string; area: string }>>([
    { nome: "", area: "" }
  ]);

  // Buscar talhões da fazenda selecionada
  const fazendaSelecionadaObj = fazendas.find((f) => f.idfazenda === fazendaIdfazenda);
  const { data: talhoesDaFazenda = [] } = useTalhoes(fazendaSelecionadaObj?.id);

  // Calcular área automaticamente com base nos talhões selecionados
  useEffect(() => {
    if (talhoesSelecionados.length > 0) {
      const areaTotal = talhoesDaFazenda
        .filter((t) => talhoesSelecionados.includes(t.id))
        .reduce((sum, t) => sum + Number(t.area), 0);
      setAreaHectares(areaTotal.toString());
    } else if (fazendaIdfazenda && talhoesDaFazenda.length === 0) {
      // Se não tem talhões, não define área
      setAreaHectares("");
    }
  }, [talhoesSelecionados, talhoesDaFazenda, fazendaIdfazenda]);

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
    if (Array.isArray(initialData.talhoes_ids)) setTalhoesSelecionados(initialData.talhoes_ids);
    if (Array.isArray(initialData.cultivares)) setItensCultivar(initialData.cultivares.map((c) => {
      const tipo = normalizeTipoTratamento((c as any).tipo_tratamento);
      const base: ItemCultivar & { uiId: string } = { ...(c as ItemCultivar), tipo_tratamento: tipo, uiId: makeUiId() };
      if (tipo === "NÃO") {
        (base as any).tratamento_ids = [];
        (base as any).tratamento_id = undefined;
      }
      return base;
    }));
    if (Array.isArray(initialData.adubacao)) setItensAdubacao(initialData.adubacao as ItemAdubacao[]);
    // Detecta caso de "não fazer adubação" quando há apenas justificativa sem formulação
    if (Array.isArray(initialData.adubacao)) {
      const temFormulacao = initialData.adubacao.some((a) => !!(a as ItemAdubacao).formulacao);
      const temJustificativa = initialData.adubacao.some((a) => !!(a as ItemAdubacao).justificativa_nao_adubacao_id);
      setNaoFazerAdubacao(!!temJustificativa && !temFormulacao);
    }
  }, [initialData]);

  // Ajusta itens de adubação quando alterna entre os modos
  useEffect(() => {
    if (naoFazerAdubacao) {
      const currentJust = itensAdubacao[0]?.justificativa_nao_adubacao_id || "";
      setItensAdubacao([{ formulacao: "", dose: 0, percentual_cobertura: 0, justificativa_nao_adubacao_id: currentJust }]);
    } else {
      const onlyJustificativa = itensAdubacao.length === 1 && !itensAdubacao[0].formulacao;
      if (itensAdubacao.length === 0 || onlyJustificativa) {
        setItensAdubacao([{ formulacao: "", dose: 0, percentual_cobertura: 100 }]);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [naoFazerAdubacao]);

  useEffect(() => {
    if (produtorNumerocm && !initialData) {
      const filtered = fazendas.filter(f => f.numerocm === produtorNumerocm);
      setFazendaFiltrada(filtered);
      setFazendaIdfazenda("");
      setArea("");
      setAreaHectares("");
      setTalhoesSelecionados([]);
    } else if (produtorNumerocm) {
      const filtered = fazendas.filter(f => f.numerocm === produtorNumerocm);
      setFazendaFiltrada(filtered);
    }
  }, [produtorNumerocm, fazendas, initialData]);

  // Resetar talhões ao trocar de fazenda (somente quando não está editando)
  useEffect(() => {
    if (fazendaIdfazenda && !initialData) {
      setTalhoesSelecionados([]);
      const fazendaSelecionada = fazendaFiltrada.find((f) => f.idfazenda === fazendaIdfazenda);
      setArea(fazendaSelecionada?.nomefazenda || "");
    } else if (fazendaIdfazenda) {
      const fazendaSelecionada = fazendaFiltrada.find((f) => f.idfazenda === fazendaIdfazenda);
      setArea(fazendaSelecionada?.nomefazenda || "");
    }
  }, [fazendaIdfazenda, fazendaFiltrada, initialData]);

  const handleAddCultivar = () => {
    setItensCultivar([...itensCultivar, {
      uiId: makeUiId(),
      cultivar: "",
      percentual_cobertura: 100,
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
    setItensAdubacao([...itensAdubacao, { formulacao: "", dose: 0, percentual_cobertura: 100 }]);
  };

  const handleRemoveAdubacao = (index: number) => {
    const next = itensAdubacao.filter((_, i) => i !== index);
    setItensAdubacao(next);
    // Se remover o último item, ativa modo "não fazer adubação" e solicita justificativa
    if (next.length === 0) {
      setNaoFazerAdubacao(true);
      setItensAdubacao([{ formulacao: "", dose: 0, percentual_cobertura: 0, justificativa_nao_adubacao_id: "" }]);
    }
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

  const handleAdicionarNovoTalhao = () => {
    setNovosTalhoes([...novosTalhoes, { nome: "", area: "" }]);
  };

  const handleRemoverNovoTalhao = (index: number) => {
    if (novosTalhoes.length === 1) return;
    setNovosTalhoes(novosTalhoes.filter((_, i) => i !== index));
  };

  const handleSalvarTalhoes = async () => {
    // Validar campos
    const talhoesValidos = novosTalhoes.filter(t => t.nome && t.area && Number(t.area) > 0);
    
    if (talhoesValidos.length === 0) {
      toast({
        title: "Erro de validação",
        description: "Preencha pelo menos um talhão com nome e área válidos",
        variant: "destructive"
      });
      return;
    }

    if (!fazendaSelecionadaObj?.id) {
      toast({
        title: "Erro",
        description: "Fazenda não encontrada",
        variant: "destructive"
      });
      return;
    }

    try {
      // Inserir talhões no banco
      const { error } = await supabase
        .from("talhoes")
        .insert(
          talhoesValidos.map(t => ({
            fazenda_id: fazendaSelecionadaObj.id,
            nome: t.nome,
            area: Number(t.area)
          }))
        );

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: `${talhoesValidos.length} talhão(ões) cadastrado(s) com sucesso`
      });

      // Atualizar lista de talhões
      queryClient.invalidateQueries({ queryKey: ["talhoes", fazendaSelecionadaObj.id] });
      
      // Fechar dialog e resetar
      setDialogTalhoesAberto(false);
      setNovosTalhoes([{ nome: "", area: "" }]);
    } catch (error) {
      console.error("Erro ao salvar talhões:", error);
      toast({
        title: "Erro ao salvar",
        description: "Não foi possível cadastrar os talhões. Tente novamente.",
        variant: "destructive"
      });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const totalCultivar = getTotalCultivar();
    if (Math.abs(totalCultivar - 100) > 0.1) {
      toast({
        title: "Erro de validação",
        description: "O percentual de cobertura das cultivares deve somar 100% (tolerância ±0,1)",
        variant: "destructive"
      });
      return;
    }

    // Garante consistência: área (nome) e hectares vindos da fazenda selecionada
    const fazendaSelecionada =
      fazendas.find((f) => f.idfazenda === fazendaIdfazenda && f.numerocm === produtorNumerocm) ||
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

    // Validação de talhões
    if (talhoesDaFazenda.length > 0 && talhoesSelecionados.length === 0) {
      toast({
        title: "Erro de validação",
        description: "Selecione pelo menos um talhão da fazenda",
        variant: "destructive",
      });
      return;
    }

    const adubacaoNormal = itensAdubacao.filter((item) => !!item.formulacao);
    if (!naoFazerAdubacao && adubacaoNormal.length === 0) {
      toast({
        title: "Erro de validação",
        description: "Adicione pelo menos uma adubação ou marque 'Não fazer adubação'",
        variant: "destructive",
      });
      return;
    }

    const data: CreateProgramacao = {
      produtor_numerocm: produtorNumerocm,
      fazenda_idfazenda: fazendaIdfazenda,
      area: areaNome,
      area_hectares: areaHectaresFinal,
      safra_id: safraId || undefined,
      talhoes_ids: talhoesSelecionados, // IDs dos talhões selecionados
      // Remove uiId antes de enviar
      cultivares: itensCultivar
        .filter(item => item.cultivar)
        .map(({ uiId, ...rest }) => {
          // Se for NA FAZENDA, incluir defensivos_fazenda
          if (rest.tipo_tratamento === "NA FAZENDA") {
            const result = { ...rest, defensivos_fazenda: (rest as any).defensivos_fazenda || [] } as any;
            const ids = Array.isArray((rest as any).tratamento_ids)
              ? ((rest as any).tratamento_ids as string[])
              : [];
            const first = ids[0] || (rest as any).tratamento_id || undefined;
            result.tratamento_id = first;
            return result;
          }
          // Blindagem: se usuário definiu "NÃO", não enviamos nenhum tratamento
          if (rest.tipo_tratamento === "NÃO") {
            const base = { ...rest } as any;
            base.tratamento_ids = [];
            base.tratamento_id = undefined;
            return base;
          }
          // Caso contrário, compatibilidade: usa o primeiro selecionado
          const ids = Array.isArray((rest as any).tratamento_ids)
            ? ((rest as any).tratamento_ids as string[])
            : [];
          const first = ids[0] || (rest as any).tratamento_id || undefined;
          return { ...rest, tratamento_id: first } as any;
        }),
      adubacao: naoFazerAdubacao
        ? (() => {
            const justificativa = itensAdubacao[0]?.justificativa_nao_adubacao_id;
            if (!justificativa) {
              toast({
                title: "Erro de validação",
                description: "Selecione a justificativa para não fazer adubação",
                variant: "destructive"
              });
              return [] as ItemAdubacao[];
            }
            return [{ formulacao: "", dose: 0, percentual_cobertura: 0, justificativa_nao_adubacao_id: justificativa }];
          })()
        : adubacaoNormal
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
          <div className="space-y-2 md:col-span-2">
            <Label>Produtor</Label>
            <Select value={produtorNumerocm} onValueChange={setProdutorNumerocm}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o produtor" />
              </SelectTrigger>
              <SelectContent>
                {Array.isArray(produtores) && produtores.filter(p => p && p.numerocm && p.nome).map((p) => (
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
                {Array.isArray(fazendaFiltrada) && fazendaFiltrada.filter(f => f && f.idfazenda && f.nomefazenda).map((f) => {
                  const invalid = !f.area_cultivavel || Number(f.area_cultivavel) <= 0;
                  return (
                    <SelectItem key={f.idfazenda} value={f.idfazenda}>
                      {f.nomefazenda}
                      <span className="ml-3 text-xs text-muted-foreground">({Number(f.area_cultivavel || 0)} ha)</span>
                      {invalid && <Badge variant="destructive" className="ml-2">sem área (ha)</Badge>}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
            
          </div>

          

          <div className="space-y-2">
            <Label>Safra</Label>
            <Select value={safraId} onValueChange={setSafraId}>
              <SelectTrigger className="mt-2 space-y-2 w-[20ch]">
                <SelectValue placeholder="Selecione a safra" className="truncate" />
              </SelectTrigger>
              <SelectContent>
                {Array.isArray(safras) && safras.filter(s => s && s.ativa && s.id && s.nome).map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.nome}{s.is_default ? " (Padrão)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Seção de Talhões */}
        {fazendaIdfazenda && talhoesDaFazenda.length > 0 && (
          <div className="border-t pt-6">
            <div className="space-y-4">
              <div>
                <Label className="text-base font-semibold">Talhões da Fazenda</Label>
                <p className="text-sm text-muted-foreground">
                  Selecione os talhões que farão parte desta programação. A área total será calculada automaticamente.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {(() => {
                  if (!Array.isArray(talhoesDaFazenda) || talhoesDaFazenda.length === 0) {
                    return null;
                  }
                  
                  const talhoesValidos = talhoesDaFazenda.filter(t => t && t.id && t.nome != null && t.area != null);
                  
                  if (talhoesValidos.length === 0) {
                    return null;
                  }
                  
                  return talhoesValidos.map((talhao) => (
                    <div
                      key={talhao.id}
                      className={cn(
                        "flex items-start space-x-3 rounded-lg border p-4 cursor-pointer transition-colors",
                        talhoesSelecionados.includes(talhao.id)
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/50"
                      )}
                      onClick={() => {
                        setTalhoesSelecionados((prev) =>
                          prev.includes(talhao.id)
                            ? prev.filter((id) => id !== talhao.id)
                            : [...prev, talhao.id]
                        );
                      }}
                    >
                      <Checkbox
                        checked={talhoesSelecionados.includes(talhao.id)}
                        onCheckedChange={(checked) => {
                          setTalhoesSelecionados((prev) =>
                            checked
                              ? [...prev, talhao.id]
                              : prev.filter((id) => id !== talhao.id)
                          );
                        }}
                      />
                      <div className="flex-1 space-y-1">
                        <Label className="font-medium cursor-pointer">{String(talhao.nome)}</Label>
                        <p className="text-sm text-muted-foreground">{String(talhao.area)} ha</p>
                      </div>
                    </div>
                  ));
                })()}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-muted/30 rounded-lg p-4 border">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Área total da fazenda</p>
                      <p className="text-sm font-medium text-muted-foreground">
                        {(Array.isArray(talhoesDaFazenda) ? talhoesDaFazenda : []).reduce((sum, t) => sum + Number(t?.area || 0), 0).toFixed(2)} ha
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Total de talhões</p>
                      <p className="text-lg font-semibold">{(Array.isArray(talhoesDaFazenda) ? talhoesDaFazenda : []).length}</p>
                    </div>
                  </div>
                </div>

                <div className="bg-primary/5 rounded-lg p-4 border border-primary/20">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Talhões selecionados</p>
                      <p className="text-sm font-medium">
                        {(Array.isArray(talhoesSelecionados) ? talhoesSelecionados : []).length} de {(Array.isArray(talhoesDaFazenda) ? talhoesDaFazenda : []).length}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground mb-1">Área para programação</p>
                      <p className="text-2xl font-bold text-primary">{Number(areaHectares || 0).toFixed(2)} ha</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {fazendaIdfazenda && talhoesDaFazenda.length === 0 && (
          <div className="border-t pt-6">
            <div className="rounded-lg border-2 border-amber-300 bg-amber-50 p-6 space-y-4">
              <div className="flex items-start gap-3">
                <div className="mt-0.5">
                  <svg className="w-6 h-6 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div className="flex-1 space-y-2">
                  <p className="text-base font-semibold text-amber-900">
                    ⚠️ Talhões não cadastrados
                  </p>
                  <p className="text-sm text-amber-800">
                    Para continuar com a programação, você precisa cadastrar os talhões desta fazenda (nome e área em hectares).
                  </p>
                  <p className="text-sm text-amber-700 font-medium mt-3">
                    Após cadastrar os talhões:
                  </p>
                  <ol className="list-decimal list-inside text-sm text-amber-800 space-y-1 ml-2">
                    <li>A soma das áreas dos talhões aparecerá automaticamente</li>
                    <li>Selecione os talhões desejados para a programação</li>
                    <li>A área total será calculada automaticamente</li>
                  </ol>
                  <div className="pt-3 flex gap-2">
                    <Dialog open={dialogTalhoesAberto} onOpenChange={setDialogTalhoesAberto}>
                      <DialogTrigger asChild>
                        <Button
                          type="button"
                          variant="default"
                          className="bg-primary hover:bg-primary/90"
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Cadastrar Talhões Aqui
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                        <DialogHeader>
                          <DialogTitle>Cadastrar Talhões</DialogTitle>
                          <DialogDescription>
                            Adicione os talhões da fazenda {fazendaSelecionadaObj?.nomefazenda}
                          </DialogDescription>
                        </DialogHeader>
                        
                        <div className="space-y-4">
                          {Array.isArray(novosTalhoes) && novosTalhoes.map((talhao, index) => (
                            <div key={index} className="flex gap-3 items-end">
                              <div className="flex-1 space-y-2">
                                <Label>Nome do Talhão</Label>
                                <Input
                                  placeholder="Ex: Talhão 1, Área Norte..."
                                  value={talhao.nome}
                                  onChange={(e) => {
                                    const updated = [...novosTalhoes];
                                    updated[index].nome = e.target.value;
                                    setNovosTalhoes(updated);
                                  }}
                                />
                              </div>
                              <div className="w-32 space-y-2">
                                <Label>Área (ha)</Label>
                                <Input
                                  type="number"
                                  step="0.01"
                                  min="0.01"
                                  placeholder="0.00"
                                  value={talhao.area}
                                  onChange={(e) => {
                                    const updated = [...novosTalhoes];
                                    updated[index].area = e.target.value;
                                    setNovosTalhoes(updated);
                                  }}
                                />
                              </div>
                              {novosTalhoes.length > 1 && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleRemoverNovoTalhao(index)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          ))}
                          
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={handleAdicionarNovoTalhao}
                            className="w-full"
                          >
                            <Plus className="h-4 w-4 mr-2" />
                            Adicionar outro talhão
                          </Button>

                          {Array.isArray(novosTalhoes) && novosTalhoes.some(t => t.nome && t.area) && (
                            <div className="bg-muted/50 rounded-lg p-3">
                              <p className="text-sm font-medium">
                                Área total: {novosTalhoes
                                  .filter(t => t.area && Number(t.area) > 0)
                                  .reduce((sum, t) => sum + Number(t.area), 0)
                                  .toFixed(2)} ha
                              </p>
                            </div>
                          )}
                        </div>

                        <DialogFooter>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                              setDialogTalhoesAberto(false);
                              setNovosTalhoes([{ nome: "", area: "" }]);
                            }}
                          >
                            Cancelar
                          </Button>
                          <Button
                            type="button"
                            onClick={handleSalvarTalhoes}
                          >
                            Salvar Talhões
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>

                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => window.location.href = '/admin?tab=talhoes'}
                    >
                      Ou ir para Admin
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

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
            {Array.isArray(itensCultivar) && itensCultivar.map((item, index) => (
              <CultivarRow
                key={item.uiId}
                item={item}
                index={index}
                cultivaresDistinct={cultivaresDistinct}
                cultivaresCatalog={cultivares || []}
          canRemove={itensCultivar.length > 1}
          areaHectares={Number(areaHectares) || 0}
          onChange={handleCultivarChange}
          onRemove={handleRemoveCultivar}
        />
            ))}
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
                  {Array.isArray(justificativas) && justificativas.filter(j => j && j.id && j.descricao).map((j) => (
                    <SelectItem key={j.id} value={j.id}>
                      {j.descricao}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="space-y-4">
              {Array.isArray(itensAdubacao) && itensAdubacao.map((item, index) => (
                <div key={index} className="grid grid-cols-1 md:grid-cols-5 gap-3 p-4 border rounded-lg">
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
                        {/* Fallback: inclui a formulação salva mesmo que não esteja no catálogo */}
                        {item.formulacao && !fertilizantesDistinct.some((f) => (f.item || "") === item.formulacao) && (
                          <SelectItem value={item.formulacao}>{item.formulacao}</SelectItem>
                        )}
                        {Array.isArray(fertilizantesDistinct) && fertilizantesDistinct.filter(f => f && f.item && f.cod_item).map((f) => (
                          <SelectItem key={f.cod_item ?? f.item} value={f.item || ""}>
                            {f.item || 'Sem nome'}
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
                      step="0.1"
                      min="1"
                      max="100"
                      value={item.percentual_cobertura ?? 100}
                      onChange={(e) => {
                        const raw = Number(e.target.value);
                        const val = Number.isFinite(raw) ? Math.min(100, Math.max(1, raw)) : 100;
                        handleAdubacaoChange(index, "percentual_cobertura", val);
                      }}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Data provável de aplicação</Label>
                    <Input
                      type="date"
                      value={item.data_aplicacao || ""}
                      onChange={(e) => handleAdubacaoChange(index, "data_aplicacao", e.target.value)}
                    />
                  </div>

                  <div className="flex items-end">
                    <Button
                      type="button"
                      variant="destructive"
                      size="icon"
                      onClick={() => handleRemoveAdubacao(index)}
                      disabled={false}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  {/* RN012: checkbox de fertilizante salvo dentro do grid */}
                  <div className="flex items-center gap-2 mt-2 md:col-span-5">
                    <Checkbox
                      id={`adubacao-salvo-${index}`}
                      checked={!!item.fertilizante_salvo}
                      onCheckedChange={(checked) => handleAdubacaoChange(index, "fertilizante_salvo", !!checked)}
                    />
                  <Label htmlFor={`adubacao-salvo-${index}`}>Fertilizante salvo de safra anterior (RN012)</Label>
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
