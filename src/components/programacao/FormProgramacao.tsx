import { useState, useEffect, useMemo, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList, CommandInput } from "@/components/ui/command";
import { Checkbox } from "@/components/ui/checkbox";
import { ChevronsUpDown, Check } from "lucide-react";
import { cn, safeRandomUUID, getApiBaseUrl } from "@/lib/utils";
import { useProdutores } from "@/hooks/useProdutores";
import { useFazendas } from "@/hooks/useFazendas";
import { useCultivaresCatalog } from "@/hooks/useCultivaresCatalog";
import { useFertilizantesCatalog } from "@/hooks/useFertilizantesCatalog";
import { useSafras } from "@/hooks/useSafras";
import { useTratamentosSementes } from "@/hooks/useTratamentosSementes";
import { useJustificativasAdubacao } from "@/hooks/useJustificativasAdubacao";
import { useDefensivosCatalog } from "@/hooks/useDefensivosCatalog";
import { useTalhoes } from "@/hooks/useTalhoes";
import { useEpocas } from "@/hooks/useEpocas";
import { useSystemConfig } from "@/hooks/useSystemConfig";
import { Plus, Trash2, Settings, Loader2 } from "lucide-react";
import { GerenciarTalhoes } from "@/components/programacao/GerenciarTalhoes";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useProfile } from "@/hooks/useProfile";
import { useAdminRole } from "@/hooks/useAdminRole";
import { useQueryClient } from "@tanstack/react-query";
import type { CreateProgramacao, ItemCultivar, ItemAdubacao } from "@/hooks/useProgramacoes";

interface FormProgramacaoProps {
  onSubmit: (data: CreateProgramacao) => void;
  onCancel: () => void;
  title?: string;
  submitLabel?: string;
  initialData?: Partial<CreateProgramacao>;
  readOnly?: boolean;
  isLoading?: boolean;
  embalagensCultivarOptions?: Array<{ id: string; nome: string; cultura?: string | null }>;
  embalagensFertilizantesOptions?: Array<{ id: string; nome: string }>;
}

// Tipo para defensivo dentro da cultivar
type DefensivoNaFazenda = {
  tempId: string;
  classe: string;
  aplicacao: string;
  defensivo: string;
  cod_item?: string;
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
  // cultivaresDistinct mantido por compatibilidade, mas filtragem passa a usar o catálogo completo
  cultivaresDistinct: Array<{ cultivar: string | null }>;
  cultivaresCatalog: Array<{ cultivar: string | null; cultura: string | null; nome_cientifico: string | null }>;
  embalagensCultivar: Array<{ id: string; nome: string; cultura?: string | null }>;
  canRemove: boolean;
  areaHectares: number;
  onChange: (index: number, field: keyof ItemCultivar, value: any) => void;
  onRemove: (index: number) => void;
};

function CultivarRow({ item, index, cultivaresDistinct, cultivaresCatalog, embalagensCultivar, canRemove, areaHectares, onChange, onRemove }: CultivarRowProps) {
  const { toast } = useToast();
  const [culturaSelecionada, setCulturaSelecionada] = useState<string>(item.cultura || "");
  
  // Sincroniza cultura quando item.cultura mudar (importante para edição)
  useEffect(() => {
    if (item.cultura && item.cultura !== culturaSelecionada) {
      setCulturaSelecionada(item.cultura);
    }
  }, [item.cultura]);

  // Filtra embalagens disponíveis para a cultura selecionada
  const embalagensDisponiveis = useMemo(() => {
    const list = (embalagensCultivar || []).filter((e) => {
      const ec = String(e?.cultura || "").trim();
      const cc = String(culturaSelecionada || "").trim();
      const ecs = ec ? ec.split(",").map((s) => s.trim()).filter(Boolean) : [];
      return ecs.length === 0 || (cc && ecs.includes(cc));
    });
    
    // Se houver uma embalagem selecionada que não está na lista (ex: inativa ou erro de carga),
    // adiciona ela temporariamente para não quebrar a visualização no Select
    const atual = String(item.tipo_embalagem || "").trim();
    if (atual && !list.some(e => e.nome === atual)) {
      return [...list, { id: 'temp-legacy', nome: atual, cultura: null }];
    }
    
    return list;
  }, [embalagensCultivar, culturaSelecionada, item.tipo_embalagem]);

  // Removido useEffect que limpava tipo_embalagem automaticamente para evitar perda de dados em race conditions
  
  const cultivarSelecionado = cultivaresCatalog.find(c => c.cultivar === item.cultivar);
  // const cultivarNome = cultivarSelecionado?.cultivar; 
  
  // Busca todos os tratamentos e filtra no cliente para suportar múltiplas culturas (separadas por vírgula)
  const { data: todosTratamentos = [] } = useTratamentosSementes();
  
  const tratamentosDisponiveis = useMemo(() => {
    if (!culturaSelecionada) return [];
    const culturaTarget = String(culturaSelecionada).trim().toUpperCase();
    
    return todosTratamentos.filter((t) => {
      if (!t.cultura) return false;
      // Quebra a string "MILHO, SOJA, AVEIA" em array e verifica se inclui a cultura selecionada
      const culturas = t.cultura.split(",").map((c) => c.trim().toUpperCase());
      return culturas.includes(culturaTarget);
    });
  }, [todosTratamentos, culturaSelecionada]);
  const { data: defensivosCatalog = [] } = useDefensivosCatalog();
  
  // Obter culturas únicas do catálogo (todas as culturas importadas)
  const culturasUnicas = useMemo(() => {
    const set = new Set<string>();
    for (const c of cultivaresCatalog) {
      const nome = String(c.cultura || "").trim();
      if (nome) set.add(nome);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR", { sensitivity: "base" }));
  }, [cultivaresCatalog]);
  
  // Filtrar cultivares pela cultura selecionada usando o catálogo completo
  const cultivaresFiltradas = useMemo(() => {
    const nomes = cultivaresCatalog
      .filter((cc) => {
        const cult = String(cc.cultivar || "").trim();
        if (!cult) return false;
        if (!culturaSelecionada) return true;
        return String(cc.cultura || "").trim() === culturaSelecionada;
      })
      .map((cc) => String(cc.cultivar || "").trim());
    const unicos = Array.from(new Set(nomes));
    return unicos.map((n) => ({ cultivar: n }));
  }, [culturaSelecionada, cultivaresCatalog]);
  
  const [defensivosFazenda, setDefensivosFazenda] = useState<DefensivoNaFazenda[]>(
    item.defensivos_fazenda || [
      {
        tempId: safeRandomUUID(),
        classe: "",
        aplicacao: "Tratamento de Semente - TS",
        defensivo: "",
        cod_item: "",
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
      {
        tempId: safeRandomUUID(),
        classe: "",
        aplicacao: "Tratamento de Semente - TS",
        defensivo: "",
        cod_item: "",
        dose: 0,
        cobertura: 100,
        total: 0,
        produto_salvo: false,
        porcentagem_salva: 100,
      },
      ...defensivosFazenda
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
          const updated = { ...d, [field]: value } as DefensivoNaFazenda;
          if (field === "defensivo") {
            const norm = (s: string) => String(s || "").normalize("NFD").replace(/[^\p{L}\p{N}\s\-]/gu, "").toUpperCase().trim();
            const sel = defensivosCatalog.find((x: any) => String(x.item) === String(value))
              || defensivosCatalog.find((x: any) => norm(String(x.item)) === norm(String(value)));
            updated.cod_item = sel?.cod_item ? String(sel.cod_item) : "";
            const grupo = sel?.grupo ? String(sel.grupo) : "";
            updated.classe = grupo || updated.classe || "";
          }
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
    <div className="space-y-3 p-3 md:p-4 border rounded-lg">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-3">
        <div className="space-y-2 xl:col-span-1 lg:col-span-1 sm:col-span-1">
          <Label>Cultura</Label>
          <Select 
            value={culturaSelecionada} 
            onValueChange={(value) => {
              setCulturaSelecionada(value);
              onChange(index, "cultura" as any, value);
              // Limpar cultivar quando trocar cultura
              onChange(index, "cultivar", "");
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione cultura" />
            </SelectTrigger>
            <SelectContent>
              {culturasUnicas.map((cultura) => (
                <SelectItem key={cultura} value={cultura || ""}>
                  {cultura}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        <div className="space-y-2 sm:col-span-2 lg:col-span-1 xl:col-span-1">
          <Label>Cultivar</Label>
          <Select 
            value={item.cultivar} 
            onValueChange={(value) => onChange(index, "cultivar", value)}
            disabled={!culturaSelecionada}
          >
            <SelectTrigger>
              <SelectValue placeholder={culturaSelecionada ? "Selecione" : "Selecione cultura primeiro"} />
            </SelectTrigger>
            <SelectContent>
              {cultivaresFiltradas.map((c) => (
                <SelectItem key={`cult-${c.cultivar ?? 'null'}`} value={c.cultivar || ""}>
                  {c.cultivar}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2 xl:col-span-1 lg:col-span-1">
          <Label>Embalagem</Label>
          <div className="flex gap-2">
            <Select value={item.tipo_embalagem} onValueChange={(value) => onChange(index, "tipo_embalagem", value)}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Selecione a embalagem" />
              </SelectTrigger>
              <SelectContent>
                {embalagensDisponiveis.map((e, idx) => (
                  <SelectItem key={e.id || `emb-${idx}`} value={e.nome}>{e.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>

          </div>
        </div>

        <div className="space-y-2 xl:col-span-1 lg:col-span-1">
          <Label>Tratamento</Label>
          <Select
            value={item.tipo_tratamento}
            onValueChange={(value) => {
              onChange(index, "tipo_tratamento", value);

              if (value !== "NA FAZENDA") {
                setDefensivosFazenda([]);
              }

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

        <div className="space-y-2 xl:col-span-1 lg:col-span-1">
          <Label>Data provável de plantio</Label>
          <Input
            type="date"
            value={item.data_plantio || ""}
            onChange={(e) => onChange(index, "data_plantio", e.target.value)}
          />
        </div>

        <div className="space-y-2 xl:col-span-1 lg:col-span-1">
          <Label>Sementes por M2</Label>
          <Input
            type="number"
            step="0.01"
            value={item.populacao_recomendada ?? ""}
            onChange={(e) => onChange(index, "populacao_recomendada", parseFloat(e.target.value) || 0)}
            placeholder="Ex: 28.5"
          />
        </div>

        <div className="space-y-2 sm:col-span-2 lg:col-span-1 xl:col-span-1">
          <Label>% Cobertura</Label>
          <div className="flex gap-2">
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
              className="flex-1"
            />
            <Button 
              type="button" 
              variant="destructive" 
              size="icon" 
              onClick={() => onRemove(index)} 
              disabled={!canRemove}
              className="shrink-0"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
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
                    {tratamentosDisponiveis.map((t, idx) => {
                      const selected = Array.isArray((item as any).tratamento_ids)
                        ? (item as any).tratamento_ids.includes(t.id)
                        : false;
                      return (
                        <CommandItem
                          key={t.id || `trat-${idx}`}
                          value={`${t.nome}`}
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
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <Label className="text-sm font-semibold">Defensivos para o TS</Label>
            <Button type="button" variant="outline" size="sm" onClick={handleAddDefensivo} className="w-full sm:w-auto">
              <Plus className="h-4 w-4 mr-1" />
              Adicionar defensivo
            </Button>
          </div>

          {defensivosFazenda.map((defensivo, defIndex) => (
            <div key={defensivo.tempId} className="space-y-3 p-3 border rounded-md bg-muted/30">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
                <div className="space-y-2">
                  <Label>Aplicação</Label>
                  <Input
                    value="Tratamento de Semente - TS"
                    disabled
                    className="bg-muted"
                  />
                </div>

                <div className="space-y-2 sm:col-span-2 lg:col-span-2">
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
                            {defensivosCatalog.map((d, idx) => (
                              <CommandItem
                                key={d.cod_item || `def-${idx}`}
                                value={`${d.item}`}
                                onSelect={() => handleDefensivoChange(defensivo.tempId, "defensivo", d.item)}
                              >
                                <Check className={cn("mr-2 h-4 w-4", defensivo.defensivo === d.item ? "opacity-100" : "opacity-0")} />
                                {d.item}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
              
                <div className="space-y-2">
                  <Label>Dose *</Label>
                  <Input
                    type="text"
                    inputMode="decimal"
                    value={String(defensivo.dose || "")}
                    onChange={(e) => {
                      let value = e.target.value.replace(',', '.');
                      if (value === '' || /^\d*\.?\d*$/.test(value)) {
                        handleDefensivoChange(defensivo.tempId, "dose", value as any);
                      }
                    }}
                    onBlur={(e) => {
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

                <div className="space-y-2 sm:col-span-2 lg:col-span-3 xl:col-span-1 flex flex-col sm:flex-row items-start sm:items-center gap-2 justify-between">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id={`produto-salvo-${defensivo.tempId}`}
                      checked={defensivo.produto_salvo}
                      onCheckedChange={(checked) => handleDefensivoChange(defensivo.tempId, "produto_salvo", !!checked)}
                    />
                    <Label htmlFor={`produto-salvo-${defensivo.tempId}`} className="text-sm whitespace-nowrap">
                      Produto proprio.
                    </Label>
                  </div>
                  {defensivosFazenda.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveDefensivo(defensivo.tempId)}
                      className="shrink-0"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>

              
            </div>
          ))}
        </div>
      )}
      <div className="flex items-center gap-2">
        <Checkbox
          id={`cultivar-salvo-${item.uiId || index}`}
          checked={!!item.semente_propria}
          onCheckedChange={(checked) => onChange(index, "semente_propria", !!checked)}
        />
        <Label htmlFor={`cultivar-salvo-${item.uiId || index}`}>Semente propria</Label>
      </div>
    </div>
  );
}

export const FormProgramacao = ({ onSubmit, onCancel, title, submitLabel, initialData, readOnly = false, isLoading = false, embalagensCultivarOptions = [], embalagensFertilizantesOptions = [] }: FormProgramacaoProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { profile } = useProfile();
  const { data: adminRole } = useAdminRole();
  const isAdmin = !!adminRole?.isAdmin;
  const isConsultor = !!profile?.numerocm_consultor && !isAdmin;
  const { data: produtores = [] } = useProdutores();
  const [safraId, setSafraId] = useState(initialData?.safra_id || "");
  const isEditing = !!initialData;
  const initialProdutorNumerocm = (initialData?.produtor_numerocm || undefined) as string | undefined;
  const { data: fazendas = [] } = useFazendas(initialProdutorNumerocm, isEditing ? undefined : safraId);
  const { data: cultivares = [] } = useCultivaresCatalog();
  const { data: fertilizantes = [] } = useFertilizantesCatalog();
  const { data: defensivosCatalog = [] } = useDefensivosCatalog();
  const { safras = [], defaultSafra } = useSafras();
  const { data: justificativas = [] } = useJustificativasAdubacao();
  const { data: epocas = [] } = useEpocas();
  const { data: systemConfig = [] } = useSystemConfig();

  const embalagensRaw = (systemConfig || []).find((c) => c.config_key === "embalagens_catalog")?.config_value || "[]";
  const embalagens = useMemo(() => {
    try {
      const parsed = JSON.parse(embalagensRaw || "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch { return []; }
  }, [embalagensRaw]);
  const embalagensCultivar = useMemo(() => {
    if (embalagensCultivarOptions.length > 0) return embalagensCultivarOptions;
    // Fallback para configuração do sistema (legado)
    return (embalagens || []).filter((e: any) => (e?.ativo ?? true) && Array.isArray(e?.scopes) && e.scopes.includes("CULTIVAR"));
  }, [embalagensCultivarOptions, embalagens]);

  const embalagensFertilizantesAll = useMemo(() => {
    if (embalagensFertilizantesOptions.length > 0) return embalagensFertilizantesOptions;
    // Fallback para configuração do sistema (legado)
    const legacy = (embalagens || []).filter((e: any) => (e?.ativo ?? true) && Array.isArray(e?.scopes) && e.scopes.includes("FERTILIZANTE"));
    return legacy;
  }, [embalagensFertilizantesOptions, embalagens]);

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
        if (!nome || seen.has(nome)) return false;
        seen.add(nome);
        return true;
      });
  }, [fertilizantes]);

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

  const [produtorNumerocm, setProdutorNumerocm] = useState(initialData?.produtor_numerocm || "");
  const [fazendaIdfazenda, setFazendaIdfazenda] = useState(initialData?.fazenda_idfazenda || "");
  const [area, setArea] = useState(initialData?.area || "");
  const [areaHectares, setAreaHectares] = useState(String(initialData?.area_hectares || ""));
  const [epocaId, setEpocaId] = useState((initialData as any)?.epoca_id || "");
  const [talhaoIds, setTalhaoIds] = useState<string[]>([]);
  const [naoFazerAdubacao, setNaoFazerAdubacao] = useState(false);
  const [tipoProgramacao, setTipoProgramacao] = useState<"PREVIA" | "PROGRAMACAO">(
    ((initialData as any)?.tipo === "PREVIA") ? "PREVIA" : "PROGRAMACAO"
  );

  // Itens de cultivares com id estável para chaves de lista
  const makeUiId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  const [itensCultivar, setItensCultivar] = useState<(ItemCultivar & { uiId: string })[]>(
    initialData?.cultivares && initialData.cultivares.length > 0
      ? initialData.cultivares.map((c) => ({ ...c, uiId: makeUiId() }))
      : [{
          uiId: makeUiId(),
          cultivar: "",
          percentual_cobertura: 0,
          tipo_embalagem: "",
          tipo_tratamento: "NÃO" as const,
          populacao_recomendada: 0
        }]
  );

  const [itensAdubacao, setItensAdubacao] = useState<ItemAdubacao[]>(
    initialData?.adubacao && initialData.adubacao.length > 0
      ? initialData.adubacao
      : [{ formulacao: "", dose: 0, percentual_cobertura: 0 }]
  );
  const [openFormulacaoIndex, setOpenFormulacaoIndex] = useState<number | null>(null);

  const [fazendaFiltrada, setFazendaFiltrada] = useState<any[]>([]);
  const [gerenciarTalhoesOpen, setGerenciarTalhoesOpen] = useState(false);
  const [selectedFazendaUuid, setSelectedFazendaUuid] = useState<string | undefined>(undefined);
  
  // Ref para rastrear se estamos carregando initialData
  const isLoadingInitialData = useRef(false);
  
  // Busca os talhões da fazenda selecionada (robusto na primeira carga)
  const fazendaSelecionadaId = (
    selectedFazendaUuid
    || (fazendaFiltrada.find((f) => f.idfazenda === fazendaIdfazenda)?.id)
    || ((fazendas || []).find((f: any) => f.idfazenda === fazendaIdfazenda)?.id)
    || undefined
  );
  const { data: talhoesDaFazenda = [] } = useTalhoes(fazendaSelecionadaId, safraId, epocaId);

  // Filtra talhões disponíveis
  const talhoesDisponiveis = useMemo(() => {
    return talhoesDaFazenda.filter((t) => {
      // Se não há conflito de programação nesta safra E época, está disponível
      // Agora usamos conflito_programacao que é específico para safra+época
      if (!t.conflito_programacao) return true;
      
      // Se tem conflito, verifica se é a própria programação sendo editada
      if (isEditing) {
        const originalSafra = String(initialData?.safra_id || "");
        const originalEpoca = String((initialData as any)?.epoca_id || "");
        const currentSafra = String(safraId || "");
        const currentEpoca = String(epocaId || "");
        
        // Se estamos visualizando a mesma safra/época original, o conflito somos nós mesmos
        if (originalSafra === currentSafra && originalEpoca === currentEpoca) {
          if (initialData?.talhao_ids?.map(String).includes(String(t.id))) {
            return true;
          }
        }
      }
      
      // Caso contrário, está ocupado por outra programação
      return false;
    });
  }, [talhoesDaFazenda, isEditing, initialData, safraId, epocaId]);

  // Seleciona automaticamente a safra padrão, se disponível
  useEffect(() => {
    if (!safraId && defaultSafra?.id) {
      setSafraId(defaultSafra.id);
    }
  }, [defaultSafra, safraId]);

  // Seleciona automaticamente a época padrão (Normal), se disponível
  useEffect(() => {
    if (!epocaId && epocas.length > 0) {
      const normal = epocas.find((e: any) => e.nome === "Normal");
      if (normal) setEpocaId(normal.id);
    }
  }, [epocas, epocaId]);

  // Atualiza estados quando initialData mudar (quando abrimos edição)
  useEffect(() => {
    if (!initialData) return;
    
    // Marca que estamos carregando initialData
    isLoadingInitialData.current = true;
    
    // Configura campos básicos
    if (typeof initialData.produtor_numerocm === "string") {
      setProdutorNumerocm(initialData.produtor_numerocm);
      // Nota: fazendaFiltrada será atualizada pelo useEffect dedicado a [fazendas, produtorNumerocm]
    }
    
    if (typeof initialData.fazenda_idfazenda === "string") {
      setFazendaIdfazenda(initialData.fazenda_idfazenda);
    }
    
    if (typeof initialData.area === "string") setArea(initialData.area);
    if (typeof initialData.area_hectares !== "undefined") setAreaHectares(String(initialData.area_hectares || ""));
    if (typeof initialData.safra_id === "string") setSafraId(initialData.safra_id);
    if (typeof (initialData as any).epoca_id === "string") setEpocaId((initialData as any).epoca_id);
    
    // Carregar talhões selecionados (normaliza para string)
    if (Array.isArray((initialData as any).talhao_ids)) {
      const norm = ((initialData as any).talhao_ids || []).map((id: any) => String(id));
      setTalhaoIds(norm);
    }
    
    if (Array.isArray(initialData.cultivares)) setItensCultivar(initialData.cultivares.map((c) => {
      const tipo = normalizeTipoTratamento((c as any).tipo_tratamento);
      const base: ItemCultivar & { uiId: string } = { ...(c as ItemCultivar), tipo_tratamento: tipo, uiId: makeUiId() };
      base.data_plantio = normalizeDateInput((c as any).data_plantio);
      if (tipo === "NÃO") {
        (base as any).tratamento_ids = [];
        (base as any).tratamento_id = undefined;
      }
      return base;
    }));
    
    if (Array.isArray(initialData.adubacao)) setItensAdubacao((initialData.adubacao as ItemAdubacao[]).map((a: any) => ({
      ...a,
      data_aplicacao: normalizeDateInput(a?.data_aplicacao)
    })));
    
    // Detecta caso de "não fazer adubação" quando há apenas justificativa sem formulação
    if (Array.isArray(initialData.adubacao)) {
      const temFormulacao = initialData.adubacao.some((a) => !!(a as ItemAdubacao).formulacao);
      const temJustificativa = initialData.adubacao.some((a) => !!(a as ItemAdubacao).justificativa_nao_adubacao_id);
      setNaoFazerAdubacao(!!temJustificativa && !temFormulacao);
    }
  }, [initialData]); // Removido fazendas da dependência para evitar reset ao atualizar lista

  // Resolve o UUID da fazenda selecionada (necessário para buscar talhões)
  useEffect(() => {
    if (!initialData?.fazenda_idfazenda) return;
    
    const f0 = (fazendas || []).find((f: any) => String(f.idfazenda) === String(initialData.fazenda_idfazenda))
      || fazendaFiltrada.find((f: any) => String(f.idfazenda) === String(initialData.fazenda_idfazenda));
      
    if (f0?.id) {
      setSelectedFazendaUuid(f0.id);
    }
  }, [fazendas, fazendaFiltrada, initialData]);

  // Garante consistência: quando as fazendas carregarem, refiltra para o produtor atual
  useEffect(() => {
    const cm = String(produtorNumerocm || "").trim();
    if (!cm) {
      setFazendaFiltrada(fazendas);
      return;
    }
    const filtered = (fazendas || []).filter((f: any) => String(f.numerocm || "").trim() === cm);
    setFazendaFiltrada(filtered);
  }, [fazendas, produtorNumerocm]);

  // Finaliza fase de carregamento inicial apenas quando já temos a fazenda selecionada resolvida
  useEffect(() => {
    if (!initialData) return;
    if (fazendaSelecionadaId) {
      isLoadingInitialData.current = false;
    }
  }, [fazendaSelecionadaId, initialData]);

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
    // Não limpar durante carregamento de initialData
    if (isLoadingInitialData.current) return;
    
    if (produtorNumerocm) {
      const filtered = fazendas.filter(f => f.numerocm === produtorNumerocm);
      setFazendaFiltrada(filtered);
      // Em modo edição, não limpar automaticamente os campos
      if (!initialData) {
        // console.log("Clearing fields due to produtor change");
        setFazendaIdfazenda("");
        setArea("");
        setTalhaoIds([]);
        // Resetar hectares ao trocar de produtor para evitar resquícios
        setAreaHectares("");
      }
    }
  }, [produtorNumerocm, fazendas]);

  // Ref para rastrear mudança de fazenda
  const prevFazendaIdRef = useRef<string | undefined>(undefined);

  // Limpa talhões ao trocar de fazenda e atualiza o nome da área
  useEffect(() => {
    // Não limpar durante carregamento de initialData
    if (isLoadingInitialData.current) return;
    
    if (!fazendaIdfazenda) return;
    const fazendaSelecionada = fazendaFiltrada.find((f) => f.idfazenda === fazendaIdfazenda);
    // Sincroniza o campo de "área" (nome da fazenda) com a fazenda selecionada
    setArea(fazendaSelecionada?.nomefazenda || "");
    
    // Limpa talhões selecionados APENAS se trocou de fazenda (ID mudou)
    // Se for apenas atualização da lista de fazendas (refetch), mantém a seleção
    if (prevFazendaIdRef.current !== fazendaIdfazenda) {
      if (!initialData) {
        setTalhaoIds([]);
        setAreaHectares("");
      }
      prevFazendaIdRef.current = fazendaIdfazenda;
    }
  }, [fazendaIdfazenda, fazendaFiltrada]);

  useEffect(() => {
    if (isLoadingInitialData.current) return;
    if (!initialData) {
      setTalhaoIds([]);
      setAreaHectares("");
    }
  }, [safraId, epocaId]);

  // Calcula automaticamente a área total dos talhões selecionados
  useEffect(() => {
    if (talhaoIds.length === 0) {
      setAreaHectares("");
      return;
    }
    const areaTotal = talhoesDaFazenda
      .filter(t => talhaoIds.includes(t.id))
      .reduce((sum, t) => sum + Number(t.area || 0), 0);
    setAreaHectares(String(areaTotal));
  }, [talhaoIds, talhoesDaFazenda]);

  const handleAddCultivar = () => {
    setItensCultivar([{
      uiId: makeUiId(),
      cultivar: "",
      percentual_cobertura: 100,
      tipo_embalagem: "",
      tipo_tratamento: "NÃO" as const
    }, ...itensCultivar]);
  };

  const handleRemoveCultivar = (index: number) => {
    setItensCultivar(itensCultivar.filter((_, i) => i !== index));
  };

  const handleCultivarChange = (index: number, field: keyof ItemCultivar, value: any) => {
    setItensCultivar((prev) => {
      const newItems = [...prev];
      newItems[index] = { ...newItems[index], [field]: value };
      return newItems;
    });
  };

  const handleAddAdubacao = () => {
    setItensAdubacao([{ formulacao: "", dose: 0, percentual_cobertura: 100 }, ...itensAdubacao]);
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

  const handleSubmit = async (e: React.FormEvent) => {
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
    const areaHectaresFinal = Number(areaHectares);

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

    const adubacaoNormal = itensAdubacao.filter((item) => !!item.formulacao);
    if (!naoFazerAdubacao && adubacaoNormal.length === 0) {
      toast({
        title: "Erro de validação",
        description: "Adicione pelo menos uma adubação ou marque 'Não fazer adubação'",
        variant: "destructive",
      });
      return;
    }

    if (talhaoIds.length === 0) {
      toast({
        title: "Erro de validação",
        description: "Selecione pelo menos um talhão",
        variant: "destructive"
      });
      return;
    }

    // Garantir catálogo de defensivos disponível
    let defensivosCatalogLocal = defensivosCatalog;
    if (!defensivosCatalogLocal || defensivosCatalogLocal.length === 0) {
      try {
        const baseUrl = getApiBaseUrl();
        const res = await fetch(`${baseUrl}/defensivos`, { credentials: "omit" });
        if (res.ok) {
          const json = await res.json();
          defensivosCatalogLocal = (json?.items ?? []) as any[];
        }
      } catch {}
    }

    const data: CreateProgramacao = {
      produtor_numerocm: produtorNumerocm,
      fazenda_idfazenda: fazendaIdfazenda,
      area: areaNome,
      area_hectares: areaHectaresFinal,
      safra_id: safraId || undefined,
      tipo: tipoProgramacao,
      epoca_id: epocaId || undefined,
      talhao_ids: talhaoIds,
      // Remove uiId antes de enviar
      cultivares: itensCultivar
        .filter(item => item.cultivar)
        .map(({ uiId, ...rest }) => {
          // Se for NA FAZENDA, incluir defensivos_fazenda
          if (rest.tipo_tratamento === "NA FAZENDA") {
            const defsInput = ((rest as any).defensivos_fazenda || []) as DefensivoNaFazenda[];
            const defsNormalized = defsInput.map((d) => {
              const sel = (defensivosCatalogLocal || []).find((x: any) => String(x.item) === String(d.defensivo));
              const codRaw = d.cod_item || (sel?.cod_item ? String(sel.cod_item) : "");
              return {
                classe: String(d.classe || "").trim() ? String(d.classe) : null,
                aplicacao: String(d.aplicacao || "Tratamento de Semente - TS"),
                defensivo: String(d.defensivo || ""),
                cod_item: String(codRaw || ""),
                dose: Number(d.dose) || 0,
                cobertura: Number(d.cobertura) || 100,
                total: Number(d.total) || 0,
                produto_salvo: !!d.produto_salvo,
              } as any;
            });
            const result = { ...rest, defensivos_fazenda: defsNormalized } as any;
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

    // Validação: campos obrigatórios por cultivar
    const cultsIncompletas = itensCultivar.some((it) => {
      // Cultura, Cultivar, Embalagem, Tratamento (tipo), Data Plantio, Sementes/m², % Cobertura
      if (!it.cultura) return true;
      if (!it.cultivar) return true;
      if (!it.tipo_embalagem) return true;
      if (!it.tipo_tratamento) return true;
      if (!it.data_plantio) return true;
      if (!it.populacao_recomendada || it.populacao_recomendada <= 0) return true;
      if (!it.percentual_cobertura || it.percentual_cobertura <= 0) return true;
      return false;
    });

    if (cultsIncompletas) {
      toast({
        title: "Erro de validação",
        description: "Em Cultivares / Sementes, tem que ser obrigatório: Cultura, Cultivar, Embalagem, Tratamento, Data Provável de plantio, Sementes por M2 e % Cobertura.",
        variant: "destructive",
      });
      return;
    }

    // Validação: Tratamento Industrial exige seleção do tratamento
    const cultsIndustrialSemTratamento = itensCultivar.some((it) => {
      if (it.tipo_tratamento !== "INDUSTRIAL") return false;
      const ids = it.tratamento_ids;
      return !ids || ids.length === 0;
    });

    if (cultsIndustrialSemTratamento) {
      toast({
        title: "Erro de validação",
        description: "Se tiver tratamento INDUSTRIAL tem que selecionar qual tratamento.",
        variant: "destructive",
      });
      return;
    }

    // Validação: cada adubação deve ter embalagem selecionada
    if (!naoFazerAdubacao) {
      const adubsSemEmbalagem = itensAdubacao.filter((it) => !!it.formulacao && !String(it.embalagem || "").trim());
      if (adubsSemEmbalagem.length > 0) {
        toast({
          title: "Erro de validação",
          description: "Selecione a embalagem para cada adubação",
          variant: "destructive",
        });
        return;
      }
    }

    // Validação: Tratamento na Fazenda exige pelo menos um defensivo válido
    const cultsNaFazendaSemDefensivo = itensCultivar.filter((it) => {
      if (it.tipo_tratamento !== "NA FAZENDA") return false;
      const defs = it.defensivos_fazenda as DefensivoNaFazenda[] | undefined;
      // Se não tem lista ou lista vazia, é inválido
      if (!defs || defs.length === 0) return true;
      // Se tem lista, verifica se pelo menos um tem nome de defensivo preenchido
      const temValido = defs.some((d) => !!d.defensivo && String(d.defensivo).trim().length > 0);
      return !temValido;
    });

    if (cultsNaFazendaSemDefensivo.length > 0) {
      toast({
        title: "Erro de validação",
        description: "Para tratamento na fazenda, é necessário adicionar pelo menos um defensivo válido em cada cultivar.",
        variant: "destructive",
      });
      return;
    }

    try {
      const defensivosSnapshot = (data.cultivares || []).flatMap((c: any) => c?.defensivos_fazenda || []);
    } catch {}
    onSubmit(data);
  };

  return (
    <Card className="overflow-hidden relative">
      {isLoading && (
        <div className="absolute inset-0 bg-background/80 flex items-center justify-center z-50">
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="text-sm text-muted-foreground">Carregando dados...</span>
          </div>
        </div>
      )}
      <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-6">
        {title && (
          <h2 className="text-xl sm:text-2xl font-bold mb-2">{title}</h2>
        )}
        {readOnly && (
          <div className="p-3 rounded-md bg-muted text-muted-foreground text-sm">
            Edição bloqueada para consultores. Solicite liberação ao administrador.
          </div>
        )}
        <fieldset disabled={readOnly} className={readOnly ? "opacity-60" : ""}>
        
        {/* Seção Produtor/Safra/Fazenda */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Produtor</Label>
            <Select value={produtorNumerocm} onValueChange={setProdutorNumerocm}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o produtor" />
              </SelectTrigger>
              <SelectContent>
                {Array.from(new Map(produtores.map((p: any) => [String(p.numerocm), p])).values()).map((p: any) => (
                  <SelectItem key={p.numerocm} value={p.numerocm}>
                    {p.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <Label>Fazenda</Label>
              {fazendaIdfazenda && fazendaSelecionadaId && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setGerenciarTalhoesOpen(true)}
                  className="h-8 gap-1 w-full sm:w-auto"
                >
                  <Settings className="h-4 w-4" />
                  <span className="sm:inline">Gerenciar Talhões</span>
                </Button>
              )}
            </div>
            <Select value={fazendaIdfazenda} onValueChange={(val) => {
              setFazendaIdfazenda(val);
              const f0 = fazendaFiltrada.find((f: any) => String(f.idfazenda) === String(val))
                || (fazendas || []).find((f: any) => String(f.idfazenda) === String(val));
              setSelectedFazendaUuid(f0?.id);
            }} disabled={!produtorNumerocm}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a fazenda" />
              </SelectTrigger>
              <SelectContent>
                {fazendaFiltrada.map((f: any) => {
                  const invalid = !f.area_cultivavel || Number(f.area_cultivavel) <= 0;
                  return (
                    <SelectItem key={`${f.id}-${f.idfazenda}`} value={f.idfazenda}>
                      <div className="flex flex-col gap-1">
                        <span>{f.nomefazenda}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">({Number(f.area_cultivavel || 0)} ha)</span>
                          {invalid && <Badge variant="destructive" className="text-xs">sem área</Badge>}
                        </div>
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Safra</Label>
            <Select value={safraId} onValueChange={setSafraId} disabled={!fazendaIdfazenda}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a safra" />
              </SelectTrigger>
              <SelectContent>
                {Array.from(new Map(((safras || []).filter((s: any) => s.ativa)).map((s: any) => [String(s.id), s])).values()).map((s: any) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.nome}{s.is_default ? " (Padrão)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Época</Label>
            <Select value={epocaId} onValueChange={setEpocaId} disabled={!safraId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a época" />
              </SelectTrigger>
              <SelectContent>
                {Array.from(new Map((epocas || []).map((e: any) => [String(e.id), e])).values()).map((e: any) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Tipo</Label>
            <Select value={tipoProgramacao} onValueChange={(v) => setTipoProgramacao(v as any)}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="PROGRAMACAO">Programação</SelectItem>
                <SelectItem value="PREVIA">Prévia</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {fazendaIdfazenda && safraId && epocaId && talhoesDisponiveis.length > 0 && (
            <div className="space-y-2 lg:col-span-2">
              <Label>Talhões Disponíveis *</Label>
              <div className="border rounded-lg p-3 space-y-2 max-h-60 overflow-y-auto">
                {talhoesDisponiveis
                  .filter((t) => !fazendaSelecionadaId || String(t.fazenda_id) === String(fazendaSelecionadaId))
                  .map((talhao) => (
                  <div key={talhao.id} className="flex items-center space-x-2 py-1">
                    <Checkbox
                      id={`talhao-${talhao.id}`}
                      checked={talhaoIds.includes(talhao.id)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setTalhaoIds([...talhaoIds, talhao.id]);
                        } else {
                          setTalhaoIds(talhaoIds.filter(id => id !== talhao.id));
                        }
                      }}
                    />
                    <Label 
                      htmlFor={`talhao-${talhao.id}`}
                      className="flex-1 cursor-pointer font-normal text-sm"
                    >
                      {talhao.nome} - {Number(talhao.area).toFixed(2)} ha
                    </Label>
                  </div>
                ))}
              </div>
              {talhaoIds.length > 0 && (
                <div className="text-xs sm:text-sm text-muted-foreground bg-muted/30 p-2 rounded">
                  {talhaoIds.length} talhão(ões) selecionado(s) • Total: {areaHectares} ha
                </div>
              )}
            </div>
          )}

          {fazendaIdfazenda && safraId && epocaId && talhoesDisponiveis.length === 0 && (
            <div className="space-y-2 p-3 border border-amber-200/50 rounded-lg bg-amber-50 lg:col-span-2">
              <Badge variant="outline" className="mb-1 border-amber-200 text-amber-700">Sem talhões disponíveis</Badge>
              <p className="text-xs sm:text-sm text-muted-foreground">
                {talhoesDaFazenda.length > 0
                  ? "Todos os talhões desta fazenda já possuem programação nesta safra e época."
                  : "Não existem talhões cadastrados para esta fazenda nesta safra."}
              </p>
            </div>
          )}
        </div>

        {/* Seção Cultivares */}
        <div className="border-t pt-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <h3 className="text-lg font-semibold">Cultivares / Sementes</h3>
            <Button type="button" onClick={handleAddCultivar} variant="outline" size="sm" className="w-full sm:w-auto">
              <Plus className="h-4 w-4 mr-1" />
              Adicionar
            </Button>
          </div>

          <div className="space-y-4">
            {itensCultivar.map((item, index) => (
              <CultivarRow
                key={item.uiId}
                item={item}
                index={index}
                cultivaresDistinct={cultivaresDistinct}
                cultivaresCatalog={cultivares}
                embalagensCultivar={embalagensCultivar}
          canRemove={itensCultivar.length > 1}
          areaHectares={Number(areaHectares) || 0}
          onChange={handleCultivarChange}
          onRemove={handleRemoveCultivar}
        />
            ))}
          </div>

          <div className={`text-sm font-medium ${getTotalCultivar() === 100 ? "text-green-600" : "text-red-600"}`}>
            Total: {getTotalCultivar().toFixed(2)}% {getTotalCultivar() !== 100 && "(deve ser 100%)"}
          </div>
        </div>

        {/* Seção Adubação */}
        <div className="border-t pt-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <h3 className="text-lg font-semibold">Adubação</h3>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
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
                <Button type="button" onClick={handleAddAdubacao} variant="outline" size="sm" className="w-full sm:w-auto">
                  <Plus className="h-4 w-4 mr-1" />
                  Adicionar
                </Button>
              )}
            </div>
          </div>

          {naoFazerAdubacao ? (
            <div className="space-y-4">
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
                  {Array.from(new Map((justificativas || []).map((j: any) => [String(j.id), j])).values()).map((j: any) => (
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
                <div key={index} className="p-3 md:p-4 border rounded-lg space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
                    <div className="space-y-2 sm:col-span-2 lg:col-span-2">
                      <Label>Formulação</Label>
                      <Popover open={openFormulacaoIndex === index} onOpenChange={(o) => setOpenFormulacaoIndex(o ? index : null)}>
                        <PopoverTrigger asChild>
                          <Button variant="outline" role="combobox" aria-expanded={openFormulacaoIndex === index} className="w-full justify-between">
                            {item.formulacao ? item.formulacao : "Selecione"}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-full p-0">
                          <Command>
                            <CommandInput placeholder="Buscar formulação..." />
                            <CommandList>
                              <CommandEmpty>Nenhuma formulação encontrada.</CommandEmpty>
                              <CommandGroup>
                                {item.formulacao && !fertilizantesDistinct.some((f) => (f.item || "") === item.formulacao) && (
                                  <CommandItem
                                    key={`saved-${index}`}
                                    value={item.formulacao}
                                    onSelect={(currentValue) => {
                                      handleAdubacaoChange(index, "formulacao", currentValue);
                                      setOpenFormulacaoIndex(null);
                                    }}
                                  >
                                    <Check className={cn("mr-2 h-4 w-4", item.formulacao === item.formulacao ? "opacity-100" : "opacity-0")} />
                                    {item.formulacao}
                                  </CommandItem>
                                )}
                                {fertilizantesDistinct.map((f) => (
                                  <CommandItem
                                    key={f.cod_item ?? f.item ?? `${index}-f`}
                                    value={`${f.item || ""}${f.marca ? ` ${f.marca}` : ""}`}
                                    onSelect={(currentValue) => {
                                      handleAdubacaoChange(index, "formulacao", String(f.item || currentValue));
                                      setOpenFormulacaoIndex(null);
                                    }}
                                  >
                                    <Check className={cn("mr-2 h-4 w-4", item.formulacao === f.item ? "opacity-100" : "opacity-0")} />
                                    {f.item}
                                    {f.marca && (
                                      <span className="ml-2 text-xs text-muted-foreground">({f.marca})</span>
                                    )}
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
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

                  <div className="space-y-2 sm:col-span-2 lg:col-span-1">
                    <Label>Data provável</Label>
                    <Input
                      type="date"
                      value={item.data_aplicacao || ""}
                      onChange={(e) => handleAdubacaoChange(index, "data_aplicacao", e.target.value)}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Embalagem</Label>
                    <Select
                      value={item.embalagem || ""}
                      onValueChange={(value) => handleAdubacaoChange(index, "embalagem", value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a embalagem" />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from(new Map((embalagensFertilizantesAll || []).map((e: any) => [String(e.id), e])).values()).map((e: any, idx: number) => (
                          <SelectItem key={e.id || `fert-${idx}`} value={e.nome}>{e.nome}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                    
                  <div className="space-y-2 sm:col-span-2 lg:col-span-1">
                    <Label>% Cobertura</Label>
                    <div className="flex gap-2">
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
                        className="flex-1"
                      />
                      <Button
                        type="button"
                        variant="destructive"
                        size="icon"
                        onClick={() => handleRemoveAdubacao(index)}
                        disabled={false}
                        className="shrink-0"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  </div>

                  <div className="flex flex-wrap items-center gap-6 pt-2 border-t sm:col-span-2 lg:col-span-3 xl:col-span-5">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id={`adubacao-salvo-${index}`}
                        checked={!!item.fertilizante_salvo}
                        onCheckedChange={(checked) => handleAdubacaoChange(index, "fertilizante_salvo", !!checked)}
                      />
                      <Label htmlFor={`adubacao-salvo-${index}`} className="text-sm">
                        Fertilizante proprio
                      </Label>
                    </div>

                    {item.fertilizante_salvo && (
                      <div className="flex items-center gap-2">
                        <Label htmlFor={`adubacao-porcentagem-${index}`} className="text-sm whitespace-nowrap">
                          % Salva:
                        </Label>
                        <Input
                          id={`adubacao-porcentagem-${index}`}
                          type="number"
                          className="w-20 h-8"
                          min="0"
                          max="100"
                          value={item.porcentagem_salva || 0}
                          onChange={(e) => handleAdubacaoChange(index, "porcentagem_salva", Number(e.target.value))}
                        />
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="text-sm font-medium text-muted-foreground">
            {!naoFazerAdubacao && `Total cobertura: ${getTotalAdubacao().toFixed(2)}%`}
          </div>
        </div>

        </fieldset>

        {/* Botões de ação */}
        <div className="flex flex-col sm:flex-row gap-3 pt-6">
          <Button type="button" variant="outline" onClick={onCancel} className="w-full sm:w-auto">
            Cancelar
          </Button>
          <Button type="submit" className="w-full sm:w-auto" disabled={readOnly}>
            {submitLabel || "Salvar Programação"}
          </Button>
        </div>
      </form>
      
      {fazendaSelecionadaId && (
        <GerenciarTalhoes
        fazendaId={fazendaSelecionadaId}
        fazendaNome={fazendaFiltrada.find(f => f.id === fazendaSelecionadaId)?.nomefazenda || ""}
        safraId={safraId}
        epocaId={epocaId}
        open={gerenciarTalhoesOpen}
        onOpenChange={setGerenciarTalhoesOpen}
      />
      )}
    </Card>
  );
};
  const normalizeDateInput = (s?: string | null) => {
    if (!s) return "";
    const t = String(s);
    if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
    const m = t.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
    const d = new Date(t);
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
    return "";
  };
