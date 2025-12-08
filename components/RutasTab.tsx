import React, { useState, useMemo, useCallback } from 'react';
import { format } from 'date-fns/format';
import type { LuminaireEvent, InventoryItem, ZoneBase, ServicePoint, WorksheetData, CabinetWorksheet, LuminariaWorksheet, WorksheetRow } from '../types';
import Worksheet from './Worksheet';
import { ACTION_SOLUTION_MAP, ALCID_TO_MUNICIPIO_MAP } from '../constants';

interface MantenimientoTabProps {
    allEvents: LuminaireEvent[];
    inventory: InventoryItem[];
    zoneBases: ZoneBase[];
    zones: string[];
    cabinetFailureAnalysisData: { name: string; count: number; accounts: string[] }[];
    servicePoints: ServicePoint[];
}

declare var JSZip: any;

// --- HTML Generation Helpers (copied from Worksheet.tsx for bulk export) ---
const generateLuminariaTableHtml = (worksheet: LuminariaWorksheet): string => {
    const headers = ['#', 'ID Luminaria / OLC', 'ID Gabinete', 'Potencia', 'Fecha Reporte', 'Categoría', 'Situación', 'Mensaje de Error', 'Detalles Técnicos', 'Acción', 'Posible Solución', 'COMPARTIR'];
    const headerHtml = `<thead><tr style="background-color: #e0e7ff; color: #1e3a8a; font-weight: 600;">${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>`;
    
    const rowsHtml = worksheet.failures.map(row => {
        const technicalDetails = `Pot. Medida: ${row.event.systemMeasuredPower?.toFixed(0) ?? 'N/A'}`;
        // FIX: Access lat and lon from row.event
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
        // Fix for `rowStyle` ternary operator syntax (remove extra quotes)
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
        <div style="overflow-x: auto;">
            <table style="border-collapse: collapse; width: 100%; font-size: 12px;">
                ${headerHtml}
                <tbody>${rowsHtml}</tbody>
            </table>
        </div>
    `;
};

const generateCabinetTableHtml = (worksheet: CabinetWorksheet): string => {
    const sp = worksheet.servicePoint;
    const locationLink = sp.lat && sp.lon ? `https://www.google.com/maps?q=${sp.lat},${sp.lon}` : '';
    const clickAttr = locationLink ? `onclick="window.open('${locationLink}', '_blank')"` : '';
    const cursorStyle = locationLink ? 'cursor: pointer;' : '';
    const titleText = locationLink ? 'Haga clic para ver la ubicación en Google Maps' : '';

    const municipioName = sp.alcid && ALCID_TO_MUNICIPIO_MAP[sp.alcid] 
        ? `${ALCID_TO_MUNICIPIO_MAP[sp.alcid]}` 
        : (sp.alcid || 'N/A');

    const servicePointHtml = `
        <div style="margin-bottom: 20px; ${cursorStyle}" ${clickAttr} title="${titleText}">
            <h4 style="font-size: 16px; color: #333; margin-top: 25px; margin-bottom: 15px;">Detalles del Servicio a Revisar (Click para Mapa)</h4>
            <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; border: 1px solid #d1d5db; font-family: sans-serif;">
                
                <!-- Account Number -->
                <div style="margin-bottom: 15px; border-bottom: 2px solid #e5e7eb; padding-bottom: 10px;">
                    <div style="font-size: 14px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px;">Nro. Cuenta</div>
                    <div style="font-size: 32px; font-weight: 800; color: #d97706; font-family: monospace;">${sp.nroCuenta}</div>
                </div>

                <!-- Address -->
                <div style="margin-bottom: 20px;">
                    <div style="font-size: 14px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px;">Dirección</div>
                    <div style="font-size: 18px; font-weight: 600; color: #1f2937;">${sp.direccion}</div>
                </div>

                <!-- Grid -->
                <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px;">
                    <div><div style="font-size: 14px; color: #6b7280;">Municipio</div><div style="font-weight: 600; color: #374151;">${municipioName}</div></div>
                    <div><div style="font-size: 14px; color: #6b7280;">Tarifa</div><div style="color: #374151;">${sp.tarifa}</div></div>
                    
                    <div><div style="font-size: 14px; color: #6b7280;">Pot. Contratada</div><div style="color: #374151;">${sp.potenciaContratada} kW</div></div>
                    <div><div style="font-size: 14px; color: #6b7280;">Tensión</div><div style="color: #374151;">${sp.tension}</div></div>
                    
                    <div><div style="font-size: 14px; color: #6b7280;">Fases</div><div style="color: #374151;">${sp.fases}</div></div>
                    <div><div style="font-size: 14px; color: #6b7280;">% Eficiencia</div><div style="color: #374151;">${sp.porcentEf !== undefined ? sp.porcentEf + '%' : 'N/A'}</div></div>
                    
                    <div><div style="font-size: 14px; color: #6b7280;">Cant. Luminarias</div><div style="color: #374151;">${sp.cantidadLuminarias}</div></div>
                    ${worksheet.inaccessibleCount !== undefined ? `<div><div style="font-size: 14px; color: #6b7280;">Lum. Inaccesibles</div><div style="color: #374151;">${worksheet.inaccessibleCount} (${worksheet.inaccessiblePercentage?.toFixed(1)}%)</div></div>`: ''}
                </div>
            </div>
        </div>
    `;

    return servicePointHtml;
};


const getHtmlContentForWorksheet = (worksheet: WorksheetData): string => {
    // The title is already in the correct format "HR [Nro] [ZONA] [MUNI] [DATE]" from generation time
    const title = worksheet.title;
    let tableHtml = '';

    if (worksheet.type === 'luminaria') {
        tableHtml = generateLuminariaTableHtml(worksheet as LuminariaWorksheet);
    } else {
        tableHtml = generateCabinetTableHtml(worksheet as CabinetWorksheet);
    }

    let mapScript = '';
    let waypointsForHtml: {lat: number, lng: number, popup: string, situacion?: string}[] = [];
    
    if (worksheet.type === 'luminaria') {
        waypointsForHtml = (worksheet as LuminariaWorksheet).failures
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
         const cabinetWorksheet = worksheet as CabinetWorksheet;
         if (cabinetWorksheet.servicePoint.lat && cabinetWorksheet.servicePoint.lon) {
            waypointsForHtml.push({
                lat: cabinetWorksheet.servicePoint.lat,
                lng: cabinetWorksheet.servicePoint.lon,
                popup: `<b>Num_Cuenta:</b> ${cabinetWorksheet.servicePoint.nroCuenta}`,
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
                var specialSituations = ["COLUMNA CAIDA", "HURTO", "VANDALIZADO", "FALTA PODA", "FALTA LINEA", "VANDALIZADO VR", "VANDALIZADO NF", "ROADFORCE SIN POTENCIA", "SIN ENERGÍA", "RETIRADA", "SIN OLC", "RETIRADA POR OBRA"];
                var bounds = [];

                waypoints.forEach(function(wp, index) {
                    var isSpecial = specialSituations.includes((wp.situacion || '').toUpperCase());
                    var bgColor = isSpecial ? '#1f2937' : '#2563eb';
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
                        },
                        // FIX: Revert to the demo OSRM service URL.
                        // For production, a dedicated OSRM server or paid service is recommended.
                        serviceUrl: 'https://router.project-osrm.org/route/v1' 
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
                /* Updated Table Styles */
                table { border-collapse: collapse; width: 100%; font-size: 12px; }
                th, td { border: 1px solid #ccc; padding: 10px; text-align: left; vertical-align: top; }
                th { background-color: #e0e7ff; color: #1e3a8a; font-weight: 600; white-space: nowrap; }
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


const getActionAndSolution = (event: LuminaireEvent): { action: string; solution: string } => {
    const defaultResponse = { action: 'Revisión general.', solution: 'Según diagnóstico en sitio.' };
    if (!event.failureCategory) return defaultResponse;

    const eventDescriptionLower = event.description ? event.description.toLowerCase() : '';

    const matchingRule = ACTION_SOLUTION_MAP.find(rule => 
        rule.category === event.failureCategory && eventDescriptionLower.includes(rule.messageSubstring.toLowerCase())
    );

    return matchingRule 
        ? { action: matchingRule.action, solution: matchingRule.solution } 
        : defaultResponse;
};

const RutasTab: React.FC<MantenimientoTabProps> = ({ allEvents, inventory, zoneBases, zones, cabinetFailureAnalysisData, servicePoints }) => {
    const [selectedZone, setSelectedZone] = useState<string>('');
    const [worksheets, setWorksheets] = useState<WorksheetData[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [message, setMessage] = useState<string | null>('Seleccione una zona y genere las hojas de ruta para ver los resultados.');

    const servicePointMap = useMemo(() => {
        return new Map<string, ServicePoint>(servicePoints.map(sp => [sp.nroCuenta, sp]));
    }, [servicePoints]);
    
    const inventoryMap = useMemo(() => new Map<string, InventoryItem>(inventory.map(item => [item.streetlightIdExterno, item])), [inventory]);

    const getDistance = (p1: {lat: number, lon: number}, p2: {lat: number, lon: number}) => {
        return Math.sqrt(Math.pow(p1.lat - p2.lat, 2) + Math.pow(p1.lon - p2.lon, 2));
    };

    const handleGenerateWorksheets = useCallback(() => {
        if (!selectedZone) {
            setMessage("Error: Por favor, seleccione una zona.");
            return;
        }
        
        setIsLoading(true);
        setWorksheets([]);
        setMessage('Procesando fallas y generando hojas de ruta...');

        setTimeout(() => {
            const generatedWorksheets: WorksheetData[] = [];
            const processedLuminaires = new Set<string>(); // Stores streetlightIdExterno
            let worksheetCounter = 1;
            const dateStr = format(new Date(), 'dd-MM-yyyy');

            // 1. New Critical Failure Detection based on percentages
            // Use cabinetFailureAnalysisData which already identifies failing service accounts
            const failingServiceAccountsInZone = cabinetFailureAnalysisData.filter(data => data.name === selectedZone);

            failingServiceAccountsInZone.forEach(zoneData => {
                zoneData.accounts.forEach(account => {
                    const servicePoint = servicePointMap.get(account);
                    if (servicePoint) {
                        const associatedLuminaires = inventory.filter(item => item.nroCuenta === account && item.zone === selectedZone);
                        const totalLuminariasInAccount = associatedLuminaires.length;

                        // Recalculate inaccessible count for this specific service point from allEvents
                        const inaccessibleLuminairesForAccount = allEvents.filter(e => 
                            e.status === 'FAILURE' && 
                            e.failureCategory === 'Inaccesible' && 
                            inventoryMap.get(e.id)?.nroCuenta === account &&
                            inventoryMap.get(e.id)?.zone === selectedZone
                        ).map(e => e.id);
                        
                        const inaccessibleCount = new Set(inaccessibleLuminairesForAccount).size;

                        if (totalLuminariasInAccount === 0) return;
                        const percentage = (inaccessibleCount / totalLuminariasInAccount) * 100;

                        let worksheetType: CabinetWorksheet['type'] | null = null;
                        if (percentage > 90) {
                            worksheetType = 'cabinet_falla_total';
                        } else if (percentage >= 50) {
                            worksheetType = 'cabinet_falla_parcial';
                        }

                        if (worksheetType) {
                            const municipioName = servicePoint.alcid && ALCID_TO_MUNICIPIO_MAP[servicePoint.alcid] 
                                ? ALCID_TO_MUNICIPIO_MAP[servicePoint.alcid].toUpperCase()
                                : (servicePoint.alcid || 'DESCONOCIDO');

                            // Update the service point with actual calculated luminaire count
                            const updatedServicePoint = { 
                                ...servicePoint, 
                                cantidadLuminarias: totalLuminariasInAccount 
                            };
                            
                            // Mark all luminaires from this account as processed
                            associatedLuminaires.forEach(lum => processedLuminaires.add(lum.streetlightIdExterno));
                            
                            generatedWorksheets.push({
                                id: `service-${account}-${worksheetCounter}`,
                                title: `HR ${worksheetCounter++} ${selectedZone} ${municipioName} ${dateStr} (Servicio ${account})`,
                                type: worksheetType,
                                servicePoint: updatedServicePoint,
                                luminaires: associatedLuminaires,
                                inaccessiblePercentage: percentage,
                                inaccessibleCount: inaccessibleCount,
                                totalLuminariasInAccount: totalLuminariasInAccount // Ensure this is set
                            });
                        }
                    }
                });
            });


            // 2. Regular Route Creation for remaining failures
            const individualFailures = allEvents.filter(e =>
                e.zone === selectedZone &&
                e.status === 'FAILURE' &&
                !processedLuminaires.has(e.id) && // Exclude already processed luminaires
                e.lat && e.lon
            ).sort((a, b) => a.date.getTime() - b.date.getTime());

            const failuresByMunicipality: Record<string, LuminaireEvent[]> = {};
            for (const event of individualFailures) {
                const municipio = event.municipio || 'Sin Municipio';
                if (!failuresByMunicipality[municipio]) {
                    failuresByMunicipality[municipio] = [];
                }
                failuresByMunicipality[municipio].push(event);
            }

            Object.entries(failuresByMunicipality).forEach(([municipio, events]) => {
                let remainingEvents = [...events];
                while(remainingEvents.length > 0) {
                    const routeChunk: LuminaireEvent[] = [];
                    let lastPoint = remainingEvents.shift()!;
                    routeChunk.push(lastPoint);

                    while (routeChunk.length < 10 && remainingEvents.length > 0) {
                        let nearestIndex = -1;
                        let minDistance = Infinity;
                        for (let i = 0; i < remainingEvents.length; i++) {
                            const distance = getDistance({lat: lastPoint.lat!, lon: lastPoint.lon!}, {lat: remainingEvents[i].lat!, lon: remainingEvents[i].lon!});
                            if (distance < minDistance) {
                                minDistance = distance;
                                nearestIndex = i;
                            }
                        }
                        if (nearestIndex !== -1) {
                            lastPoint = remainingEvents.splice(nearestIndex, 1)[0];
                            routeChunk.push(lastPoint);
                        }
                    }

                    const worksheetRows: WorksheetRow[] = routeChunk.map((event, index) => {
                        const inventoryItem = inventoryMap.get(event.id);
                        const { action, solution } = getActionAndSolution(event);
                        return {
                            index: index + 1,
                            idLuminariaOlc: `${event.id}\n${event.olcHardwareDir || ''}`,
                            idGabinete: inventoryItem?.cabinetIdExterno,
                            potencia: event.power ? `${event.power} W` : undefined,
                            fechaReporte: format(event.date, 'dd/MM/yy HH:mm'),
                            categoria: event.failureCategory,
                            situacion: inventoryItem?.situacion,
                            mensajeDeError: event.description,
                            accion: action,
                            posibleSolucion: solution,
                            event: event,
                        };
                    });
                    
                    const muniTitle = municipio.toUpperCase();
                    generatedWorksheets.push({
                        id: `luminaria-${municipio}-${worksheetCounter}`,
                        title: `HR ${worksheetCounter++} ${selectedZone} ${muniTitle} ${dateStr}`,
                        type: 'luminaria',
                        municipio,
                        failures: worksheetRows,
                        totalFailuresInZone: individualFailures.length,
                    });
                }
            });
            
            setWorksheets(generatedWorksheets);
            setMessage(generatedWorksheets.length > 0 ? `Se generaron ${generatedWorksheets.length} hojas de ruta.` : 'No se encontraron fallas para generar hojas de ruta en la zona seleccionada.');
            setIsLoading(false);

        }, 100);

    }, [selectedZone, allEvents, inventory, inventoryMap, servicePointMap, cabinetFailureAnalysisData]);

    const handleGenerateAllHtml = async () => {
        if (worksheets.length === 0) return;
        if (typeof JSZip === 'undefined') {
            setMessage('Error: La librería de compresión (JSZip) no está disponible.');
            return;
        }

        setMessage(`Comprimiendo ${worksheets.length} archivos HTML...`);
        setIsLoading(true);

        try {
            const zip = new JSZip();

            worksheets.forEach(ws => {
                const content = getHtmlContentForWorksheet(ws);
                const filename = `${ws.title.replace(/[ /\\?%*:|"<>]/g, '_')}.html`;
                zip.file(filename, content);
            });

            const content = await zip.generateAsync({ type: 'blob' });
            const url = URL.createObjectURL(content);
            const link = document.createElement('a');
            link.href = url;
            const dateStr = new Date().toISOString().split('T')[0];
            link.download = `Hojas_de_Ruta_${selectedZone}_${dateStr}.zip`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            setMessage(`Se descargó el archivo ${link.download} con ${worksheets.length} hojas de ruta.`);
        } catch (error) {
            console.error("Error generating zip file", error);
            setMessage('Error al generar el archivo comprimido.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleDownloadSingleHtml = (ws: WorksheetData) => {
        const content = getHtmlContentForWorksheet(ws);
        const blob = new Blob([content], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${ws.title.replace(/[ /\\?%*:|"<>]/g, '_')}.html`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };


    return (
        <div className="space-y-4">
            <div className="bg-gray-800 shadow-lg rounded-xl p-4 space-y-4">
                <h2 className="text-xl font-bold text-cyan-400">Generador de Hojas de Ruta de Mantenimiento</h2>
                 <div className="flex flex-col sm:flex-row sm:items-end gap-4">
                    <div className="flex-grow">
                        <label htmlFor="zone-select-mantenimiento" className="block text-sm font-medium text-gray-400 mb-1">Filtro de Zona de Alumbrado</label>
                        <select
                            id="zone-select-mantenimiento"
                            value={selectedZone}
                            onChange={(e) => setSelectedZone(e.target.value)}
                            className="w-full bg-gray-700 border border-gray-600 rounded-md p-2 text-white focus:ring-cyan-500 focus:border-cyan-500"
                        >
                            <option value="">-- Seleccione una Zona --</option>
                            {zones.map(zone => <option key={zone} value={zone}>{zone}</option>)}
                        </select>
                    </div>
                    <button
                        onClick={handleGenerateWorksheets}
                        disabled={isLoading || !selectedZone}
                        className="bg-cyan-600 text-white font-bold py-2 px-4 rounded-md hover:bg-cyan-700 disabled:bg-gray-500 disabled:cursor-not-allowed transition-colors"
                    >
                        {isLoading ? 'Generando...' : 'Generar Hojas de Ruta'}
                    </button>
                    {worksheets.length > 0 && !isLoading && (
                        <button
                            onClick={handleGenerateAllHtml}
                            className="bg-green-600 text-white font-bold py-2 px-4 rounded-md hover:bg-green-700 transition-colors"
                            title="Generar y descargar todos los archivos HTML para las hojas de ruta listadas abajo"
                        >
                            Generar Todos los HTML
                        </button>
                    )}
                </div>
                 {message && (
                    <div className={`p-3 rounded-md text-sm ${message.startsWith('Error') ? 'bg-red-900/50 text-red-300' : 'bg-blue-900/50 text-blue-300'}`}>
                        {message}
                    </div>
                )}
            </div>

            <div className="space-y-4">
                 {worksheets.map(ws => (
                    <Worksheet 
                        key={ws.id} 
                        worksheet={ws} 
                        onDownloadHtml={() => handleDownloadSingleHtml(ws)}
                    />
                 ))}
            </div>
        </div>
    );
};

export default RutasTab;