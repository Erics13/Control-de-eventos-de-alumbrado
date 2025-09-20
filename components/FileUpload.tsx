
import React, { useState } from 'react';

interface FileUploadProps {
    onFileUpload: (file: File) => void;
    loading: boolean;
}

const FileUpload: React.FC<FileUploadProps> = ({ onFileUpload, loading }) => {
    const [fileName, setFileName] = useState<string | null>(null);

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            setFileName(file.name);
            onFileUpload(file);
            event.target.value = '';
        }
    };

    const handleButtonClick = () => {
        document.getElementById('csv-upload-input')?.click();
    };

    return (
        <div className="w-full">
            <input
                type="file"
                id="csv-upload-input"
                accept=".csv"
                onChange={handleFileChange}
                className="hidden"
                disabled={loading}
            />
            <button
                onClick={handleButtonClick}
                disabled={loading}
                className="w-full bg-cyan-600 hover:bg-cyan-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold py-3 px-6 rounded-lg transition-colors duration-300 flex items-center justify-center gap-3"
            >
                {loading ? (
                    <>
                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Procesando...
                    </>
                ) : (
                    <>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                        </svg>
                        <span>Seleccionar archivo CSV</span>
                    </>
                )}
            </button>
            {fileName && !loading && (
                 <p className="text-sm text-gray-400 mt-2 text-center sm:text-left">Último archivo: {fileName}</p>
            )}
        </div>
    );
};

export default FileUpload;
