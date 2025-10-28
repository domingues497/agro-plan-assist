import { useState } from "react";
import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Droplet, ArrowLeft, Copy, Trash2, Plus, Pencil } from "lucide-react";
import { useProgramacaoAdubacao, ProgramacaoAdubacao } from "@/hooks/useProgramacaoAdubacao";
import { FormAdubacao } from "@/components/adubacao/FormAdubacao";
import { Badge } from "@/components/ui/badge";

const Adubacao = () => {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<ProgramacaoAdubacao | null>(null);
  const { programacoes, isLoading, create, duplicate, remove, update, isCreating, isUpdating } = useProgramacaoAdubacao();

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
                        onClick={() => duplicate(item.id)}
                        title="Duplicar"
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
    </div>
  );
};

export default Adubacao;

