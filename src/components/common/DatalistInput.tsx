import React, { useState, useRef, useEffect } from 'react';

interface DatalistInputProps {
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export const DatalistInput: React.FC<DatalistInputProps> = ({
  value,
  onChange,
  options,
  placeholder = 'Select or enter...',
  className = '',
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState(value || '');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setQuery(value || '');
  }, [value]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const matchingOptions = options.filter(opt =>
    opt.toLowerCase().includes((query || '').toLowerCase())
  );
  
  // Show matching options if any match, otherwise show all options so list is never empty
  const displayOptions = matchingOptions.length > 0 ? matchingOptions : options;

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative flex items-center">
        <input
          type="text"
          className={`${className} pr-8 disabled:bg-slate-50 disabled:text-slate-700 disabled:cursor-not-allowed`}
          placeholder={placeholder}
          value={query}
          disabled={disabled}
          onChange={e => {
            if (disabled) return;
            const val = e.target.value;
            setQuery(val);
            onChange(val);
            setIsOpen(true);
          }}
          onFocus={() => !disabled && setIsOpen(true)}
          onClick={() => !disabled && setIsOpen(true)}
        />
        <button
          type="button"
          tabIndex={-1}
          disabled={disabled}
          onClick={() => !disabled && setIsOpen(prev => !prev)}
          className={`absolute right-3 text-slate-400 focus:outline-none p-1 ${disabled ? 'cursor-not-allowed opacity-50' : 'hover:text-slate-600 cursor-pointer'}`}
        >
          <svg className={`w-4 h-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      {isOpen && !disabled && (
        <div className="absolute z-[9999] left-0 right-0 mt-1 max-h-60 overflow-y-auto bg-white border border-slate-200 rounded-xl shadow-xl divide-y divide-slate-50">
          {displayOptions.map((option, idx) => (
            <div
              key={idx}
              className={`px-3.5 py-2.5 text-xs cursor-pointer hover:bg-blue-50 transition-colors flex items-center justify-between ${
                value === option ? 'bg-blue-50/80 font-bold text-blue-600' : 'text-slate-700'
              }`}
              onMouseDown={e => {
                e.preventDefault();
                setQuery(option);
                onChange(option);
                setIsOpen(false);
              }}
            >
              <span>{option}</span>
              {value === option && (
                <svg className="w-3.5 h-3.5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                </svg>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
export default DatalistInput;
