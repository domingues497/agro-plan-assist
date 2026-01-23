import React from 'react';
import { processGeoJsonToSvg, getSatelliteImageUrl } from '@/lib/mapUtils';

// Componente para desenhar o talhão (thumbnail)
export const TalhaoThumbnail = ({ geojson, className = "w-8 h-8 mr-2 bg-orange-50/50 rounded flex-shrink-0" }: { geojson: any, className?: string }) => {
  const data = processGeoJsonToSvg(geojson);
  
  if (!data) return null;

  const mapUrl = getSatelliteImageUrl(data.bbox);

  return (
    <div className={`relative overflow-hidden ${className}`}>
        {/* Satellite Background */}
        <img 
            src={mapUrl} 
            alt="Satellite View" 
            className="absolute inset-0 w-full h-full object-cover"
            style={{ opacity: 0.9 }}
        />
        
        {/* Polygon Overlay */}
        <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full z-10">
          <g transform={`translate(${data.translateX}, ${data.translateY})`}>
            {data.polygons.map((points, idx) => (
               <polygon 
                    key={idx} 
                    points={points} 
                    fill="rgba(254, 215, 170, 0.3)" 
                    stroke="#f97316" 
                    strokeWidth="2" 
                    vectorEffect="non-scaling-stroke" 
                />
            ))}
          </g>
        </svg>
    </div>
  );
};
