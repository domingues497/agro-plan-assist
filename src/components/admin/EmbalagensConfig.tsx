import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { getApiBaseUrl } from "@/lib/utils";
import { useCultivaresCatalog } from "@/hooks/useCultivaresCatalog";
import { useToast } from "@/hooks/use-toast";

type Scope = "CULTIVAR" | "FERTILIZANTE" | "DEFENSIVO";

type EmbalagemItem = {
  id: string;
  nome: string;
  scopes: Scope[];
  ativo: boolean;
  culturas?: string[];
};

export const EmbalagensConfig = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { data: cultivaresCatalog = [] } = useCultivaresCatalog();
  const culturasUnicas = useMemo(() => {
    const set = new Set<string>();
    for (const c of (cultivaresCatalog || [])) {
      const nome = String(c.cultura || "").trim();
      if (nome) set.add(nome);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR", { sensitivity: "base" }));
  }, [cultivaresCatalog]);

  const [items, setItems] = useState<EmbalagemItem[]>([]);

  useEffect(() => {
    const load = async () => {
      try {
        const base = getApiBaseUrl();
        const res = await fetch(`${base}/embalagens`);
        const j = await res.json();
        const arr = (j?.items || []).map((x: any) => ({
          id: x.id,
          nome: x.nome,
          scopes: [
            x.scope_cultivar ? "CULTIVAR" : null,
            x.scope_fertilizante ? "FERTILIZANTE" : null,
            x.scope_defensivo ? "DEFENSIVO" : null,
          ].filter(Boolean) as Scope[],
          ativo: !!x.ativo,
          culturas: String(x.cultura || "")
            .split(",")
            .map((s: string) => s.trim())
            .filter((s: string) => !!s),
        })) as EmbalagemItem[];
        setItems(arr);
      } catch {}
      setLoading(false);
    };
    load();
  }, []);

  const [newNome, setNewNome] = useState("");
  const [newScopes, setNewScopes] = useState<Scope[]>(["CULTIVAR"]);
  const [newCulturas, setNewCulturas] = useState<string[]>([]);

  const toggleScope = (scope: Scope, base?: Scope[]) => {
    const arr = base ? [...base] : [...newScopes];
    const exists = arr.includes(scope);
    const next = exists ? arr.filter((s) => s !== scope) : [...arr, scope];
    return next;
  };

  const handleAdd = () => {
    const nome = newNome.trim();
    if (!nome) {
      toast({ title: "Informe o nome da embalagem", variant: "destructive" });
      return;
    }
    const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
    const next: EmbalagemItem = { id, nome, scopes: newScopes.length ? newScopes : ["CULTIVAR"], ativo: true, culturas: newScopes.includes("CULTIVAR") ? [...newCulturas] : [] };
    setItems([next, ...items]);
    setNewNome("");
    setNewScopes(["CULTIVAR"]);
    setNewCulturas([]);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const base = getApiBaseUrl();
      const payload = { items: items.map((it) => ({ id: it.id, nome: it.nome, ativo: it.ativo, scopes: it.scopes, cultura: (it.culturas && it.culturas.length > 0) ? it.culturas.join(",") : null })) };
      const res = await fetch(`${base}/embalagens/bulk`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (!res.ok) throw new Error(await res.text());
      toast({ title: "Embalagens salvas" });
    } catch (e: any) {
      toast({ title: "Erro ao salvar", description: e?.message || String(e), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = (id: string) => {
    setItems(items.filter((it) => it.id !== id));
  };

  const toggleActive = (id: string) => {
    setItems(items.map((it) => (it.id === id ? { ...it, ativo: !it.ativo } : it)));
  };

  const updateScopes = (id: string, scope: Scope) => {
    setItems(items.map((it) => (it.id === id ? { ...it, scopes: toggleScope(scope, it.scopes) } : it)));
  };

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-4">Embalagens {loading ? "(carregando...)" : ""}</h3>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-3">
          <Label>Nome da embalagem</Label>
          <Input value={newNome} onChange={(e) => setNewNome(e.target.value)} placeholder="Ex: BAG 5000K" />
          <div className="space-y-2">
            <Label>Aplicação</Label>
            <div className="flex flex-wrap gap-3">
              {(["CULTIVAR", "FERTILIZANTE", "DEFENSIVO"] as Scope[]).map((sc) => (
                <label key={sc} className="flex items-center gap-2 text-sm">
                  <Checkbox checked={newScopes.includes(sc)} onCheckedChange={() => setNewScopes(toggleScope(sc))} />
                  <span>{sc}</span>
                </label>
              ))}
            </div>
          </div>
          {newScopes.includes("CULTIVAR") && (
            <div className="space-y-2">
              <Label>Culturas (para Cultivar)</Label>
              <div className="grid grid-cols-2 gap-2">
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={newCulturas.length === 0}
                    onCheckedChange={() => setNewCulturas([])}
                  />
                  <span>Todas</span>
                </label>
                {culturasUnicas.map((c) => (
                  <label key={c} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={newCulturas.includes(c)}
                      onCheckedChange={() => setNewCulturas(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c])}
                    />
                    <span>{c}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
          <Button onClick={handleAdd}>Adicionar</Button>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium">Catálogo</h4>
            <Button variant="outline" onClick={handleSave} disabled={saving}>
              {saving ? "Salvando..." : "Salvar alterações"}
            </Button>
          </div>
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma embalagem cadastrada</p>
          ) : (
            <div className="space-y-3">
              {items.map((it) => (
                <div key={it.id} className="p-3 border rounded-md">
                  <div className="flex items-center justify-between">
                    <div className="font-medium">{it.nome}</div>
                    <div className="flex items-center gap-2">
                      <label className="flex items-center gap-2 text-sm">
                        <Checkbox checked={!!it.ativo} onCheckedChange={() => toggleActive(it.id)} />
                        <span>Ativo</span>
                      </label>
                      <Button variant="ghost" size="sm" onClick={() => handleRemove(it.id)}>Remover</Button>
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-3 text-sm">
                    {(["CULTIVAR", "FERTILIZANTE", "DEFENSIVO"] as Scope[]).map((sc) => (
                      <label key={`${it.id}-${sc}`} className="flex items-center gap-2">
                        <Checkbox checked={it.scopes.includes(sc)} onCheckedChange={() => updateScopes(it.id, sc)} />
                        <span>{sc}</span>
                      </label>
                    ))}
                  </div>
                  {it.scopes.includes("CULTIVAR") && (
                    <div className="mt-2 space-y-1">
                      <Label className="text-xs">Culturas (para Cultivar)</Label>
                      <div className="grid grid-cols-2 gap-2">
                        <label className="flex items-center gap-2 text-xs">
                          <Checkbox
                            checked={(it.culturas || []).length === 0}
                            onCheckedChange={() => setItems(items.map((x) => (x.id === it.id ? { ...x, culturas: [] } : x)))}
                          />
                          <span>Todas</span>
                        </label>
                        {culturasUnicas.map((c) => (
                          <label key={c} className="flex items-center gap-2 text-xs">
                            <Checkbox
                              checked={(it.culturas || []).includes(c)}
                              onCheckedChange={() => setItems(items.map((x) => (
                                x.id === it.id
                                  ? { ...x, culturas: (x.culturas || []).includes(c) ? (x.culturas || []).filter(y => y !== c) : [...(x.culturas || []), c] }
                                  : x
                              )))}
                            />
                            <span>{c}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
};
