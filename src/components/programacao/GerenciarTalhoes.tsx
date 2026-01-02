import { useEffect, useRef, useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Trash2, Plus, Pencil, Upload, Flag, Settings } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useTalhoes } from "@/hooks/useTalhoes";
import { useSafras } from "@/hooks/useSafras";
import { useProdutores } from "@/hooks/useProdutores";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { useQueryClient } from "@tanstack/react-query";
import { getApiBaseUrl } from "@/lib/utils";

interface GerenciarTalhoesProps {
  fazendaId: string;
  fazendaNome: string;
  safraId?: string;
  epocaId?: string;
  produtorId?: string;
  produtorNumerocm?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function GerenciarTalhoes({ fazendaId, fazendaNome, safraId, epocaId, produtorId, produtorNumerocm, open, onOpenChange }: GerenciarTalhoesProps) {
  const { data: talhoes = [], refetch } = useTalhoes(fazendaId, safraId, epocaId);
  const { data: produtores = [], refetch: refetchProdutores } = useProdutores();
  const produtor = produtores.find(p => p.id === produtorId) || 
                   (produtorNumerocm ? produtores.find(p => String(p.numerocm).trim() === String(produtorNumerocm).trim()) : undefined);
  
  const { safras = [] } = useSafras();
  const [editando, setEditando] = useState<{ id?: string; nome: string; area: string; arrendado: boolean; safras_todas: boolean; safras_sel: string[] } | null>(null);
  const queryClient = useQueryClient();
  
  // Flags do produtor
  const [flagsOpen, setFlagsOpen] = useState(false);
  const [produtorFlags, setProdutorFlags] = useState<{
    compra_insumos: boolean;
    entrega_producao: boolean;
    paga_assistencia: boolean;
    observacao_flags: string;
  }>({
    compra_insumos: true,
    entrega_producao: true,
    paga_assistencia: true,
    observacao_flags: "",
  });

  useEffect(() => {
    if (produtor) {
      setProdutorFlags({
        compra_insumos: produtor.compra_insumos ?? true,
        entrega_producao: produtor.entrega_producao ?? true,
        paga_assistencia: produtor.paga_assistencia ?? true,
        observacao_flags: produtor.observacao_flags ?? "",
      });
    }
  }, [produtor]);

  const handleSaveFlags = async () => {
    const idToUpdate = produtorId || produtor?.id;
    if (!idToUpdate) return;
    
    // Validação
    if ((!produtorFlags.compra_insumos || !produtorFlags.entrega_producao || !produtorFlags.paga_assistencia) && !produtorFlags.observacao_flags.trim()) {
      toast.error("Observação é obrigatória quando há pendências nos flags");
      return;
    }

    try {
      const { getApiBaseUrl } = await import("@/lib/utils");
      const baseUrl = getApiBaseUrl();
      const res = await fetch(`${baseUrl}/produtores/${idToUpdate}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(produtorFlags),
      });

      if (!res.ok) {
        throw new Error(await res.text());
      }

      toast.success("Flags do produtor atualizadas");
      setFlagsOpen(false);
      refetchProdutores();
    } catch (error) {
      toast.error("Erro ao atualizar flags");
    }
  };

  const mapRef = useRef<HTMLDivElement | null>(null);
  const leafletReadyRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [geoPreview, setGeoPreview] = useState<any | null>(null);
  const [pendingKml, setPendingKml] = useState<any | null>(null);
  const [selectedKmlName, setSelectedKmlName] = useState<string | null>(null);
  
  const [importMode, setImportMode] = useState<"kml" | "manual">("manual");
  const [manualCoords, setManualCoords] = useState<{lat: number, lng: number} | null>(null);
  const mapInstanceRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const importModeRef = useRef("manual");

  useEffect(() => {
    importModeRef.current = importMode;
  }, [importMode]);

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  const paginatedTalhoes = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return talhoes.slice(startIndex, startIndex + itemsPerPage);
  }, [talhoes, currentPage]);

  const totalPages = Math.ceil(talhoes.length / itemsPerPage);

  useEffect(() => {
    setCurrentPage(1);
  }, [talhoes.length]);

  const handleSalvar = async () => {
    if (!editando) return;
    
    const area = parseFloat(editando.area);
    if (isNaN(area) || area <= 0) {
      toast.error("Área deve ser um número positivo");
      return;
    }

    let manualGeoData: any = {};
    if (importMode === "manual") {
      if (!manualCoords) {
        toast.error("É obrigatório selecionar a localização no mapa para salvar.");
        return;
      }
      manualGeoData = {
        centroid_lat: manualCoords.lat,
        centroid_lng: manualCoords.lng,
        geojson: {
          type: "Point",
          coordinates: [manualCoords.lng, manualCoords.lat]
        }
      };
    }

    try {
      const baseUrl = getApiBaseUrl();
      const basePayload = { 
        nome: editando.nome, 
        area, 
        arrendado: editando.arrendado, 
        safras_todas: editando.safras_todas, 
        safras: editando.safras_sel 
      };

      if (editando.id) {
        const res = await fetch(`${baseUrl}/talhoes/${editando.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...basePayload, ...manualGeoData }),
        });
        if (!res.ok) {
          const txt = await res.text();
          throw new Error(txt);
        }
        toast.success("Talhão atualizado");
      } else {
        const res = await fetch(`${baseUrl}/talhoes`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fazenda_id: fazendaId, ...basePayload, ...manualGeoData }),
        });
        if (!res.ok) {
          const txt = await res.text();
          throw new Error(txt);
        }
        const json = await res.json();
        const newId = json?.id as string;
        
        if (importMode === "kml" && pendingKml && newId) {
          try {
            const putRes = await fetch(`${baseUrl}/talhoes/${newId}`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                kml_name: pendingKml.kml_name,
                kml_text: pendingKml.kml_text,
                geojson: pendingKml.geojson,
                centroid_lat: pendingKml.centroid_lat,
                centroid_lng: pendingKml.centroid_lng,
                bbox_min_lat: pendingKml.bbox_min_lat,
                bbox_min_lng: pendingKml.bbox_min_lng,
                bbox_max_lat: pendingKml.bbox_max_lat,
                bbox_max_lng: pendingKml.bbox_max_lng,
              }),
            });
            if (!putRes.ok) {
              const txt = await putRes.text();
              throw new Error(txt || "Falha ao salvar geometria do KML");
            }
            toast.success("Talhão criado com KML");
          } catch (e: any) {
            toast.error(e.message || "Falha ao salvar KML do novo talhão");
          }
        } else {
          toast.success("Talhão criado");
        }
      }
      
      setEditando(null);
      setPendingKml(null);
      refetch();
      // Invalida queries de fazendas para recalcular área cultivável
      queryClient.invalidateQueries({ queryKey: ["fazendas"] });
      queryClient.invalidateQueries({ queryKey: ["fazendas-multi"] });
    } catch (error: any) {
      toast.error(error.message || "Erro ao salvar talhão");
    }
  };

  const loadLeaflet = async () => {
    if (leafletReadyRef.current) return;
    const hasL = (window as any).L;
    if (!hasL) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);
      await new Promise((res) => setTimeout(res, 50));
      await new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
        script.async = true;
        script.onload = () => resolve(null);
        script.onerror = () => reject(new Error("Falha ao carregar Leaflet"));
        document.body.appendChild(script);
      });
    }
    leafletReadyRef.current = true;
  };

  // Effect to sync state from editando
  useEffect(() => {
    if (!editando?.id) {
      setGeoPreview(null);
      setImportMode("manual");
      setManualCoords(null);
      return;
    }
    const talhao = talhoes.find((t) => t.id === editando.id);
    const gj = (talhao as any)?.geojson;
    const hasKml = !!(talhao as any)?.kml_name;

    if (hasKml) {
      setImportMode("kml");
      setGeoPreview(gj);
      setManualCoords(null);
    } else {
      setImportMode("manual");
      setGeoPreview(null);
      const lat = (talhao as any)?.centroid_lat;
      const lng = (talhao as any)?.centroid_lng;
      if (lat && lng) {
        setManualCoords({ lat, lng });
      } else {
        setManualCoords(null);
      }
    }
  }, [editando?.id]);

  // Initialize Map
  useEffect(() => {
    if (!editando) return;

    let isActive = true;
    const initMap = async () => {
      await loadLeaflet();
      if (!isActive) return;
      
      const L = (window as any).L;
      if (!mapRef.current) return;

      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        markerRef.current = null;
      }

      const map = L.map(mapRef.current, { zoomControl: true });
      mapInstanceRef.current = map;

      const satellite = L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        { attribution: "Tiles © Esri", maxZoom: 19 }
      );
      const roads = L.tileLayer(
        "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
        { attribution: "© OpenStreetMap", maxZoom: 19 }
      );
      const hybrid = L.layerGroup([
        L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", { maxZoom: 19 }),
        L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}", { maxZoom: 19 }),
      ]);

      const baseLayers = { "Satélite": satellite, "Ruas (OSM)": roads, "Híbrido": hybrid };
      satellite.addTo(map);
      L.control.layers(baseLayers, {}, { position: "topright" }).addTo(map);

      map.on('click', (e: any) => {
        if (importModeRef.current === "manual") {
           setManualCoords({ lat: e.latlng.lat, lng: e.latlng.lng });
        }
      });

      if (importMode === "kml" && geoPreview) {
        const layer = L.geoJSON(geoPreview, {
          style: { color: "#d00", weight: 2, fillColor: "#d00", fillOpacity: 0.25 },
        });
        layer.addTo(map);
        try { map.fitBounds(layer.getBounds(), { padding: [20, 20] }); } catch {}
      } else {
         if (manualCoords) {
            map.setView([manualCoords.lat, manualCoords.lng], 16);
            markerRef.current = L.marker([manualCoords.lat, manualCoords.lng]).addTo(map);
         } else {
            map.setView([-15.79, -47.88], 4);
         }
      }
    };

    initMap();

    return () => {
      isActive = false;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [!!editando, editando?.id, importMode, geoPreview]); // Re-init map when mode or preview changes

  // Update Marker separately
  useEffect(() => {
    if (!mapInstanceRef.current || importMode !== "manual") return;
    const L = (window as any).L;
    const map = mapInstanceRef.current;
    
    if (markerRef.current) {
      markerRef.current.remove();
      markerRef.current = null;
    }
    
    if (manualCoords) {
      markerRef.current = L.marker([manualCoords.lat, manualCoords.lng]).addTo(map);
    }
  }, [manualCoords, importMode]);

  const handleUploadKml = async (file: File) => {
    setSelectedKmlName(file.name || null);
    if (!file.name.toLowerCase().endsWith(".kml")) {
      toast.error("Formato inválido: selecione um arquivo .kml");
      return;
    }
    try {
      const baseUrl = getApiBaseUrl();
      const text = await file.text();
      const parseKmlFront = (kmlText: string) => {
        const parser = new DOMParser();
        const xml = parser.parseFromString(kmlText, "application/xml");
        const coordsFromText = (t: string) => t.trim().split(/\s+/).map((p) => p.split(",").map(Number)).filter((a) => a.length >= 2).map(([lng, lat]) => [lng, lat]);
        const geoms: any[] = [];
        const getPlacemarkName = () => {
          const pms = Array.from(xml.getElementsByTagName("Placemark"));
          for (const pm of pms) {
            const n = pm.getElementsByTagName("name")[0];
            const val = (n?.textContent || "").trim();
            if (val) return val;
          }
          const docName = xml.getElementsByTagName("name")[0]?.textContent?.trim() || "";
          return docName || null;
        };
        const title = getPlacemarkName();
        const polys = Array.from(xml.getElementsByTagName("Polygon"));
        polys.forEach((poly) => {
          const ring = poly.getElementsByTagName("coordinates")[0];
          if (ring && ring.textContent) {
            const coords = coordsFromText(ring.textContent);
            if (coords.length) geoms.push({ type: "Polygon", coordinates: [coords] });
          }
        });
        const lines = Array.from(xml.getElementsByTagName("LineString"));
        lines.forEach((ls) => {
          const c = ls.getElementsByTagName("coordinates")[0];
          if (c && c.textContent) {
            const coords = coordsFromText(c.textContent);
            if (coords.length) geoms.push({ type: "LineString", coordinates: coords });
          }
        });
        const points = Array.from(xml.getElementsByTagName("Point"));
        points.forEach((pt) => {
          const c = pt.getElementsByTagName("coordinates")[0];
          if (c && c.textContent) {
            const coords = coordsFromText(c.textContent);
            if (coords.length) geoms.push({ type: "Point", coordinates: coords[0] });
          }
        });
        if (!geoms.length) throw new Error("Nenhuma geometria encontrada no KML");
        const all: Array<[number, number]> = [];
        geoms.forEach((g) => {
          if (g.type === "Point") all.push(g.coordinates);
          if (g.type === "LineString") g.coordinates.forEach((p: any) => all.push(p));
          if (g.type === "Polygon") g.coordinates.forEach((ring: any) => ring.forEach((p: any) => all.push(p)));
        });
        const lons = all.map((p) => p[0]);
        const lats = all.map((p) => p[1]);
        const min_lng = Math.min(...lons), max_lng = Math.max(...lons);
        const min_lat = Math.min(...lats), max_lat = Math.max(...lats);
        const centroid_lng = lons.reduce((a, b) => a + b, 0) / lons.length;
        const centroid_lat = lats.reduce((a, b) => a + b, 0) / lats.length;
        const geojson = { type: "GeometryCollection", geometries: geoms, bbox: [min_lng, min_lat, max_lng, max_lat] };
        const toRad = (d: number) => (d * Math.PI) / 180;
        const metersPerDegLat = (lat: number) => {
          const φ = toRad(lat);
          return 111132.92 - 559.82 * Math.cos(2 * φ) + 1.175 * Math.cos(4 * φ) - 0.0023 * Math.cos(6 * φ);
        };
        const metersPerDegLon = (lat: number) => {
          const φ = toRad(lat);
          return 111412.84 * Math.cos(φ) - 93.5 * Math.cos(3 * φ) + 0.118 * Math.cos(5 * φ);
        };
        const toMetersArea = (ring: Array<[number, number]>) => {
          if (ring.length < 3) return 0;
          const lat0 = ring.reduce((acc, [, lat]) => acc + lat, 0) / ring.length;
          const lon0 = ring[0][0];
          const mLat = metersPerDegLat(lat0);
          const mLon = metersPerDegLon(lat0);
          const pts = ring.map(([lng, lat]) => {
            const x = (lng - lon0) * mLon;
            const y = (lat - lat0) * mLat;
            return [x, y] as [number, number];
          });
          if (pts[0][0] !== pts[pts.length - 1][0] || pts[0][1] !== pts[pts.length - 1][1]) {
            pts.push(pts[0]);
          }
          let area = 0;
          for (let i = 0; i < pts.length - 1; i++) {
            const [x1, y1] = pts[i];
            const [x2, y2] = pts[i + 1];
            area += x1 * y2 - x2 * y1;
          }
          return Math.abs(area) * 0.5;
        };
        let area_m2 = 0;
        geoms.forEach((g) => {
          if (g.type === "Polygon") {
            g.coordinates.forEach((ring: any) => {
              area_m2 += toMetersArea(ring as Array<[number, number]>);
            });
          }
        });
        const area_ha = area_m2 / 10000;
        return { title, area_ha, geojson, centroid_lng, centroid_lat, min_lng, min_lat, max_lng, max_lat };
      };

      const parsed = parseKmlFront(text);
      if (editando) {
        const nome = parsed.title || editando.nome;
        const areaStr = parsed.area_ha && parsed.area_ha > 0 ? String(Number(parsed.area_ha.toFixed(2))) : editando.area;
        setEditando({ ...editando, nome, area: areaStr });
      }
      setGeoPreview(parsed.geojson);

      if (editando?.id) {
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch(`${baseUrl}/talhoes/${editando.id}/kml`, { method: "POST", body: fd });
        if (!res.ok) {
          const putRes = await fetch(`${baseUrl}/talhoes/${editando.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              nome: editando.nome,
              area: parseFloat(editando.area || "0") || undefined,
              arrendado: editando.arrendado,
              kml_name: file.name,
              kml_text: text,
              geojson: parsed.geojson,
              centroid_lat: parsed.centroid_lat,
              centroid_lng: parsed.centroid_lng,
              bbox_min_lat: parsed.min_lat,
              bbox_min_lng: parsed.min_lng,
              bbox_max_lat: parsed.max_lat,
              bbox_max_lng: parsed.max_lng,
            }),
          });
          if (!putRes.ok) {
            const txt = await putRes.text();
            throw new Error(txt || "Falha ao salvar geometria (PUT)");
          }
          toast.success("KML processado e salvo (fallback)");
        } else {
          const js = await res.json().catch(() => ({} as any));
          if (!js?.has_kml) {
            const putRes = await fetch(`${baseUrl}/talhoes/${editando.id}`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                nome: editando.nome,
                area: parseFloat(editando.area || "0") || undefined,
                arrendado: editando.arrendado,
                kml_name: file.name,
                kml_text: text,
                geojson: parsed.geojson,
                centroid_lat: parsed.centroid_lat,
                centroid_lng: parsed.centroid_lng,
                bbox_min_lat: parsed.min_lat,
                bbox_min_lng: parsed.min_lng,
                bbox_max_lat: parsed.max_lat,
                bbox_max_lng: parsed.max_lng,
              }),
            });
            if (!putRes.ok) {
              const txt = await putRes.text();
              throw new Error(txt || "Falha ao salvar geometria (PUT)");
            }
            toast.success("KML salvo (verificação)");
          } else {
            toast.success("KML importado");
          }
        }
        await refetch();
      } else {
        setPendingKml({
          kml_name: file.name,
          kml_text: text,
          geojson: parsed.geojson,
          centroid_lat: parsed.centroid_lat,
          centroid_lng: parsed.centroid_lng,
          bbox_min_lat: parsed.min_lat,
          bbox_min_lng: parsed.min_lng,
          bbox_max_lat: parsed.max_lat,
          bbox_max_lng: parsed.max_lng,
        });
        toast.success("KML processado para este talhão (não salvo ainda)");
      }
    } catch (e: any) {
      toast.error(e.message || "Falha ao importar KML");
    }
  };

  const handleExcluir = async (id: string) => {
    if (!confirm("Deseja excluir este talhão?")) return;
    
    try {
      const baseUrl = getApiBaseUrl();
      const res = await fetch(`${baseUrl}/talhoes/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt);
      }
      toast.success("Talhão excluído");
      refetch();
      // Invalida queries de fazendas para recalcular área cultivável
      queryClient.invalidateQueries({ queryKey: ["fazendas"] });
      queryClient.invalidateQueries({ queryKey: ["fazendas-multi"] });
    } catch (error: any) {
      toast.error(error.message || "Erro ao excluir talhão");
    }
  };

  const areaTotal = talhoes.reduce((sum, t) => sum + Number(t.area), 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0 gap-0">
        <DialogHeader className="p-6 pb-4 border-b shrink-0">
          <DialogTitle>Gerenciar Talhões - {fazendaNome}</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-6 min-h-0">
          <div className="space-y-6">
            <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Área total: <span className="font-semibold">{areaTotal.toFixed(2)} ha</span>
            </p>
            <Button
              onClick={() => setEditando({ nome: "", area: "", arrendado: false, safras_todas: true, safras_sel: [] })}
              size="sm"
            >
              <Plus className="h-6 w-6 mr-2" />
              Novo Talhão
            </Button>
          </div>

          {editando && (
            <Card className="p-6 bg-muted/50">
              <div className="space-y-3">
                <div className="flex flex-wrap items-end gap-3">
                  <div className="flex-1 min-w-[280px] max-w-[55%]">
                    <Label className="text-xs">Nome do Talhão</Label>
                    <Input
                      value={editando.nome}
                      onChange={(e) => setEditando({ ...editando, nome: e.target.value })}
                      placeholder="Ex: Talhão 1"
                    />
                  </div>
                  <div className="w-[120px]">
                    <Label className="text-xs">Área (ha)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={editando.area}
                      onChange={(e) => setEditando({ ...editando, area: e.target.value })}
                      placeholder="Ex: 50.5"
                    />
                  </div>
                  <div className="flex items-center gap-2 shrink-0 whitespace-nowrap">
                    <Checkbox
                      id="arrendado"
                      checked={editando.arrendado}
                      onCheckedChange={(checked) => setEditando({ ...editando, arrendado: checked as boolean })}
                    />
                    <Label htmlFor="arrendado" className="cursor-pointer">Talhão Arrendado</Label>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 whitespace-nowrap">
                    <Checkbox
                      id="safras_todas"
                      checked={editando.safras_todas}
                      onCheckedChange={(checked) => setEditando({ ...editando, safras_todas: checked as boolean, safras_sel: (checked ? [] : editando.safras_sel) })}
                    />
                    <Label htmlFor="safras_todas" className="cursor-pointer">Todas as safras</Label>
                    {!editando.safras_todas && (
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" size="sm">
                            Selecionar safras{editando.safras_sel.length ? ` (${editando.safras_sel.length})` : ""}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-56">
                          <div className="max-h-48 overflow-y-auto">
                            {safras.map((s) => (
                              <div key={s.id} className="flex items-center gap-2 py-1">
                                <Checkbox
                                  id={`safra-${s.id}`}
                                  checked={editando.safras_sel.includes(s.id)}
                                  onCheckedChange={(checked) => {
                                    const set = new Set(editando.safras_sel);
                                    if (checked) set.add(s.id); else set.delete(s.id);
                                    setEditando({ ...editando, safras_sel: Array.from(set) });
                                  }}
                                />
                                <Label htmlFor={`safra-${s.id}`} className="cursor-pointer text-sm">{s.nome}</Label>
                              </div>
                            ))}
                          </div>
                        </PopoverContent>
                      </Popover>
                    )}
                  </div>
                </div>
                {editando && (
                  <div className="mt-4 space-y-4">
                    <div className="space-y-2">
                        <Label>Definição da Área</Label>
                        <RadioGroup value={importMode} onValueChange={(v) => setImportMode(v as "kml" | "manual")} className="flex gap-4">
                            <div className="flex items-center space-x-2">
                                <RadioGroupItem value="manual" id="mode-manual" />
                                <Label htmlFor="mode-manual" className="cursor-pointer font-normal">Cadastro Manual (Mapa)</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                                <RadioGroupItem value="kml" id="mode-kml" />
                                <Label htmlFor="mode-kml" className="cursor-pointer font-normal">Importar KML</Label>
                            </div>
                        </RadioGroup>
                    </div>

                    {importMode === "kml" ? (
                        <div className="space-y-2 p-4 border rounded-md bg-muted/20">
                            <Label>Arquivo KML</Label>
                            <div className="flex items-center gap-2">
                              <input
                                ref={fileInputRef}
                                type="file"
                                accept=".kml,application/vnd.google-earth.kml+xml"
                                className="hidden"
                                onChange={(e) => {
                                  const f = e.target.files?.[0];
                                  if (f) handleUploadKml(f);
                                  e.currentTarget.value = "";
                                }}
                              />
                              <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                                <Upload className="h-4 w-4 mr-2" /> Selecionar arquivo KML
                              </Button>
                              {selectedKmlName && (
                                <span className="text-xs bg-muted px-2 py-0.5 rounded">{selectedKmlName}</span>
                              )}
                            </div>
                            {(() => {
                              const t = editando?.id ? talhoes.find((tt) => tt.id === editando.id) : null;
                              const hasKml = !!(t as any)?.kml_name;
                              if (!hasKml) return null;
                              const baseUrl = getApiBaseUrl();
                              return (
                                <div className="flex items-center gap-2 mt-2">
                                  <a
                                    href={`${baseUrl}/talhoes/${editando.id}/kml`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-sm underline"
                                  >
                                    Baixar KML atual
                                  </a>
                                  <span className="text-xs text-muted-foreground">({(t as any)?.kml_name})</span>
                                </div>
                              );
                            })()}
                        </div>
                    ) : (
                        <div className="space-y-1">
                             <div className="flex justify-between items-center">
                                <Label>Localização (Clique no mapa)</Label>
                                {manualCoords ? (
                                    <span className="text-xs text-green-600 font-medium flex items-center gap-1">
                                         <span className="w-2 h-2 rounded-full bg-green-600"/> Localização selecionada
                                    </span>
                                ) : (
                                    <span className="text-xs text-red-500 font-medium flex items-center gap-1">
                                         <span className="w-2 h-2 rounded-full bg-red-500"/> Obrigatório selecionar
                                    </span>
                                )}
                             </div>
                             <p className="text-xs text-muted-foreground">Clique no mapa para posicionar o marcador no centro do talhão.</p>
                        </div>
                    )}

                    <div className="mt-2">
                      <div className="text-sm text-muted-foreground mb-1">Preview do mapa</div>
                      <div ref={mapRef} style={{ height: 350 }} className="rounded border overflow-hidden relative" />
                    </div>

                    <div className="mt-3 flex justify-end gap-2">
                      <Button onClick={handleSalvar} size="sm">
                        Salvar
                      </Button>
                      <Button onClick={() => { setEditando(null); setPendingKml(null); }} variant="outline" size="sm">
                        Cancelar
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </Card>
          )}

          {!editando && (
            <>
              <div className="space-y-2">
                {talhoes.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Nenhum talhão cadastrado
                  </p>
                ) : (
                  paginatedTalhoes.map((talhao) => (
                    <Card key={talhao.id} className="p-3 flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{talhao.nome}</p>
                          {talhao.arrendado && (
                            <span className="text-xs bg-muted px-2 py-0.5 rounded">Arrendado</span>
                          )}
                          {(talhao as any).tem_programacao_safra && (
                            <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">Com Programação nesta safra</span>
                          )}
                          {((talhao as any).safras_todas || ((talhao as any).allowed_safras || []).length === 0) ? (
                            <span className="text-xs bg-muted px-2 py-0.5 rounded">Safras: Todas</span>
                          ) : (
                            <span className="text-xs bg-muted px-2 py-0.5 rounded">Safras: {((talhao as any).allowed_safras || []).length}</span>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">{Number(talhao.area).toFixed(2)} ha</p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => setEditando({ id: talhao.id, nome: talhao.nome, area: talhao.area.toString(), arrendado: talhao.arrendado, safras_todas: Boolean((talhao as any).safras_todas), safras_sel: [ ...(((talhao as any).allowed_safras || []) as string[]) ] })}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => handleExcluir(talhao.id)}
                          disabled={(talhao as any).tem_programacao}
                          title={(talhao as any).tem_programacao ? "Talhão com programação não pode ser excluído" : undefined}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </Card>
                  ))
                )}
              </div>

              {talhoes.length > 0 && totalPages > 1 && (
                <div className="flex items-center justify-between py-2 border-t mt-2">
                  <div className="text-sm text-muted-foreground">
                    Página {currentPage} de {totalPages}
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                    >
                      Anterior
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                    >
                      Próxima
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
        </div>
        
      </DialogContent>
    </Dialog>
  );
}
