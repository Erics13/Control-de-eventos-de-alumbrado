
import React, { useRef, useEffect, useMemo } from 'react';
import L from 'leaflet';
import 'leaflet-routing-machine';
// FIX: Added missing imports for LuminaireEvent and InventoryItem types.
import type { WorksheetData, ServicePoint, LuminariaWorksheet, CabinetWorksheet, WorksheetRow, LuminaireEvent, InventoryItem } from '../types';
import CollapsibleSection from './CollapsibleSection';
import { ALCID_TO_MUNICIPIO_MAP } from '../constants';

declare global {
    interface Window {
        jspdf: any;
        html2canvas: any;
    }
}

// Fix for default marker icon issue with webpack
// FIX: Removed delete (L.Icon.Default.prototype as any)._getIconUrl; as it is now handled in index.html
// Removed L.Icon.Default.mergeOptions as it can reintroduce default marker image paths.
// We rely on explicit icon options or L.divIcon for custom markers.

const SPECIAL_SITUATIONS_FOR_MAP = [
    "COLUMNA CAIDA",
    "HURTO",
    "VANDALIZADO",
    // "VANDALIZADO VR", // Removed specific vandalizado types for broader match
    // "VANDALIZADO NF",
    "FALTA PODA",
    "FALTA LINEA",
    "ROADFORCE SIN POTENCIA",
    "SIN ENERGÍA",
    "RETIRADA",
    "SIN OLC",
    "RETIRADA POR OBRA"
];

const ServicePointDetails: React.FC<{ servicePoint: ServicePoint }> = ({ servicePoint }) => {
    const handleMapClick = () => {
        if (servicePoint.lat && servicePoint.lon) {
            const url = `https://www.google.com/maps?q=${servicePoint.lat},${servicePoint.lon}`;
            window.open(url, '_blank', 'noopener,noreferrer');
        }
    };

    const isClickable = servicePoint.lat && servicePoint.lon;

    const municipioName = servicePoint.alcid && ALCID_TO_MUNICIPIO_MAP[servicePoint.alcid] 
        ? `${ALCID_TO_MUNICIPIO_MAP[servicePoint.alcid]}` 
        : (servicePoint.alcid || 'N/A');

    return (
        <div className="space-y-4 text-sm mb-6">
            <h4 className="text-xl font-bold text-gray-200 mb-3">Detalles del Servicio a Revisar (Click para abrir ubicación en mapa de Google)</h4>
            <div 
                className={`p-6 bg-gray-700/50 rounded-xl border border-gray-600 transition-colors shadow-md ${isClickable ? 'cursor-pointer hover:bg-gray-600/50 hover:border-cyan-500' : ''}`}
                onClick={handleMapClick}
                title={isClickable ? "Ver ubicación en Google Maps" : ""}
            >
                {/* Account Number - Big and Colored */}
                <div className="mb-6 border-b border-gray-500 pb-3">
                    <span className="block text-gray-400 text-lg font-bold uppercase tracking-wider mb-1">Nro. Cuenta</span>
                    <span className="text-5xl font-extrabold text-yellow-400 tracking-wider font-mono">{servicePoint.nroCuenta}</span>
                </div>

                {/* Address */}
                <div className="mb-6">
                    <span className="block text-gray-400 text-lg font-bold uppercase tracking-wider mb-1">Dirección</span>
                    <span className="text-2xl text-white font-medium">{servicePoint.direccion}</span>
                </div>

                {/* Grid for other details */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-6 text-base">
                    <div><span className="text-gray-400 block text-sm font-bold uppercase tracking-wide">Municipio</span> <span className="text-gray-200 text-xl font-semibold">{municipioName}</span></div>
                    <div><span className="text-gray-400 block text-sm font-bold uppercase tracking-wide">Tarifa</span> <span className="text-gray-200 text-xl">{servicePoint.tarifa ?? 'N/A'}</span></div>
                    
                    <div><span className="text-gray-400 block text-sm font-bold uppercase tracking-wide">Pot. Contratada</span> <span className="text-gray-200 text-xl">{servicePoint.potenciaContratada?.toLocaleString('es-ES') ?? 'N/A'} kW</span></div>
                    <div><span className="text-gray-400 block text-sm font-bold uppercase tracking-wide">Tensión</span> <span className="text-gray-200 text-xl">{servicePoint.tension ?? 'N/A'}</span></div>
                    
                    <div><span className="text-gray-400 block text-sm font-bold uppercase tracking-wide">Fases</span> <span className="text-gray-200 text-xl">{servicePoint.fases ?? 'N/A'}</span></div>
                    <div><span className="text-gray-400 block text-sm font-bold uppercase tracking-wide"> % Eficiencia</span> <span className="text-gray-200 text-xl">{servicePoint.porcentEf !== undefined ? servicePoint.porcentEf + '%' : 'N/A'}</span></div>
                    
                    <div><span className="text-gray-400 block text-sm font-bold uppercase tracking-wide">Cant. Luminarias</span> <span className="text-gray-200 text-xl">{servicePoint.cantidadLuminarias}</span></div>
                </div>
            </div>
        </div>
    );
};


const LuminariaWorksheetTable: React.FC<{ worksheet: LuminariaWorksheet }> = ({ worksheet }) => {
    
    // FIX: Add defensive check for worksheet.failures before mapping
    if (!worksheet.failures || worksheet.failures.length === 0) {
        return (
            <div className="flex items-center justify-center h-40 text-gray-500 rounded-lg bg-gray-900/50 p-4">
                No hay luminarias con fallas para mostrar en esta hoja de ruta.
            </div>
        );
    }

    return (
    <>
        <h4 className="text-base font-semibold text-gray-300 mb-2">Total de luminarias en esta hoja de ruta: {worksheet.failures.length}</h4>
        <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-600 border border-gray-600">
                <thead className="bg-gray-700 text-xs text-gray-300 uppercase">
                    <tr>
                        {['#', 'ID Luminaria / OLC', 'ID Gabinete', 'Potencia', 'Fecha Reporte', 'Categoría', 'Situación', 'Mensaje de Error', 'Detalles Técnicos', 'Acción', 'Posible Solución', 'COMPARTIR'].map(header => (
                            <th key={header} className="px-2 py-2 text-left font-medium tracking-wider border-r border-gray-600 last:border-r-0">{header}</th>
                        ))}
                    </tr>
                </thead>
                <tbody className="bg-gray-800 divide-y divide-gray-600 text-sm text-gray-300">
                    {worksheet.failures.map((row) => {
                        const event: Partial<LuminaireEvent> = row.event || {};
                        const technicalDetails = `Pot. Medida: ${event.systemMeasuredPower?.toFixed(0) ?? 'N/A'}`;
                        const locationLink = event.lat && event.lon ? `https://www.google.com/maps?q=${event.lat},${event.lon}` : '';
                        
                        let whatsappLink = '';
                        if (locationLink) {
                            const messageParts = [
                                `*Falla de Luminaria*`,
                                `ID/OLC: ${row.idLuminariaOlc.replace('\n', ' ')}`,
                                `Potencia: ${row.potencia || 'N/A'}`,
                                `Ubicación: ${locationLink}`
                            ];
                            const message = encodeURIComponent(messageParts.join('\n'));
                            whatsappLink = `https://wa.me/?text=${message}`;
                        }

                        return (
                            <tr 
                                key={row.index}
                                className="hover:bg-gray-700/50"
                            >
                                <td className="px-2 py-2 border-r border-gray-600 font-bold text-center align-middle">{row.index}</td>
                                <td className="px-2 py-2 whitespace-pre-wrap border-r border-gray-600 align-top">{row.idLuminariaOlc}</td>
                                <td className="px-2 py-2 border-r border-gray-600 align-top">{row.idGabinete || 'N/A'}</td>
                                <td className="px-2 py-2 border-r border-gray-600 align-top">{row.potencia || 'N/A'}</td>
                                <td className="px-2 py-2 whitespace-pre-wrap border-r border-gray-600 align-top">{event.date?.toLocaleString() || 'N/A'}</td>
                                <td className="px-2 py-2 border-r border-gray-600 align-top">{row.categoria || 'N/A'}</td>
                                <td className="px-2 py-2 border-r border-gray-600 align-top">{row.situacion || 'N/A'}</td>
                                <td className="px-2 py-2 border-r border-gray-600 max-w-xs align-top">{row.mensajeDeError}</td>
                                <td className="px-2 py-2 border-r border-gray-600 align-top">{technicalDetails}</td>
                                <td className="px-2 py-2 border-r border-gray-600 align-top">{row.accion}</td>
                                <td className="px-2 py-2 border-r border-gray-600 align-top">{row.posibleSolucion}</td>
                                <td className="px-2 py-2 text-center align-middle">
                                    {whatsappLink && (
                                        <a 
                                           href={whatsappLink} 
                                           target="_blank" 
                                           rel="noopener noreferrer" 
                                           title="Compartir por WhatsApp"
                                           onClick={(e) => e.stopPropagation()} 
                                        >
                                            <svg className="h-6 w-6 text-green-400 hover:text-green-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
                                            </svg>
                                        </a>
                                    )}
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    </>
)};

const CabinetWorksheetMap: React.FC<{ worksheet: CabinetWorksheet, elementId: string }> = ({ worksheet, elementId }) => {
    // We attach the ID to the container div
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<L.Map | null>(null);

    const waypoints = useMemo(() => {
        const points: L.LatLng[] = [];
        if (worksheet.servicePoint && worksheet.servicePoint.lat && worksheet.servicePoint.lon) {
            points.push(L.latLng(worksheet.servicePoint.lat, worksheet.servicePoint.lon));
        }
        // FIX: Add defensive check for worksheet.luminaires before forEach in useMemo
        // For cabinet_acumulacion, map originalEvents (the chunked events) if available
        const eventsToMap = worksheet.type === 'cabinet_acumulacion' && worksheet.originalEvents 
            ? worksheet.originalEvents 
            : worksheet.luminaires;

        if (eventsToMap && eventsToMap.length > 0) {
            eventsToMap.forEach(item => {
                if (item.lat && item.lon) {
                    points.push(L.latLng(item.lat, item.lon));
                }
            });
        }
        return points;
    }, [worksheet]);

    useEffect(() => {
        // FIX: Add defensive checks for empty waypoints and map container
        if (!mapContainerRef.current) return;
        if (waypoints.length === 0) {
            if (mapRef.current) {
                mapRef.current.remove();
                mapRef.current = null;
            }
            return; // Exit early if no waypoints to display
        }

        if (!mapRef.current) {
            const map = L.map(mapContainerRef.current).setView(waypoints[0], 15);
            mapRef.current = map;

            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '&copy; OpenStreetMap contributors'
            }).addTo(map);
        }
        
        const map = mapRef.current!;
        
        // Clear existing layers if any (except tile layer)
        map.eachLayer(layer => {
            if (!(layer instanceof L.TileLayer)) {
                map.removeLayer(layer);
            }
        });

        // Add service point marker (Red T icon)
        const servicePointIcon = L.divIcon({
            html: `<div style="background-color: white; color: red; border: 2px solid red; border-radius: 4px; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; font-weight: bold; font-family: sans-serif; font-size: 16px; box-shadow: 0 2px 4px rgba(0,0,0,0.3);">T</div>`,
            className: 'custom-cabinet-marker',
            iconSize: [30, 30],
            iconAnchor: [15, 15]
        });
        if (worksheet.servicePoint && worksheet.servicePoint.lat && worksheet.servicePoint.lon) {
            L.marker([worksheet.servicePoint.lat, worksheet.servicePoint.lon], { icon: servicePointIcon })
                .addTo(map)
                .bindPopup(`<b>Servicio:</b> ${worksheet.servicePoint.nroCuenta}`)
                .openPopup();
        }

        // Add luminaire markers
        // FIX: Add defensive check for worksheet.luminaires before forEach
        // Use accumulationFailures for P3, otherwise use luminaires
        const eventsToMark = worksheet.type === 'cabinet_acumulacion' && worksheet.originalEvents
            ? worksheet.originalEvents
            : worksheet.luminaires;

        if (eventsToMark && eventsToMark.length > 0) {
            eventsToMark.forEach((item, index) => {
                if (item.lat && item.lon) {
                    const isLuminaireEvent = (val: LuminaireEvent | InventoryItem): val is LuminaireEvent => 'uniqueEventId' in val;
                    const luminaireId = isLuminaireEvent(item) ? item.id : item.streetlightIdExterno;

                    const luminaireIcon = L.divIcon({
                        html: `<span style="background-color: ${worksheet.color}; color: white; border-radius: 50%; width: 25px; height: 25px; display: flex; align-items: center; justify-content: center; font-weight: bold; border: 2px solid white; box-shadow: 0 0 5px rgba(0,0,0,0.5);">${index + 1}</span>`,
                        className: 'custom-numbered-marker',
                        iconSize: [25, 25],
                        iconAnchor: [12, 12]
                    });
                    L.marker([item.lat, item.lon], { icon: luminaireIcon })
                        .addTo(map)
                        .bindPopup(`<b>Luminaria:</b> ${luminaireId}`);
                }
            });
        }
        // INCREASED PADDING TO [100, 100] to ensure centering in PDF
        map.fitBounds(L.latLngBounds(waypoints), { padding: [100, 100] });
    }, [waypoints, worksheet]);

    // This check is for initial render, not for useEffect updates
    if (!worksheet.servicePoint || !worksheet.servicePoint.lat || !worksheet.servicePoint.lon || waypoints.length === 0) { // Added waypoints.length check
         return <div className="h-96 flex items-center justify-center bg-gray-700/50 rounded-lg text-gray-400">Sin coordenadas para el servicio o luminarias asociadas para mostrar el mapa.</div>;
    }

    return <div id={elementId} ref={mapContainerRef} className="h-full w-full" />;
};

const CabinetWorksheetDetails: React.FC<{ worksheet: CabinetWorksheet, mapElementId: string }> = ({ worksheet, mapElementId }) => (
    <>
        <div className="flex flex-col gap-6">
            <div>
                 <ServicePointDetails servicePoint={worksheet.servicePoint} />
                 {/* Route Summary removed as per request */}
            </div>
             <div>
                <h3 className="text-xl font-bold text-cyan-400 mb-2">Mapa de ubicación</h3>
                <div className="h-[600px] w-full rounded-lg overflow-hidden border-2" style={{ borderColor: worksheet.color }}>
                    <CabinetWorksheetMap worksheet={worksheet} elementId={mapElementId} />
                </div>
             </div>
        </div>
        {/* Table for associated luminaires */}
        {(worksheet.type === 'cabinet_acumulacion' && worksheet.accumulationFailures && worksheet.accumulationFailures.length > 0) ? (
            <div className="mt-6">
                <h4 className="text-base font-semibold text-gray-300 mb-2">Luminarias en Falla de Acumulación ({worksheet.accumulationFailures.length})</h4>
                {/* We can cast the current worksheet to LuminariaWorksheet and pass its accumulationFailures as failures */}
                <LuminariaWorksheetTable worksheet={{...worksheet, failures: worksheet.accumulationFailures} as LuminariaWorksheet} />
            </div>
        ) : (worksheet.luminaires && worksheet.luminaires.length > 0 && worksheet.type !== 'cabinet_falla_total' && ( // Hide full list for total failures
            <div className="mt-6">
                 <h4 className="text-base font-semibold text-gray-300 mb-2">Luminarias asociadas al servicio ({worksheet.luminaires.length})</h4>
                 <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-600 border border-gray-600 text-sm">
                        <thead className="bg-gray-700 text-xs text-gray-300 uppercase">
                            <tr>
                                <th className="px-2 py-2 text-left font-medium tracking-wider">ID Luminaria</th>
                                <th className="px-2 py-2 text-left font-medium tracking-wider">OLC / Hardware</th>
                                <th className="px-2 py-2 text-left font-medium tracking-wider">Potencia</th>
                                <th className="px-2 py-2 text-left font-medium tracking-wider">Estado</th>
                                <th className="px-2 py-2 text-left font-medium tracking-wider">Situación</th>
                            </tr>
                        </thead>
                        <tbody className="bg-gray-800 divide-y divide-gray-600 text-gray-300">
                            {worksheet.luminaires.map(lum => (
                                <tr key={lum.streetlightIdExterno} className="hover:bg-gray-700/50">
                                    <td className="px-2 py-2 whitespace-nowrap">{lum.streetlightIdExterno}</td>
                                    <td className="px-2 py-2 whitespace-nowrap">{lum.olcHardwareDir || lum.olcIdExterno || 'N/A'}</td>
                                    <td className="px-2 py-2 whitespace-nowrap">{lum.potenciaNominal ?? 'N/A'} W</td>
                                    <td className="px-2 py-2 whitespace-nowrap">{lum.estado || 'N/A'}</td>
                                    <td className="px-2 py-2 whitespace-nowrap">{lum.situacion || 'N/A'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                 </div>
            </div>
        ))}
    </>
);

const LuminariaWorksheetMap: React.FC<{ worksheet: LuminariaWorksheet, elementId: string }> = ({ worksheet, elementId }) => {
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<L.Map | null>(null);

    // FIX: Add defensive check for worksheet.failures before creating waypoints
    const waypoints = useMemo(() => {
        if (!worksheet.failures || worksheet.failures.length === 0) {
            return [];
        }
        return worksheet.failures
            .filter(f => f.event.lat && f.event.lon)
            .map(f => L.latLng(f.event.lat!, f.event.lon!));
    }, [worksheet.failures]);

    useEffect(() => {
        // FIX: Add defensive checks for empty waypoints and map container
        if (!mapContainerRef.current) return;
        if (waypoints.length === 0) {
            if (mapRef.current) {
                mapRef.current.remove();
                mapRef.current = null;
            }
            return; // Exit early if no waypoints to display
        }

        if (!mapRef.current) {
            const map = L.map(mapContainerRef.current).setView(waypoints[0], 13);
            mapRef.current = map;

            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '&copy; OpenStreetMap contributors'
            }).addTo(map);
        }
        const map = mapRef.current!;

        // Clear existing layers if any (except tile layer)
        map.eachLayer(layer => {
            if (!(layer instanceof L.TileLayer)) {
                map.removeLayer(layer);
            }
        });

        // Ensure worksheet.failures is valid before iterating
        if (worksheet.failures && worksheet.failures.length > 0) {
            waypoints.forEach((wp, index) => { // Use waypoints to ensure index safety
                const failure = worksheet.failures[index]; // This access is now safer because waypoints.length <= worksheet.failures.length
                const situation = failure.situacion?.toUpperCase() || '';
                const isSpecial = SPECIAL_SITUATIONS_FOR_MAP.includes(situation);
                const bgColor = isSpecial ? '#1f2937' : worksheet.color; // black vs assigned priority color

                // Simplified HTML for divIcon to rely more on CSS class
                const icon = L.divIcon({
                    html: `<span style="--marker-bg-color: ${bgColor};">${index + 1}</span>`,
                    className: 'custom-numbered-marker',
                    iconSize: [25, 25],
                    iconAnchor: [12, 12]
                });

                const popupContent = `
                    <b>Punto #${index + 1}</b><br>
                    <b>ID Luminaria:</b> ${failure.event.id}<br>
                    <b>ID OLC:</b> ${failure.idLuminariaOlc.split('\n')[1] || 'N/A'}<br>
                    <b>Potencia:</b> ${failure.potencia || 'N/A'}<br>
                    <b>Situación:</b> ${failure.situacion || 'N/A'}
                `;

                L.marker(wp, { icon }).addTo(map).bindPopup(popupContent);
            });
        }
        // INCREASED PADDING TO [100, 100] to ensure centering in PDF
        map.fitBounds(L.latLngBounds(waypoints), { padding: [100, 100] });

    }, [waypoints, worksheet.failures, worksheet.routePolyline, worksheet.color]);

    // This check is for initial render, not for useEffect updates
    if (waypoints.length === 0) {
        return <div className="h-96 flex items-center justify-center bg-gray-700/50 rounded-lg text-gray-400">No hay coordenadas para mostrar el mapa de la ruta.</div>;
    }

    return <div id={elementId} ref={mapContainerRef} className="h-[600px] w-full rounded-lg overflow-hidden border-2" style={{ borderColor: worksheet.color }} />;
};


interface WorksheetProps {
    worksheet: WorksheetData;
    onDownloadHtml: () => void;
}

const Worksheet: React.FC<WorksheetProps> = ({ worksheet, onDownloadHtml }) => {
    const printableRef = useRef<HTMLDivElement>(null);
    const mapElementId = `map-for-pdf-${worksheet.id}`;

    const handleExportPdf = async () => {
        // Now supporting both Luminaria and Cabinet worksheets with specialized layouts
        
        const { jsPDF } = window.jspdf;
        const html2canvas = window.html2canvas;

        if (!html2canvas) {
            alert('La librería html2canvas no está cargada. Recargue la página.');
            return;
        }

        const doc = new jsPDF({
            orientation: 'landscape',
            unit: 'mm',
            format: 'a4'
        });

        // The title in the worksheet object is already formatted as "HR [Nro] [ZONA] [MUNI] [DATE]"
        // We use it directly for the PDF header and filename
        const title = worksheet.title;
        
        const pageContent = (data: any) => {
            // FOOTER ONLY (Header is now part of the content flow)
            doc.setFontSize(10);
            doc.setFont("helvetica", "normal"); // Reset font for footer
            const pageStr = `Página ${data.pageNumber}`;
            doc.text(pageStr, data.settings.margin.left, doc.internal.pageSize.height - 10);
        };

        // --- 1. TITLE ---
        doc.setFontSize(16);
        doc.setFont("helvetica", "bold"); // Bold Title
        doc.setTextColor(40);
        doc.text(title, 14, 15);
        doc.setFont("helvetica", "normal"); // Reset font
        
        let finalY = 25;

        // --- 2. SERVICE DETAILS (If Cabinet) ---
        if (worksheet.type !== 'luminaria') {
            const cabWS = worksheet as CabinetWorksheet;
            const sp = cabWS.servicePoint;
            
            // Print Service Point Details block
            doc.setFontSize(14);
            doc.setTextColor(0);
            doc.text('Detalles del Servicio', 14, finalY);
            finalY += 8;
            
            doc.setFontSize(12);
            doc.text(`Nro. Cuenta: ${sp.nroCuenta}`, 14, finalY);
            doc.text(`Dirección: ${sp.direccion}`, 80, finalY);
            finalY += 6;
            const municipioName = sp.alcid && ALCID_TO_MUNICIPIO_MAP[sp.alcid] ? ALCID_TO_MUNICIPIO_MAP[sp.alcid] : (sp.municipio || 'N/A');
            doc.text(`Municipio: ${municipioName}`, 14, finalY);
            doc.text(`Tarifa: ${sp.tarifa || 'N/A'}`, 80, finalY);
            doc.text(`Potencia: ${sp.potenciaContratada?.toLocaleString('es-ES') || 'N/A'} kW`, 140, finalY);
            finalY += 6;
            doc.text(`Tensión: ${sp.tension || 'N/A'}`, 14, finalY);
            doc.text(`Fases: ${sp.fases || 'N/A'}`, 80, finalY);
            doc.text(`Cant. Luminarias: ${sp.cantidadLuminarias}`, 140, finalY);
            
            finalY += 10;
        }

        // --- 3. MAP CAPTURE ---
        const mapElement = document.getElementById(mapElementId);
        if (mapElement) {
            try {
                // Capture map using html2canvas
                const canvas = await html2canvas(mapElement, {
                    useCORS: true,
                    scale: 2, // Higher scale for better resolution
                    allowTaint: true,
                    logging: false,
                });
                
                const imgData = canvas.toDataURL('image/png');
                const imgProps = doc.getImageProperties(imgData);
                const pdfWidth = doc.internal.pageSize.getWidth() - 28; // Margins
                const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
                
                // Check if map fits on current page (it should, as page is fresh or only has service details)
                if (finalY + pdfHeight > doc.internal.pageSize.getHeight() - 20) {
                    doc.addPage();
                    finalY = 20;
                }

                doc.addImage(imgData, 'PNG', 14, finalY, pdfWidth, pdfHeight);
                finalY += pdfHeight + 10;

                // --- FORCE PAGE BREAK BEFORE TABLES ---
                doc.addPage();
                finalY = 15; // Reset Y for new page

            } catch (error) {
                console.error("Error capturing map for PDF:", error);
                // Continue without map if error, but still add page break for table separation if content exists
                doc.addPage();
                finalY = 15;
            }
        } else {
             // If no map, we still might want a break if service details took up space, but simpler to just proceed
             // or force break to be consistent with layout.
             // For now, let's just proceed if no map.
        }

        // --- 4. TABLES ---

        // --- Layout for CABINET Worksheets ---
        if (worksheet.type !== 'luminaria') {
            const cabWS = worksheet as CabinetWorksheet;

            // If P3 (Accumulation), print the failures table
            if (cabWS.type === 'cabinet_acumulacion' && cabWS.accumulationFailures && cabWS.accumulationFailures.length > 0) {
                doc.setFontSize(12);
                doc.text(`Luminarias en Falla de Acumulación (${cabWS.accumulationFailures.length})`, 14, finalY);
                finalY += 6;

                const head = [['#', 'ID Luminaria / OLC', 'ID Gabinete', 'Potencia', 'Fecha Reporte', 'Categoría', 'Situación', 'Mensaje de Error', 'Acción', 'Posible Solución', 'Observaciones']];
                const body = cabWS.accumulationFailures.map(row => [
                    row.index,
                    row.idLuminariaOlc,
                    row.idGabinete || 'N/A',
                    row.potencia || 'N/A',
                    row.fechaReporte,
                    row.categoria || 'N/A',
                    row.situacion || 'N/A',
                    row.mensajeDeError,
                    row.accion,
                    row.posibleSolucion,
                    '' // Empty column for observations
                ]);

                (doc as any).autoTable({
                    head,
                    body,
                    startY: finalY,
                    didDrawPage: pageContent,
                    theme: 'grid',
                    styles: { fontSize: 9, cellPadding: 2, overflow: 'linebreak' },
                    headStyles: { fillColor: [220, 220, 220], textColor: [0, 0, 0], fontStyle: 'bold' },
                    // Make 'ID Luminaria / OLC' (Index 1) bold
                    columnStyles: { 1: { fontStyle: 'bold' } },
                    margin: { top: 25 }
                });
                finalY = (doc as any).lastAutoTable.finalY + 10;
            } 
            // If NOT P1 (Total Failure), print associated luminaires list
            else if (cabWS.type !== 'cabinet_falla_total' && cabWS.luminaires.length > 0) {
                doc.setFontSize(12);
                doc.text(`Luminarias asociadas al servicio (${cabWS.luminaires.length})`, 14, finalY);
                finalY += 6;

                const head = [['ID Luminaria', 'OLC / Hardware', 'Potencia', 'Estado', 'Situación', 'Observaciones']];
                const body = cabWS.luminaires.map(lum => [
                    lum.streetlightIdExterno,
                    lum.olcHardwareDir || lum.olcIdExterno || 'N/A',
                    `${lum.potenciaNominal ?? 'N/A'} W`,
                    lum.estado || 'N/A',
                    lum.situacion || 'N/A',
                    '' // Empty column for observations
                ]);

                (doc as any).autoTable({
                    head,
                    body,
                    startY: finalY,
                    didDrawPage: pageContent,
                    theme: 'grid',
                    styles: { fontSize: 9, cellPadding: 2 },
                    headStyles: { fillColor: [220, 220, 220], textColor: [0, 0, 0], fontStyle: 'bold' },
                    // Make 'ID Luminaria' (Index 0) and 'OLC / Hardware' (Index 1) bold
                    columnStyles: { 0: { fontStyle: 'bold' }, 1: { fontStyle: 'bold' } },
                    margin: { top: 25 }
                });
                finalY = (doc as any).lastAutoTable.finalY + 10;
            }

        } 
        // --- Layout for LUMINARIA Worksheets ---
        else {
            const head = [['#', 'ID Luminaria / OLC', 'ID Gabinete', 'Potencia', 'Fecha Reporte', 'Categoría', 'Situación', 'Mensaje de Error', 'Detalles Técnicos', 'Acción', 'Posible Solución', 'Observaciones']];
            const failuresData = (worksheet as LuminariaWorksheet).failures || [];
            const body = failuresData.map(row => {
                const event: Partial<LuminaireEvent> = row.event || {};
                return [
                    row.index,
                    row.idLuminariaOlc,
                    row.idGabinete || 'N/A',
                    row.potencia || 'N/A',
                    event.date?.toLocaleString() || 'N/A',
                    row.categoria || 'N/A',
                    row.situacion || 'N/A',
                    row.mensajeDeError,
                    `Pot. Medida: ${event.systemMeasuredPower?.toFixed(0) ?? 'N/A'}`,
                    row.accion,
                    row.posibleSolucion,
                    '' // Empty column for observations
                ];
            });
            
            (doc as any).autoTable({
                head,
                body,
                startY: finalY,
                didDrawPage: pageContent,
                theme: 'grid',
                styles: {
                    fontSize: 10,
                    cellPadding: 2,
                    valign: 'middle',
                    overflow: 'linebreak',
                    lineColor: [0, 0, 0],
                    lineWidth: 0.1,
                    textColor: [0, 0, 0],
                    fillColor: [255, 255, 255]
                },
                headStyles: {
                    fillColor: [220, 220, 220],
                    textColor: [0, 0, 0],
                    fontStyle: 'bold',
                    fontSize: 10,
                    lineColor: [0, 0, 0],
                    lineWidth: 0.2
                },
                columnStyles: {
                    0: { cellWidth: 10, halign: 'center', fontStyle: 'bold' },
                    1: { fontStyle: 'bold' }, // Make ID Luminaria / OLC bold
                },
                margin: { top: 25 }
            });

            // Summary Table logic for Luminaria worksheets remains same
            finalY = (doc as any).lastAutoTable.finalY + 15;
            if (finalY > doc.internal.pageSize.height - 40) {
                doc.addPage();
                finalY = 25;
            }

            const powerCounts: Record<string, number> = {};
            failuresData.forEach(row => {
                const power = row.potencia || 'Desconocida';
                powerCounts[power] = (powerCounts[power] || 0) + 1;
            });

            const summaryBody = Object.entries(powerCounts)
                .map(([power, count]) => ({ power, count, val: parseInt(power) || 0 }))
                .sort((a, b) => a.val - b.val)
                .map(x => [x.power, x.count]);

            if (summaryBody.length > 0) {
                doc.setFontSize(12);
                doc.setTextColor(0);
                doc.text('Materiales Necesarios (Resumen por Potencia)', 14, finalY);
                finalY += 5;
                (doc as any).autoTable({
                    head: [['Potencia', 'Cantidad']],
                    body: summaryBody,
                    startY: finalY,
                    theme: 'grid',
                    headStyles: { 
                        fillColor: [50, 50, 50],
                        textColor: 255, 
                        fontSize: 10,
                        fontStyle: 'bold',
                        lineColor: [0, 0, 0],
                        lineWidth: 0.1
                    },
                    styles: { 
                        fontSize: 10, 
                        cellPadding: 2,
                        lineColor: [0, 0, 0],
                        lineWidth: 0.1,
                        textColor: [0, 0, 0]
                    },
                    columnStyles: {
                        0: { cellWidth: 40 },
                        1: { cellWidth: 30 }
                    },
                    margin: { left: 14 }
                });
            }
        }
        
        doc.save(`${title.replace(/[ /\\?%*:|"<>]/g, '_')}.pdf`);
    };


    return (
        <CollapsibleSection
            title={worksheet.title}
            defaultOpen={true}
            extraHeaderContent={
                 <div className="flex items-center gap-2">
                    <button onClick={onDownloadHtml} className="bg-gray-700 hover:bg-gray-600 text-sm font-medium py-1 px-3 rounded-md transition-colors">
                        Generar HTML
                    </button>
                    <button onClick={handleExportPdf} className="bg-gray-700 hover:bg-red-600 text-sm font-medium py-1 px-3 rounded-md transition-colors">
                        Exportar PDF
                    </button>
                </div>
            }
            // Use the worksheet's priority color for the section border
            // NOTE: Tailwind's JIT compiler might purge dynamic classes if not explicitly listed.
            // Consider fixed classes like `border-red-500`, `border-amber-500`, etc.
            // For now, inline style will work.
            sectionClassName={`border-l-4`}
            sectionStyle={{ borderColor: worksheet.color }}
        >
            <div ref={printableRef} className="p-2 space-y-4">
                <div className="worksheet-table-content">
                    {worksheet.type === 'luminaria' && <LuminariaWorksheetTable worksheet={worksheet as LuminariaWorksheet} />}
                    {worksheet.type !== 'luminaria' && <CabinetWorksheetDetails worksheet={worksheet as CabinetWorksheet} mapElementId={mapElementId} />}
                </div>
                {/* The map is always shown if there are waypoints, regardless of polyline existence */}
                {worksheet.type === 'luminaria' && (
                    <>
                        <h3 className="text-xl font-bold text-cyan-400 mt-6 mb-2">Mapa de ubicación</h3>
                        <LuminariaWorksheetMap worksheet={worksheet as LuminariaWorksheet} elementId={mapElementId} />
                    </>
                )}
            </div>
        </CollapsibleSection>
    );
};

export default Worksheet;
