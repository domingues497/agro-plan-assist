import React from 'react';

// Componente para desenhar o talhão (thumbnail)
export const TalhaoThumbnail = ({ geojson, className = "w-8 h-8 mr-2 bg-orange-50/50 rounded flex-shrink-0" }: { geojson: any, className?: string }) => {
  if (!geojson) return null;

  try {
    let coordinates: any[] = [];
    
    // Extrair coordenadas baseadas no tipo de geometria
    // GeoJSON structure: { type: "GeometryCollection", geometries: [...] } OR { type: "Polygon", ... }
    const geometries = geojson.type === "GeometryCollection" ? geojson.geometries : [geojson];

    geometries.forEach((geom: any) => {
      if (geom.type === "Polygon") {
        coordinates.push(...geom.coordinates); // Polygon rings
      } else if (geom.type === "MultiPolygon") {
        geom.coordinates.forEach((poly: any) => coordinates.push(...poly));
      }
    });

    if (coordinates.length === 0) return null;

    // Achatar para lista de pontos [lng, lat]
    // coordinates[0] é o anel externo do primeiro polígono
    const allPoints: [number, number][] = [];
    coordinates.forEach(ring => {
      ring.forEach((pt: any) => {
        if (Array.isArray(pt) && pt.length >= 2) {
          allPoints.push([pt[0], pt[1]]); // [lng, lat]
        }
      });
    });

    if (allPoints.length === 0) return null;

    // Calcular Bounding Box
    const lngs = allPoints.map(p => p[0]);
    const lats = allPoints.map(p => p[1]);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);

    // Se for um ponto ou linha muito pequena, não desenha
    if (minLng === maxLng || minLat === maxLat) return null;

    // Criar paths SVG normalizados (0-100)
    // Inverter Y porque SVG coordenadas crescem para baixo, Latitude cresce para cima (Hemisfério Norte)
    // Mas no Brasil (Sul), Lat é negativa.
    // SVG: (0,0) top-left.
    // Map: (minLng, maxLat) should be top-left.

    const width = maxLng - minLng;
    const height = maxLat - minLat;
    
    // Manter aspect ratio
    const scale = Math.max(width, height);
    
    // Função de normalização
    // x = (lng - minLng) / width * 100
    // y = (maxLat - lat) / height * 100 (inverter eixo Y)
    
    const paths = coordinates.map((ring: any[], idx: number) => {
      const points = ring.map((pt: any) => {
        const x = ((pt[0] - minLng) / scale) * 100;
        const y = ((maxLat - pt[1]) / scale) * 100;
        return `${x},${y}`;
      }).join(" ");
      return <polygon key={`${idx}-${points}`} points={points} fill="#fed7aa" stroke="#f97316" strokeWidth="2" vectorEffect="non-scaling-stroke" />;
    });

    return (
      <svg viewBox={`0 0 100 100`} className={className}>
         {/* Ajustar offsets para centralizar */}
        <g transform={`translate(${(100 - (width/scale)*100)/2}, ${(100 - (height/scale)*100)/2})`}>
          {paths}
        </g>
      </svg>
    );
  } catch (e) {
    console.error("Error rendering TalhaoThumbnail", e);
    return null;
  }
};
