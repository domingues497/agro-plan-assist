import { useState } from "react";
import { useUsuarios } from "@/hooks/useUsuarios";
import { useUserProdutores } from "@/hooks/useUserProdutores";
import { useUserFazendas } from "@/hooks/useUserFazendas";
import { useProdutores } from "@/hooks/useProdutores";
import { useFazendas } from "@/hooks/useFazendas";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Trash2, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export const GerenciarGestores = () => {
  const { usuarios, isLoading: loadingUsuarios } = useUsuarios();
  const { data: produtores, isLoading: loadingProdutores } = useProdutores();
  const { data: fazendas, isLoading: loadingFazendas } = useFazendas();

  const [selectedGestor, setSelectedGestor] = useState<string>("");
  const [selectedProdutor, setSelectedProdutor] = useState<string>("");
  const [selectedFazenda, setSelectedFazenda] = useState<string>("");

  const {
    produtores: gestorProdutores,
    addProdutor,
    removeProdutor,
    isAdding: addingProdutor,
  } = useUserProdutores(selectedGestor);

  const {
    fazendas: gestorFazendas,
    addFazenda,
    removeFazenda,
    isAdding: addingFazenda,
  } = useUserFazendas(selectedGestor);

  const gestores = usuarios?.filter((u) => u.role === "gestor") ?? [];

  const handleAddProdutor = () => {
    if (selectedGestor && selectedProdutor) {
      addProdutor({
        userId: selectedGestor,
        produtorNumerocm: selectedProdutor,
      });
      setSelectedProdutor("");
    }
  };

  const handleAddFazenda = () => {
    if (selectedGestor && selectedFazenda) {
      addFazenda({
        userId: selectedGestor,
        fazendaId: selectedFazenda,
      });
      setSelectedFazenda("");
    }
  };

  if (loadingUsuarios || loadingProdutores || loadingFazendas) {
    return <div>Carregando...</div>;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Gerenciar Associações de Gestores</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-2 block">
              Selecione um Gestor
            </label>
            <Select value={selectedGestor} onValueChange={setSelectedGestor}>
              <SelectTrigger>
                <SelectValue placeholder="Escolha um gestor" />
              </SelectTrigger>
              <SelectContent>
                {gestores.map((gestor) => (
                  <SelectItem key={gestor.id} value={gestor.id}>
                    {gestor.nome || gestor.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedGestor && (
            <>
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-semibold mb-2">
                    Produtores Associados
                  </h3>
                  <div className="flex gap-2 mb-4">
                    <Select
                      value={selectedProdutor}
                      onValueChange={setSelectedProdutor}
                    >
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Selecione um produtor" />
                      </SelectTrigger>
                      <SelectContent>
                        {produtores
                          ?.filter(
                            (p) =>
                              !gestorProdutores.some(
                                (gp) => gp.produtor_numerocm === p.numerocm
                              )
                          )
                          .map((produtor) => (
                            <SelectItem
                              key={produtor.id}
                              value={produtor.numerocm}
                            >
                              {produtor.nome}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                    <Button
                      onClick={handleAddProdutor}
                      disabled={!selectedProdutor || addingProdutor}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Adicionar
                    </Button>
                  </div>

                  {gestorProdutores.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Produtor</TableHead>
                          <TableHead className="w-[100px]">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {gestorProdutores.map((gp) => {
                          const produtor = produtores?.find(
                            (p) => p.numerocm === gp.produtor_numerocm
                          );
                          return (
                            <TableRow key={gp.id}>
                              <TableCell>
                                {produtor?.nome || gp.produtor_numerocm}
                              </TableCell>
                              <TableCell>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => removeProdutor(gp.id)}
                                >
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  ) : (
                    <p className="text-muted-foreground text-sm">
                      Nenhum produtor associado
                    </p>
                  )}
                </div>

                <div>
                  <h3 className="text-lg font-semibold mb-2">
                    Fazendas Associadas
                  </h3>
                  <div className="flex gap-2 mb-4">
                    <Select
                      value={selectedFazenda}
                      onValueChange={setSelectedFazenda}
                    >
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Selecione uma fazenda" />
                      </SelectTrigger>
                      <SelectContent>
                        {fazendas
                          ?.filter(
                            (f) =>
                              !gestorFazendas.some(
                                (gf) => gf.fazenda_id === f.id
                              )
                          )
                          .map((fazenda) => (
                            <SelectItem key={fazenda.id} value={fazenda.id}>
                              {fazenda.nomefazenda}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                    <Button
                      onClick={handleAddFazenda}
                      disabled={!selectedFazenda || addingFazenda}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Adicionar
                    </Button>
                  </div>

                  {gestorFazendas.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Fazenda</TableHead>
                          <TableHead className="w-[100px]">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {gestorFazendas.map((gf) => {
                          const fazenda = fazendas?.find(
                            (f) => f.id === gf.fazenda_id
                          );
                          return (
                            <TableRow key={gf.id}>
                              <TableCell>
                                {fazenda?.nomefazenda || gf.fazenda_id}
                              </TableCell>
                              <TableCell>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => removeFazenda(gf.id)}
                                >
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  ) : (
                    <p className="text-muted-foreground text-sm">
                      Nenhuma fazenda associada
                    </p>
                  )}
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
