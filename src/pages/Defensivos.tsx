import { useState } from "react";
import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Shield, ArrowLeft, Copy, Trash2, Plus, Pencil, ChevronDown } from "lucide-react";
import { useAplicacoesDefensivos, AplicacaoDefensivo } from "@/hooks/useAplicacoesDefensivos";
import { FormAplicacaoDefensivo } from "@/components/defensivos/FormAplicacaoDefensivo";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const Defensivos = () => {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<AplicacaoDefensivo | null>(null);
  const { aplicacoes, isLoading, create, duplicate, remove, update, isCreating, isUpdating } = useAplicacoesDefensivos();

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
                            <h3 className="font-semibold text-lg">Aplicação - {aplicacao.area}</h3>
                            {aplicacao.produtor_numerocm && (
                              <p className="text-sm text-muted-foreground">
                                Produtor: {aplicacao.produtor_numerocm}
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
                            onClick={() => duplicate(aplicacao.id)}
                            title="Duplicar aplicação"
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
    </div>
  );
};

export default Defensivos;
