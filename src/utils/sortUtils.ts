export function sortData<T>(data: T[], key: string, dir: 'asc' | 'desc', valueGetter?: (row: T, key: string) => any): T[] {
  if (!key) return data;

  const isEmpty = (v: any): boolean => {
    if (v === null || v === undefined) return true;
    if (typeof v === 'string') {
      const s = v.trim().toLowerCase();
      return s === '' || s === '—' || s === '-' || s === '–' || s === 'n/a' || s === 'na' || s === 'none';
    }
    return false;
  };

  const tryParseNumber = (val: any): number | null => {
    if (typeof val === 'number') return isNaN(val) ? null : val;
    if (typeof val === 'string') {
      const trimmed = val.trim();
      // Handle duration e.g. "2 Years" or "1 Year" or "5 days"
      const durationMatch = trimmed.match(/^(\d+(\.\d+)?)\s*(years?|yrs?|days?|months?)$/i);
      if (durationMatch) {
        return parseFloat(durationMatch[1]);
      }
      // Check if it's formatted currency or number like "₹50,000" or "1,00,000" or "50000"
      const cleaned = trimmed.replace(/[₹$,\s]/g, '');
      if (cleaned !== '' && !isNaN(Number(cleaned))) {
        return Number(cleaned);
      }
    }
    return null;
  };

  const tryParseDate = (val: any): number | null => {
    if (val instanceof Date) return isNaN(val.getTime()) ? null : val.getTime();
    if (typeof val !== 'string') return null;
    const s = val.trim();
    if (s.length < 8) return null;

    // DD/MM/YYYY or DD-MM-YYYY
    const dmyMatch = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
    if (dmyMatch) {
      const day = parseInt(dmyMatch[1], 10);
      const month = parseInt(dmyMatch[2], 10) - 1;
      const year = parseInt(dmyMatch[3], 10);
      const d = new Date(year, month, day);
      if (!isNaN(d.getTime())) return d.getTime();
    }

    // YYYY-MM-DD or ISO string
    const ymdMatch = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
    if (ymdMatch) {
      const d = new Date(s);
      if (!isNaN(d.getTime())) return d.getTime();
    }

    // DD/MMM/YYYY or DD-MMM-YYYY (e.g. 15/Jan/2024 or 15-Jun-2025)
    const dMmmYMatch = s.match(/^(\d{1,2})[-/]([A-Za-z]{3})[-/](\d{4})$/);
    if (dMmmYMatch) {
      const d = new Date(s.replace(/-/g, ' '));
      if (!isNaN(d.getTime())) return d.getTime();
    }

    if ((s.includes('T') || s.includes('Z')) && !isNaN(Date.parse(s))) {
      return Date.parse(s);
    }

    return null;
  };

  return [...data].sort((a: any, b: any) => {
    const getDefaultValue = (obj: any, path: string) => {
      if (!obj || !path) return null;
      return path.split('.').reduce((acc, part) => (acc && acc[part] !== undefined ? acc[part] : null), obj);
    };

    let valA = valueGetter ? valueGetter(a, key) : getDefaultValue(a, key);
    let valB = valueGetter ? valueGetter(b, key) : getDefaultValue(b, key);

    // Empty / null / dash values handling: always push empty values to the bottom
    const emptyA = isEmpty(valA);
    const emptyB = isEmpty(valB);
    if (emptyA && emptyB) return 0;
    if (emptyA) return 1;
    if (emptyB) return -1;

    // Number / Currency comparison
    const numA = tryParseNumber(valA);
    const numB = tryParseNumber(valB);
    if (numA !== null && numB !== null) {
      return dir === 'asc' ? numA - numB : numB - numA;
    }

    // Date comparison
    const dateA = tryParseDate(valA);
    const dateB = tryParseDate(valB);
    if (dateA !== null && dateB !== null) {
      return dir === 'asc' ? dateA - dateB : dateB - dateA;
    }

    // Boolean comparison
    if (typeof valA === 'boolean' && typeof valB === 'boolean') {
      const comp = valA === valB ? 0 : valA ? 1 : -1;
      return dir === 'asc' ? comp : -comp;
    }

    // String comparison
    const strA = String(valA).trim();
    const strB = String(valB).trim();
    const comp = strA.localeCompare(strB, undefined, { numeric: true, sensitivity: 'base' });
    return dir === 'asc' ? comp : -comp;
  });
}
