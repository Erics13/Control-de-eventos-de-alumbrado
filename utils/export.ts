
// This file requires the xlsx library to be loaded globally, e.g., from a CDN.
declare var XLSX: any;

/**
 * Exports an array of objects to an XLSX file.
 * @param data The array of data to export.
 * @param filename The name of the file to be downloaded.
 */
export const exportToXlsx = (data: any[], filename: string): void => {
    if (typeof XLSX === 'undefined') {
        console.error("XLSX library is not loaded. Please make sure it's included in your HTML.");
        alert("La función de exportación no está disponible. La librería XLSX no se pudo cargar.");
        return;
    }
    
    if (!Array.isArray(data) || data.length === 0) {
        console.warn("Export to XLSX aborted: data is empty or not an array.");
        return;
    }
    
    try {
        const worksheet = XLSX.utils.json_to_sheet(data);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Datos");
        
        // Trigger the download
        XLSX.writeFile(workbook, filename, { bookType: 'xlsx', type: 'binary' });
    } catch (error) {
        console.error("Error exporting to XLSX:", error);
        alert("Ocurrió un error al generar el archivo XLSX.");
    }
};

interface SheetData {
    sheetName: string;
    data: any[];
}

/**
 * Exports an array of sheet data objects to a multi-sheet XLSX file.
 * @param sheetsData The array of sheet data objects.
 * @param filename The name of the file to be downloaded.
 */
export const exportToXlsxMultiSheet = (sheetsData: SheetData[], filename: string): void => {
    if (typeof XLSX === 'undefined') {
        console.error("XLSX library is not loaded.");
        alert("La función de exportación no está disponible. La librería XLSX no se pudo cargar.");
        return;
    }

    if (!Array.isArray(sheetsData) || sheetsData.length === 0) {
        console.warn("Export to XLSX aborted: no sheet data provided.");
        return;
    }

    try {
        const workbook = XLSX.utils.book_new();
        
        sheetsData.forEach(sheetInfo => {
            if (Array.isArray(sheetInfo.data) && sheetInfo.data.length > 0) {
                const worksheet = XLSX.utils.json_to_sheet(sheetInfo.data);
                XLSX.utils.book_append_sheet(workbook, worksheet, sheetInfo.sheetName);
            } else {
                // Create an empty sheet with a message if no data
                const worksheet = XLSX.utils.json_to_sheet([{ "Mensaje": "No hay datos para mostrar con los filtros seleccionados." }]);
                XLSX.utils.book_append_sheet(workbook, worksheet, sheetInfo.sheetName);
            }
        });

        XLSX.writeFile(workbook, filename, { bookType: 'xlsx', type: 'binary' });
    } catch (error) {
        console.error("Error exporting to multi-sheet XLSX:", error);
        alert("Ocurrió un error al generar el archivo XLSX.");
    }
};