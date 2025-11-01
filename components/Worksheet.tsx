import React, { useRef, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet-routing-machine';
import type { WorksheetData, ServicePoint, LuminariaWorksheet, CabinetWorksheet, WorksheetRow } from '../types';
import CollapsibleSection from './CollapsibleSection';

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

const ServicePointDetails: React.FC<{ servicePoint: ServicePoint }> = ({ servicePoint }) => (
    <div className="space-y-2 text-sm mb-4">
        <h4 className="text-lg font-semibold text-gray-300 mb-2">Detalles del Servicio a Revisar</h4>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 p-3 bg-gray-700/50 rounded-lg">
            <strong className="text-gray-400">Dirección:</strong> <span className="text-gray-200 col-span-2">{servicePoint.direccion}</span>
            <strong className="text-gray-400">Nro. Cuenta:</strong> <span className="text-gray-200 font-mono">{servicePoint.nroCuenta}</span>
            <strong className="text-gray-400">Cant. Luminarias:</strong> <span className="text-gray-200">{servicePoint.cantidadLuminarias}</span>
        </div>
    </div>
);


const LuminariaWorksheetTable: React.FC<{ worksheet: LuminariaWorksheet }> = ({ worksheet }) => {
    
    const handleRowClick = (row: WorksheetRow) => {
        if (row.event.lat && row.event.lon) {
            const url = `https://www.google.com/maps?q=${row.event.lat},${row.event.lon}`;
            window.open(url, '_blank', 'noopener,noreferrer');
        }
    };
    
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
                        const locationLink = row.event.lat && row.event.lon ? `https://www.google.com/maps?q=${row.event.lat},${row.event.lon}` : '';
                        
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

                        const isClickable = !!locationLink;

                        return (
                            <tr 
                                key={row.index}
                                onClick={() => handleRowClick(row)}
                                className={`hover:bg-gray-700/50 ${isClickable ? 'cursor-pointer' : ''}`}
                                title={isClickable ? 'Haga clic para ver la ubicación en el mapa' : ''}
                            >
                                <td className="px-2 py-2 border-r border-gray-600 font-bold text-center align-middle">{row.index}</td>
                                <td className="px-2 py-2 whitespace-pre-wrap border-r border-gray-600 align-top">{row.idLuminariaOlc}</td>
                                <td className="px-2 py-2 border-r border-gray-600 align-top">{row.idGabinete || 'N/A'}</td>
                                <td className="px-2 py-2 border-r border-gray-600 align-top">{row.potencia || 'N/A'}</td>
                                <td className="px-2 py-2 whitespace-pre-wrap border-r border-gray-600 align-top">{row.fechaReporte}</td>
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
                                           onClick={(e) => e.stopPropagation()} // Prevent row click when clicking the icon
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


const CabinetWorksheetDetails: React.FC<{ worksheet: CabinetWorksheet }> = ({ worksheet }) => (
    <>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
                 <ServicePointDetails servicePoint={worksheet.servicePoint} />
                 <h4 className="text-lg font-semibold text-gray-300 mb-2">Luminarias Asociadas ({worksheet.luminaires.length})</h4>
                <div className="overflow-auto border border-gray-700 rounded-lg" style={{ maxHeight: '300px' }}>
                    <table className="min-w-full divide-y divide-gray-700">
                         <thead className="bg-gray-700/50 sticky top-0">
                            <tr>
                                {['ID Luminaria', 'Municipio', 'Situación', 'Potencia (W)'].map(header => (
                                     <th key={header} scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">{header}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="bg-gray-800 divide-y divide-gray-700">
                            {worksheet.luminaires.map(lum => (
                                <tr key={lum.streetlightIdExterno}>
                                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-300">{lum.streetlightIdExterno}</td>
                                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-300">{lum.municipio}</td>
                                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-300">{lum.situacion || 'N/A'}</td>
                                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-300">{lum.potenciaNominal || 'N/A'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
             <div className="h-96 rounded-lg overflow-hidden border-2 border-red-500">
                <MapContainer center={[worksheet.servicePoint.lat, worksheet.servicePoint.lon]} zoom={15} style={{ height: '100%', width: '100%' }}>
                    <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                    <Marker position={[worksheet.servicePoint.lat, worksheet.servicePoint.lon]}>
                        <Popup><b>Tablero Prioritario:</b><br/>{worksheet.servicePoint.nroCuenta}</Popup>
                    </Marker>
                </MapContainer>
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
                const routingControl = L.Routing.control({
                    waypoints: waypoints,
                    routeWhileDragging: false,
                    show: false,
                    addWaypoints: false,
                    lineOptions: {
                        styles: [{ color: '#2563eb', opacity: 0.8, weight: 6 }]
                    },
                    createMarker: () => null, // Don't create the default A/B markers
                });

                routingControl.on('routingerror', (e) => {
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
}

const generateLuminariaTableHtml = (worksheet: LuminariaWorksheet): string => {
    const headers = ['#', 'ID Luminaria / OLC', 'ID Gabinete', 'Potencia', 'Fecha Reporte', 'Categoría', 'Situación', 'Mensaje de Error', 'Detalles Técnicos', 'Acción', 'Posible Solución', 'COMPARTIR'];
    const headerHtml = `<thead><tr style="background-color: #e0e7ff; color: #1e3a8a; font-weight: 600;">${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>`;
    
    const rowsHtml = worksheet.failures.map(row => {
        const technicalDetails = `Pot. Medida: ${row.event.systemMeasuredPower?.toFixed(0) ?? 'N/A'}`;
        const locationLink = row.event.lat && row.event.lon ? `https://www.google.com/maps?q=${row.event.lat},${row.event.lon}` : '';
        
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

        const isClickable = !!locationLink;
        const rowOnClick = isClickable ? `onclick="window.open('${locationLink}', '_blank')"` : '';
        const rowStyle = isClickable ? 'cursor: pointer;' : '';
        
        const shareHtml = whatsappLink ? `<a href="${whatsappLink}" target="_blank" rel="noopener noreferrer" onclick="event.stopPropagation()" style="display: inline-block; vertical-align: middle;">
            <svg style="height: 20px; width: 20px; color: #25D366;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
            </svg>
        </a>` : '';

        return `
            <tr style="${rowStyle}" ${rowOnClick}>
                <td style="text-align: center; font-weight: bold;">${row.index}</td>
                <td style="white-space: pre-wrap;">${row.idLuminariaOlc}</td>
                <td>${row.idGabinete || 'N/A'}</td>
                <td>${row.potencia || 'N/A'}</td>
                <td style="white-space: pre-wrap;">${row.fechaReporte}</td>
                <td>${row.categoria || 'N/A'}</td>
                <td>${row.situacion || 'N/A'}</td>
                <td>${row.mensajeDeError}</td>
                <td>${technicalDetails}</td>
                <td>${row.accion}</td>
                <td>${row.posibleSolucion}</td>
                <td style="text-align: center;">${shareHtml}</td>
            </tr>
        `;
    }).join('');

    return `
        <h4>Total de luminarias en esta hoja de ruta: ${worksheet.failures.length}</h4>
        <table>
            ${headerHtml}
            <tbody>${rowsHtml}</tbody>
        </table>
    `;
};


const Worksheet: React.FC<WorksheetProps> = ({ worksheet }) => {
    const printableRef = useRef<HTMLDivElement>(null);

    const getHtmlContent = () => {
        const title = `${worksheet.title} ${new Date().toLocaleDateString('es-ES')}`;
        let tableHtml = '';

        if (worksheet.type === 'luminaria') {
            tableHtml = generateLuminariaTableHtml(worksheet);
        } else {
             tableHtml = printableRef.current?.querySelector('.worksheet-table-content')?.innerHTML || '';
        }

        let mapScript = '';
        let waypointsForHtml: {lat: number, lng: number, popup: string, situacion?: string}[] = [];
        
        if (worksheet.type === 'luminaria') {
            waypointsForHtml = worksheet.failures
                .filter(f => f.event.lat && f.event.lon)
                .map((f, index) => {
                    const popupContent = `<b>Punto #${index + 1}</b><br><b>ID Luminaire:</b> ${f.event.id}<br><b>ID OLC:</b> ${f.event.olcHardwareDir || 'N/A'}<br><b>Potencia:</b> ${f.potencia || 'N/A'}<br><b>Situación:</b> ${f.situacion || 'N/A'}`;
                    return {
                        lat: f.event.lat!,
                        lng: f.event.lon!,
                        popup: popupContent,
                        situacion: f.situacion || ''
                    };
                });
        } else {
             if (worksheet.servicePoint.lat && worksheet.servicePoint.lon) {
                waypointsForHtml.push({
                    lat: worksheet.servicePoint.lat,
                    lng: worksheet.servicePoint.lon,
                    popup: `<b>Tablero Prioritario:</b><br/>${worksheet.servicePoint.nroCuenta}`,
                    situacion: ''
                });
             }
        }
        
        if (waypointsForHtml.length > 0) {
            mapScript = `
                <script>
                    var map = L.map('map').setView([${waypointsForHtml[0].lat}, ${waypointsForHtml[0].lng}], 13);
                    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                        attribution: '&copy; OpenStreetMap contributors'
                    }).addTo(map);

                    var waypoints = ${JSON.stringify(waypointsForHtml)};
                    var specialSituations = ${JSON.stringify(SPECIAL_SITUATIONS_FOR_MAP)};
                    var bounds = [];

                    waypoints.forEach(function(wp, index) {
                        var isSpecial = specialSituations.includes((wp.situacion || '').toUpperCase());
                        var bgColor = isSpecial ? '#1f2937' : '#2563eb'; // black vs blue

                        var iconHtml = '<div style="background-color: ' + bgColor + '; color: white; border-radius: 50%; width: 25px; height: 25px; display: flex; align-items: center; justify-content: center; font-weight: bold; border: 2px solid white;">' + (index + 1) + '</div>';
                        var customIcon = L.divIcon({
                            html: iconHtml,
                            className: '',
                            iconSize: [25, 25],
                            iconAnchor: [12, 12]
                        });
                        
                        var marker = L.marker([wp.lat, wp.lng], { icon: customIcon }).addTo(map).bindPopup(wp.popup);
                        bounds.push([wp.lat, wp.lng]);
                    });

                    if (waypoints.length > 1) {
                         var routingControl = L.Routing.control({
                            waypoints: waypoints.map(function(wp) { return L.latLng(wp.lat, wp.lng); }),
                            show: false,
                            addWaypoints: false,
                            createMarker: function() { return null; },
                            lineOptions: {
                                styles: [{ color: '#2563eb', opacity: 0.8, weight: 5 }]
                            }
                        });
                        routingControl.on('routingerror', function(e) {
                            console.error('Error de ruteo (ignorado en HTML):', e.error);
                        });
                        routingControl.addTo(map);
                    }
                    
                    if (bounds.length > 0) {
                        map.fitBounds(bounds, { padding: [50, 50] });
                    }
                </script>
            `;
        }

        return `
            <!DOCTYPE html>
            <html lang="es">
            <head>
                <meta charset="UTF-8">
                <title>${title}</title>
                <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
                <link rel="stylesheet" href="https://unpkg.com/leaflet-routing-machine@3.2.12/dist/leaflet-routing-machine.css" />
                <style>
                    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; margin: 0; background-color: #f4f4f9; color: #333; }
                    .container { max-width: 1400px; margin: 20px auto; background-color: #fff; padding: 25px; box-shadow: 0 4px 8px rgba(0,0,0,0.1); border-radius: 8px; }
                    h2 { font-size: 24px; color: #1e3a8a; border-bottom: 2px solid #3b82f6; padding-bottom: 10px; margin-top: 0; margin-bottom: 25px; }
                    h4 { font-size: 16px; color: #333; margin-top: 25px; margin-bottom: 15px; }
                    #map { height: 600px; width: 100%; margin-bottom: 25px; border-radius: 8px; border: 1px solid #ddd; }
                    .worksheet-table-content { margin-top: 20px; }
                    table { border-collapse: collapse; width: 100%; font-size: 10px; table-layout: fixed; }
                    th, td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; vertical-align: top; word-wrap: break-word; }
                    th { background-color: #e0e7ff; color: #1e3a8a; font-weight: 600; }
                    tr:nth-child(even) { background-color: #f9fafb; }
                    td:first-child { text-align: center; font-weight: bold; }
                    .whitespace-pre-wrap { white-space: pre-wrap; }
                    a { color: #3b82f6; text-decoration: none; }
                    a:hover { text-decoration: underline; }
                </style>
            </head>
            <body>
                <div class="container">
                    <h2>${title}</h2>
                    <div class="worksheet-table-content">${tableHtml}</div>
                    ${waypointsForHtml.length > 0 ? '<h4>Mapa de la Hoja de Ruta</h4><div id="map"></div>' : ''}
                </div>
                <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
                <script src="https://unpkg.com/leaflet-routing-machine@3.2.12/dist/leaflet-routing-machine.js"></script>
                ${mapScript}
            </body>
            </html>
        `;
    };

    const handleGenerateHtml = () => {
        const content = getHtmlContent();
        const blob = new Blob([content], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${worksheet.title.replace(/ /g, '_')}.html`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };
    
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

        const title = `${worksheet.title} ${new Date().toLocaleDateString('es-ES')}`;
        const head = [['#', 'ID Luminaria / OLC', 'ID Gabinete', 'Potencia', 'Fecha Reporte', 'Categoría', 'Situación', 'Mensaje de Error', 'Detalles Técnicos', 'Acción', 'Posible Solución', 'Actuación / Observaciones']];
        const body = worksheet.failures.map(row => [
            row.index,
            row.idLuminariaOlc,
            row.idGabinete || 'N/A',
            row.potencia || 'N/A',
            row.fechaReporte,
            row.categoria || 'N/A',
            row.situacion || 'N/A',
            row.mensajeDeError,
            `Pot. Medida: ${row.event.systemMeasuredPower?.toFixed(0) ?? 'N/A'}`,
            row.accion,
            row.posibleSolucion,
            '' // Empty column for notes
        ]);
        
        const pageContent = (data: any) => {
            // HEADER
            doc.setFontSize(14);
            doc.setTextColor(40);
            doc.text(title, data.settings.margin.left, 15);

            // FOOTER
            const pageCount = doc.internal.getNumberOfPages();
            doc.setFontSize(10);
            const pageStr = `Página ${data.pageNumber}`;
            doc.text(pageStr, data.settings.margin.left, doc.internal.pageSize.height - 10);
        };
        
        (doc as any).autoTable({
            head,
            body,
            startY: 20,
            didDrawPage: pageContent,
            styles: {
                fontSize: 6,
                cellPadding: 1,
                valign: 'middle',
            },
            headStyles: {
                fillColor: [224, 231, 255], // indigo-100
                textColor: [30, 58, 138], // indigo-900
                fontStyle: 'bold',
                fontSize: 5,
            },
            columnStyles: {
                0: { cellWidth: 8 }, // #
                1: { cellWidth: 25 }, // ID
                2: { cellWidth: 15 }, // Gabinete
                3: { cellWidth: 12 }, // Potencia
                4: { cellWidth: 15 }, // Fecha
                5: { cellWidth: 18 }, // Categoría
                6: { cellWidth: 18 }, // Situación
                7: { cellWidth: 28 }, // Mensaje
                8: { cellWidth: 20 }, // Detalles
                9: { cellWidth: 28 }, // Acción
                10: { cellWidth: 28 }, // Solución
                11: { cellWidth: 32 }, // Observaciones
            },
            margin: { top: 20 }
        });
        
        doc.save(`${title.replace(/ /g, '_')}.pdf`);
    };


    return (
        <CollapsibleSection
            title={worksheet.title}
            defaultOpen={true}
            extraHeaderContent={
                 <div className="flex items-center gap-2">
                    <button onClick={handleGenerateHtml} className="bg-gray-700 hover:bg-blue-600 text-sm font-medium py-1 px-3 rounded-md transition-colors">
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
                    {worksheet.type === 'luminaria' && <LuminariaWorksheetTable worksheet={worksheet} />}
                    {worksheet.type !== 'luminaria' && <CabinetWorksheetDetails worksheet={worksheet} />}
                </div>
                {worksheet.type === 'luminaria' && (
                    <>
                        <h3 className="text-xl font-bold text-cyan-400 mt-6 mb-2">Mapa de la Hoja de Ruta</h3>
                        <LuminariaWorksheetMap worksheet={worksheet} />
                    </>
                )}
            </div>
        </CollapsibleSection>
    );
};

export default Worksheet;