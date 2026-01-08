import { useState, useEffect, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Check, ChevronsUpDown, Plus, Trash2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn, safeRandomUUID, getApiBaseUrl } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { useProdutores } from "@/hooks/useProdutores";
import { useDefensivosCatalog } from "@/hooks/useDefensivosCatalog";
import { useCalendarioAplicacoes } from "@/hooks/useCalendarioAplicacoes";
import { useFazendas } from "@/hooks/useFazendas";
import type { DefensivoItem } from "@/hooks/useAplicacoesDefensivos";
import { useProgramacaoCultivares } from "@/hooks/useProgramacaoCultivares";
import { useSafras } from "@/hooks/useSafras";
import { useAplicacoesDefensivos } from "@/hooks/useAplicacoesDefensivos";
import { useProgramacaoAdubacao } from "@/hooks/useProgramacaoAdubacao";
import { useTalhoesForApp } from "@/hooks/useTalhoesForApp";

type FormAplicacaoDefensivoProps = {
  onSubmit: (data: { produtor_numerocm: string; area: string; tipo?: "PROGRAMACAO" | "PREVIA"; talhao_ids?: string[]; defensivos: Omit<DefensivoItem, "id">[] }) => void;
  onCancel: () => void;
  isLoading?: boolean;
  initialData?: {
    id?: string;
    produtor_numerocm?: string;
    area?: string;
    tipo?: "PROGRAMACAO" | "PREVIA";
    defensivos?: DefensivoItem[];
    talhao_ids?: string[];
  };
  title?: string;
  submitLabel?: string;
  readOnly?: boolean;
};

export const FormAplicacaoDefensivo = ({
  onSubmit,
  onCancel,
  isLoading = false,
  initialData,
  title = "Nova Aplicação de Defensivos",
  submitLabel = "Salvar aplicação",
  readOnly = false,
}: FormAplicacaoDefensivoProps) => {
  const { data: produtores } = useProdutores();
  const { data: defensivosCatalog } = useDefensivosCatalog();
  const { data: calendario } = useCalendarioAplicacoes();

  const [produtorNumerocm, setProdutorNumerocm] = useState("");
  const [area, setArea] = useState("");
  const [openFazenda, setOpenFazenda] = useState(false);
  const { data: fazendas } = useFazendas(produtorNumerocm);
  const [selectedAreaHa, setSelectedAreaHa] = useState<number>(0);
  const [selectedTalhaoIds, setSelectedTalhaoIds] = useState<string[]>([]);
  const [tipo, setTipo] = useState<"PROGRAMACAO" | "PREVIA">("PROGRAMACAO");
  const [talhoesOptions, setTalhoesOptions] = useState<Array<{ id: string; nome: string; area: number }>>([]);
  const { safras, defaultSafra } = useSafras();
  const { aplicacoes = [] } = useAplicacoesDefensivos();
  const [safraId, setSafraId] = useState<string>("");
  const [openSafra, setOpenSafra] = useState(false);
  const isUuidLocal = (s?: string | null) => !!s && /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(String(s));
  const { programacoes: cultProgramacoes = [], isLoading: isCultLoading } = useProgramacaoCultivares();
  const { programacoes: adubProgramacoes = [], isLoading: isAdubLoading } = useProgramacaoAdubacao();
  const talhoesKey = useMemo(() => {
    const cm = String(produtorNumerocm || "").trim();
    const a = String(area || "").trim();
    const s = String(safraId || "").trim();
    return cm && a && s ? `${cm}|${a}|${s}` : "";
  }, [produtorNumerocm, area, safraId]);
  
  const [defensivos, setDefensivos] = useState<Array<Omit<DefensivoItem, "id"> & { tempId: string; total?: number }>>([
    {
      tempId: safeRandomUUID(),
      defensivo: "",
      dose: 0,
      unidade: "L/ha",
      alvo: "",
      aplicacoes: [],
      produto_salvo: false,
      deve_faturar: true,
      porcentagem_salva: 100,
      area_hectares: 0,
      total: 0,
    },
  ]);

  const [openProdutorPopover, setOpenProdutorPopover] = useState(false);

  // Seleções de calendário agora são por produto (na linha)

  useEffect(() => {
    if (initialData) {
      setProdutorNumerocm(initialData.produtor_numerocm || "");
      setArea(initialData.area || "");
      if (initialData.tipo) {
        const t = String(initialData.tipo);
        if (t === "Programação" || t === "PROGRAMACAO") setTipo("PROGRAMACAO");
        else if (t === "Prévia" || t === "PREVIA") setTipo("PREVIA");
        else setTipo("PROGRAMACAO");
      }
      const candidates = (initialData.defensivos || []).map((d) => String((d as any).safra_id || "").trim());
      const picked = candidates.find((s) => isUuidLocal(s)) || candidates.find((s) => !!s) || "";
      if (picked) setSafraId(String(picked));
      if (initialData.defensivos && initialData.defensivos.length > 0) {
        setDefensivos(
          initialData.defensivos.map((def) => ({
            ...def,
            tempId: safeRandomUUID(),
            // Separar as aplicações concatenadas do campo alvo
            aplicacoes: def.alvo ? def.alvo.split(",").map(a => a.trim()) : [],
            porcentagem_salva: Math.min(100, Math.max(1, Number(def.porcentagem_salva ?? 100))),
            total: ( (Number(def.dose) || 0) * (Number(def.area_hectares) || 0) * (Math.min(100, Math.max(1, Number(def.porcentagem_salva ?? 100))) / 100) ),
          }))
        );
        setSelectedAreaHa(initialData.defensivos[0]?.area_hectares || 0);
      }
      if (initialData.talhao_ids && Array.isArray(initialData.talhao_ids)) {
        setSelectedTalhaoIds(initialData.talhao_ids.map(String));
      }
    }
  }, [initialData]);

  // Prefill de safra na edição quando não está salvo em programacao_defensivos
  useEffect(() => {
    if (safraId) return;
    const cm = String(initialData?.produtor_numerocm || "").trim();
    const a = String(initialData?.area || "").trim();
    if (!cm || !a) return;
    const cultSafras = new Set<string>((cultProgramacoes || [])
      .filter((p) => String(p.produtor_numerocm || "").trim() === cm && String(p.area || "").trim() === a)
      .map((p) => String(p.safra || "").trim())
    );
    const adubSafras = new Set<string>((adubProgramacoes || [])
      .filter((p: any) => String(p.produtor_numerocm || "").trim() === cm && String(p.area || "").trim() === a)
      .map((p: any) => String(p.safra_id || "").trim())
    );
    const inter = Array.from(cultSafras).filter((s) => !!s && adubSafras.has(s));
    const choice = inter.find((s) => isUuidLocal(s)) || inter[0] || "";
    if (choice) setSafraId(choice);
  }, [safraId, initialData, cultProgramacoes, adubProgramacoes]);

  // Ao abrir nova aplicação, selecionar automaticamente a safra padrão do banco
  useEffect(() => {
    if (!initialData && !safraId && defaultSafra) {
      setSafraId(String(defaultSafra.id));
    }
  }, [defaultSafra, initialData, safraId]);

  // Fallback adicional: se não houver padrão explícito, escolher primeira ativa ou a primeira da lista
  useEffect(() => {
    if (initialData || safraId) return;
    const list = safras || [];
    if (!list.length) return;
    const candidate = defaultSafra
      || list.find((s: any) => s?.is_default)
      || list.find((s: any) => s?.ativa)
      || list[0];
    if (candidate?.id) {
      setSafraId(String(candidate.id));
    }
  }, [safras, defaultSafra, initialData, safraId]);

  useEffect(() => {
    setDefensivos((prev) =>
      prev.map((d) => ({
        ...d,
        total: ( (Number(d.dose) || 0) * (selectedAreaHa || 0) * ( (Math.min(100, Math.max(1, Number(d.porcentagem_salva ?? 100))) ) / 100) ),
      }))
    );
  }, [selectedAreaHa]);

  const handleAddDefensivo = () => {
    setDefensivos([
      {
        tempId: safeRandomUUID(),
        classe: "",
        defensivo: "",
        dose: 0,
        unidade: "L/ha",
        alvo: "",
        aplicacoes: [],
        produto_salvo: false,
        deve_faturar: true,
        porcentagem_salva: 100,
        area_hectares: 0,
        total: 0,
      },
      ...defensivos
    ]);
  };

  const handleRemoveDefensivo = (tempId: string) => {
    if (defensivos.length === 1) return;
    setDefensivos(defensivos.filter((d) => d.tempId !== tempId));
  };

  const handleDefensivoChange = (tempId: string, field: keyof Omit<DefensivoItem, "id">, value: any) => {
    setDefensivos((prev) =>
      prev.map((d) => {
        if (d.tempId === tempId) {
          const updated = { ...d, [field]: value } as Omit<DefensivoItem, "id"> & { tempId: string };
          if (field === "porcentagem_salva") {
            const coberturaRaw = parseFloat(value);
            const cobertura = isNaN(coberturaRaw) ? 100 : Math.min(100, Math.max(0, coberturaRaw));
            updated.porcentagem_salva = cobertura as any;
          }
          if (field === "dose" || field === "porcentagem_salva") {
            const dose = Number(field === "dose" ? value : (updated as any).dose) || 0;
            const cobertura = Math.min(100, Math.max(0, Number((updated as any).porcentagem_salva ?? 100)));
            (updated as any).total = dose * (selectedAreaHa || 0) * (cobertura / 100);
          }
          return updated;
        }
        return d;
      })
    );
  };

  // Mapa de defensivos já selecionados por aplicação (para evitar duplicados na mesma aplicação)
  const existingByAplicacao = useMemo(() => {
    const map: Record<string, string[]> = {};
    defensivos.forEach((d) => {
      if ((d as any).produto_salvo) return;
      const ap = (d.aplicacoes && d.aplicacoes[0]) || d.alvo || "";
      const key = String(ap || "").trim();
      const name = String(d.defensivo || "").trim();
      if (!key || !name) return;
      if (!map[key]) map[key] = [];
      map[key].push(name);
    });
    return map;
  }, [defensivos]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!safraId) {
      alert("Selecione a Safra antes do Produtor/Fazenda");
      return;
    }
    if (!produtorNumerocm || !area) {
      alert("Por favor, preencha Produtor e Fazenda");
      return;
    }

    // Regra de negócio: bloquear se não existir programação de cultivar nem de adubação para produtor/fazenda
    if (!hasCultivarProgram && !hasAdubacaoProgram) {
      alert("Não é possível cadastrar defensivos antes de registrar a programação de Cultivar ou Adubação para este produtor/fazenda.");
      return;
    }

    // Bloqueio: não permitir duplicidade produtor/fazenda/safra já existente
    const dup = (aplicacoes || []).find((ap: any) =>
      String(ap.produtor_numerocm || "") === String(produtorNumerocm || "") &&
      String(ap.area || "") === String(area || "") &&
      ((ap.defensivos || []) as any[]).some((d: any) => String(d?.safra_id || "") === String(safraId || ""))
    );
    if (dup && (!initialData?.id || String(dup.id) !== String(initialData.id))) {
      alert("Já existe aplicação de defensivos para este Produtor/Fazenda nesta Safra.");
      return;
    }

    // Validação: Talhão obrigatório
    if (selectedTalhaoIds.length === 0) {
      alert("Por favor, selecione pelo menos um Talhão.");
      return;
    }

    // Validação dos campos obrigatórios nos defensivos
    if (defensivos.length === 0) {
      alert("Por favor, adicione pelo menos um defensivo.");
      return;
    }

    const hasInvalidDefensivo = defensivos.some((d) => {
      const hasClasse = !!d.classe;
      const hasAplicacao = (d.aplicacoes && d.aplicacoes.length > 0) || !!d.alvo;
      const hasDefensivo = !!d.defensivo;
      const hasDose = Number(d.dose) > 0;
      // Cobertura (porcentagem_salva) padrão é 100, mas vamos garantir que não seja 0 se isso for o critério
      // O usuário pediu "Cobertura" obrigatório. Como é um número, assumimos > 0.
      const hasCobertura = Number(d.porcentagem_salva ?? 0) > 0;

      return !hasClasse || !hasAplicacao || !hasDefensivo || !hasDose || !hasCobertura;
    });

    if (hasInvalidDefensivo) {
      alert("Por favor, preencha todos os campos obrigatórios dos defensivos: Classe, Aplicação, Defensivo, Dose e Cobertura.");
      return;
    }

    if (Number(selectedAreaHa) <= 0) {
       alert("Área inválida.");
       return;
    }

    const defensivosToSubmit = defensivos.map(({ tempId, total, aplicacoes, ...def }) => ({
      ...def,
      safra_id: safraId,
      area_hectares: selectedAreaHa,
      alvo: aplicacoes && aplicacoes.length > 0 ? aplicacoes.join(", ") : def.alvo,
    }));
    onSubmit({ produtor_numerocm: produtorNumerocm, area, tipo, talhao_ids: selectedTalhaoIds, defensivos: defensivosToSubmit });
  };

  const selectedProdutor = produtores?.find((p) => p.numerocm === produtorNumerocm);

  const hasCultivarProgram = useMemo(() => {
    if (!produtorNumerocm || !area || !safraId) return false;
    const a = String(area || "").trim();
    const cm = String(produtorNumerocm || "").trim();
    const s = String(safraId || "").trim();
    return (cultProgramacoes || []).some(
      (p) =>
        String(p.produtor_numerocm || "").trim() === cm &&
        String(p.area || "").trim() === a &&
        String(p.safra || "").trim() === s
    );
  }, [cultProgramacoes, produtorNumerocm, area, safraId]);

  const hasAdubacaoProgram = useMemo(() => {
    if (!produtorNumerocm || !area || !safraId) return false;
    const a = String(area || "").trim();
    const cm = String(produtorNumerocm || "").trim();
    const s = String(safraId || "").trim();
    return (adubProgramacoes || []).some(
      (p: any) =>
        String(p.produtor_numerocm || "").trim() === cm &&
        String(p.area || "").trim() === a &&
        String(p.safra_id || "").trim() === s
    );
  }, [adubProgramacoes, produtorNumerocm, area, safraId]);

  // Atualiza a área selecionada com base nos talhões da programação correspondente (via Hook)
  const { data: talhoesData } = useTalhoesForApp(produtorNumerocm, area, safraId, fazendas);

  useEffect(() => {
    if (!talhoesData) return;
    
    const { options, fallbackArea } = talhoesData;
    setTalhoesOptions(options);

    // Se não houver talhões, usa fallback
    if (options.length === 0) {
      setSelectedAreaHa(fallbackArea);
      // Se não tem talhões, limpa seleção anterior de IDs para evitar inconsistência
      if (selectedTalhaoIds.length > 0) setSelectedTalhaoIds([]);
      return;
    }

    const sumAll = options.reduce((acc, t) => acc + t.area, 0);

    const saved = (() => {
      try {
        // Se estiver editando, ignora o localStorage para não sobrescrever o que veio do banco
        if (initialData?.id) return [] as string[];
        if (!talhoesKey) return [] as string[];
        const raw = sessionStorage.getItem(`def-talhoes-sel:${talhoesKey}`);
        const ids = raw ? (JSON.parse(raw) as string[]) : [];
        return ids.filter((id) => options.some((o) => o.id === id));
      } catch {
        return [] as string[];
      }
    })();

    if (saved.length > 0) {
      setSelectedTalhaoIds(saved);
      const idSet = new Set(saved.map(String));
      const sumSel = options.reduce((acc, o) => acc + (idSet.has(o.id) ? o.area : 0), 0);
      setSelectedAreaHa(sumSel > 0 ? sumSel : (sumAll > 0 ? sumAll : 0));
    } else if (selectedTalhaoIds.length > 0) {
      // Revalida seleção existente
      const validIds = selectedTalhaoIds.filter(id => options.some(o => o.id === id));
      if (validIds.length !== selectedTalhaoIds.length) {
         setSelectedTalhaoIds(validIds);
      }
      const idSet = new Set(validIds);
      const sumSel = options.reduce((acc, o) => acc + (idSet.has(o.id) ? o.area : 0), 0);
      setSelectedAreaHa(sumSel > 0 ? sumSel : (sumAll > 0 ? sumAll : 0));
    } else {
      // tentativa simples de inferência
      const target = Number(initialData?.defensivos?.[0]?.area_hectares || 0) || 0;
      if (target > 0) {
        const tolerance = 0.01; 
        const single = options.find((o) => Math.abs(o.area - target) <= tolerance);
        if (single) {
          setSelectedTalhaoIds([single.id]);
          setSelectedAreaHa(single.area);
        } else {
          setSelectedAreaHa(sumAll > 0 ? sumAll : 0);
        }
      } else {
        setSelectedAreaHa(sumAll > 0 ? sumAll : 0);
      }
    }
  }, [talhoesData, talhoesKey, initialData]);

  const allowedProdutoresNumerocm = useMemo(() => {
    if (!safraId) return [] as string[];
    const s = String(safraId);
    
    const cultSet = new Set<string>((cultProgramacoes || [])
      .filter((p) => String(p.safra || "") === s)
      .map((p) => String(p.produtor_numerocm || ""))
    );
    const adubSet = new Set<string>((adubProgramacoes || [])
      .filter((p: any) => String(p.safra_id || "") === s)
      .map((p: any) => String(p.produtor_numerocm || ""))
    );
    
    // Permitir se tiver Cultivar OU Adubação (Union)
    // Isso resolve o problema de exigir ambos
    const union = new Set([...cultSet, ...adubSet]);
    return Array.from(union);
  }, [cultProgramacoes, adubProgramacoes, safraId]);

  const produtoresFiltrados = useMemo(() => {
    if (!safraId) return [] as typeof produtores;
    const base = (produtores || []);
    const filtered = base.filter((p) => allowedProdutoresNumerocm.includes(String(p.numerocm)));
    return filtered;
  }, [produtores, allowedProdutoresNumerocm, safraId]);

  const allowedAreasSet = useMemo(() => {
    const set = new Set<string>();
    if (safraId && produtorNumerocm) {
      const s = String(safraId);
      const cm = String(produtorNumerocm);
      
      const cultAreas = (cultProgramacoes || [])
        .filter((p) => String(p.safra || "") === s && String(p.produtor_numerocm || "") === cm)
        .map((p) => String(p.area || ""));
        
      const adubAreas = (adubProgramacoes || [])
        .filter((p: any) => String(p.safra_id || "") === s && String(p.produtor_numerocm || "") === cm)
        .map((p: any) => String(p.area || ""));
      
      // Union aqui também
      cultAreas.forEach(a => set.add(a));
      adubAreas.forEach(a => set.add(a));
    }
    return set;
  }, [cultProgramacoes, adubProgramacoes, safraId, produtorNumerocm]);

  const fazendasFiltradas = useMemo(() => {
    if (!safraId || !produtorNumerocm) return [] as NonNullable<typeof fazendas>;
    const base = (fazendas || []);
    const s = String(safraId);
    const cm = String(produtorNumerocm);
    const usedAreas = new Set<string>();
    for (const ap of (aplicacoes || [])) {
      if (String(ap.produtor_numerocm || "") !== cm) continue;
      const areaName = String(ap.area || "");
      const defs = (ap.defensivos || []) as any[];
      if (defs.some((d) => String(d?.safra_id || "") === s)) {
        usedAreas.add(areaName);
      }
    }
    const filtered = base.filter((f) => allowedAreasSet.has(String(f.nomefazenda)) && !usedAreas.has(String(f.nomefazenda)));
    return filtered;
  }, [fazendas, allowedAreasSet, safraId, produtorNumerocm, aplicacoes]);

  return (
    <Card className="p-6 mb-6">
      {title && <h3 className="text-lg font-semibold mb-4">{title}</h3>}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Alerta de regra de negócio */}
        {produtorNumerocm && area && !isCultLoading && !isAdubLoading && !(hasCultivarProgram && hasAdubacaoProgram) && (
          <div className="p-3 rounded-md bg-destructive/10 text-destructive text-sm">
            Não é possível cadastrar defensivos antes de registrar a programação de Cultivar e Adubação para este produtor/fazenda.
          </div>
        )}
        {/* Seção fixa */}
        {readOnly && (
          <div className="p-3 rounded-md bg-muted text-muted-foreground text-sm">
            Edição bloqueada para consultores. Solicite liberação ao administrador.
          </div>
        )}
        <fieldset disabled={readOnly} className={readOnly ? "opacity-60" : ""}>
        <div className="grid gap-4 md:grid-cols-4 lg:grid-cols-12">
          <div className="space-y-2 md:col-span-1 lg:col-span-1">
            <Label>Safra *</Label>
            <Popover open={openSafra} onOpenChange={setOpenSafra}>
              <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" className="w-full justify-between">
                  {safraId ? `${(safras || []).find((s) => String(s.id) === String(safraId))?.nome || "Selecionada"}` : "Selecione..."}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-full p-0">
                <Command>
                  <CommandInput placeholder="Buscar safra..." />
                  <CommandList>
                    <CommandEmpty>Nenhuma safra encontrada.</CommandEmpty>
                    <CommandGroup>
                      {(safras || []).map((s) => (
                        <CommandItem
                          key={String(s.id)}
                          value={`${s.nome}`}
                          onSelect={() => {
                            setSafraId(String(s.id));
                            // reset produtor/fazenda ao trocar safra
                            setProdutorNumerocm("");
                            setArea("");
                            setSelectedAreaHa(0);
                            setSelectedTalhaoIds([]);
                            setOpenSafra(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              String(safraId) === String(s.id) ? "opacity-100" : "opacity-0"
                            )}
                          />
                          {s.nome}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
          <div className="space-y-2 md:col-span-1 lg:col-span-3">
            <Label>Produtor *</Label>
            <Popover open={openProdutorPopover} onOpenChange={setOpenProdutorPopover}>
              <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" className="w-full justify-between" disabled={!safraId}>
                  {selectedProdutor ? `${selectedProdutor.numerocm} - ${selectedProdutor.nome}` : "Selecione..."}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-full p-0">
                <Command>
                  <CommandInput placeholder="Buscar produtor..." />
                  <CommandList>
                    <CommandEmpty>Nenhum produtor com Cultivar ou Adubação nesta safra.</CommandEmpty>
                    <CommandGroup>
                      {(produtoresFiltrados || []).map((produtor) => (
                        <CommandItem
                          key={produtor.id}
                          value={`${produtor.numerocm} ${produtor.nome}`}
                          onSelect={() => {
                            setProdutorNumerocm(produtor.numerocm);
                            setArea("");
                            setSelectedTalhaoIds([]);
                            setOpenProdutorPopover(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              produtorNumerocm === produtor.numerocm ? "opacity-100" : "opacity-0"
                            )}
                          />
                          {produtor.numerocm} - {produtor.nome}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2 md:col-span-2 lg:col-span-6">
            <Label htmlFor="fazenda">Fazenda *</Label>
            <Popover open={openFazenda} onOpenChange={setOpenFazenda}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={openFazenda}
                  className="w-full justify-between"
                  disabled={!produtorNumerocm || !safraId}
                >
                  {area ? (
                    <span className="flex items-center gap-2">
                      <span>{fazendas.find(f => f.nomefazenda === area)?.nomefazenda || area}</span>
                      {Number(selectedAreaHa || 0) > 0 ? (
                        <span className="text-xs text-muted-foreground">({Number(selectedAreaHa).toFixed(2)} ha)</span>
                      ) : (
                        <Badge variant="secondary" className="text-xs">sem área(há)</Badge>
                      )}
                    </span>
                  ) : (
                    "Selecione uma fazenda..."
                  )}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-full p-0">
                <Command>
                  <CommandInput placeholder="Buscar fazenda..." />
                  <CommandList>
                    <CommandEmpty>Nenhuma fazenda com Cultivar nesta safra.</CommandEmpty>
                    <CommandGroup>
                      {(fazendasFiltradas || []).map((f) => (
                        <CommandItem
                          key={f.id}
                          value={f.nomefazenda}
                          onSelect={() => {
                            setArea(f.nomefazenda);
                            // A área será calculada via useEffect quando programacaoAtual mudar
                            setSelectedTalhaoIds([]);
                            setOpenFazenda(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              area === f.nomefazenda ? "opacity-100" : "opacity-0"
                            )}
                          />
                          <span className="flex items-center gap-2">
                            <span>{f.nomefazenda}</span>
                            {Number(f.area_cultivavel || 0) > 0 ? (
                              <span className="text-xs text-muted-foreground">({Number(f.area_cultivavel || 0)} ha)</span>
                            ) : (
                              <Badge variant="secondary" className="text-xs">sem área(há)</Badge>
                            )}
                          </span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
          </Popover>
          </div>

          <div className="space-y-2 md:col-span-1 lg:col-span-3">
            <Label>Talhão *</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" className="w-full justify-between" disabled={!produtorNumerocm || !area || !safraId || talhoesOptions.length === 0}>
                  {selectedTalhaoIds.length > 0
                    ? `${selectedTalhaoIds.length} talhões selecionados`
                    : talhoesOptions.length > 0
                      ? "Selecione..."
                      : "Sem talhões desta programação"}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-full p-0">
                <Command>
                  <CommandInput placeholder="Buscar talhão..." />
                  <CommandList>
                    <CommandEmpty>Nenhum talhão encontrado.</CommandEmpty>
                    <CommandGroup>
                      {talhoesOptions.map((t) => (
                        <CommandItem
                          key={t.id}
                          value={`${t.nome}`}
                          onSelect={() => {
                            const isSelected = selectedTalhaoIds.includes(t.id);
                            const next = isSelected ? selectedTalhaoIds.filter((id) => id !== t.id) : [...selectedTalhaoIds, t.id];
                            setSelectedTalhaoIds(next);
                            const idSet = new Set(next.map(String));
                            const sumSel = talhoesOptions.reduce((acc, o) => acc + (idSet.has(o.id) ? (Number(o.area || 0) || 0) : 0), 0);
                            const sumAll = talhoesOptions.reduce((acc, o) => acc + (Number(o.area || 0) || 0), 0);
                            setSelectedAreaHa(sumSel > 0 ? sumSel : sumAll);
                            try {
                              if (talhoesKey) sessionStorage.setItem(`def-talhoes-sel:${talhoesKey}`, JSON.stringify(next));
                            } catch {}
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              selectedTalhaoIds.includes(t.id) ? "opacity-100" : "opacity-0"
                            )}
                          />
                          {t.nome} • {t.area.toFixed(2)} ha
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2 lg:col-span-2">
            <Label>Área cultivável (ha)</Label>
          <Input
            type="number"
            value={Number(selectedAreaHa || 0).toFixed(2)}
            disabled
            className="bg-muted"
          />
          </div>

          <div className="space-y-2 lg:col-span-4">
            <Label>Tipo *</Label>
            <Select value={tipo} onValueChange={(v) => setTipo(v as any)}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="PROGRAMACAO">Programação</SelectItem>
                <SelectItem value="PREVIA">Prévia</SelectItem>
              </SelectContent>
            </Select>
          </div>


        </div>

        {/* Seleção de classe/aplicação agora por produto (na linha) */}

        {/* Lista dinâmica de defensivos */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label className="text-base font-semibold">Defensivos aplicados</Label>
            <Button type="button" onClick={handleAddDefensivo} size="sm" variant="outline" disabled={readOnly}>
              <Plus className="mr-2 h-4 w-4" />
              Adicionar defensivo
            </Button>
          </div>

          {defensivos.map((defensivo, index) => (
            <DefensivoRow
              key={defensivo.tempId}
              defensivo={defensivo}
              index={index}
              defensivosCatalog={(defensivosCatalog || [])}
              calendario={calendario}
              existingByAplicacao={existingByAplicacao}
              onChange={(field, value) => handleDefensivoChange(defensivo.tempId, field, value)}
              onRemove={() => handleRemoveDefensivo(defensivo.tempId)}
              canRemove={defensivos.length > 1}
            />
          ))}
        </div>
        </fieldset>

        <div className="flex gap-2 justify-end pt-4">
          <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
            Cancelar
          </Button>
          <Button type="submit" disabled={readOnly || isLoading || !(hasCultivarProgram || hasAdubacaoProgram)}>
            {isLoading ? "Salvando..." : submitLabel}
          </Button>
        </div>
      </form>
    </Card>
  );
};

type DefensivoRowProps = {
  defensivo: Omit<DefensivoItem, "id"> & { tempId: string; total?: number };
  index: number;
  defensivosCatalog: Array<{ item: string | null; cod_item: string; marca: string | null; principio_ativo: string | null; grupo: string | null }>;
  calendario?: { classes: string[]; aplicacoesPorClasse: Record<string, string[]> } | undefined;
  existingByAplicacao: Record<string, string[]>;
  onChange: (field: keyof Omit<DefensivoItem, "id">, value: any) => void;
  onRemove: () => void;
  canRemove: boolean;
};

// Normaliza texto: remove acentos e deixa em maiúsculas
const normalizeText = (s: string) =>
  String(s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();

// Normaliza texto removendo pluralidade (S no final) para comparação
const normalizeWithoutPlural = (s: string) => {
  const normalized = normalizeText(s);
  // Remove 'S' no final se a palavra tiver mais de 3 caracteres
  return normalized.length > 3 && normalized.endsWith('S') 
    ? normalized.slice(0, -1) 
    : normalized;
};

// Sinônimos/abreviações por classe (case/acentos serão normalizados na comparação)
const CLASS_SYNONYMS: Record<string, string[]> = {
  TS: ["TRAT. SEMENTES", "TRAT SEMENTES", "TRATAMENTO DE SEMENTES", "TRATAMENTO SEMENTES"],
  "TRAT. SEMENTES": ["TS", "TRAT SEMENTES", "TRATAMENTO DE SEMENTES", "TRATAMENTO SEMENTES"],
  "TRAT SEMENTES": ["TS", "TRAT. SEMENTES", "TRATAMENTO DE SEMENTES", "TRATAMENTO SEMENTES"],
};

// Aplicações que não devem aparecer na programação de defensivos
const EXCLUDED_APLICACOES = new Set<string>([
  normalizeText("Tratamento de Semente - TS"),
]);

const DefensivoRow = ({ defensivo, index, defensivosCatalog, calendario, existingByAplicacao, onChange, onRemove, canRemove }: DefensivoRowProps) => {
  const [openDefensivoPopover, setOpenDefensivoPopover] = useState(false);
  const [openClassePopover, setOpenClassePopover] = useState(false);
  const [openAplicacoesPopover, setOpenAplicacoesPopover] = useState(false);
  const [selectedClasse, setSelectedClasse] = useState<string>("");
  const [selectedAplicacoes, setSelectedAplicacoes] = useState<string[]>(defensivo.aplicacoes || []);

  // Sincroniza selectedAplicacoes quando defensivo.aplicacoes mudar
  useEffect(() => {
    setSelectedAplicacoes(defensivo.aplicacoes || []);
  }, [defensivo.aplicacoes]);

  // Inicializa a classe ao editar, inferindo primeiro pelo catálogo do defensivo,
  // depois por aplicacoes e por fim pelo alvo
  useEffect(() => {
    // Se já veio salvo, priorizar o valor persistido
    if (defensivo.classe && defensivo.classe.trim()) {
      setSelectedClasse(defensivo.classe);
      return;
    }
    if (selectedClasse) return; // não sobrescrever se já houve seleção

    const classes = Object.keys(calendario?.aplicacoesPorClasse || {});

    // 1) Tentar identificar a classe pelo catálogo do defensivo selecionado
    const defName = String(defensivo.defensivo || "").trim();
    if (defName) {
      const match = (defensivosCatalog || []).find((d) => normalizeText(String(d.item || "")) === normalizeText(defName));
      const grupo = String(match?.grupo || "").trim();
      if (grupo) {
        setSelectedClasse(grupo);
        onChange("classe", grupo);
        return;
      }
      // 1b) Se não encontrou no catálogo, tentar extrair prefixo antes de "-"
      const prefix = defName.split("-")[0]?.trim();
      if (prefix) {
        const prefixNorm = normalizeWithoutPlural(prefix);
        const clsFromPrefix = classes.find((c) => normalizeWithoutPlural(c) === prefixNorm);
        if (clsFromPrefix) {
          setSelectedClasse(clsFromPrefix);
          onChange("classe", clsFromPrefix);
          return;
        }
      }
    }

    // 2) Em seguida, inferir pela primeira aplicação selecionada
    if (defensivo.aplicacoes && defensivo.aplicacoes.length > 0) {
      const firstAp = defensivo.aplicacoes[0];
      const cls = classes.find((c) =>
        (calendario?.aplicacoesPorClasse?.[c] || []).some((ap) => normalizeWithoutPlural(ap) === normalizeWithoutPlural(firstAp))
      );
      if (cls) {
        setSelectedClasse(cls);
        onChange("classe", cls);
        return;
      }
    }

    // 3) Por fim, inferir pelo alvo com match exato
    const alvo = String(defensivo.alvo || "").trim();
    if (alvo) {
      const alvoNorm = normalizeWithoutPlural(alvo);
      const cls = classes.find((c) =>
        (calendario?.aplicacoesPorClasse?.[c] || []).some((ap) => normalizeWithoutPlural(ap) === alvoNorm)
      );
      if (cls) {
        setSelectedClasse(cls);
        onChange("classe", cls);
      }
    }
  }, [defensivo.classe, defensivo.defensivo, defensivo.aplicacoes, defensivo.alvo, calendario, selectedClasse, defensivosCatalog, onChange]);

  console.log('📦 Total items in catalog:', defensivosCatalog?.length);
  console.log('🎯 Selected class:', selectedClasse);
  
  // Debug: quantos INSETICIDA existem no catálogo original?
  const inseticidasCount = defensivosCatalog?.filter((d: any) => d.grupo === 'INSETICIDA').length || 0;
  console.log('🔢 Items com grupo="INSETICIDA" no catálogo original:', inseticidasCount);
  
  const filteredCatalog = (defensivosCatalog || []).filter((d: any) => {
    const cls = String(selectedClasse || "").trim();
    if (!cls) return true;

    const clsNorm = normalizeWithoutPlural(cls);
    const grupoNorm = normalizeWithoutPlural(d.grupo || "");
    const itemPrefixNorm = normalizeWithoutPlural(String(d.item || "").split("-")[0]?.trim() || "");

    const matchesClasse = (grupoNorm && grupoNorm === clsNorm) || (!grupoNorm && itemPrefixNorm === clsNorm);
    if (!matchesClasse) return false;

    if ((defensivo as any).produto_salvo) return true;

    const apKey = String((selectedAplicacoes[0] || defensivo.alvo || "").trim());
    if (!apKey) return true;
    const existing = (existingByAplicacao[apKey] || [])
      .map((n) => normalizeText(String(n || "").replace(/%/g, "")))
      .filter((n) => n && n !== normalizeText(defensivo.defensivo || ""));

    const clsPrefix = clsNorm + " ";
    const cores = existing.map((n) => (n.startsWith(clsPrefix) ? n.slice(clsPrefix.length).trim() : n));

    const itemNorm = normalizeText(d.item || "");
    const marcaNorm = normalizeText(d.marca || "");

    const isDuplicateByItem = cores.some((core) => core && itemNorm.includes(core));
    const isDuplicateByMarca = cores.some((core) => core && marcaNorm.includes(core));

    if (isDuplicateByItem || isDuplicateByMarca) return false;
    return true;
  });

  const displayCatalog = filteredCatalog;

  return (
    <Card className="p-4 bg-muted/50">
      <div className="flex items-start gap-4">
        <div className="flex-1 grid gap-2 md:grid-cols-2 lg:grid-cols-12">
          <div className="space-y-2 lg:col-span-2">
            <Label>Descrição da Classe *</Label>
            <Popover open={openClassePopover} onOpenChange={setOpenClassePopover}>
              <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" className="w-full justify-between">
                  {selectedClasse || "Selecione..."}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-full p-0">
                <Command>
                  <CommandInput placeholder="Buscar classe..." />
                  <CommandList>
                    <CommandEmpty>Nenhuma classe encontrada.</CommandEmpty>
                    <CommandGroup>
                      {(calendario?.classes || []).map((cls) => (
                        <CommandItem
                          key={cls}
                          value={cls}
                          onSelect={() => {
                            setSelectedClasse(cls);
                            setSelectedAplicacoes([]);
                            onChange("aplicacoes", []);
                            onChange("alvo", "");
                            onChange("classe", cls);
                            onChange("defensivo", "");
                            onChange("dose", 0);
                            onChange("porcentagem_salva", 0);
                            setOpenClassePopover(false);
                          }}
                        >
                          <Check className={cn("mr-2 h-4 w-4", selectedClasse === cls ? "opacity-100" : "opacity-0")} />
                          {cls}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2 lg:col-span-2">
            <Label>Descrição da Aplicação *</Label>
            <Popover open={openAplicacoesPopover} onOpenChange={setOpenAplicacoesPopover}>
              <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" className="w-full justify-between">
                  {selectedAplicacoes.length > 0
                    ? selectedAplicacoes[0]
                    : selectedClasse
                      ? "Selecione..."
                      : "Selecione uma classe"}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-full p-0">
                <Command>
                  <CommandInput placeholder="Buscar aplicação..." />
                  <CommandList>
                    <CommandEmpty>
                      {selectedClasse ? "Nenhuma aplicação encontrada." : "Selecione uma classe primeiro."}
                    </CommandEmpty>
                    <CommandGroup>
                      {((calendario?.aplicacoesPorClasse?.[selectedClasse] || [])
                        .filter((ap) => !EXCLUDED_APLICACOES.has(normalizeText(ap)))
                      ).map((ap) => (
                        <CommandItem
                          key={ap}
                          value={ap}
                          onSelect={() => {
                            // Seleção única: alterna entre nenhuma e a aplicação escolhida
                            const newSelection = selectedAplicacoes.includes(ap) ? [] : [ap];
                            setSelectedAplicacoes(newSelection);
                            onChange("aplicacoes", newSelection);
                            onChange("alvo", newSelection[0] ?? "");
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              selectedAplicacoes.includes(ap) ? "opacity-100" : "opacity-0"
                            )}
                          />
                          {ap}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2 lg:col-span-3">
            <Label>Defensivo *</Label>
            <Popover open={openDefensivoPopover} onOpenChange={setOpenDefensivoPopover}>
              <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" className="w-full justify-between">
                  {defensivo.defensivo || "Selecione..."}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-full p-0">
                <Command>
                  <CommandInput placeholder="Buscar defensivo..." />
                  <CommandList>
                    <CommandEmpty>Nenhum defensivo encontrado.</CommandEmpty>
                    <CommandGroup>
                      {displayCatalog.map((def) => (
                        <CommandItem
                          key={def.cod_item}
                          value={`${def.item} ${def.marca}`}
                          onSelect={() => {
                            onChange("defensivo", def.item || "");
                            setOpenDefensivoPopover(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              defensivo.defensivo === def.item ? "opacity-100" : "opacity-0"
                            )}
                          />
                          {def.item} {def.marca && `- ${def.marca}`}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2 lg:col-span-1">
            <Label>Dose *</Label>
            <Input
              type="number"
              step="0.01"
              value={defensivo.dose}
              onChange={(e) => onChange("dose", parseFloat(e.target.value) || 0)}
              placeholder="0.00"
              required
            />
          </div>

          {/* Campo de Unidade removido conforme solicitação; mantém valor padrão "L/ha" */}

          {/* Área por produto removida: usa-se a área da fazenda selecionada */}

          <div className="space-y-2 lg:col-span-1">
            <Label className="whitespace-nowrap text-xs truncate">Cobertura em % *</Label>
            <Input
              type="number"
              step="0.1"
              min="0"
              max="100"
              value={defensivo.porcentagem_salva ?? 100}
              onChange={(e) => {
                const raw = parseFloat(e.target.value);
                const val = isNaN(raw) ? 100 : Math.min(100, Math.max(0, raw));
                onChange("porcentagem_salva", val);
              }}
              placeholder="100"
            />
          </div>

          <div className="space-y-2 md:col-span-2 lg:col-span-1">
            <Label>Total</Label>
            <Input
              type="number"
              step="0.01"
              value={defensivo.total?.toFixed(2) || "0.00"}
              disabled
              className="bg-muted"
            />
          </div>

          <div className="space-y-3 lg:col-span-1">
            <div className="flex items-center space-x-2">
              <Checkbox
                id={`produto-salvo-${index}`}
                checked={defensivo.produto_salvo}
                onCheckedChange={(checked) => onChange("produto_salvo", checked)}
              />
              <Label htmlFor={`produto-salvo-${index}`} className="cursor-pointer">
                Produto proprio
              </Label>
            </div>
            {canRemove && (
              <Button type="button" variant="ghost" size="icon" onClick={onRemove} title="Remover defensivo" className="h-10 w-10">
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
};
