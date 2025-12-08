import React, { useRef, useEffect } from 'react';
import L from 'leaflet';
import 'leaflet-routing-machine';
import type { WorksheetData, ServicePoint, LuminariaWorksheet, CabinetWorksheet, WorksheetRow } from '../types';
import CollapsibleSection from './CollapsibleSection';
import { ALCID_TO_MUNICIPIO_MAP } from '../constants';

declare global {
    interface Window {
        jspdf: any;
        html2canvas: any;
    }
}

// Fix for default marker icon issue with webpack
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const SPECIAL_SITUATIONS_FOR_MAP = [
    "COLUMNA CAIDA",
    "HURTO",
    "VANDALIZADO",
    "VANDALIZADO VR",
    "VANDALIZADO NF",
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
        <div className="space-y-2 text-sm mb-4">
            <h4 className="text-lg font-semibold text-gray-300 mb-2">Detalles del Servicio a Revisar (Click para Mapa)</h4>
            <div 
                className={`p-4 bg-gray-700/50 rounded-lg border border-gray-600 transition-colors ${isClickable ? 'cursor-pointer hover:bg-gray-600/50 hover:border-cyan-500' : ''}`}
                onClick={handleMapClick}
                title={isClickable ? "Ver ubicación en Google Maps" : ""}
            >
                {/* Account Number - Big and Colored */}
                <div className="mb-4 border-b border-gray-600 pb-2">
                    <span className="block text-gray-400 text-base font-medium uppercase tracking-wider">Nro. Cuenta</span>
                    <span className="text-3xl font-extrabold text-yellow-400 tracking-wide font-mono">{servicePoint.nroCuenta}</span>
                </div>

                {/* Address */}
                <div className="mb-4">
                    <span className="block text-gray-400 text-base font-medium uppercase tracking-wider">Dirección</span>
                    <span className="text-lg text-white font-medium">{servicePoint.direccion}</span>
                </div>

                {/* Grid for other details */}
                <div className="grid grid-cols-2 gap-4 text-sm">
                    <div><span className="text-gray-400 block text-base font-medium">Municipio</span> <span className="text-gray-200 text-base font-semibold">{municipioName}</span></div>
                    <div><span className="text-gray-400 block text-base font-medium">Tarifa</span> <span className="text-gray-200 text-base">{servicePoint.tarifa}</span></div>
                    
                    <div><span className="text-gray-400 block text-base font-medium">Pot. Contratada</span> <span className="text-gray-200 text-base">{servicePoint.potenciaContratada} kW</span></div>
                    <div><span className="text-gray-400 block text-base font-medium">Tensión</span> <span className="text-gray-200 text-base">{servicePoint.tension}</div>
                    
                    <div><span className="text-gray-400 block text-base font-medium">Fases</span> <span className="text-gray-200 text-base">{servicePoint.fases}</span></div>
                    <div><span className="text-gray-400 block text-base font-medium">% Eficiencia</span> <span className="text-gray-200 text-base">{servicePoint.porcentEf !== undefined ? servicePoint.porcentEf + '%' : 'N/A'}</span></div>
                    
                    <div><span className="text-gray-400 block text-base font-medium">Cant. Luminarias</span> <span className="text-gray-200 text-base">{servicePoint.cantidadLuminarias}</span></div>
                </div>
            </div>
        </div>
    );
};


const LuminariaWorksheetTable: React.FC<{ worksheet: LuminariaWorksheet }> = ({ worksheet }) => {
    
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
                        const technicalDetails = `Pot. Medida: ${row.event.systemMeasuredPower?.toFixed(0) ?? 'N/A'}`;
                        const locationLink = row.event.lat && row.event.lon ? `https://www.google.com/maps?q=${row.event.lat},${row.lon}` : '';
                        
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
                                <td className="px-2 py-2 whitespace-pre-wrap border-r border-gray-600 align-top">{row.event.date?.toLocaleString() || 'N/A'}</td>
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

const CabinetWorksheetMap: React.FC<{ servicePoint: ServicePoint }> = ({ servicePoint }) => {
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<L.Map | null>(null);

    useEffect(() => {
        if (mapContainerRef.current && !mapRef.current && servicePoint.lat && servicePoint.lon) {
            const map = L.map(mapContainerRef.current).setView([servicePoint.lat, servicePoint.lon], 15);
            mapRef.current = map;

            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '&copy; OpenStreetMap contributors'
            }).addTo(map);

            L.marker([servicePoint.lat, servicePoint.lon])
                .addTo(map)
                .bindPopup(`<b>Num_Cuenta:</b> ${servicePoint.nroCuenta}`)
                .openPopup();
        }
    }, [servicePoint]);

    if (!servicePoint.lat || !servicePoint.lon) {
         return <div className="h-96 flex items-center justify-center bg-gray-700/50 rounded-lg text-gray-400">Sin coordenadas.</div>;
    }

    return <div ref={mapContainerRef} className="h-full w-full" />;
};

const CabinetWorksheetDetails: React.FC<{ worksheet: CabinetWorksheet }> = ({ worksheet }) => (
    <>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
                 <ServicePointDetails servicePoint={worksheet.servicePoint} />
            </div>
             <div className="h-96 rounded-lg overflow-hidden border-2 border-red-500">
                <CabinetWorksheetMap servicePoint={worksheet.servicePoint} />
            </div>
        </div>
    </>
);

const LuminariaWorksheetMap: React.FC<{ worksheet: LuminariaWorksheet }> = ({ worksheet }) => {
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<L.Map | null>(null);

    const waypoints = worksheet.failures
        .filter(f => f.event.lat && f.event.lon)
        .map(f => L.latLng(f.event.lat!, f.event.lon!));

    useEffect(() => {
        if (mapContainerRef.current && !mapRef.current && waypoints.length > 0) {
            const map = L.map(mapContainerRef.current).setView(waypoints[0], 13);
            mapRef.current = map;

            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '&copy; OpenStreetMap contributors'
            }).addTo(map);

            waypoints.forEach((wp, index) => {
                const failure = worksheet.failures[index];
                const situation = failure.situacion?.toUpperCase() || '';
                const isSpecial = SPECIAL_SITUATIONS_FOR_MAP.includes(situation);
                const bgColor = isSpecial ? '#1f2937' : '#2563eb'; // black vs blue

                const icon = L.divIcon({
                    html: `<div style="background-color: ${bgColor}; color: white; border-radius: 50%; width: 25px; height: 25px; display: flex; align-items: center; justify-content: center; font-weight: bold; border: 2px solid white; box-shadow: 0 0 5px rgba(0,0,0,0.5);">${index + 1}</div>`,
                    className: '',
                    iconSize: [25, 25],
                    iconAnchor: [12, 12]
                });

                const popupContent = `
                    <b>Punto #${index + 1}</b><br>
                    <b>ID Luminaria:</b> ${failure.event.id}<br>
                    <b>ID OLC:</b> ${failure.event.olcHardwareDir || 'N/A'}<br>
                    <b>Potencia:</b> ${failure.potencia || 'N/A'}<br>
                    <b>Situación:</b> ${failure.situacion || 'N/A'}
                `;

                L.marker(wp, { icon }).addTo(map).bindPopup(popupContent);
            });
            
            if (waypoints.length > 1) {
                // Access L.Routing from leaflet-routing-machine plugin safely
                const routingControl = (L as any).Routing.control({
                    waypoints: waypoints,
                    routeWhileDragging: false,
                    show: false,
                    addWaypoints: false,
                    lineOptions: {
                        styles: [{ color: '#2563eb', opacity: 0.8, weight: 6 }]
                    },
                    // FIX: Revert to the demo OSRM service URL.
                    // For production, a dedicated OSRM server or paid service is recommended.
                    serviceUrl: 'https://router.project-osrm.org/route/v1' 
                });

                routingControl.on('routingerror', (e: any) => {
                    console.error('Error de ruteo (ignorado en UI):', e.error);
                });
                
                routingControl.addTo(map);
            }

            map.fitBounds(L.latLngBounds(waypoints), { padding: [50, 50] });
        }
    }, [waypoints, worksheet.failures]);

    if (waypoints.length === 0) {
        return <div className="h-96 flex items-center justify-center bg-gray-700/50 rounded-lg text-gray-400">No hay coordenadas para mostrar el mapa de la ruta.</div>;
    }

    return <div ref={mapContainerRef} className="h-[600px] w-full rounded-lg overflow-hidden border-2 border-cyan-500" />;
};


interface WorksheetProps {
    worksheet: WorksheetData;
    onDownloadHtml: () => void;
}

const Worksheet: React.FC<WorksheetProps> = ({ worksheet, onDownloadHtml }) => {
    const printableRef = useRef<HTMLDivElement>(null);

    const handleExportPdf = () => {
       if (worksheet.type !== 'luminaria') {
            alert("La exportación a PDF solo está disponible para hojas de ruta de luminarias individuales.");
            return;
        }

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({
            orientation: 'landscape',
            unit: 'mm',
            format: 'a4'
        });

        // The title in the worksheet object is already formatted as "HR [Nro] [ZONA] [MUNI] [DATE]"
        // We use it directly for the PDF header and filename
        const title = worksheet.title;
        
        const pageContent = (data: any) => {
            // HEADER
            doc.setFontSize(14);
            doc.setTextColor(40);
            doc.text(title, data.settings.margin.left, 15);

            // FOOTER
            doc.setFontSize(10);
            const pageStr = `Página ${data.pageNumber}`;
            doc.text(pageStr, data.settings.margin.left, doc.internal.pageSize.height - 10);
        };

        // --- 1. Draw Main Table FIRST ---
        let finalY = 25;
        const head = [['#', 'ID Luminaria / OLC', 'ID Gabinete', 'Potencia', 'Fecha Reporte', 'Categoría', 'Situación', 'Mensaje de Error', 'Detalles Técnicos', 'Acción', 'Posible Solución', 'Actuación / Observaciones']];
        const body = (worksheet as LuminariaWorksheet).failures.map(row => [
            row.index,
            row.idLuminariaOlc,
            row.idGabinete || 'N/A',
            row.potencia || 'N/A',
            row.event.date?.toLocaleString() || 'N/A', // FIX: Add optional chaining
            row.categoria || 'N/A',
            row.situacion || 'N/A',
            row.mensajeDeError,
            `Pot. Medida: ${row.event.systemMeasuredPower?.toFixed(0) ?? 'N/A'}`, // FIX: Add optional chaining
            row.accion,
            row.posibleSolucion,
            '' // Empty column for notes
        ]);
        
        (doc as any).autoTable({
            head,
            body,
            startY: finalY,
            didDrawPage: pageContent,
            theme: 'grid', // Enable grid theme for lines
            styles: {
                fontSize: 10,
                cellPadding: 2,
                valign: 'middle',
                overflow: 'linebreak',
                lineColor: [0, 0, 0], // Black lines
                lineWidth: 0.1, // Thinner lines to look cleaner but distinct
                textColor: [0, 0, 0], // Black text for readability
                fillColor: [255, 255, 255] // White background
            },
            headStyles: {
                fillColor: [220, 220, 220], // Light grey for header background
                textColor: [0, 0, 0], // Black text
                fontStyle: 'bold',
                fontSize: 10,
                lineColor: [0, 0, 0],
                lineWidth: 0.2 // Slightly thicker header border
            },
            columnStyles: {
                0: { cellWidth: 10, halign: 'center', fontStyle: 'bold' }, // #
                1: { fontStyle: 'bold' }, // ID Luminaria / OLC - BOLD
                // Other columns auto-width
            },
            margin: { top: 25 }
        });

        // --- 2. Draw Summary Table AFTER Main Table ---
        // Get final Y position of the main table
        finalY = (doc as any).lastAutoTable.finalY + 15;

        // Check if there is enough space for the summary title and at least one row
        if (finalY > doc.internal.pageSize.height - 40) {
            doc.addPage();
            finalY = 25; // Reset to top margin
        }

        // Calculate Summary Data
        const powerCounts: Record<string, number> = {};
        (worksheet as LuminariaWorksheet).failures.forEach(row => {
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
                    fillColor: [50, 50, 50], // Dark Grey
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
        
        // Save using the title as filename (replacing slashes just in case)
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
        >
            <div ref={printableRef} className="p-2 space-y-4">
                <div className="worksheet-table-content">
                    {worksheet.type === 'luminaria' && <LuminariaWorksheetTable worksheet={worksheet as LuminariaWorksheet} />}
                    {worksheet.type !== 'luminaria' && <CabinetWorksheetDetails worksheet={worksheet as CabinetWorksheet} />}
                </div>
                {worksheet.type === 'luminaria' && (
                    <>
                        <h3 className="text-xl font-bold text-cyan-400 mt-6 mb-2">Mapa de la Hoja de Ruta</h3>
                        <LuminariaWorksheetMap worksheet={worksheet as LuminariaWorksheet} />
                    </>
                )}
            </div>
        </CollapsibleSection>
    );
};

export default Worksheet;