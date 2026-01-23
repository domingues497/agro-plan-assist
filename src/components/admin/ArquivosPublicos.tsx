import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getApiBaseUrl } from "@/lib/utils";
import { toast } from "sonner";
import { Trash2, Copy, FileIcon, Upload } from "lucide-react";

interface PublicFile {
  name: string;
  size: number;
  modified: number;
  url: string;
}

export const ArquivosPublicos = () => {
  const [files, setFiles] = useState<PublicFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  const fetchFiles = async () => {
    setLoading(true);
    try {
      const baseUrl = getApiBaseUrl();
      const res = await fetch(`${baseUrl}/upload/public`);
      if (res.ok) {
        const data = await res.json();
        setFiles(data.items);
      }
    } catch (e) {
      toast.error("Erro ao carregar arquivos");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFiles();
  }, []);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Limite de 500MB
    const MAX_SIZE = 500 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      toast.error("Arquivo muito grande. O limite é 500MB.");
      e.target.value = "";
      return;
    }

    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const baseUrl = getApiBaseUrl();
      const res = await fetch(`${baseUrl}/upload/public`, {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        toast.success("Arquivo enviado com sucesso!");
        fetchFiles();
      } else {
        const err = await res.json();
        toast.error(`Erro: ${err.error || "Falha no envio"}`);
      }
    } catch (e) {
      toast.error("Erro ao enviar arquivo");
    } finally {
      setUploading(false);
      // Reset input
      e.target.value = "";
    }
  };

  const handleDelete = async (filename: string) => {
    if (!confirm(`Tem certeza que deseja excluir ${filename}?`)) return;

    try {
      const baseUrl = getApiBaseUrl();
      const res = await fetch(`${baseUrl}/upload/public/${filename}`, {
        method: "DELETE",
      });

      if (res.ok) {
        toast.success("Arquivo excluído!");
        fetchFiles();
      } else {
        toast.error("Erro ao excluir arquivo");
      }
    } catch (e) {
      toast.error("Erro ao excluir arquivo");
    }
  };

  const copyLink = (filename: string) => {
    const url = `${window.location.protocol}//${window.location.host}/${filename}`;
    navigator.clipboard.writeText(url);
    toast.success("Link copiado: " + url);
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  const formatDate = (ts: number) => {
    return new Date(ts * 1000).toLocaleString("pt-BR");
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Arquivos Públicos</CardTitle>
          <CardDescription>
            Faça upload de arquivos para disponibilizar publicamente na raiz do domínio.
            Exemplo: programacao.coopagricola.coop.br/arquivo.pdf
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 mb-6">
            <Button disabled={uploading} asChild>
                <label className="cursor-pointer flex items-center gap-2">
                    <Upload className="w-4 h-4" />
                    {uploading ? "Enviando..." : "Upload de Arquivo"}
                    <input type="file" className="hidden" onChange={handleUpload} />
                </label>
            </Button>
          </div>

          {loading ? (
            <div className="text-center py-4">Carregando...</div>
          ) : (
            <div className="border rounded-md divide-y">
              {files.length === 0 && (
                <div className="p-4 text-center text-muted-foreground">Nenhum arquivo encontrado</div>
              )}
              {files.map((file) => (
                <div key={file.name} className="p-3 flex items-center justify-between hover:bg-muted/50">
                  <div className="flex items-center gap-3 overflow-hidden">
                    <FileIcon className="w-5 h-5 text-blue-500 shrink-0" />
                    <div className="min-w-0">
                        <div className="font-medium truncate">{file.name}</div>
                        <div className="text-xs text-muted-foreground">
                            {formatSize(file.size)} • {formatDate(file.modified)}
                        </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button variant="ghost" size="icon" onClick={() => copyLink(file.name)} title="Copiar Link">
                        <Copy className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-600 hover:bg-red-50" onClick={() => handleDelete(file.name)} title="Excluir">
                        <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
