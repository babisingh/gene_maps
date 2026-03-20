'use client';

// ============================================================
// GeneSearchInterface — Autocomplete gene search bar.
// Calls /api/genes/search?q=<query> for suggestions.
// ============================================================

import { useState, useCallback, useRef, useEffect } from 'react';
import { Search, Loader2, X } from 'lucide-react';

interface GeneSuggestion {
  symbol: string;
  description: string;
}

interface Props {
  onGeneSelect: (geneSymbol: string) => void;
  placeholder?: string;
  className?: string;
}

export function GeneSearchInterface({
  onGeneSelect,
  placeholder = 'Search genes (e.g., GCG, BRCA1, TP53)...',
  className = '',
}: Props) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<GeneSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(-1);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const searchGenes = useCallback(async (term: string) => {
    if (term.length < 2) {
      setSuggestions([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/genes/search?q=${encodeURIComponent(term)}`);
      if (!res.ok) throw new Error(`Search failed: ${res.statusText}`);
      const data: GeneSuggestion[] = await res.json();
      setSuggestions(data);
    } catch (err) {
      setError('Search unavailable. Please try again.');
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Debounce input changes
  const handleInput = (value: string) => {
    setQuery(value);
    setActiveIndex(-1);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => searchGenes(value), 250);
  };

  const handleSelect = (gene: GeneSuggestion) => {
    setQuery(gene.symbol);
    setSuggestions([]);
    setActiveIndex(-1);
    onGeneSelect(gene.symbol);
  };

  const handleClear = () => {
    setQuery('');
    setSuggestions([]);
    setError(null);
  };

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (suggestions.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, -1));
    } else if (e.key === 'Enter' && activeIndex >= 0) {
      e.preventDefault();
      handleSelect(suggestions[activeIndex]);
    } else if (e.key === 'Escape') {
      setSuggestions([]);
    }
  };

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setSuggestions([]);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} className={`relative w-full max-w-lg ${className}`}>
      {/* Input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
        <input
          type="text"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={suggestions.length > 0}
          aria-label="Search genes"
          placeholder={placeholder}
          value={query}
          onChange={(e) => handleInput(e.target.value)}
          onKeyDown={handleKeyDown}
          className="w-full pl-10 pr-10 py-3 rounded-xl text-sm transition
                     bg-white/90 border border-white/20 text-gray-900 placeholder:text-gray-400
                     focus:outline-none focus:ring-2 focus:ring-gm-pink/60 focus:border-gm-pink/40"
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-gray-400" />
        )}
        {!loading && query && (
          <button
            onClick={handleClear}
            aria-label="Clear search"
            className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 hover:text-gray-600"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Error */}
      {error && (
        <p className="mt-1 text-xs text-red-400 pl-2">{error}</p>
      )}

      {/* Dropdown */}
      {suggestions.length > 0 && (
        <ul
          role="listbox"
          className="absolute z-20 w-full mt-1 rounded-xl overflow-hidden shadow-2xl border border-white/10"
          style={{ background: 'rgba(15,7,38,0.97)', backdropFilter: 'blur(20px)' }}
        >
          {suggestions.map((gene, idx) => (
            <li key={gene.symbol} role="option" aria-selected={idx === activeIndex}>
              <button
                className={`w-full px-4 py-3 text-left transition
                  ${idx === activeIndex ? 'bg-gm-pink/15' : 'hover:bg-white/8'}
                  ${idx !== suggestions.length - 1 ? 'border-b border-white/8' : ''}`}
                onClick={() => handleSelect(gene)}
                onMouseEnter={() => setActiveIndex(idx)}
              >
                <div className="flex items-center gap-3">
                  <span className="font-semibold text-gm-pink text-sm font-mono w-16 shrink-0">
                    {gene.symbol}
                  </span>
                  <span className="text-white/50 text-xs truncate">{gene.description}</span>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
