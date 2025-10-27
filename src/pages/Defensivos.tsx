import { useState } from "react";
import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Shield, ArrowLeft, Copy, Trash2, Plus } from "lucide-react";
import { useProgramacaoDefensivos } from "@/hooks/useProgramacaoDefensivos";
import { FormDefensivo } from "@/components/defensivos/FormDefensivo";

const Defensivos = () => {
  const [showForm, setShowForm] = useState(false);
  const { programacoes, isLoading, create, duplicate, remove, isCreating } = useProgramacaoDefensivos();

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

        {showForm && (
          <FormDefensivo
            onSubmit={handleSubmit}
            onCancel={() => setShowForm(false)}
            isLoading={isCreating}
          />
        )}

        {isLoading ? (
          <p className="text-muted-foreground">Carregando programações...</p>
        ) : (
          <div className="grid gap-4">
            {programacoes.length === 0 ? (
              <Card className="p-6">
                <p className="text-muted-foreground">Nenhuma programação cadastrada.</p>
              </Card>
            ) : (
              programacoes.map((item) => (
                <Card key={item.id} className="p-6 hover:shadow-lg transition-shadow">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-3">
                        <Shield className="h-5 w-5 text-primary" />
                        <h3 className="font-semibold text-lg">{item.defensivo}</h3>
                        {item.produto_salvo && (
                          <Badge variant="secondary">Produto Salvo</Badge>
                        )}
                      </div>
                      <div className="grid gap-2 text-sm">
                        <p>
                          <span className="font-medium text-muted-foreground">Área:</span>{" "}
                          <span className="text-foreground">{item.area}</span>
                        </p>
                        <p>
                          <span className="font-medium text-muted-foreground">Dose:</span>{" "}
                          <span className="text-foreground">{item.dose} {item.unidade || "L/ha"}</span>
                        </p>
                        {item.data_aplicacao && (
                          <p>
                            <span className="font-medium text-muted-foreground">Data aplicação:</span>{" "}
                            <span className="text-foreground">
                              {new Date(item.data_aplicacao).toLocaleDateString("pt-BR")}
                            </span>
                          </p>
                        )}
                        {item.alvo && (
                          <p>
                            <span className="font-medium text-muted-foreground">Alvo:</span>{" "}
                            <span className="text-foreground">{item.alvo}</span>
                          </p>
                        )}
                        {item.produto_salvo && item.porcentagem_salva > 0 && (
                          <p>
                            <span className="font-medium text-muted-foreground">% Produto salvo:</span>{" "}
                            <span className="text-foreground">{item.porcentagem_salva}%</span>
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => duplicate(item.id)}
                        title="Duplicar programação"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => remove(item.id)}
                        title="Excluir programação"
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
