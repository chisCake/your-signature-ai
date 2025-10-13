'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Input } from './ui/input';
import {
  searchUsersAndPseudousers,
  formatModSearchLabel,
} from '@/lib/supabase/mod-utils';
import { User } from '@/lib/types';
import { cn } from '@/lib/utils';
import { isMod } from '@/lib/auth-client-utils';
import { LoaderCircle } from 'lucide-react';

type UserSearchDropdownProps = {
  className?: string;
  placeholder?: string;
  autoSearch?: boolean;
  searchIntervalMs?: number;
  maxResults?: number;
  onSelect?: (item: User) => void;
  onSearchComplete?: (query: string, results: User[]) => void;
  onInputChange?: (query: string) => void;
};

export function UserSearchDropdown(props: UserSearchDropdownProps) {
  const {
    className,
    placeholder = 'Поиск пользователя...',
    autoSearch = false,
    searchIntervalMs = 200,
    maxResults = 10,
    onSelect,
    onSearchComplete,
    onInputChange,
  } = props;

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<User[]>([]);
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [lastSearchedQuery, setLastSearchedQuery] = useState('');

  const lastChangedAtRef = useRef<number>(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({
    display: 'none',
  });

  // Check permission once on mount
  useEffect(() => {
    async function checkMod(): Promise<boolean> {
      return await isMod();
    }
    let mounted = true;
    checkMod().then(ok => {
      if (mounted) setAllowed(ok);
    });
    return () => {
      mounted = false;
    };
  }, []);

  // Track input rect to size/position fixed dropdown equal to input
  const updateDropdownPosition = useCallback(() => {
    const el = inputRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const style: React.CSSProperties = {
      position: 'fixed',
      top: rect.bottom,
      left: rect.left,
      width: rect.width,
      maxHeight: 300,
      overflowY: 'auto',
      zIndex: 50,
      display: open && results.length > 0 ? 'block' : 'none',
    };
    setDropdownStyle(style);
  }, [open, results.length]);

  useEffect(() => {
    updateDropdownPosition();
    const onResize = () => updateDropdownPosition();
    window.addEventListener('resize', onResize);
    window.addEventListener('scroll', onResize, true);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('scroll', onResize, true);
    };
  }, [updateDropdownPosition]);

  const runSearch = useCallback(async () => {
    // console.log("runSearch", allowed, query, maxResults);
    if (!allowed) {
      setResults([]);
      setIsLoading(false);
      setLastSearchedQuery('');
      return;
    }
    if (!query.trim()) {
      setResults([]);
      setIsLoading(false);
      setLastSearchedQuery('');
      return;
    }

    // Не выполняем поиск если уже искали этот запрос
    if (lastSearchedQuery === query.trim()) {
      return;
    }

    setIsLoading(true);
    try {
      const data = await searchUsersAndPseudousers(query, maxResults);
      setResults(data);
      setLastSearchedQuery(query.trim());
      if (onSearchComplete) onSearchComplete(query, data);
      setOpen(true);
    } finally {
      setIsLoading(false);
    }
  }, [allowed, query, maxResults, onSearchComplete, lastSearchedQuery]);

  // Public trigger via event dispatched from outside
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handler = () => {
      runSearch();
    };
    el.addEventListener('trigger-search', handler as EventListener);
    return () => {
      el.removeEventListener('trigger-search', handler as EventListener);
    };
  }, [runSearch]);

  // Auto search timer, resets on input changes; starts after searchIntervalMs
  useEffect(() => {
    if (!autoSearch) return;
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    lastChangedAtRef.current = Date.now();
    timerRef.current = setTimeout(() => {
      runSearch();
    }, searchIntervalMs);
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [query, autoSearch, searchIntervalMs, runSearch]);

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
    setOpen(false);
    // Сбрасываем состояние поиска при изменении текста
    if (lastSearchedQuery !== e.target.value.trim()) {
      setLastSearchedQuery('');
      setResults([]);
    }
    if (onInputChange) onInputChange(e.target.value);
  };

  const onResultClick = (item: User) => {
    setOpen(false);
    if (onSelect) onSelect(item);
    // Also dispatch a DOM CustomEvent for external listeners
    const el = containerRef.current;
    if (el) {
      el.dispatchEvent(
        new CustomEvent('user-selected', { detail: item, bubbles: true })
      );
    }
  };

  // Close on outside click
  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!containerRef.current?.contains(t)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  useEffect(() => {
    updateDropdownPosition();
  }, [open, results.length, updateDropdownPosition]);

  return (
    <div ref={containerRef} className={cn('w-full', className)}>
      <Input
        ref={inputRef}
        value={query}
        placeholder={allowed === false ? 'Нет доступа' : placeholder}
        onChange={onChange}
        onFocus={() => results.length > 0 && setOpen(true)}
        disabled={allowed === false}
        aria-autocomplete='list'
      />

      {/* Fixed results container pinned to input bottom with equal width */}
      <div style={dropdownStyle}>
        <div className='rounded-md border bg-popover text-popover-foreground shadow-md'>
          {results.slice(0, maxResults).map(item => (
            <button
              key={`${item.type}-${item.data.id}`}
              className={cn(
                'w-full text-left px-3 py-2 hover:bg-accent hover:text-accent-foreground'
              )}
              onClick={() => onResultClick(item)}
              type='button'
            >
              {formatModSearchLabel(item)}
            </button>
          ))}
        </div>
      </div>

      {/* Status container - always takes vertical space */}
      <div className='h-6 flex items-center'>
        {isLoading ? (
          <div className='px-3 py-1 text-sm text-muted-foreground flex items-center gap-2'>
            <LoaderCircle className='h-4 w-4 animate-spin' />
            Поиск...
          </div>
        ) : query.trim() &&
          lastSearchedQuery === query.trim() &&
          results.length === 0 ? (
          <div className='px-3 py-1 text-sm text-muted-foreground'>
            Нет результатов
          </div>
        ) : null}
      </div>
    </div>
  );
}
