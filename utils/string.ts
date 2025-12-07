// utils/string.ts

export const normalizeString = (str: string): string => {
    return str
        .normalize("NFD") // Decompose combined graphemes (e.g., "á" to "a" + "́")
        .replace(/[\u0300-\u036f]/g, "") // Remove diacritics (accents)
        .toLowerCase()
        .trim();
};