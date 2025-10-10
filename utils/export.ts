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
