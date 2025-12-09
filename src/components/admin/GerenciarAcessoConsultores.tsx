import { useState } from "react";
import { useConsultores } from "@/hooks/useConsultores";
import { useUsuarios } from "@/hooks/useUsuarios";
import { useUserProdutores } from "@/hooks/useUserProdutores";
import { useUserFazendas } from "@/hooks/useUserFazendas";
import { useProdutores } from "@/hooks/useProdutores";
import { useFazendas } from "@/hooks/useFazendas";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Trash2, Plus } from "lucide-react";

export const GerenciarAcessoConsultores = () => {
  const { data: consultores, isLoading: loadingConsultores } = useConsultores();
  const { usuarios } = useUsuarios();
  const [selectedConsultor, setSelectedConsultor] = useState<string>("");
  const [queryProdutor, setQueryProdutor] = useState("");
  const [queryFazenda, setQueryFazenda] = useState("");
  const [selectedProdutores, setSelectedProdutores] = useState<string[]>([]);
  const [selectedFazendas, setSelectedFazendas] = useState<string[]>([]);
  const [linkProdutorOnAdd, setLinkProdutorOnAdd] = useState<boolean>(false);

  const { data: produtores } = useProdutores();
  const { data: fazendas } = useFazendas();

  const { produtores: associadosProdutores, addProdutor, removeProdutor, isAdding: addingProdutor } = useUserProdutores(selectedConsultor);
  const { fazendas: associadosFazendas, addFazenda, removeFazenda, isAdding: addingFazenda } = useUserFazendas(selectedConsultor);

  const allUsersById = new Map((usuarios ?? []).map((u) => [u.id, u]));

  const filteredProdutores = (produtores ?? []).filter((p) => {
    const q = queryProdutor.trim().toLowerCase();
    if (!q) return true;
    return (
      String(p.numerocm || "").toLowerCase().includes(q) ||
      String(p.nome || "").toLowerCase().includes(q)
    );
  }).filter((p) => !associadosProdutores.some((ap) => ap.produtor_numerocm === p.numerocm));

  const filteredFazendas = (fazendas ?? []).filter((f) => {
    const q = queryFazenda.trim().toLowerCase();
    if (!q) return true;
    return (
      String(f.idfazenda || "").toLowerCase().includes(q) ||
      String(f.nomefazenda || "").toLowerCase().includes(q) ||
      String(f.numerocm || "").toLowerCase().includes(q)
    );
  }).filter((f) => !associadosFazendas.some((af) => af.fazenda_id === f.id));

  const handleToggleProdutor = (numerocm: string) => {
    setSelectedProdutores((prev) => prev.includes(numerocm) ? prev.filter((x) => x !== numerocm) : [...prev, numerocm]);
  };

  const handleToggleFazenda = (id: string) => {
    setSelectedFazendas((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  };

  const handleAddProdutores = () => {
    if (!selectedConsultor || selectedProdutores.length === 0) return;
    for (const numerocm of selectedProdutores) {
      addProdutor({ userId: selectedConsultor, produtorNumerocm: numerocm });
    }
    setSelectedProdutores([]);
  };

  const handleAddFazendas = () => {
    if (!selectedConsultor || selectedFazendas.length === 0) return;
    for (const fazendaId of selectedFazendas) {
      addFazenda({ userId: selectedConsultor, fazendaId });
    }
    if (linkProdutorOnAdd) {
      for (const fazendaId of selectedFazendas) {
        const fz = (fazendas ?? []).find((f: any) => f.id === fazendaId);
        const cm = fz?.numerocm as string | undefined;
        if (cm && !associadosProdutores.some((ap) => ap.produtor_numerocm === cm)) {
          addProdutor({ userId: selectedConsultor, produtorNumerocm: cm });
        }
      }
    }
    setSelectedFazendas([]);
  };

  if (loadingConsultores) {
    return <div>Carregando...</div>;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Gerenciar Acesso de Consultores</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <label className="text-sm font-medium mb-2 block">Selecione um Consultor</label>
            <Select value={selectedConsultor} onValueChange={setSelectedConsultor}>
              <SelectTrigger>
                <SelectValue placeholder="Escolha um consultor" />
              </SelectTrigger>
              <SelectContent>
                {(consultores ?? []).map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.consultor} - {c.email} ({c.numerocm_consultor})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedConsultor && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Produtores</h3>
                <div className="flex items-center gap-2">
                  <Input placeholder="Buscar produtor por nome ou CM" value={queryProdutor} onChange={(e) => setQueryProdutor(e.target.value)} />
                  <Button onClick={handleAddProdutores} disabled={selectedProdutores.length === 0 || addingProdutor} size="sm">
                    <Plus className="h-4 w-4 mr-2" /> Adicionar ({selectedProdutores.length})
                  </Button>
                </div>
                <ScrollArea className="h-[220px] border rounded-md p-2">
                  <div className="space-y-2">
                    {filteredProdutores.map((p) => (
                      <div key={p.id} className="flex items-center gap-2">
                        <Checkbox id={`prod-${p.id}`} checked={selectedProdutores.includes(p.numerocm)} onCheckedChange={() => handleToggleProdutor(p.numerocm)} />
                        <label htmlFor={`prod-${p.id}`} className="text-sm cursor-pointer flex-1">
                          {p.numerocm} - {p.nome}
                        </label>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Produtor</TableHead>
                      <TableHead>CM</TableHead>
                      <TableHead className="w-[100px]">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {associadosProdutores.map((ap) => (
                      <TableRow key={ap.id}>
                        <TableCell>{ap.produtor_numerocm}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{ap.produtor_numerocm}</Badge>
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" onClick={() => removeProdutor(ap.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Fazendas</h3>
                <div className="flex items-center gap-2">
                  <Input placeholder="Buscar fazenda por nome, id ou CM" value={queryFazenda} onChange={(e) => setQueryFazenda(e.target.value)} />
                  <Button onClick={handleAddFazendas} disabled={selectedFazendas.length === 0 || addingFazenda} size="sm">
                    <Plus className="h-4 w-4 mr-2" /> Adicionar ({selectedFazendas.length})
                  </Button>
                  <div className="flex items-center gap-2 ml-auto">
                    <Checkbox id="link-produtor-on-add" checked={linkProdutorOnAdd} onCheckedChange={() => setLinkProdutorOnAdd((v) => !v)} />
                    <label htmlFor="link-produtor-on-add" className="text-xs">Associar produtor automaticamente</label>
                  </div>
                </div>
                <ScrollArea className="h-[220px] border rounded-md p-2">
                  <div className="space-y-2">
                    {filteredFazendas.map((f) => (
                      <div key={f.id} className="flex items-center gap-2">
                        <Checkbox id={`faz-${f.id}`} checked={selectedFazendas.includes(f.id)} onCheckedChange={() => handleToggleFazenda(f.id)} />
                        <label htmlFor={`faz-${f.id}`} className="text-sm cursor-pointer flex-1">
                          {f.idfazenda} - {f.nomefazenda} ({f.numerocm})
                        </label>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fazenda</TableHead>
                      <TableHead>ID</TableHead>
                      <TableHead className="w-[100px]">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {associadosFazendas.map((af) => {
                      const fz = (fazendas ?? []).find((f) => f.id === af.fazenda_id);
                      return (
                        <TableRow key={af.id}>
                          <TableCell>{fz?.nomefazenda || af.fazenda_id}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{af.fazenda_id}</Badge>
                          </TableCell>
                          <TableCell>
                            <Button variant="ghost" size="icon" onClick={() => removeFazenda(af.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
