import { useState } from "react";
import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Shield, ArrowLeft, Copy, Trash2, Plus, Pencil, ChevronDown, Check, ChevronsUpDown } from "lucide-react";
import { useAplicacoesDefensivos, AplicacaoDefensivo } from "@/hooks/useAplicacoesDefensivos";
import { FormAplicacaoDefensivo } from "@/components/defensivos/FormAplicacaoDefensivo";
import { useProdutores } from "@/hooks/useProdutores";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { useFazendas } from "@/hooks/useFazendas";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const Defensivos = () => {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<AplicacaoDefensivo | null>(null);
  const { aplicacoes, isLoading, create, duplicate, remove, update, isCreating, isUpdating, replicate, isReplicating } = useAplicacoesDefensivos();
  const { data: produtores = [] } = useProdutores();
  const [replicateOpen, setReplicateOpen] = useState(false);
  const [replicateTargetId, setReplicateTargetId] = useState<string | null>(null);
  const [replicateProdutorNumerocm, setReplicateProdutorNumerocm] = useState<string>("");
  const [replicateArea, setReplicateArea] = useState<string>("");
  const [replicateTargets, setReplicateTargets] = useState<Array<{ produtor_numerocm: string; area: string }>>([]);
  const [openReplicateProdutorPopover, setOpenReplicateProdutorPopover] = useState(false);
  const [openReplicateFazendaPopover, setOpenReplicateFazendaPopover] = useState(false);
  const { data: fazendas = [] } = useFazendas(replicateProdutorNumerocm);

  const handleSubmit = (data: any) => {
    create(data);
    setShowForm(false);
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
              <Shield className="h-6 w-6 text-primary" />
              <h1 className="text-xl font-bold">Defensivos</h1>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-foreground">Programação de Defensivos</h2>
            <p className="text-muted-foreground">Aplicações químicas planejadas por área</p>
          </div>
          <Button onClick={() => setShowForm(!showForm)}>
            <Plus className="mr-2 h-4 w-4" />
            Nova aplicação
          </Button>
        </div>

        {showForm && !editing && (
          <FormAplicacaoDefensivo
            onSubmit={handleSubmit}
            onCancel={() => setShowForm(false)}
            isLoading={isCreating}
          />
        )}

        {editing && (
          <FormAplicacaoDefensivo
            title="Editar Aplicação de Defensivo"
            submitLabel="Salvar alterações"
            initialData={{
              produtor_numerocm: editing.produtor_numerocm || "",
              area: editing.area,
              defensivos: editing.defensivos,
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
          <p className="text-muted-foreground">Carregando aplicações...</p>
        ) : (
          <div className="grid gap-4">
            {aplicacoes.length === 0 ? (
              <Card className="p-6">
                <p className="text-muted-foreground">Nenhuma aplicação cadastrada.</p>
              </Card>
            ) : (
              aplicacoes.map((aplicacao) => (
                <Card key={aplicacao.id} className="hover:shadow-lg transition-shadow">
                  <Accordion type="single" collapsible className="w-full">
                    <AccordionItem value="item-1" className="border-none">
                      <div className="flex items-center justify-between p-6 pb-0">
                        <div className="flex items-center gap-3 flex-1">
                          <Shield className="h-5 w-5 text-primary" />
                          <div className="flex-1">
                            <h3 className="font-semibold text-lg">{aplicacao.produtor_numerocm} - {produtores.find(p => p.numerocm === aplicacao.produtor_numerocm)?.nome || ""} </h3>
                            {aplicacao.produtor_numerocm && (
                              <p className="text-sm text-muted-foreground">
                                 {aplicacao.area}
                              </p>
                            )}
                            <p className="text-xs text-muted-foreground">
                              {aplicacao.defensivos.length} defensivo(s) programado(s)
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => setEditing(aplicacao)}
                            title="Editar aplicação"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => {
                              setReplicateTargetId(aplicacao.id);
                              setReplicateProdutorNumerocm("");
                              setReplicateArea("");
                              setReplicateOpen(true);
                            }}
                            title="Replicar aplicação"
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => remove(aplicacao.id)}
                            title="Excluir aplicação"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      <AccordionTrigger className="px-6 py-4 hover:no-underline">
                        <span className="text-sm font-medium">Ver defensivos aplicados</span>
                      </AccordionTrigger>
                      <AccordionContent className="px-6 pb-6">
                        <div className="space-y-3 pt-2">
                          {aplicacao.defensivos.map((def, idx) => (
                            <div key={def.id || idx} className="bg-muted/50 p-4 rounded-md">
                              <div className="flex items-center gap-2 mb-2">
                                <span className="font-semibold">{def.defensivo}</span>
                                {def.produto_salvo && (
                                  <Badge variant="secondary" className="text-xs">Produto Salvo</Badge>
                                )}
                              </div>
                              <div className="grid gap-1 text-sm">
                                <p>
                                  <span className="text-muted-foreground">Dose:</span>{" "}
                                  {def.dose} {def.unidade}
                                </p>
                                {def.alvo && (
                                  <p>
                                    <span className="text-muted-foreground">Alvo:</span> {def.alvo}
                                  </p>
                                )}
                                {def.produto_salvo && def.porcentagem_salva > 0 && (
                                  <p>
                                    <span className="text-muted-foreground">% Salva:</span> {def.porcentagem_salva}%
                                  </p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
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
            <DialogTitle>Replicar aplicação</DialogTitle>
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
                    // Erro individual de replicação é tratado pelo hook via toast
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

export default Defensivos;
