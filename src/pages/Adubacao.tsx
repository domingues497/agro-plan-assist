import { useState } from "react";
import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Droplet, ArrowLeft, Copy, Trash2, Plus, Pencil } from "lucide-react";
import { useProgramacaoAdubacao, ProgramacaoAdubacao } from "@/hooks/useProgramacaoAdubacao";
import { FormAdubacao } from "@/components/adubacao/FormAdubacao";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { useProdutores } from "@/hooks/useProdutores";
import { useFazendas } from "@/hooks/useFazendas";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

const Adubacao = () => {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<ProgramacaoAdubacao | null>(null);
  const { programacoes, isLoading, create, duplicate, remove, update, isCreating, isUpdating, replicate, isReplicating } = useProgramacaoAdubacao();
  const { data: produtores = [] } = useProdutores();
  const [replicateOpen, setReplicateOpen] = useState(false);
  const [replicateTargetId, setReplicateTargetId] = useState<string | null>(null);
  const [replicateProdutorNumerocm, setReplicateProdutorNumerocm] = useState<string>("");
  const [replicateArea, setReplicateArea] = useState<string>("");
  const [replicateTargets, setReplicateTargets] = useState<Array<{ produtor_numerocm: string; area: string }>>([]);
  const [openReplicateProdutorPopover, setOpenReplicateProdutorPopover] = useState(false);
  const [openReplicateFazendaPopover, setOpenReplicateFazendaPopover] = useState(false);
  const { data: fazendas = [] } = useFazendas(replicateProdutorNumerocm);

  const getProdutorNumerocmFallback = (id?: string) => {
    try {
      if (!id) return "";
      const key = "programacao_adubacao_produtor_map";
      const raw = localStorage.getItem(key);
      const map = raw ? JSON.parse(raw) : {};
      return (map[id] || "").trim();
    } catch (e) {
      return "";
    }
  };

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
              <Droplet className="h-6 w-6 text-primary" />
              <h1 className="text-xl font-bold">Adubacao</h1>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-foreground">Programacao de adubacao</h2>
            <p className="text-muted-foreground">Planejar formulacoes NPK e doses por hectare</p>
          </div>
          <Button onClick={() => setShowForm(!showForm)}>
            <Plus className="mr-2 h-4 w-4" />
            Nova adubação
          </Button>
        </div>

        {showForm && !editing && (
          <FormAdubacao
            onSubmit={(data) => {
              create(data);
              setShowForm(false);
            }}
            onCancel={() => setShowForm(false)}
            isLoading={isCreating}
          />
        )}

        {editing && (
          <FormAdubacao
            title="Editar Adubação"
            submitLabel="Salvar alterações"
            initialData={{
              formulacao: editing.formulacao,
              area: editing.area,
              produtor_numerocm: (editing.produtor_numerocm || getProdutorNumerocmFallback(editing.id))?.trim(),
              dose: editing.dose,
              total: editing.total,
              data_aplicacao: editing.data_aplicacao,
              responsavel: editing.responsavel,
              fertilizante_salvo: editing.fertilizante_salvo,
              deve_faturar: editing.deve_faturar,
              porcentagem_salva: editing.porcentagem_salva,
            }}
            onSubmit={(data) => {
              update({ id: editing.id, ...data });
              setEditing(null);
            }}
            onCancel={() => setEditing(null)}
            isLoading={isUpdating}
          />
        )}

        {isLoading ? (
          <p className="text-muted-foreground">Carregando programações...</p>
        ) : (
          <div className="grid gap-4">
            {programacoes.length === 0 ? (
              <Card className="p-6">
                <p className="text-muted-foreground">Nenhuma programação de adubação encontrada.</p>
              </Card>
            ) : (
              programacoes.map((item) => (
                <Card key={item.id} className="p-6 hover:shadow-lg transition-shadow">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-3">
                        <Droplet className="h-5 w-5 text-primary" />
                        <h3 className="font-semibold text-lg">{item.formulacao}</h3>
                        {item.fertilizante_salvo && (
                          <Badge variant="secondary">Fertilizante Salvo</Badge>
                        )}
                        {!item.deve_faturar && (
                          <Badge variant="outline">Não Faturar</Badge>
                        )}
                      </div>
                      
                      <div className="grid gap-2 text-sm text-muted-foreground">
                        <p>
                          <span className="font-medium">Área:</span> {item.area}
                        </p>
                        <p>
                          <span className="font-medium">Dose:</span> {item.dose} kg/ha
                        </p>
                        {item.total && (
                          <p>
                            <span className="font-medium">Total:</span> {item.total} kg
                          </p>
                        )}
                        {item.data_aplicacao && (
                          <p>
                            <span className="font-medium">Data aplicação:</span>{" "}
                            {new Date(item.data_aplicacao).toLocaleDateString("pt-BR")}
                          </p>
                        )}
                        {item.responsavel && (
                          <p>
                            <span className="font-medium">Responsável:</span> {item.responsavel}
                          </p>
                        )}
                        {item.fertilizante_salvo && item.porcentagem_salva > 0 && (
                          <p>
                            <span className="font-medium">% Salvo:</span> {item.porcentagem_salva}%
                          </p>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => setEditing(item)}
                        title="Editar"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => {
                          setReplicateTargetId(item.id);
                          setReplicateProdutorNumerocm("");
                          setReplicateArea("");
                          setReplicateOpen(true);
                        }}
                        title="Replicar"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => remove(item.id)}
                        title="Excluir"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </Card>
              ))
            )}
          </div>
        )}
      </main>
      {/* Dialog de Replicação */}
      <Dialog open={replicateOpen} onOpenChange={(o) => setReplicateOpen(o)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Replicar adubação</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Produtor</label>
              <Popover open={openReplicateProdutorPopover} onOpenChange={setOpenReplicateProdutorPopover}>
                <PopoverTrigger asChild>
                  <Button variant="outline" role="combobox" className="w-full justify-between">
                    {replicateProdutorNumerocm
                      ? `${replicateProdutorNumerocm} - ${produtores.find(p => p.numerocm === replicateProdutorNumerocm)?.nome || ""}`
                      : "Selecione..."}
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
                              setReplicateArea("");
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
              <label className="text-sm font-medium">Fazenda</label>
              <Popover open={openReplicateFazendaPopover} onOpenChange={setOpenReplicateFazendaPopover}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={openReplicateFazendaPopover}
                    className="w-full justify-between"
                    disabled={!replicateProdutorNumerocm}
                  >
                    {replicateArea
                      ? fazendas.find(f => f.nomefazenda === replicateArea)?.nomefazenda || replicateArea
                      : "Selecione uma fazenda..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0">
                  <Command>
                    <CommandInput placeholder="Buscar fazenda..." />
                    <CommandList>
                      <CommandEmpty>Nenhuma fazenda encontrada.</CommandEmpty>
                      <CommandGroup>
                        {fazendas?.map((f) => (
                          <CommandItem
                            key={f.id}
                            value={f.nomefazenda}
                            onSelect={(currentValue) => {
                              setReplicateArea(currentValue);
                              setOpenReplicateFazendaPopover(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                replicateArea === f.nomefazenda ? "opacity-100" : "opacity-0"
                              )}
                            />
                            {f.nomefazenda} {f.area_cultivavel && `(${f.area_cultivavel} ha)`}
                          </CommandItem>
                        ))}
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
                if (!replicateProdutorNumerocm || !replicateArea) return;
                const exists = replicateTargets.some(
                  (t) => t.produtor_numerocm === replicateProdutorNumerocm && t.area === replicateArea
                );
                if (exists) return;
                setReplicateTargets([
                  ...replicateTargets,
                  { produtor_numerocm: replicateProdutorNumerocm, area: replicateArea },
                ]);
                setReplicateArea("");
              }}
              disabled={!replicateProdutorNumerocm || !replicateArea}
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
                    key={`${t.produtor_numerocm}-${t.area}-${idx}`}
                    className="flex items-center justify-between rounded-md border p-2"
                  >
                    <div className="text-sm">
                      <span className="font-medium">
                        {t.produtor_numerocm} - {produtores.find(p => p.numerocm === t.produtor_numerocm)?.nome || ""}
                      </span>
                      <span className="ml-2 text-muted-foreground">/ {t.area}</span>
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
                setReplicateArea("");
                setReplicateTargets([]);
              }}
            >
              Cancelar
            </Button>
            <Button
              onClick={async () => {
                if (!replicateTargetId || replicateTargets.length === 0) return;
                for (const t of replicateTargets) {
                  try {
                    await replicate({ id: replicateTargetId, produtor_numerocm: t.produtor_numerocm, area: t.area });
                  } catch (e) {
                    // Erro individual tratado via toast no hook
                  }
                }
                setReplicateOpen(false);
                setReplicateTargetId(null);
                setReplicateProdutorNumerocm("");
                setReplicateArea("");
                setReplicateTargets([]);
              }}
              disabled={isReplicating || !replicateTargetId || replicateTargets.length === 0}
            >
              Replicar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Adubacao;

