
import React, { useState, useMemo, useCallback } from 'react';
import { format } from 'date-fns/format';
import { getDistance as haversineDistance } from 'ol/sphere'; // Use Haversine for accurate distance
import { fromLonLat } from 'ol/proj'; // To convert lat/lon to proper coordinates for distance calculation
import type { LuminaireEvent, InventoryItem, ZoneBase, ServicePoint, WorksheetData, CabinetWorksheet, LuminariaWorksheet, WorksheetRow, RoutePriority } from '../types';
import Worksheet from './Worksheet';
import { ACTION_SOLUTION_MAP, ALCID_TO_MUNICIPIO_MAP, MAX_EVENTS_PER_ROUTE, MAX_EVENTS_FOR_PRIORITY3_CHUNK, CABINET_PROXIMITY_THRESHOLD_METERS, PRIORITY_COLORS, VOLTAGE_MESSAGE_SUBSTRINGS, REGULAR_ROUTE_SITUATIONS, ZONE_ORDER, MUNICIPIO_TO_ZONE_MAP } from '../constants';
import { normalizeString } from '../utils/string';
// FIX: Added missing import for Leaflet.
import L from 'leaflet';

declare var JSZip: any;

// --- Helper Functions for HTML Generation (copied from Worksheet.tsx for bulk export) ---
const generateLuminariaTableHtml = (worksheet: LuminariaWorksheet): string => {
    const headers = ['#', 'ID Luminaria / OLC', 'ID Gabinete', 'Potencia', 'Fecha Reporte', 'Categoría', 'Situación', 'Mensaje de Error', 'Detalles Técnicos', 'Acción', 'Posible Solución', 'COMPARTIR'];
    const headerHtml = `<thead><tr style="background-color: #e0e7ff; color: #1e3a8a; font-weight: 600;">${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>`;
    
    const rowsHtml = worksheet.failures.map(row => {
        // FIX: Explicitly cast row.event to LuminaireEvent to ensure TypeScript correctly infers lat/lon properties.
        const eventData: LuminaireEvent = row.event;
        const technicalDetails = `Pot. Medida: ${eventData.systemMeasuredPower?.toFixed(0) ?? 'N/A'}`;
        const locationLink = eventData.lat && eventData.lon ? `https://www.google.com/maps?q=${eventData.lat},${eventData.lon}` : '';
        
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
        <div style="overflow-x: auto;">
            <table style="border-collapse: collapse; width: 100%; font-size: 12px;">
                ${headerHtml}
                <tbody>${rowsHtml}</tbody>
            </table>
        </div>
    `;
};

// FIX: Added the missing generateCabinetTableHtml function.
const generateCabinetTableHtml = (worksheet: CabinetWorksheet): string => {
    const servicePoint = worksheet.servicePoint;
    const municipioName = servicePoint.alcid && ALCID_TO_MUNICIPIO_MAP[servicePoint.alcid] 
        ? `${ALCID_TO_MUNICIPIO_MAP[servicePoint.alcid]}` 
        : (servicePoint.alcid || 'N/A');

    const servicePointDetailsHtml = `
        <div style="margin-bottom: 20px; padding: 15px; border: 1px solid #e0e7ff; border-radius: 8px; background-color: #f0f4ff;">
            <h4 style="font-size: 16px; color: #1e3a8a; margin-top: 0; margin-bottom: 10px;">Detalles del Servicio a Revisar</h4>
            <div style="margin-bottom: 15px; padding-bottom: 10px; border-bottom: 1px solid #c3dafe;">
                <span style="display: block; color: #60a5fa; font-size: 14px; font-weight: 500;">Nro. Cuenta</span>
                <span style="font-size: 24px; font-weight: bold; color: #f59e0b; font-family: monospace;">${servicePoint.nroCuenta}</span>
            </div>
            <div style="margin-bottom: 15px;">
                <span style="display: block; color: #60a5fa; font-size: 14px; font-weight: 500;">Dirección</span>
                <span style="font-size: 16px; color: #333; font-weight: 500;">${servicePoint.direccion}</span>
            </div>
            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; font-size: 13px;">
                <div><span style="display: block; color: #60a5fa; font-size: 14px;">Municipio</span> <span style="color: #333;">${municipioName}</span></div>
                <div><span style="display: block; color: #60a5fa; font-size: 14px;">Tarifa</span> <span style="color: #333;">${servicePoint.tarifa ?? 'N/A'}</span></div>
                <div><span style="display: block; color: #60a5fa; font-size: 14px;">Pot. Contratada</span> <span style="color: #333;">${servicePoint.potenciaContratada?.toLocaleString('es-ES') ?? 'N/A'} kW</span></div>
                <div><span style="display: block; color: #60a5fa; font-size: 14px;">Tensión</span> <span style="color: #333;">${servicePoint.tension ?? 'N/A'}</span></div>
                <div><span style="display: block; color: #60a5fa; font-size: 14px;">Fases</span> <span style="color: #333;">${servicePoint.fases ?? 'N/A'}</span></div>
                <div><span style="display: block; color: #60a5fa; font-size: 14px;">% Eficiencia</span> <span style="color: #333;">${servicePoint.porcentEf !== undefined ? servicePoint.porcentEf + '%' : 'N/A'}</span></div>
                <div><span style="display: block; color: #60a5fa; font-size: 14px;">Cant. Luminarias</span> <span style="color: #333;">${servicePoint.cantidadLuminarias}</span></div>
            </div>
        </div>
    `;

    let luminairesTableHtml = '';
    
    // For cabinet_acumulacion, we want to show the specific accumulation failures (originalEvents), not ALL luminaires
    if (worksheet.type === 'cabinet_acumulacion' && worksheet.accumulationFailures && worksheet.accumulationFailures.length > 0) {
        const headers = ['#', 'ID Luminaria / OLC', 'ID Gabinete', 'Potencia', 'Fecha Reporte', 'Categoría', 'Situación', 'Mensaje de Error', 'Acción', 'Posible Solución'];
        const headerHtml = `<thead><tr style="background-color: #e0e7ff; color: #1e3a8a; font-weight: 600;">${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>`;
        
        const rowsHtml = worksheet.accumulationFailures.map(row => `
            <tr>
                <td style="text-align: center; font-weight: bold;">${row.index}</td>
                <td style="white-space: pre-wrap;">${row.idLuminariaOlc}</td>
                <td>${row.idGabinete || 'N/A'}</td>
                <td>${row.potencia || 'N/A'}</td>
                <td style="white-space: pre-wrap;">${row.fechaReporte}</td>
                <td>${row.categoria || 'N/A'}</td>
                <td>${row.situacion || 'N/A'}</td>
                <td>${row.mensajeDeError}</td>
                <td>${row.accion}</td>
                <td>${row.posibleSolucion}</td>
            </tr>
        `).join('');

        luminairesTableHtml = `
            <h4 style="font-size: 16px; color: #333; margin-top: 25px; margin-bottom: 15px;">Luminarias en Falla de Acumulación (${worksheet.accumulationFailures.length})</h4>
            <div style="overflow-x: auto;">
                <table style="border-collapse: collapse; width: 100%; font-size: 12px;">
                    ${headerHtml}
                    <tbody>${rowsHtml}</tbody>
                </table>
            </div>
        `;
    } else if (worksheet.luminaires.length > 0 && worksheet.type !== 'cabinet_falla_total') { 
        // Show associated luminaires BUT NOT for 'cabinet_falla_total' as per user request
        const lumHeaders = ['ID Luminaria', 'OLC / Hardware', 'Potencia', 'Estado', 'Situación'];
        const lumHeaderHtml = `<thead><tr style="background-color: #e0e7ff; color: #1e3a8a; font-weight: 600;">${lumHeaders.map(h => `<th>${h}</th>`).join('')}</tr></thead>`;
        const lumRowsHtml = worksheet.luminaires.map(lum => `
            <tr>
                <td>${lum.streetlightIdExterno}</td>
                <td>${lum.olcHardwareDir || lum.olcIdExterno || 'N/A'}</td>
                <td>${lum.potenciaNominal ?? 'N/A'} W</td>
                <td>${lum.estado || 'N/A'}</td>
                <td>${lum.situacion || 'N/A'}</td>
            </tr>
        `).join('');

        luminairesTableHtml = `
            <h4 style="font-size: 16px; color: #333; margin-top: 25px; margin-bottom: 15px;">Luminarias asociadas al servicio (${worksheet.luminaires.length})</h4>
            <div style="overflow-x: auto;">
                <table style="border-collapse: collapse; width: 100%; font-size: 12px;">
                    ${lumHeaderHtml}
                    <tbody>${lumRowsHtml}</tbody>
                </table>
            </div>
        `;
    }

    return servicePointDetailsHtml + luminairesTableHtml;
};


const getHtmlContentForWorksheet = (worksheet: WorksheetData): string => {
    const title = worksheet.title;
    let tableHtml = '';
    // Removed descriptionHtml logic as user does not want the route summary box for cabinets

    if (worksheet.type === 'luminaria') {
        tableHtml = generateLuminariaTableHtml(worksheet as LuminariaWorksheet);
    } else {
        tableHtml = generateCabinetTableHtml(worksheet as CabinetWorksheet);
    }

    let mapScript = '';
    let waypointsForHtml: {lat: number, lng: number, popup: string, situacion?: string, isService?: boolean}[] = [];
    
    if (worksheet.type === 'luminaria') {
        waypointsForHtml = (worksheet as LuminariaWorksheet).failures
            .filter(f => f.event.lat && f.event.lon)
            .map((f, index) => {
                const popupContent = `<b>Punto #${index + 1}</b><br><b>ID Luminaire:</b> ${f.event.id}<br><b>ID OLC:</b> ${f.event.olcHardwareDir || 'N/A'}<br><b>Potencia:</b> ${f.potencia || 'N/A'}<br><b>Situación:</b> ${f.situacion || 'N/A'}`;
                return {
                    lat: f.event.lat!,
                    lng: f.event.lon!,
                    popup: popupContent,
                    situacion: f.situacion || '',
                    isService: false
                };
            });
    } else {
         const cabinetWorksheet = worksheet as CabinetWorksheet;
         if (cabinetWorksheet.servicePoint.lat && cabinetWorksheet.servicePoint.lon) {
            waypointsForHtml.push({
                lat: cabinetWorksheet.servicePoint.lat,
                lng: cabinetWorksheet.servicePoint.lon,
                popup: `<b>Num_Cuenta:</b> ${cabinetWorksheet.servicePoint.nroCuenta}`,
                situacion: '',
                isService: true
            });
         }
         // Add luminaires for board routes as well. For P3, use the chunked events.
         const eventsToMap = cabinetWorksheet.type === 'cabinet_acumulacion' && cabinetWorksheet.originalEvents
            ? cabinetWorksheet.originalEvents
            : cabinetWorksheet.luminaires;

         eventsToMap
            .filter(lum => lum.lat && lum.lon)
            .forEach((lum, index) => {
                const isLuminaireEvent = (item: LuminaireEvent | InventoryItem): item is LuminaireEvent => 'uniqueEventId' in item;
                const lumId = isLuminaireEvent(lum) ? lum.id : lum.streetlightIdExterno;
                const lumSituacion = isLuminaireEvent(lum) ? lum.situacion : lum.situacion;
                const popupContent = `<b>Luminaria Tablero:</b> ${lumId}<br><b>Situación:</b> ${lumSituacion || 'N/A'}`;
                waypointsForHtml.push({
                    lat: lum.lat!,
                    lng: lum.lon!,
                    popup: popupContent,
                    situacion: lumSituacion || '',
                    isService: false
                });
            });
    }
    
    if (waypointsForHtml.length > 0) {
        // Modified: Removed L.Routing.control to not draw the polyline.
        // The map will still display the markers.
        const routeInstructions = ''; 

        mapScript = `
            <script>
                var map = L.map('map').setView([${waypointsForHtml[0].lat}, ${waypointsForHtml[0].lng}], 13);
                L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                    attribution: '&copy; OpenStreetMap contributors'
                }).addTo(map);

                var waypoints = ${JSON.stringify(waypointsForHtml)};
                var specialSituations = ["COLUMNA CAIDA", "HURTO", "VANDALIZADO", "FALTA PODA", "FALTA LINEA", "SIN ENERGÍA", "RETIRADA", "SIN OLC", "RETIRADA POR OBRA"];
                var bounds = [];

                waypoints.forEach(function(wp, index) {
                    var iconHtml;
                    var className = 'custom-numbered-marker';
                    var iconSize = [25, 25];
                    var anchor = [12, 12];

                    if (wp.isService) {
                         // Red T inside a square
                         iconHtml = '<div style="background-color: white; color: red; border: 2px solid red; border-radius: 4px; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; font-weight: bold; font-family: sans-serif; font-size: 16px; box-shadow: 0 2px 4px rgba(0,0,0,0.3);">T</div>';
                         iconSize = [30, 30];
                         anchor = [15, 15];
                         className = 'custom-cabinet-marker';
                    } else {
                        var isSpecial = specialSituations.includes((wp.situacion || '').toUpperCase());
                        var bgColor = isSpecial ? '#1f2937' : '${worksheet.color}';
                        var label = index + 1;
                        // Adjust label if we are in a cabinet worksheet where the first point might be a service point (index 0)
                        if ('${worksheet.type}' !== 'luminaria') {
                             label = index; // Service is 0, first luminaire is 1
                        }
                        
                        iconHtml = '<span style="--marker-bg-color:' + bgColor + ';">' + label + '</span>';
                    }
                    
                    var customIcon = L.divIcon({
                        html: iconHtml,
                        className: className,
                        iconSize: iconSize,
                        iconAnchor: anchor
                    });
                    
                    var marker = L.marker([wp.lat, wp.lng], { icon: customIcon }).addTo(map).bindPopup(wp.popup);
                    bounds.push([wp.lat, wp.lng]);
                });

                if (bounds.length > 0) {
                    map.fitBounds(bounds, { padding: [50, 50] });
                }
                ${routeInstructions}
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
            <link rel="stylesheet" href="https://unpkg.com/leaflet-routing-machine@3.2.12/dist/leaflet-routing-machine.js"></script>
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
                /* Estilos para el marcador circular personalizado sin el pin predeterminado */
                .custom-numbered-marker {
                    background-image: none !important;
                    background-color: transparent !important;
                    border: none !important;
                    box-shadow: none !important;
                    padding: 0 !important;
                    margin: 0 !important;
                    width: 25px !important; /* Fixed width */
                    height: 25px !important; /* Fixed height */
                    display: flex; /* Flexbox for centering content */
                    align-items: center;
                    justify-content: center;
                    z-index: 600;
                }
                .custom-numbered-marker > span {
                    background-color: var(--marker-bg-color, #2563eb); /* Default blue */
                    color: white;
                    border-radius: 50%;
                    width: 25px; /* Size of the inner circle */
                    height: 25px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-weight: bold;
                    border: 2px solid white;
                    box-shadow: 0 0 5px rgba(0,0,0,0.5);
                    font-size: 12px; /* Adjust font size if needed */
                    line-height: 1;
                    box-sizing: border-box;
                }
                /* Cabinet Marker Style */
                .custom-cabinet-marker {
                    background-image: none !important;
                    background-color: transparent !important;
                    border: none !important;
                    box-shadow: none !important;
                    padding: 0 !important;
                    margin: 0 !important;
                    z-index: 610; /* Slightly higher than regular markers */
                }
                /* Agresivo para eliminar el pin de Leaflet */
                .leaflet-marker-icon.leaflet-zoom-animated.leaflet-interactive {
                    background-image: none !important;
                }
                .leaflet-marker-shadow {
                    display: none !important;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <h2>${title}</h2>
                <div class="worksheet-table-content">${tableHtml}</div>
                ${waypointsForHtml.length > 0 ? '<h4>Mapa de ubicación</h4><div id="map"></div>' : ''}
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

// --- Haversine Distance (more accurate for geographical coordinates) ---
const getHaversineDistance = (p1: {lat: number, lon: number}, p2: {lat: number, lon: number}): number => {
    // Convert degrees to radians
    const toRadians = (deg: number) => deg * Math.PI / 180;
    const R = 6371e3; // metres
    const φ1 = toRadians(p1.lat);
    const φ2 = toRadians(p2.lat);
    const Δφ = toRadians(p2.lat - p1.lat);
    const Δλ = toRadians(p2.lon - p1.lon);

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distance in meters
};

// --- OSRM Routing Helper ---
interface OSRMRouteSummary {
    totalDistance: number; // meters
    totalTime: number;    // seconds
    htmlInstructions: string;
}

const fetchRoutePolyline = async (waypoints: L.LatLng[]): Promise<{ polyline: string, summary: OSRMRouteSummary | null }> => {
    // NOTE: This function will still fetch the polyline data and summary,
    // but the `getHtmlContentForWorksheet` and map components will choose not to draw it.
    // This allows the route *summary* (distance/time) to still be available.
    if (waypoints.length < 2) return { polyline: '', summary: null };

    const coords = waypoints.map(w => `${w.lng},${w.lat}`).join(';');
    // FIX: Using a more robust OSRM demo server URL.
    const url = `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&alternatives=false&steps=true`;

    try {
        const response = await fetch(url);
        if (!response.ok) {
            // FIX: Log detailed error from OSRM response if available.
            const errorBody = await response.text();
            console.error(`OSRM HTTP Error: ${response.status} ${response.statusText}. Body: ${errorBody}`);
            // Fallback to empty polyline on HTTP error.
            return { polyline: '', summary: null };
        }
        const data = await response.json();
        if (data.routes && data.routes.length > 0) {
            const route = data.routes[0];
            
            // Defensive check for route.distance and route.duration
            const distanceKm = route.distance !== undefined && route.distance !== null ? (route.distance / 1000).toFixed(1) : 'N/A';
            const durationMin = route.duration !== undefined && route.duration !== null ? (route.duration / 60).toFixed(0) : 'N/A';

            const routeSummary: OSRMRouteSummary = {
                totalDistance: route.distance, 
                totalTime: route.duration,     
                htmlInstructions: route.legs.map((leg: any) => {
                    const legDistanceKm = leg.distance !== undefined && leg.distance !== null ? (leg.distance / 1000).toFixed(1) : 'N/A';
                    const legDurationMin = leg.duration !== undefined && leg.duration !== null ? (leg.duration / 60).toFixed(0) : 'N/A';
                    return `<li>Distancia: ${legDistanceKm} km, Duración: ${legDurationMin} min</li>`;
                }).join(''),
            };

            // Generate HTML for summary
            const summaryHtml = `
                <p><strong>Distancia Total:</strong> ${distanceKm} km</p>
                <p><strong>Tiempo Estimado:</strong> ${durationMin} minutos</p>
                <!-- <ul style="list-style-type: disc; margin-left: 20px;">${routeSummary.htmlInstructions}</ul> -->
            `;

            return { polyline: route.geometry, summary: { ...routeSummary, htmlInstructions: summaryHtml } };
        }
        // If no routes found, but request was OK
        return { polyline: '', summary: null };
    } catch (error) {
        console.error("Error fetching OSRM route:", error);
        // Ensure to return a consistent type on any fetch error
        return { polyline: '', summary: null };
    }
};

// --- Route Optimization: Nearest Neighbor Heuristic ---
const optimizeRouteNearestNeighbor = (events: LuminaireEvent[], startEvent: LuminaireEvent): LuminaireEvent[] => {
    const route: LuminaireEvent[] = [startEvent];
    const unvisited = new Set(events.filter(e => e.uniqueEventId !== startEvent.uniqueEventId));

    let currentEvent = startEvent;

    while (unvisited.size > 0) {
        let nearest: LuminaireEvent | null = null;
        let minDistance = Infinity;

        for (const event of unvisited) {
            if (currentEvent.lat && currentEvent.lon && event.lat && event.lon) {
                const distance = getHaversineDistance(
                    { lat: currentEvent.lat, lon: currentEvent.lon },
                    { lat: event.lat, lon: event.lon }
                );
                if (distance < minDistance) {
                    minDistance = distance;
                    nearest = event;
                }
            }
        }

        if (nearest) {
            route.push(nearest);
            unvisited.delete(nearest);
            currentEvent = nearest;
        } else {
            // Should not happen if all events have valid coords, but as a fallback
            // add remaining unvisited if no nearest found (e.g., isolated event)
            const remaining = Array.from(unvisited);
            route.push(...remaining);
            remaining.forEach(e => unvisited.delete(e)); // Clear remaining
        }
    }
    return route;
};

// --- Depot Assignment ---
const findNearestDepot = (coords: { lat: number, lon: number }, zoneBases: ZoneBase[], eventZone?: string, eventMunicipio?: string): ZoneBase | undefined => {
    if (eventZone) {
        const exactZoneDepot = zoneBases.find(zb => zb.zoneName === eventZone);
        if (exactZoneDepot) return exactZoneDepot;
    }
    if (eventMunicipio) {
        // Reverse map from normalized municipio name to ALCID if possible, or directly use municipio.
        const mappedZone = MUNICIPIO_TO_ZONE_MAP[eventMunicipio.toUpperCase()];
        if (mappedZone) {
            const mappedZoneDepot = zoneBases.find(zb => zb.zoneName === mappedZone);
            if (mappedZoneDepot) return mappedZoneDepot;
        }
    }

    if (!coords.lat || !coords.lon) return undefined; // Cannot find if no valid coords

    let nearestDepot: ZoneBase | undefined = undefined;
    let minDistance = Infinity;

    for (const depot of zoneBases) {
        const distance = getHaversineDistance(coords, { lat: depot.lat, lon: depot.lon });
        if (distance < minDistance) {
            minDistance = distance;
            nearestDepot = depot;
        }
    }
    return nearestDepot;
};


const generateWorksheetTitle = (priority: RoutePriority, zone: string, municipio: string | undefined, nroCuenta: string | undefined, situation: string | undefined, partIndex: number | undefined, dateStr: string): string => {
    let titleParts: string[] = [];
    let priorityName = '';
    let accountInfo = '';
    let partInfo = '';

    switch (priority) {
        case 'P1': priorityName = 'POSIBLE FALLA EN TABLERO'; accountInfo = nroCuenta ? `(Servicio ${nroCuenta})` : ''; break;
        case 'P1.5': priorityName = 'POSIBLE FALLA DE RAMAL/FASE'; accountInfo = nroCuenta ? `(Servicio ${nroCuenta})` : ''; partInfo = partIndex ? `- Parte ${partIndex}` : ''; break;
        case 'P2': priorityName = 'EVENTO DE VOLTAJE'; accountInfo = nroCuenta ? `(Servicio ${nroCuenta})` : ''; partInfo = partIndex ? `- Parte ${partIndex}` : ''; break;
        case 'P3': priorityName = 'ACUMULACION DE FALLAS'; accountInfo = nroCuenta ? `(Servicio ${nroCuenta})` : ''; partInfo = partIndex ? `- Parte ${partIndex}` : ''; break;
        case 'Regular': priorityName = situation ? normalizeString(situation).toUpperCase() : 'REGULAR'; break; // 'VANDALISMO', 'FALTA PODA' etc.
    }
    
    // FIX: Removing "HR " prefix here to avoid regex parsing issues later. It will be added in the final loop.
    titleParts.push(`${priorityName}`); 
    if (zone && zone !== 'Desconocida') titleParts.push(zone);
    if (municipio && municipio !== 'Desconocida') titleParts.push(municipio);
    titleParts.push(dateStr);
    if (accountInfo) titleParts.push(accountInfo);
    if (partInfo) titleParts.push(partInfo);

    return titleParts.filter(Boolean).join(' ').trim();
};

// FIX: Defined the MantenimientoTabProps interface.
interface MantenimientoTabProps {
    allEvents: LuminaireEvent[];
    inventory: InventoryItem[];
    zoneBases: ZoneBase[];
    zones: string[];
    cabinetFailureAnalysisData: {
        name: string;
        count: number;
        accounts: string[];
    }[];
    servicePoints: ServicePoint[];
}

// --- Queue for OSRM requests to limit concurrency ---
interface RouteTaskData {
    waypoints: L.LatLng[];
    type: 'cabinet' | 'luminaria';
    metadata: any; // To store all other info needed to construct WorksheetData later
}

interface RouteTaskResult {
    polyline: string;
    summary: OSRMRouteSummary | null;
}

class RouteRequestQueue {
    private concurrency: number;
    private running: number = 0;
    private queue: Array<{ waypoints: L.LatLng[]; resolve: (value: RouteTaskResult) => void; reject: (reason?: any) => void; }> = [];

    constructor(concurrency: number) {
        this.concurrency = concurrency;
    }

    private async processNext() {
        if (this.running < this.concurrency && this.queue.length > 0) {
            this.running++;
            const { waypoints, resolve, reject } = this.queue.shift()!;
            try {
                const result = await fetchRoutePolyline(waypoints);
                resolve(result);
            } catch (error) {
                console.error("Error processing route in queue:", error);
                reject(error);
            } finally {
                this.running--;
                this.processNext();
            }
        }
    }

    addRequest(waypoints: L.LatLng[]): Promise<RouteTaskResult> {
        return new Promise((resolve, reject) => {
            this.queue.push({ waypoints, resolve, reject });
            this.processNext();
        });
    }

    // Call this if you need to wait for all currently added requests to finish
    async drainQueue(): Promise<void> {
        while (this.queue.length > 0 || this.running > 0) {
            await new Promise(resolve => setTimeout(resolve, 100)); // Small delay
        }
    }
}

const OSRM_CONCURRENCY_LIMIT = 5; // Limit to 5 concurrent OSRM requests
const routeQueue = new RouteRequestQueue(OSRM_CONCURRENCY_LIMIT);


const RutasTab: React.FC<MantenimientoTabProps> = ({ allEvents, inventory, zoneBases, zones, cabinetFailureAnalysisData, servicePoints }) => {
    const [selectedZone, setSelectedZone] = useState<string>('');
    const [worksheets, setWorksheets] = useState<WorksheetData[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [message, setMessage] = useState<string | null>('Seleccione una zona y genere las hojas de ruta para ver los resultados.');
    
    // Summaries for display
    const [generationSummary, setGenerationSummary] = useState<{ total: number; byZone: Record<string, number>; boardRoutes: number; regularRoutes: number } | null>(null);
    const [situationSummary, setSituationSummary] = useState<Record<string, number> | null>(null);

    const servicePointMap = useMemo(() => {
        return new Map<string, ServicePoint>(servicePoints.map(sp => [sp.nroCuenta, sp]));
    }, [servicePoints]);
    
    const inventoryMap = useMemo(() => new Map<string, InventoryItem>(inventory.map(item => [item.streetlightIdExterno, item])), [inventory]);

    // Augment allEvents with nroCuenta from inventory for easier grouping
    const augmentedAllEvents = useMemo(() => {
        return allEvents.map(event => {
            const invItem = inventoryMap.get(event.id);
            return {
                ...event,
                nroCuenta: event.nroCuenta || invItem?.nroCuenta,
                zone: event.zone || invItem?.zone || (event.municipio ? (MUNICIPIO_TO_ZONE_MAP[event.municipio.toUpperCase()] || 'Desconocida') : 'Desconocida'),
                municipio: event.municipio || invItem?.municipio || 'Desconocido',
            };
        });
    }, [allEvents, inventoryMap]);


    const handleGenerateWorksheets = useCallback(async () => {
        if (!selectedZone) {
            setMessage("Error: Por favor, seleccione una zona.");
            return;
        }
        
        setIsLoading(true);
        setWorksheets([]);
        setMessage('Procesando fallas y generando hojas de ruta...');
        setGenerationSummary(null);
        setSituationSummary(null);

        const dateStr = format(new Date(), 'dd-MM-yyyy');
        const eventsInSelectedZone = augmentedAllEvents.filter(e => e.zone === selectedZone && e.status === 'FAILURE' && e.lat && e.lon);

        const routeTasks: {
            waypoints: L.LatLng[];
            type: 'cabinet' | 'luminaria';
            metadata: any; // Stores everything needed to build the worksheet later
        }[] = [];
        const processedLuminaires = new Set<string>(); // Stores streetlightIdExterno


        // --- 1. Detección y Priorización de Rutas de Tablero (Eventos Masivos) ---
        const eventsByNroCuenta = eventsInSelectedZone.reduce((acc, event) => {
            if (event.nroCuenta && event.nroCuenta !== '-') {
                if (!acc.has(event.nroCuenta)) acc.set(event.nroCuenta, []);
                acc.get(event.nroCuenta)!.push(event);
            }
            return acc;
        }, new Map<string, LuminaireEvent[]>());

        for (const [nroCuenta, eventsGroup] of eventsByNroCuenta.entries()) {
            const inaccessibleEvents = eventsGroup.filter(e => e.failureCategory === 'Inaccesible');
            const voltageEvents = eventsGroup.filter(e => VOLTAGE_MESSAGE_SUBSTRINGS.some(s => e.description.toLowerCase().includes(s)));
            
            let priority: RoutePriority | null = null;
            let type: CabinetWorksheet['type'] | null = null;
            let chunkLimit = MAX_EVENTS_PER_ROUTE; // Default chunk limit for P1.5, P2, P3

            // Prioridad 1: "Posible falla en Tablero" (Máxima Prioridad)
            if (inaccessibleEvents.length >= 10) {
                priority = 'P1';
                type = 'cabinet_falla_total';
                chunkLimit = eventsGroup.length; // No chunking for P1
            } 
            // Prioridad 1.5: "POSIBLE FALLA DE RAMAL/FASE"
            else if (inaccessibleEvents.length >= 5 && inaccessibleEvents.length <= 9) {
                // Check geographical proximity
                const areClose = inaccessibleEvents.every((e1, i, arr) => 
                    arr.every(e2 => (e1.lat && e1.lon && e2.lat && e2.lon) ? getHaversineDistance({lat: e1.lat!, lon: e1.lon!}, {lat: e2.lat!, lon: e2.lon!}) <= CABINET_PROXIMITY_THRESHOLD_METERS : false)
                );
                if (areClose) {
                    priority = 'P1.5';
                    type = 'cabinet_falla_parcial';
                }
            }
            // Prioridad 2: "Evento de Voltaje"
            else if (voltageEvents.length >= 10) {
                priority = 'P2';
                type = 'cabinet_voltaje';
            }
            // Prioridad 3: "Acumulación de fallas en un circuito"
            else if (eventsGroup.length >= 10) {
                priority = 'P3';
                type = 'cabinet_acumulacion';
                chunkLimit = MAX_EVENTS_FOR_PRIORITY3_CHUNK;
            }

            if (priority && type) {
                const servicePoint = servicePointMap.get(nroCuenta);
                if (!servicePoint) {
                    console.warn(`Skipping cabinet route for nroCuenta ${nroCuenta}: service point not found.`);
                    continue;
                }

                const associatedLuminaires = inventory.filter(item => item.nroCuenta === nroCuenta);
                const totalLuminariasInAccount = associatedLuminaires.length;
                
                const inaccessibleCount = new Set(inaccessibleEvents.map(e => e.id)).size;
                const percentage = totalLuminariasInAccount > 0 ? (inaccessibleCount / totalLuminariasInAccount) * 100 : 0;
                
                const municipioName = servicePoint.alcid && ALCID_TO_MUNICIPIO_MAP[servicePoint.alcid] 
                    ? ALCID_TO_MUNICIPIO_MAP[servicePoint.alcid].toUpperCase()
                    : (servicePoint.municipio ? servicePoint.municipio.toUpperCase() : 'DESCONOCIDO');

                const depot = findNearestDepot({lat: servicePoint.lat, lon: servicePoint.lon}, zoneBases, selectedZone, municipioName);
                
                const chunks: LuminaireEvent[][] = [];
                if (priority === 'P1') {
                    chunks.push(eventsGroup); // No chunking for Priority 1
                } else {
                    let remainingEventsInChunk = [...eventsGroup];
                    while(remainingEventsInChunk.length > 0) {
                        const start = remainingEventsInChunk.shift()!;
                        const optimizedChunk = optimizeRouteNearestNeighbor(remainingEventsInChunk, start).slice(0, chunkLimit);
                        // FIX: Logic correction. optimizeRouteNearestNeighbor returns the route starting with startEvent.
                        // We do NOT need to unshift startEvent again.
                        chunks.push(optimizedChunk); 
                        remainingEventsInChunk = remainingEventsInChunk.filter(e => !optimizedChunk.includes(e) && e.uniqueEventId !== start.uniqueEventId);
                    }
                }

                for (let i = 0; i < chunks.length; i++) {
                    const chunk = chunks[i];
                    if (chunk.length === 0) continue;

                    const chunkWaypoints = chunk.filter(e => e.lat && e.lon).map(e => L.latLng(e.lat!, e.lon!));
                    if (chunkWaypoints.length < 2) { // Need at least 2 points for a route, or 1 for just a marker
                        console.warn(`Skipping OSRM request for cabinet chunk (too few waypoints): ${nroCuenta}, chunk ${i+1}`);
                         // Add a task even for single points, but without OSRM route request
                        routeTasks.push({
                            waypoints: chunkWaypoints,
                            type: 'cabinet',
                            metadata: {
                                // Keep this as an internal ID, the final worksheet ID will be globalUniqueWorksheetCounter
                                internalId: `board-${nroCuenta}-${priority}-${i+1}`, 
                                title: generateWorksheetTitle(priority, selectedZone, municipioName, nroCuenta, undefined, chunks.length > 1 ? i + 1 : undefined, dateStr),
                                municipio: municipioName,
                                type: type,
                                priority: priority,
                                color: PRIORITY_COLORS[priority],
                                servicePoint: { ...servicePoint, cantidadLuminarias: totalLuminariasInAccount },
                                luminaires: associatedLuminaires,
                                inaccessiblePercentage: percentage,
                                inaccessibleCount: inaccessibleCount,
                                totalLuminariasInAccount: totalLuminariasInAccount,
                                originalEvents: chunk, // Store original chunk for P3 processing
                                startDepot: depot,
                                endDepot: depot,
                                polyline: '', // No polyline
                                summary: null, // No summary
                            }
                        });
                        chunk.forEach(e => processedLuminaires.add(e.id));
                        continue;
                    }

                    routeTasks.push({
                        waypoints: chunkWaypoints,
                        type: 'cabinet',
                        metadata: {
                            internalId: `board-${nroCuenta}-${priority}-${i+1}`,
                            title: generateWorksheetTitle(priority, selectedZone, municipioName, nroCuenta, undefined, chunks.length > 1 ? i + 1 : undefined, dateStr),
                            municipio: municipioName,
                            type: type,
                            priority: priority,
                            color: PRIORITY_COLORS[priority],
                            servicePoint: { ...servicePoint, cantidadLuminarias: totalLuminariasInAccount },
                            luminaires: associatedLuminaires,
                            inaccessiblePercentage: percentage,
                            inaccessibleCount: inaccessibleCount,
                            totalLuminariasInAccount: totalLuminariasInAccount,
                            originalEvents: chunk, // Store original chunk for P3 processing
                            startDepot: depot,
                            endDepot: depot,
                        }
                    });
                    chunk.forEach(e => processedLuminaires.add(e.id));
                }
            }
        }

        // --- 2. Generación de Rutas Regulares (Eventos Individuales) ---
        const individualFailures = eventsInSelectedZone.filter(e =>
            !processedLuminaires.has(e.id) // Exclude already processed luminaires
        ).sort((a, b) => a.date.getTime() - b.date.getTime()); // Sort by oldest first

        // CHANGE: Group failures primarily by Situation, disregarding municipality boundaries within the Zone.
        const failuresBySituation = individualFailures.reduce((acc, event) => {
            const situation = REGULAR_ROUTE_SITUATIONS.find(s => normalizeString(event.situacion || '').includes(s)) || 'Regular';
            if (!acc.has(situation)) acc.set(situation, []);
            acc.get(situation)!.push(event);
            return acc;
        }, new Map<string, LuminaireEvent[]>());

        const MAX_REGULAR_EVENTS_LIMIT = 10; // User requested limit for regular routes (8-10)

        for (const [situation, events] of failuresBySituation.entries()) {
            let remainingEvents = [...events];
            let partIndex = 1;

            while(remainingEvents.length > 0) {
                const startEvent = remainingEvents.shift()!; // Start with the oldest available event
                
                let chunk: LuminaireEvent[];
                const tolerance = 2; // Smaller tolerance for smaller chunks
                
                if (remainingEvents.length + 1 <= MAX_REGULAR_EVENTS_LIMIT + tolerance) {
                    // Take all remaining
                    const allRemaining = optimizeRouteNearestNeighbor(remainingEvents, startEvent);
                    chunk = allRemaining;
                    remainingEvents = []; // Consumed all
                } else {
                    // Take standard chunk
                    chunk = optimizeRouteNearestNeighbor(remainingEvents, startEvent).slice(0, MAX_REGULAR_EVENTS_LIMIT);
                    // Filter out used events from remainingEvents
                    const chunkIds = new Set(chunk.map(c => c.uniqueEventId));
                    remainingEvents = remainingEvents.filter(e => !chunkIds.has(e.uniqueEventId));
                }

                if (chunk.length === 0) continue;

                // Determine municipality label for the worksheet
                // Since points are grouped by situation across the whole zone, we label it "VARIOS" or similar
                const municipiosInChunk = Array.from(new Set(chunk.map(e => e.municipio).filter(Boolean)));
                const municipioLabel = municipiosInChunk.length === 1 ? municipiosInChunk[0] : "VARIOS";

                const chunkWaypoints = chunk.filter(e => e.lat && e.lon).map(e => L.latLng(e.lat!, e.lon!));
                
                // Find depot nearest to the first point in the chunk, using the selected Zone
                const startDepot = findNearestDepot({lat: chunk[0].lat!, lon: chunk[0].lon!}, zoneBases, selectedZone);

                if (chunkWaypoints.length < 2) {
                    console.warn(`Skipping OSRM request for regular route chunk (too few waypoints): ${municipioLabel}, situation ${situation}, chunk ${partIndex}`);
                    routeTasks.push({
                        waypoints: chunkWaypoints,
                        type: 'luminaria',
                        metadata: {
                            title: generateWorksheetTitle('Regular', selectedZone, municipioLabel, undefined, situation, undefined, dateStr) + (partIndex > 1 ? ` - Parte ${partIndex}` : ''),
                            municipio: municipioLabel,
                            type: 'luminaria',
                            priority: 'Regular',
                            color: PRIORITY_COLORS['Regular'],
                            failures: chunk.map((event, index) => {
                                const inventoryItem = inventoryMap.get(event.id);
                                const { action, solution } = getActionAndSolution(event);
                                const olcCode = inventoryItem?.olcHardwareDir || event.olcHardwareDir || 'N/A';
                                return {
                                    index: index + 1,
                                    idLuminariaOlc: `${event.id}\n${olcCode}`,
                                    idGabinete: inventoryItem?.cabinetIdExterno,
                                    potencia: event.power ? `${event.power} W` : undefined,
                                    fechaReporte: format(event.date, 'dd/MM/yy HH:mm'),
                                    categoria: event.failureCategory,
                                    situacion: event.situacion,
                                    mensajeDeError: event.description,
                                    accion: action,
                                    posibleSolucion: solution,
                                    event: event,
                                };
                            }),
                            totalFailuresInZone: individualFailures.length,
                            startDepot: startDepot,
                            endDepot: startDepot,
                            polyline: '', // No polyline
                            summary: null, // No summary
                        }
                    });
                    chunk.forEach(e => processedLuminaires.add(e.id));
                    partIndex++;
                    continue;
                }

                routeTasks.push({
                    waypoints: chunkWaypoints,
                    type: 'luminaria',
                    metadata: {
                        title: generateWorksheetTitle('Regular', selectedZone, municipioLabel, undefined, situation, undefined, dateStr) + (partIndex > 1 ? ` - Parte ${partIndex}` : ''),
                        municipio: municipioLabel,
                        type: 'luminaria',
                        priority: 'Regular',
                        color: PRIORITY_COLORS['Regular'],
                        failures: chunk.map((event, index) => {
                            const inventoryItem = inventoryMap.get(event.id);
                            const { action, solution } = getActionAndSolution(event);
                            const olcCode = inventoryItem?.olcHardwareDir || event.olcHardwareDir || 'N/A';
                            return {
                                index: index + 1,
                                idLuminariaOlc: `${event.id}\n${olcCode}`,
                                idGabinete: inventoryItem?.cabinetIdExterno,
                                potencia: event.power ? `${event.power} W` : undefined,
                                fechaReporte: format(event.date, 'dd/MM/yy HH:mm'),
                                categoria: event.failureCategory,
                                situacion: event.situacion,
                                mensajeDeError: event.description,
                                accion: action,
                                posibleSolucion: solution,
                                event: event,
                            };
                        }),
                        totalFailuresInZone: individualFailures.length,
                        startDepot: startDepot,
                        endDepot: startDepot,
                    }
                });
                chunk.forEach(e => processedLuminaires.add(e.id));
                partIndex++;
            }
        }

        // --- Execute all OSRM requests through the queue ---
        setMessage(`Calculando ${routeTasks.length} rutas (esto puede tomar varios minutos si hay muchas)...`);
        const routeResults = await Promise.all(routeTasks.map(task => routeQueue.addRequest(task.waypoints)));
        
        const generatedWorksheets: WorksheetData[] = [];
        let globalUniqueWorksheetCounter = 0; // Global counter for unique IDs


        // --- Construct WorksheetData objects using fetched route results ---
        routeTasks.forEach((task, index) => {
            const routeResult = routeResults[index];
            if (task.type === 'cabinet') {
                const metadata = task.metadata;

                // Prepare accumulationFailures for P3 type
                let accumulationFailures: WorksheetRow[] | undefined = undefined;
                if (metadata.type === 'cabinet_acumulacion' && metadata.originalEvents && metadata.originalEvents.length > 0) {
                    accumulationFailures = metadata.originalEvents.map((event: LuminaireEvent, idx: number) => {
                        const inventoryItem = inventoryMap.get(event.id);
                        const { action, solution } = getActionAndSolution(event);
                        
                        // FIX: Robust check for OLC code in cabinet failures
                        const olcCode = inventoryItem?.olcHardwareDir || event.olcHardwareDir || 'N/A';

                        return {
                            index: idx + 1,
                            idLuminariaOlc: `${event.id}\n${olcCode}`,
                            idGabinete: inventoryItem?.cabinetIdExterno,
                            potencia: event.power ? `${event.power} W` : undefined,
                            fechaReporte: format(event.date, 'dd/MM/yy HH:mm'),
                            categoria: event.failureCategory,
                            situacion: event.situacion,
                            mensajeDeError: event.description,
                            accion: action,
                            posibleSolucion: solution,
                            event: event,
                        };
                    });
                }


                generatedWorksheets.push({
                    id: `hr-${globalUniqueWorksheetCounter++}`, // Assign globally unique ID
                    title: metadata.title,
                    municipio: metadata.municipio,
                    type: metadata.type,
                    priority: metadata.priority,
                    color: metadata.color,
                    servicePoint: metadata.servicePoint,
                    luminaires: metadata.luminaires,
                    accumulationFailures: accumulationFailures, // Add accumulation failures for P3
                    inaccessiblePercentage: metadata.inaccessiblePercentage,
                    inaccessibleCount: metadata.inaccessibleCount,
                    totalLuminariasInAccount: metadata.totalLuminariasInAccount,
                    originalEvents: metadata.originalEvents,
                    routePolyline: routeResult.polyline,
                    routeDuration: routeResult.summary?.totalTime,
                    routeDistance: routeResult.summary?.totalDistance,
                    routeSummaryHtml: routeResult.summary?.htmlInstructions,
                    startDepot: metadata.startDepot,
                    endDepot: metadata.endDepot,
                } as CabinetWorksheet);
            } else { // type === 'luminaria'
                const metadata = task.metadata;
                generatedWorksheets.push({
                    id: `hr-${globalUniqueWorksheetCounter++}`, // Assign globally unique ID
                    title: metadata.title,
                    municipio: metadata.municipio,
                    type: 'luminaria',
                    priority: metadata.priority,
                    color: PRIORITY_COLORS['Regular'], // Set color for luminaria routes from PRIORITY_COLORS
                    failures: metadata.failures,
                    totalFailuresInZone: metadata.totalFailuresInZone,
                    routePolyline: routeResult.polyline,
                    routeDuration: routeResult.summary?.totalTime,
                    routeDistance: routeResult.summary?.totalDistance,
                    routeSummaryHtml: routeResult.summary?.htmlInstructions,
                    startDepot: metadata.startDepot,
                    endDepot: metadata.endDepot,
                } as LuminariaWorksheet);
            }
        });


        // --- 3. Consolidación y Ordenamiento Final ---
        const finalWorksheets = generatedWorksheets.sort((a, b) => {
            // 1. Sort by Zone Name (alphabetical based on ZONE_ORDER)
            const zoneOrderA = ZONE_ORDER.indexOf(selectedZone);
            const zoneOrderB = ZONE_ORDER.indexOf(selectedZone); // All are in the same selectedZone for now, but useful if we ever process multiple zones
            if (zoneOrderA !== zoneOrderB) return zoneOrderA - zoneOrderB;

            // 2. Sort by Priority (P1 first, then P1.5, P2, P3, Regular)
            const priorityOrder: Record<RoutePriority, number> = {
                'P1': 1, 'P1.5': 2, 'P2': 3, 'P3': 4, 'Regular': 5
            };
            const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
            if (priorityDiff !== 0) return priorityDiff;

            // 3. Sort by Worksheet Title (alphabetical)
            return a.title.localeCompare(b.title);
        });

        // Update worksheet numbers in the title after final sort
        // FIX: Simplified logic. Just prepend the number. No regex guessing.
        finalWorksheets.forEach((ws, idx) => {
            ws.title = `HR ${idx + 1} ${ws.title}`;
        });

        setWorksheets(finalWorksheets);
        setMessage(finalWorksheets.length > 0 ? `Se generaron ${finalWorksheets.length} hojas de ruta.` : 'No se encontraron fallas para generar hojas de ruta en la zona seleccionada.');
        setIsLoading(false);

        // --- Generar Resúmenes ---
        const summaryByZone: Record<string, number> = {};
        let totalBoardRoutes = 0;
        let totalRegularRoutes = 0;
        const situationCounts: Record<string, number> = {};

        finalWorksheets.forEach(ws => {
            const zone = selectedZone; // All worksheets are for the selected zone
            summaryByZone[zone] = (summaryByZone[zone] || 0) + 1;
            if (ws.type !== 'luminaria') { // Board routes are not 'luminaria' type
                totalBoardRoutes++;
            } else {
                totalRegularRoutes++;
                // Count situations for regular routes
                (ws as LuminariaWorksheet).failures.forEach(f => {
                    const normalizedSit = normalizeString(f.situacion || 'Regular');
                    const finalSit = REGULAR_ROUTE_SITUATIONS.find(s => normalizedSit.includes(s)) || 'Regular';
                    situationCounts[finalSit] = (situationCounts[finalSit] || 0) + 1;
                });
            }
        });

        setGenerationSummary({
            total: finalWorksheets.length,
            byZone: summaryByZone,
            boardRoutes: totalBoardRoutes,
            regularRoutes: totalRegularRoutes, // Corrected key to match user's request
        });
        setSituationSummary(situationCounts);

    }, [selectedZone, augmentedAllEvents, inventory, inventoryMap, servicePointMap, zoneBases, cabinetFailureAnalysisData]);

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

            {/* Resúmenes */}
            {generationSummary && (
                <div className="bg-gray-800 shadow-lg rounded-xl p-4 space-y-2">
                    <h3 className="text-xl font-bold text-cyan-400 mb-2">Resumen de Generación</h3>
                    <p className="text-gray-300">Total de Hojas de Ruta Generadas: <span className="font-semibold text-white">{generationSummary.total}</span></p>
                    <p className="text-gray-300">Rutas de Tablero (Eventos Masivos): <span className="font-semibold text-white">{generationSummary.boardRoutes}</span></p>
                    <p className="text-gray-300">Rutas Regulares (Eventos Individuales): <span className="font-semibold text-white">{generationSummary.regularRoutes}</span></p>
                    <p className="text-gray-300">Por Zona: 
                        {Object.entries(generationSummary.byZone).map(([zone, count]) => (
                            <span key={zone} className="ml-2 px-2 py-0.5 bg-gray-700 rounded-full text-xs font-semibold">{zone}: {count}</span>
                        ))}
                    </p>
                </div>
            )}
            {situationSummary && Object.keys(situationSummary).length > 0 && (
                <div className="bg-gray-800 shadow-lg rounded-xl p-4 space-y-2">
                    <h3 className="text-xl font-bold text-cyan-400 mb-2">Resumen de Eventos por Situación (Rutas Regulares)</h3>
                    <div className="flex flex-wrap gap-x-4 gap-y-2">
                        {Object.entries(situationSummary).map(([situation, count]) => (
                            <span key={situation} className="px-3 py-1 bg-gray-700 rounded-full text-sm text-gray-300">
                                {situation}: <span className="font-semibold text-white">{count}</span>
                            </span>
                        ))}
                    </div>
                </div>
            )}

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
