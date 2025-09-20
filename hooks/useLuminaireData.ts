import { useState, useEffect, useCallback } from 'react';
import type { LuminaireEvent } from '../types';
import { MUNICIPIO_TO_ZONE_MAP, FAILURE_CATEGORY_TRANSLATIONS } from '../constants';

// This regex handles comma-separated values, including quoted fields that may contain commas.
const csvRegex = /("([^"]*)"|[^,]+)(,|$)/g;
const parseCsvRow = (row: string): string[] => {
    const columns: string[] = [];
    if (!row) return columns;
    // We need to handle the case where the regex is stateful.
    // By creating a new regex object, we ensure it's reset.
    const regex = new RegExp(csvRegex);
    let match;
    while ((match = regex.exec(row))) {
        // Use content of quotes if present (group 2), otherwise use the non-quoted value (group 1).
        let column = match[2] !== undefined ? match[2] : match[1];
        columns.push(column.trim());
        if (match[3] === '') break; // Reached end of the string
    }
    return columns;
};

const parseDate = (dateStr: string): Date | null => {
    // Expected format: "D/M/YY HH:mm", e.g., "4/4/25 18:15"
    if (!dateStr || !dateStr.includes('/')) return null;
    const parts = dateStr.split(' ');
    if (parts.length < 2) return null;
    
    const dateParts = parts[0].split('/');
    const timeParts = parts[1].split(':');
    
    if (dateParts.length < 3 || timeParts.length < 2) return null;
    
    const day = parseInt(dateParts[0], 10);
    const month = parseInt(dateParts[1], 10) - 1; // Month is 0-indexed in JS Date
    const year = parseInt(dateParts[2], 10) + 2000; // Assuming years like "25" are in the 21st century
    
    const hour = parseInt(timeParts[0], 10);
    const minute = parseInt(timeParts[1], 10);
    
    const date = new Date(year, month, day, hour, minute);
    return isNaN(date.getTime()) ? null : date;
};


export const useLuminaireData = () => {
    const [allEvents, setAllEvents] = useState<LuminaireEvent[]>([]);
    const [uploadedFileNames, setUploadedFileNames] = useState<string[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        setLoading(true);
        try {
            const storedData = localStorage.getItem('luminaireEvents');
            if (storedData) {
                const parsedData = JSON.parse(storedData).map((event: any) => ({
                    ...event,
                    date: new Date(event.date),
                }));
                setAllEvents(parsedData);
            }
            const storedFiles = localStorage.getItem('luminaireUploadedFiles');
            if(storedFiles) {
                setUploadedFileNames(JSON.parse(storedFiles));
            }
        } catch (e) {
            console.error("Failed to load data from localStorage", e);
            setError("No se pudieron cargar los datos guardados.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        try {
            localStorage.setItem('luminaireEvents', JSON.stringify(allEvents));
            localStorage.setItem('luminaireUploadedFiles', JSON.stringify(uploadedFileNames));
        } catch (e) {
            console.error("Failed to save data to localStorage", e);
            setError("No se pudieron guardar los datos nuevos.");
        }
    }, [allEvents, uploadedFileNames]);

    const addEventsFromCSV = (file: File) => {
        setLoading(true);
        setError(null);
        const reader = new FileReader();
        reader.onload = (e) => {
            const text = e.target?.result as string;
            if (!text) {
                setError("El archivo CSV está vacío o no se pudo leer.");
                setLoading(false);
                return;
            }

            try {
                const rows = text.split('\n').slice(1);
                const parsedEvents: LuminaireEvent[] = [];

                rows.forEach((row, index) => {
                    if (row.trim() === '') return;
                    
                    const columns = parseCsvRow(row);

                    if (columns.length < 14) {
                        console.warn(`Skipping malformed row ${index + 2}: not enough columns.`);
                        return;
                    }

                    const eventDate = parseDate(columns[13]?.trim());
                    if (!eventDate) {
                         console.warn(`Skipping row with invalid date ${index + 2}: ${columns[13]}`);
                         return;
                    }

                    const uniqueEventId = columns[11]?.trim();
                    if (!uniqueEventId) {
                        return; // Skip if event ID is missing
                    }
                    
                    const description = columns[12]?.trim() || '';
                    const situacion = columns[8]?.trim() || '';
                    const situacionLower = situacion.toLowerCase();

                    let isSpecialFailure = false;
                    let specialFailureCategory: string | undefined = undefined;

                    if (situacionLower === 'columna caida') {
                        isSpecialFailure = true;
                        specialFailureCategory = 'Columna Caída';
                    } else if (situacionLower === 'hurto') {
                        isSpecialFailure = true;
                        specialFailureCategory = 'Hurto';
                    } else if (situacionLower.startsWith('vandalizado')) {
                        isSpecialFailure = true;
                        specialFailureCategory = 'Vandalizado';
                    }

                    const category = columns[10]?.trim();
                    const translatedCategory = FAILURE_CATEGORY_TRANSLATIONS[category];
                    const isStandardFailure = !!translatedCategory;

                    const eventStatus = (category && category.length > 0) || isSpecialFailure ? 'FAILURE' : 'OPERATIONAL';
                    const finalFailureCategory = specialFailureCategory || (isStandardFailure ? translatedCategory : undefined);
                    
                    const municipio = columns[0]?.trim() || 'N/A';
                    const zone = MUNICIPIO_TO_ZONE_MAP[municipio.toUpperCase()] || 'Desconocida';
                    
                    const latStr = columns[5]?.trim().replace(',', '.');
                    const lonStr = columns[6]?.trim().replace(',', '.');
                    const lat = parseFloat(latStr);
                    const lon = parseFloat(lonStr);

                    const event: LuminaireEvent = {
                        uniqueEventId,
                        id: columns[4]?.trim(),
                        olcId: columns[3]?.trim(),
                        power: columns[2]?.trim(),
                        date: eventDate,
                        municipio,
                        zone,
                        status: eventStatus,
                        description: description,
                        failureCategory: finalFailureCategory,
                        lat: !isNaN(lat) ? lat : undefined,
                        lon: !isNaN(lon) ? lon : undefined,
                    };

                    parsedEvents.push(event);
                });
                
                setAllEvents(prevEvents => {
                    const existingEventIds = new Set(prevEvents.map(event => event.uniqueEventId));
                    const newUniqueEvents = parsedEvents.filter(event => !existingEventIds.has(event.uniqueEventId));
                    if(newUniqueEvents.length === 0) return prevEvents;
                    return [...prevEvents, ...newUniqueEvents].sort((a,b) => b.date.getTime() - a.date.getTime());
                });

                setUploadedFileNames(prevNames => {
                    if (prevNames.includes(file.name)) return prevNames;
                    return [...prevNames, file.name].sort();
                });

            } catch (parseError) {
                console.error("Error parsing CSV", parseError);
                setError("Error al procesar el archivo CSV. Verifique el formato.");
            } finally {
                setLoading(false);
            }
        };

        reader.onerror = () => {
            setError("No se pudo leer el archivo.");
            setLoading(false);
        };
        
        reader.readAsText(file);
    };

    const addEventsFromJSON = (file: File) => {
        setLoading(true);
        setError(null);
        const reader = new FileReader();
        reader.onload = (e) => {
            const text = e.target?.result as string;
            if (!text) {
                setError("El archivo JSON está vacío o no se pudo leer.");
                setLoading(false);
                return;
            }

            try {
                const parsedData = JSON.parse(text);

                let eventsToProcess: any[] = [];
                let filesToProcess: string[] = [];

                if (parsedData && typeof parsedData === 'object' && !Array.isArray(parsedData) && parsedData.events && parsedData.metadata) {
                    if (!Array.isArray(parsedData.events)) throw new Error("El campo 'events' en el JSON no es un array.");
                    eventsToProcess = parsedData.events;
                    if (Array.isArray(parsedData.metadata.fileNames)) {
                        filesToProcess = parsedData.metadata.fileNames;
                    }
                } else if (Array.isArray(parsedData)) {
                    eventsToProcess = parsedData; // Backward compatibility
                } else {
                     throw new Error("El formato del archivo JSON no es válido.");
                }
                
                const parsedEvents: LuminaireEvent[] = eventsToProcess
                    .filter(eventData => eventData.uniqueEventId && eventData.date && eventData.id)
                    .map((eventData: any) => ({
                        ...eventData,
                        date: new Date(eventData.date),
                    }));
                
                setAllEvents(prevEvents => {
                    const existingEventIds = new Set(prevEvents.map(event => event.uniqueEventId));
                    const newUniqueEvents = parsedEvents.filter(event => !existingEventIds.has(event.uniqueEventId));
                    if(newUniqueEvents.length === 0) return prevEvents;
                    return [...prevEvents, ...newUniqueEvents].sort((a, b) => b.date.getTime() - a.date.getTime());
                });

                setUploadedFileNames(prevNames => {
                    const combined = new Set([...prevNames, ...filesToProcess]);
                    return Array.from(combined).sort();
                });

            } catch (parseError: any) {
                console.error("Error parsing JSON", parseError);
                setError(`Error al procesar el archivo JSON: ${parseError.message}`);
            } finally {
                setLoading(false);
            }
        };

        reader.onerror = () => {
            setError("No se pudo leer el archivo.");
            setLoading(false);
        };
        
        reader.readAsText(file, 'UTF-8');
    };
    
    const downloadDataAsJSON = useCallback(() => {
        if (allEvents.length === 0) {
            alert("No hay datos para descargar.");
            return;
        }

        try {
            const dataToDownload = {
                metadata: {
                    exportDate: new Date().toISOString(),
                    fileCount: uploadedFileNames.length,
                    fileNames: uploadedFileNames,
                },
                events: allEvents,
            };

            const jsonString = JSON.stringify(dataToDownload, null, 2);
            const blob = new Blob([jsonString], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            const dateStr = new Date().toISOString().split('T')[0];
            a.download = `respaldo_alumbrado_${dateStr}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (downloadError) {
            console.error("Error creating download file", downloadError);
            setError("No se pudo crear el archivo de respaldo.");
        }
    }, [allEvents, uploadedFileNames]);

    const resetApplication = () => {
        console.log("Botón 'Reiniciar Aplicación' presionado. Iniciando proceso de borrado.");
        try {
            // Primero, se borran explícitamente los datos del almacenamiento para garantizar la persistencia.
            localStorage.removeItem('luminaireEvents');
            localStorage.removeItem('luminaireUploadedFiles');
            console.log("Paso 1: Datos eliminados de localStorage.");

            // Luego, se actualiza el estado de React para reflejar el cambio en la interfaz de usuario al instante.
            setAllEvents([]);
            setUploadedFileNames([]);
            console.log("Paso 2: Estado de React limpiado. La interfaz debería actualizarse.");
        } catch (e) {
             console.error("Fallo al intentar reiniciar la aplicación", e);
             setError("Error al intentar reiniciar la aplicación.");
        }
    };

    return { allEvents, uploadedFileNames, addEventsFromCSV, addEventsFromJSON, downloadDataAsJSON, resetApplication, loading, error };
};