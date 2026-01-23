
export function processGeoJsonToSvg(geojson: any, bufferPercent: number = 0.1) {
  if (!geojson) return null;

  try {
    let coordinates: any[] = [];
    
    // Extrair coordenadas
    const geometries = geojson.type === "GeometryCollection" ? geojson.geometries : [geojson];

    geometries.forEach((geom: any) => {
      if (geom.type === "Polygon") {
        coordinates.push(...geom.coordinates);
      } else if (geom.type === "MultiPolygon") {
        geom.coordinates.forEach((poly: any) => coordinates.push(...poly));
      }
    });

    if (coordinates.length === 0) return null;

    const allPoints: [number, number][] = [];
    coordinates.forEach(ring => {
      ring.forEach((pt: any) => {
        if (Array.isArray(pt) && pt.length >= 2) {
          allPoints.push([pt[0], pt[1]]);
        }
      });
    });

    if (allPoints.length === 0) return null;

    const lngs = allPoints.map(p => p[0]);
    const lats = allPoints.map(p => p[1]);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);

    if (minLng === maxLng || minLat === maxLat) return null;

    // Make it square and add buffer
    const width = maxLng - minLng;
    const height = maxLat - minLat;
    const maxDim = Math.max(width, height);
    
    // Buffer is percentage of the maximum dimension
    const buffer = maxDim * bufferPercent;
    const finalSize = maxDim + (buffer * 2);
    
    const centerLng = (minLng + maxLng) / 2;
    const centerLat = (minLat + maxLat) / 2;
    
    const bbox = {
        minLng: centerLng - finalSize / 2,
        maxLng: centerLng + finalSize / 2,
        minLat: centerLat - finalSize / 2,
        maxLat: centerLat + finalSize / 2
    };

    const polygons = coordinates.map((ring: any[]) => {
      return ring.map((pt: any) => {
        // Normalize to 0-100 based on the square bbox
        const x = ((pt[0] - bbox.minLng) / finalSize) * 100;
        const y = ((bbox.maxLat - pt[1]) / finalSize) * 100;
        return `${x},${y}`;
      }).join(" ");
    });

    return {
      polygons,
      bbox,
      // No translation needed as we centered the bbox
      translateX: 0,
      translateY: 0
    };

  } catch (e) {
    console.error("Error processing GeoJSON", e);
    return null;
  }
}

export function getSatelliteImageUrl(bbox: { minLng: number, maxLng: number, minLat: number, maxLat: number }, width: number = 400, height: number = 400) {
    // ArcGIS Export Map
    // bbox=minLon,minLat,maxLon,maxLat
    const bboxStr = `${bbox.minLng},${bbox.minLat},${bbox.maxLng},${bbox.maxLat}`;
    return `https://services.arcgisonline.com/arcgis/rest/services/World_Imagery/MapServer/export?bbox=${bboxStr}&bboxSR=4326&size=${width},${height}&f=image`;
}

