import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, ArrowLeft, Trash2, Pencil, Copy, Check, ChevronsUpDown, Settings } from "lucide-react";
import { useProgramacoes } from "@/hooks/useProgramacoes";
import { useProfile } from "@/hooks/useProfile";
import { useAdminRole } from "@/hooks/useAdminRole";
import { useConsultores } from "@/hooks/useConsultores";
import { FormProgramacao } from "@/components/programacao/FormProgramacao";
import { useFazendas } from "@/hooks/useFazendas";
import { useProdutores } from "@/hooks/useProdutores";
import { useProgramacaoCultivares } from "@/hooks/useProgramacaoCultivares";
import { useProgramacaoAdubacao } from "@/hooks/useProgramacaoAdubacao";
import { useCultivaresCatalog } from "@/hooks/useCultivaresCatalog";
import { useAplicacoesDefensivos } from "@/hooks/useAplicacoesDefensivos";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn, safeRandomUUID } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { GerenciarTalhoes } from "@/components/programacao/GerenciarTalhoes";
import { useSafras } from "@/hooks/useSafras";

export default function Programacao() {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [editingTratamentos, setEditingTratamentos] = useState<Record<string, string[]>>({});
  const [editingDefensivos, setEditingDefensivos] = useState<Record<string, any[]>>({});
  const { programacoes, isLoading, create, delete: deleteProgramacao, update, isUpdating, replicate, isReplicating } = useProgramacoes();
  const { data: fazendas = [] } = useFazendas();
  const { data: produtores = [] } = useProdutores();
  const { programacoes: cultivaresList = [] } = useProgramacaoCultivares();
  const { programacoes: adubacaoList = [] } = useProgramacaoAdubacao();
  const { data: cultivaresCatalog = [] } = useCultivaresCatalog();
  const { aplicacoes: aplicacoesDef = [] } = useAplicacoesDefensivos();
  const { profile } = useProfile();
  const { data: adminRole } = useAdminRole();
  const { data: consultores = [] } = useConsultores();
  const isAdmin = !!adminRole?.isAdmin;
  const isConsultor = !!profile?.numerocm_consultor && !isAdmin;
  const consultorRow = consultores.find((c: any) => String(c.numerocm_consultor) === String(profile?.numerocm_consultor || ""));
  const canEditProgramacao = isAdmin || (!!consultorRow && !!consultorRow.pode_editar_programacao);
  const { defaultSafra } = useSafras();

  const areasSafrasComDefensivo = useMemo(() => {
    const set = new Set<string>();
    for (const ap of aplicacoesDef) {
      const area = String(ap.area || "").trim();
      const defs = (ap.defensivos || []) as any[];
      for (const d of defs) {
        const s = String(d?.safra_id || "").trim();
        if (area && s) set.add(`${area}|${s}`);
      }
    }
    return set;
  }, [aplicacoesDef]);

  const isDeleteBlocked = (p: any) => {
    const area = String(p?.area || "").trim();
    const safra = String(p?.safra_id || "").trim();
    if (!area || !safra) return false;
    return areasSafrasComDefensivo.has(`${area}|${safra}`);
  };

  // Replicação
  const [replicateOpen, setReplicateOpen] = useState(false);
  const [replicateTargetId, setReplicateTargetId] = useState<string | null>(null);
  const [replicateProdutorNumerocm, setReplicateProdutorNumerocm] = useState<string>("");
  const [openReplicateProdutorPopover, setOpenReplicateProdutorPopover] = useState(false);
  const [openReplicateFazendaPopover, setOpenReplicateFazendaPopover] = useState(false);
  const [selectedAreaPairs, setSelectedAreaPairs] = useState<Array<{ produtor_numerocm: string; fazenda_idfazenda: string; nomefazenda: string; area_hectares: number }>>([]);
  const [replicateTargets, setReplicateTargets] = useState<Array<{ produtor_numerocm: string; fazenda_idfazenda: string; area_hectares: number }>>([]);
  const { data: fazendasReplicate = [] } = useFazendas(replicateProdutorNumerocm);

  // Gerenciar talhões
  const [gerenciarTalhoesOpen, setGerenciarTalhoesOpen] = useState(false);
  const [fazendaParaTalhoes, setFazendaParaTalhoes] = useState<{ id: string; nome: string } | null>(null);
  const [openGerenciarSelector, setOpenGerenciarSelector] = useState(false);
  const [onlyFazendasComTalhao, setOnlyFazendasComTalhao] = useState(false);

  const temAreasCadastradas = fazendas.length > 0;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Link to="/">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div className="flex items-center gap-2">
              <Calendar className="h-6 w-6 text-primary" />
              <h1 className="text-xl font-bold">Programação</h1>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold">Programação</h1>
            <p className="text-muted-foreground">Planejamento de sementes e fertilizantes</p>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              onClick={() => setShowForm(true)}
              disabled={!temAreasCadastradas}
            >
              Nova Programação
            </Button>
            <Popover open={openGerenciarSelector} onOpenChange={setOpenGerenciarSelector}>
              <PopoverTrigger asChild>
                <Button variant="outline">
                  Gerenciar Talhões
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[420px] p-0">
                <div className="flex items-center justify-between px-3 py-2 border-b">
                  <label className="text-sm flex items-center gap-2">
                    <Checkbox
                      checked={onlyFazendasComTalhao}
                      onCheckedChange={(c) => setOnlyFazendasComTalhao(!!c)}
                      className="h-4 w-4"
                    />
                    Somente com talhão
                  </label>
                </div>
                <Command>
                  <CommandInput placeholder="Buscar fazenda..." />
                  <CommandList>
                    <CommandEmpty>Nenhuma fazenda encontrada.</CommandEmpty>
                    <CommandGroup>
                      {fazendas
                        .filter((f: any) => !onlyFazendasComTalhao || Number(f.area_cultivavel || 0) > 0)
                        .map((f: any) => (
                          <CommandItem
                            key={`${f.id}`}
                            value={`${f.numerocm} ${f.nomefazenda}`}
                            onSelect={() => {
                              setFazendaParaTalhoes({ id: f.id, nome: f.nomefazenda });
                              setGerenciarTalhoesOpen(true);
                              setOpenGerenciarSelector(false);
                            }}
                          >
                            <span className="flex items-center gap-2">
                              <span>{f.numerocm} / {f.nomefazenda}</span>
                              {Number(f.area_cultivavel || 0) > 0 ? (
                                <span className="ml-2 text-xs text-muted-foreground">({Number(f.area_cultivavel || 0)} ha)</span>
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
        </div>

        {!temAreasCadastradas && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
            <p className="text-yellow-800 font-medium">
              ⚠️ Não há áreas cadastradas. Por favor, cadastre fazendas antes de criar programações.
            </p>
          </div>
        )}

        {showForm && !editing && (
          <FormProgramacao
            onSubmit={(data) => {
              create(data);
              setShowForm(false);
            }}
            onCancel={() => setShowForm(false)}
          />
        )}

        {editing && (
          <FormProgramacao
            title="Editar Programação"
            submitLabel={isUpdating ? "Salvando..." : "Salvar alterações"}
            readOnly={isConsultor && !canEditProgramacao}
            initialData={{
              produtor_numerocm: editing.produtor_numerocm,
              fazenda_idfazenda: editing.fazenda_idfazenda,
              area: editing.area,
              area_hectares: editing.area_hectares,
              safra_id: editing.safra_id || undefined,
              epoca_id: editing.epoca_id || undefined,
              talhao_ids: editing.talhao_ids || [],
              cultivares: (() => {
                const cults = (cultivaresList as any[]).filter((c: any) => c.programacao_id === editing.id);
                return cults.map((c: any) => {
                  // Buscar a cultura do catálogo baseado no cultivar
                  const cultivarInfo = cultivaresCatalog.find(cat => cat.cultivar === c.cultivar);
                  return {
                    cultivar: c.cultivar,
                    cultura: cultivarInfo?.cultura || "",
                    percentual_cobertura: Number(c.percentual_cobertura) || 0,
                    tipo_embalagem: c.tipo_embalagem,
                    tipo_tratamento: c.tipo_tratamento,
                    tratamento_ids: (editingTratamentos as Record<string, string[]>)[c.id]
                      ?? (Array.isArray(c.tratamento_ids) ? c.tratamento_ids : (c.tratamento_id ? [c.tratamento_id] : [])),
                    tratamento_id: c.tratamento_id || undefined,
                    data_plantio: c.data_plantio || undefined,
                    populacao_recomendada: Number(c.populacao_recomendada) || 0,
                    semente_propria: Boolean(c.semente_propria),
                    referencia_rnc_mapa: c.referencia_rnc_mapa || undefined,
                    sementes_por_saca: Number(c.sementes_por_saca) || 0,
                    defensivos_fazenda: editingDefensivos[c.id] || []
                  };
                });
              })(),
              adubacao: (() => {
                const adubs = (adubacaoList as any[]).filter((a: any) => a.programacao_id === editing.id);
                return adubs.map((a: any) => ({
                  formulacao: a.formulacao,
                  dose: Number(a.dose) || 0,
                  percentual_cobertura: Number(a.percentual_cobertura) || 0,
                  data_aplicacao: a.data_aplicacao || undefined,
                  embalagem: a.embalagem || undefined,
                  justificativa_nao_adubacao_id: a.justificativa_nao_adubacao_id || undefined,
                }));
              })()
            }}
            onSubmit={(data) => {
              update({ id: editing.id, ...data }).then(() => {
                setEditing(null);
                setEditingTratamentos({});
                setEditingDefensivos({});
              });
            }}
            onCancel={() => {
              setEditing(null);
              setEditingTratamentos({});
              setEditingDefensivos({});
            }}
          />
        )}

        {isLoading ? (
          <p className="text-muted-foreground">Carregando programações...</p>
        ) : (
          <div className="grid gap-4">
            {programacoes.length === 0 ? (
              <Card className="p-6">
                <p className="text-muted-foreground">Nenhuma programação encontrada.</p>
              </Card>
            ) : (
              programacoes.map((prog) => {
                const produtor = produtores.find(p => p.numerocm === prog.produtor_numerocm);
                const fazenda = fazendas.find(f => f.idfazenda === prog.fazenda_idfazenda && f.numerocm === prog.produtor_numerocm);
                
                return (
                  <Card key={prog.id} className="p-6 hover:shadow-lg transition-shadow">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-3">
                          <Calendar className="h-5 w-5 text-primary" />
                          <h3 className="font-semibold text-lg">
                            {prog.produtor_numerocm} - {produtor?.nome || ""}
                          </h3>
                          <p className="flex items-center gap-2">
                            <span className="font-medium">Fazenda:</span>
                            <span>
                              {fazenda?.nomefazenda || "—"}
                              {(() => {
                                const ha = Number(prog.area_hectares || fazenda?.area_cultivavel || 0);
                                return ha > 0 ? ` (${ha.toFixed(2)} ha)` : "";
                              })()}
                            </span>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => {
                                if (fazenda) {
                                  setFazendaParaTalhoes({ id: fazenda.id, nome: fazenda.nomefazenda });
                                  setGerenciarTalhoesOpen(true);
                                }
                              }}
                              title="Gerenciar talhões"
                            >
                              <Settings className="h-4 w-4" />
                            </Button>
                          </p>
                        </div>
                        
                        <div className="grid gap-2 text-sm text-muted-foreground">
                        </div>
                      </div>
                      
                   <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={async () => {
                        // Buscar talhões da programacao
                        const envUrl = (import.meta as any).env?.VITE_API_URL;
                        const host = typeof window !== "undefined" ? window.location.hostname : "127.0.0.1";
                        const baseUrl = envUrl || `http://${host}:5000`;
                        const res = await fetch(`${baseUrl}/programacoes/${prog.id}/children`);
                        if (!res.ok) {
                          toast.error("Erro ao carregar dados da programação para edição");
                          return;
                        }
                        const json = await res.json();
                        const talhoesData = (json?.talhoes || []).map((t: any) => ({ talhao_id: t }));
                        const cults = (json?.cultivares || []) as any[];
                        const tratamentosMap: Record<string, string[]> = json?.tratamentos || {};
                        const defensivosRows: any[] = json?.defensivos || [];
                        const defensivosMap: Record<string, any[]> = {};
                        const epocaId = cults.length > 0 ? cults[0].epoca_id : undefined;
                        for (const cult of cults) {
                          if (cult.tipo_tratamento === "NA FAZENDA") {
                            const defs = defensivosRows.filter(d => d.programacao_cultivar_id === cult.id).map((d: any) => ({
                              tempId: safeRandomUUID(),
                              classe: d.classe || "",
                              aplicacao: d.aplicacao,
                              defensivo: d.defensivo,
                              dose: Number(d.dose) || 0,
                              cobertura: Number(d.cobertura) || 100,
                              total: Number(d.total) || 0,
                              produto_salvo: Boolean(d.produto_salvo),
                              porcentagem_salva: 100
                            }));
                            defensivosMap[cult.id] = defs;
                          }
                        }
                        
                        setEditingTratamentos(tratamentosMap);
                        setEditingDefensivos(defensivosMap);
                        setEditing({
                          ...prog,
                          epoca_id: epocaId,
                          talhao_ids: (talhoesData || []).map((t: any) => t.talhao_id)
                        });
                      }}
                      title="Editar"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => {
                        setReplicateTargetId(prog.id);
                        setReplicateProdutorNumerocm("");
                        setReplicateOpen(true);
                        setSelectedAreaPairs([]);
                        setReplicateTargets([]);
                      }}
                      title="Replicar"
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => deleteProgramacao(prog.id)}
                      disabled={isDeleteBlocked(prog)}
                      title={isDeleteBlocked(prog) ? "Exclusão bloqueada: há defensivos para esta fazenda/safra" : "Excluir"}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                    </div>
                  </Card>
                );
              })
            )}
          </div>
        )}
      </main>
    {/* Dialog de Replicação */}
    <Dialog open={replicateOpen} onOpenChange={(o) => setReplicateOpen(o)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Replicar programação</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-medium">Produtor</label>
            <Popover open={openReplicateProdutorPopover} onOpenChange={setOpenReplicateProdutorPopover}>
              <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" className="w-full justify-between">
                  {replicateProdutorNumerocm
                    ? `${replicateProdutorNumerocm} - ${produtores.find(p => p.numerocm === replicateProdutorNumerocm)?.nome || ""}`
                    : "Selecione produtor..."}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-full p-0">
                <Command>
                  <CommandInput placeholder="Buscar produtor..." />
                  <CommandList>
                    <CommandEmpty>Nenhum produtor encontrado.</CommandEmpty>
                    <CommandGroup>
                      {produtores.map((produtor) => (
                        <CommandItem
                          key={produtor.id}
                          value={`${produtor.numerocm} ${produtor.nome}`}
                          onSelect={() => {
                            setReplicateProdutorNumerocm(produtor.numerocm);
                            setSelectedAreaPairs([]);
                            setOpenReplicateProdutorPopover(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              replicateProdutorNumerocm === produtor.numerocm ? "opacity-100" : "opacity-0"
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

          <div className="space-y-2">
            <label className="text-sm font-medium">Áreas (fazendas)</label>
            <Popover open={openReplicateFazendaPopover} onOpenChange={setOpenReplicateFazendaPopover}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={openReplicateFazendaPopover}
                  className="w-full justify-between"
                  disabled={!replicateProdutorNumerocm}
                >
                  {selectedAreaPairs.length > 0
                    ? `${selectedAreaPairs.length} área(s) selecionada(s)`
                    : "Selecione áreas..."}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-full p-0">
                <Command>
                  <CommandInput placeholder="Buscar área..." />
                  <CommandList>
                    <CommandEmpty>Nenhuma área encontrada.</CommandEmpty>
                    <CommandGroup>
                      {fazendasReplicate?.map((f: any) => {
                        const produtorNome = produtores.find(p => p.numerocm === f.numerocm)?.nome || "";
                        const checked = selectedAreaPairs.some((ap) => ap.produtor_numerocm === replicateProdutorNumerocm && ap.fazenda_idfazenda === f.idfazenda);
                        const disabled = !f.area_cultivavel || Number(f.area_cultivavel) <= 0;
                        return (
                          <CommandItem
                            key={`${f.idfazenda}-${f.numerocm}`}
                            value={`${f.numerocm} ${produtorNome} / ${f.nomefazenda}`}
                            onSelect={() => {
                              if (disabled) {
                                toast.error("Fazenda sem área preenchida (ha). Atualize na Admin.");
                                return;
                              }
                              setSelectedAreaPairs((prev) => {
                                const exists = prev.some((ap) => ap.produtor_numerocm === replicateProdutorNumerocm && ap.fazenda_idfazenda === f.idfazenda);
                                if (exists) {
                                  return prev.filter((ap) => !(ap.produtor_numerocm === replicateProdutorNumerocm && ap.fazenda_idfazenda === f.idfazenda));
                                }
                                return [...prev, { produtor_numerocm: replicateProdutorNumerocm, fazenda_idfazenda: f.idfazenda, nomefazenda: f.nomefazenda, area_hectares: Number(f.area_cultivavel) }];
                              });
                            }}
                          >
                            <Checkbox checked={checked} className="mr-2 h-4 w-4" />
                            <span className="flex items-center gap-2">
                              <span>{f.numerocm} - {produtorNome} / {f.nomefazenda}</span>
                              {Number(f.area_cultivavel || 0) > 0 ? (
                                <span className="ml-2 text-xs text-muted-foreground">({Number(f.area_cultivavel || 0)} ha)</span>
                              ) : (
                                <Badge variant="secondary" className="text-xs">sem área(há)</Badge>
                              )}
                            </span>
                          </CommandItem>
                        );
                      })}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
        </div>
        <div className="mt-4 flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => {
              if (selectedAreaPairs.length === 0) return;
              const current = [...replicateTargets];
              for (const ap of selectedAreaPairs) {
                const exists = current.some((t) => t.produtor_numerocm === ap.produtor_numerocm && t.fazenda_idfazenda === ap.fazenda_idfazenda);
                if (!exists) current.push({ produtor_numerocm: ap.produtor_numerocm, fazenda_idfazenda: ap.fazenda_idfazenda, area_hectares: ap.area_hectares });
              }
              setReplicateTargets(current);
              setSelectedAreaPairs([]);
            }}
            disabled={selectedAreaPairs.length === 0}
          >
            Adicionar destino
          </Button>
        </div>
        {replicateTargets.length > 0 && (
          <div className="mt-2 space-y-2">
            <label className="text-sm font-medium">Destinos selecionados</label>
            <div className="space-y-2">
              {replicateTargets.map((t, idx) => (
                <div
                  key={`${t.produtor_numerocm}-${t.fazenda_idfazenda}-${idx}`}
                  className="flex items-center justify-between rounded-md border p-2"
                >
                  <div className="text-sm">
                    <span className="font-medium">
                      {t.produtor_numerocm} - {produtores.find(p => p.numerocm === t.produtor_numerocm)?.nome || ""}
                    </span>
                    <span className="ml-2 text-muted-foreground">/ {fazendasReplicate.find((f: any) => f.idfazenda === t.fazenda_idfazenda)?.nomefazenda || t.fazenda_idfazenda} ({Number(t.area_hectares)} ha)</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setReplicateTargets(replicateTargets.filter((rt, i) => i !== idx));
                    }}
                    title="Remover destino"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}
        <DialogFooter>
          <Button
            variant="secondary"
            onClick={() => {
              setReplicateOpen(false);
              setReplicateTargetId(null);
              setReplicateProdutorNumerocm("");
              setSelectedAreaPairs([]);
              setReplicateTargets([]);
            }}
          >
            Cancelar
          </Button>
          <Button
            onClick={async () => {
              if (!replicateTargetId || replicateTargets.length === 0) return;
              const results = await Promise.allSettled(
                replicateTargets.map((t) =>
                  replicate({ id: replicateTargetId!, produtor_numerocm: t.produtor_numerocm, fazenda_idfazenda: t.fazenda_idfazenda, area_hectares: t.area_hectares, area_name: (fazendasReplicate.find((f: any) => f.idfazenda === t.fazenda_idfazenda)?.nomefazenda || "") })
                )
              );
              const ok = results.filter((r) => r.status === "fulfilled").length;
              const fail = results.filter((r) => r.status === "rejected").length;
              if (ok > 0) toast.success(`Replicação concluída: ${ok} sucesso(s)`);
              if (fail > 0) toast.error(`Falhas em ${fail} destino(s)`);
              setReplicateOpen(false);
              setReplicateTargetId(null);
              setReplicateProdutorNumerocm("");
              setSelectedAreaPairs([]);
              setReplicateTargets([]);
            }}
            disabled={isReplicating || !replicateTargetId || replicateTargets.length === 0}
          >
            Replicar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {/* Dialog de Gerenciar Talhões */}
    {fazendaParaTalhoes && (
      <GerenciarTalhoes
        fazendaId={fazendaParaTalhoes.id}
        fazendaNome={fazendaParaTalhoes.nome}
        safraId={defaultSafra?.id}
        open={gerenciarTalhoesOpen}
        onOpenChange={setGerenciarTalhoesOpen}
      />
    )}
    </div>
  );
}
