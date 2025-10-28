import { useState } from "react";
import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sprout, ArrowLeft, Copy, Trash2, Plus, Pencil } from "lucide-react";
import { useProgramacaoCultivares, ProgramacaoCultivar } from "@/hooks/useProgramacaoCultivares";
import { FormProgramacao } from "@/components/cultivares/FormProgramacao";
import { Badge } from "@/components/ui/badge";

const Cultivares = () => {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<ProgramacaoCultivar | null>(null);
  const { programacoes, isLoading, create, duplicate, remove, update, isCreating, isUpdating } = useProgramacaoCultivares();
  const getProdutorMapping = (id: string) => {
    try {
      const raw = localStorage.getItem("programacao_cultivares_produtor_map");
      const map = raw ? JSON.parse(raw) : {};
      return typeof map[id] === "string" ? map[id] : "";
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
              <Sprout className="h-6 w-6 text-primary" />
              <h1 className="text-xl font-bold">Cultivares</h1>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-foreground">Gestao de cultivares</h2>
            <p className="text-muted-foreground">Programacao de plantio por area e safra</p>
          </div>
          <Button onClick={() => setShowForm(!showForm)}>
            <Plus className="mr-2 h-4 w-4" />
            Nova programação
          </Button>
        </div>

        {showForm && !editing && (
          <FormProgramacao
            onSubmit={(data) => {
              create(data);
              setShowForm(false);
            }}
            onCancel={() => setShowForm(false)}
            isLoading={isCreating}
          />
        )}

        {editing && (
          <FormProgramacao
            title="Editar Programação"
            submitLabel="Salvar alterações"
            initialData={{
              cultivar: editing.cultivar,
              area: editing.area,
              produtor_numerocm: (editing.produtor_numerocm && editing.produtor_numerocm.trim()) ? editing.produtor_numerocm : getProdutorMapping(editing.id),
              quantidade: editing.quantidade,
              unidade: editing.unidade,
              data_plantio: editing.data_plantio,
              safra: editing.safra,
              semente_propria: editing.semente_propria,
              referencia_rnc_mapa: editing.referencia_rnc_mapa,
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
                <p className="text-muted-foreground">Nenhuma programação encontrada.</p>
              </Card>
            ) : (
              programacoes.map((item) => (
                <Card key={item.id} className="p-6 hover:shadow-lg transition-shadow">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-3">
                        <Sprout className="h-5 w-5 text-primary" />
                        <h3 className="font-semibold text-lg">{item.cultivar}</h3>
                        {item.semente_propria && (
                          <Badge variant="secondary">Semente Própria</Badge>
                        )}
                      </div>
                      
                      <div className="grid gap-2 text-sm text-muted-foreground">
                        <p>
                          <span className="font-medium">Área:</span> {item.area}
                        </p>
                        <p>
                          <span className="font-medium">Quantidade:</span> {item.quantidade} {item.unidade}
                        </p>
                        {item.data_plantio && (
                          <p>
                            <span className="font-medium">Data plantio:</span>{" "}
                            {new Date(item.data_plantio).toLocaleDateString("pt-BR")}
                          </p>
                        )}
                        {item.safra && (
                          <p>
                            <span className="font-medium">Safra:</span> {item.safra}
                          </p>
                        )}
                        {item.semente_propria && item.porcentagem_salva > 0 && (
                          <p>
                            <span className="font-medium">% Salva:</span> {item.porcentagem_salva}%
                          </p>
                        )}
                        {item.referencia_rnc_mapa && (
                          <p>
                            <span className="font-medium">RNC MAPA:</span> {item.referencia_rnc_mapa}
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

export default Cultivares;

