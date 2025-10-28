import { useState } from "react";
import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Shield, ArrowLeft, Copy, Trash2, Plus, Pencil } from "lucide-react";
import { useAplicacoesDefensivos, AplicacaoDefensivo } from "@/hooks/useAplicacoesDefensivos";
import { FormAplicacaoDefensivo } from "@/components/defensivos/FormAplicacaoDefensivo";

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
                <Card key={aplicacao.id} className="p-6 hover:shadow-lg transition-shadow">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-3">
                        <Shield className="h-5 w-5 text-primary" />
                        <h3 className="font-semibold text-lg">Aplicação - {aplicacao.area}</h3>
                      </div>
                      <div className="grid gap-2 text-sm mb-4">
                        {aplicacao.produtor_numerocm && (
                          <p>
                            <span className="font-medium text-muted-foreground">Produtor:</span>{" "}
                            <span className="text-foreground">{aplicacao.produtor_numerocm}</span>
                          </p>
                        )}
                        <p>
                          <span className="font-medium text-muted-foreground">Área:</span>{" "}
                          <span className="text-foreground">{aplicacao.area}</span>
                        </p>
                      </div>

                      {/* Lista de defensivos */}
                      <div className="space-y-3 border-t pt-3">
                        <h4 className="font-medium text-sm text-muted-foreground">Defensivos aplicados:</h4>
                        {aplicacao.defensivos.map((def, idx) => (
                          <div key={def.id || idx} className="bg-muted/50 p-3 rounded-md">
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
