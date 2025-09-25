

// Helper to ensure values with commas, quotes, or newlines are handled correctly.
const escapeCsvValue = (value: any): string => {
    if (value == null) {
        return '';
    }
    const stringValue = String(value);
    // If the value contains a comma, a quote, or a newline, wrap it in double quotes
    if (stringValue.includes('"') || stringValue.includes(',') || stringValue.includes('\n')) {
        // Escape existing double quotes by doubling them
        return `"${stringValue.replace(/"/g, '""')}"`;
    }
    return stringValue;
};


export const exportToCsv = (data: any[], filename: string): void => {
    if (!Array.isArray(data) || data.length === 0) {
        console.error("Export to CSV failed: data is empty or not an array.");
        return;
    }
    
    const headers = Object.keys(data[0]);
    const csvRows = [headers.join(',')]; // Header row

    for (const row of data) {
        const values = headers.map(header => escapeCsvValue(row[header]));
        csvRows.push(values.join(','));
    }

    const csvString = csvRows.join('\n');
    // Add BOM for Excel to recognize UTF-8 characters correctly
    const blob = new Blob([`\uFEFF${csvString}`], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    
    // Clean up
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
};
