import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogAction } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { Checkbox } from "@/components/ui/checkbox";
import { getApiBaseUrl } from "@/lib/utils";

export function ImportTalhoes() {
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [showSummary, setShowSummary] = useState(false);
  const [summary, setSummary] = useState({ imported: 0, deleted: 0 });
  const [limparAntes, setLimparAntes] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleImport = async () => {
    if (!file) {
      toast.error("Por favor, selecione um arquivo XLSX");
      return;
    }

    setImporting(true);
    setProgress(0);

    try {
      const baseUrl = getApiBaseUrl();
      const token = typeof localStorage !== "undefined" ? localStorage.getItem("auth_token") : null;
      if (!token) {
        toast.error("Usuário não autenticado");
        return;
      }
      const meRes = await fetch(`${baseUrl}/auth/me`, { headers: { Authorization: `Bearer ${token}` } });
      if (!meRes.ok) {
        toast.error("Falha ao obter usuário");
        return;
      }
      const meJson = await meRes.json();
      const user = meJson?.user;

      let deletedCount = 0;

      setProgress(10);

      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: "array" });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const rows: any[] = XLSX.utils.sheet_to_json(worksheet);

      setProgress(30);

      const requiredColumns = ["fazenda_id", "nome", "area"];
      const firstRow = rows[0] || {};
      const missingColumns = requiredColumns.filter((col) => !(col in firstRow));
      if (missingColumns.length > 0) {
        toast.error(`Colunas obrigatórias faltando: ${missingColumns.join(", ")}`);
        return;
      }

      const records = rows
        .filter((row) => row.fazenda_id && row.nome && row.area)
        .map((row) => ({
          fazenda_id: String(row.fazenda_id),
          nome: String(row.nome),
          area: parseFloat(row.area),
        }));

      if (records.length === 0) {
        toast.error("Nenhum registro válido encontrado no arquivo");
        return;
      }

      setProgress(50);

      const res = await fetch(`${baseUrl}/talhoes/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          items: records,
          limpar_antes: limparAntes,
          user_id: user?.user_id || user?.id,
          arquivo_nome: file.name,
        }),
      });
      if (!res.ok) {
        const txt = await res.text();
        toast.error(txt);
        return;
      }
      const json = await res.json();
      const imported = Number(json?.imported || records.length);
      deletedCount = Number(json?.deleted || 0);
      setProgress(90);

      setProgress(100);
      setSummary({ imported, deleted: deletedCount });
      setShowSummary(true);
      toast.success(`Importação concluída! ${imported} talhões importados.`);
    } catch (error) {
      console.error("Erro na importação:", error);
      toast.error("Erro ao processar arquivo");
    } finally {
      setImporting(false);
      setFile(null);
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Importar Talhões</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="file-upload">Arquivo XLSX</Label>
            <Input
              id="file-upload"
              type="file"
              accept=".xlsx"
              onChange={handleFileChange}
              disabled={importing}
            />
            <p className="text-sm text-muted-foreground">
              Colunas obrigatórias: fazenda_id, nome, area
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="limpar-antes"
              checked={limparAntes}
              onCheckedChange={(checked) => setLimparAntes(checked === true)}
              disabled={importing}
            />
            <Label htmlFor="limpar-antes" className="cursor-pointer">
              Limpar todos os talhões antes de importar
            </Label>
          </div>

          {importing && (
            <div className="space-y-2">
              <Progress value={progress} />
              <p className="text-sm text-center text-muted-foreground">
                Importando... {Math.round(progress)}%
              </p>
            </div>
          )}

          <Button onClick={handleImport} disabled={!file || importing} className="w-full">
            {importing ? "Importando..." : "Importar Talhões"}
          </Button>
        </CardContent>
      </Card>

      <AlertDialog open={showSummary} onOpenChange={setShowSummary}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Importação Concluída</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>✅ {summary.imported} talhões importados</p>
              {summary.deleted > 0 && <p>🗑️ {summary.deleted} talhões deletados</p>}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setShowSummary(false)}>OK</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
