'use client';

import { SignatureList } from '@/components/signature/signature-list';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DateFilter, DateFilterValue } from '@/components/ui/date-filter';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/toast';
import { createBrowserClient } from '@/lib/supabase/client';
import {
  getForgedSignatures,
  getForgedSignaturesAmount,
  getGenuineSignatures,
  getGenuineSignaturesAmount,
  searchSignature,
} from '@/lib/supabase/queries';
import { Signature } from '@/lib/types';
import {
  ChevronFirst,
  ChevronLast,
  ChevronLeft,
  ChevronRight,
  Filter,
  Search,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

// Helper to build list of page numbers to render (max 5 items)
function getPageNumbers(current: number, total: number, max = 5): number[] {
  if (total <= max) return Array.from({ length: total }, (_, i) => i + 1);
  const half = Math.floor(max / 2);
  let start = Math.max(1, current - half);
  let end = start + max - 1;
  if (end > total) {
    end = total;
    start = end - max + 1;
  }
  return Array.from({ length: max }, (_, i) => start + i);
}

export default function SignaturesPage() {
  // Category genuine | forged
  const [category, setCategory] = useState<'genuine' | 'forged'>('genuine');
  // Pagination
  const [perPage, setPerPage] = useState<number>(50);
  const [page, setPage] = useState<number>(1);

  // Search by ID
  const [searchId, setSearchId] = useState<string>('');
  const [isSearchMode, setIsSearchMode] = useState<boolean>(false);

  // Date filter
  const [dateFilter, setDateFilter] = useState<DateFilterValue>({
    type: 'all',
  });
  const [appliedDateFilter, setAppliedDateFilter] = useState<DateFilterValue>({
    type: 'all',
  });

  // Category filter
  const [appliedCategory, setAppliedCategory] = useState<'genuine' | 'forged'>(
    'genuine'
  );

  // Data
  const [signatures, setSignatures] = useState<Signature[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const totalPages = Math.max(1, Math.ceil(totalCount / perPage));

  const client = createBrowserClient();

  const loadDataWithFilters = useCallback(
    async (
      categoryFilter: 'genuine' | 'forged',
      dateFilter: DateFilterValue,
      currentPage: number = page,
      itemsPerPage: number = perPage
    ) => {
      setIsLoading(true);
      try {
        const [count, list] = await (async () => {
          let dateFrom =
            dateFilter.type !== 'all' ? dateFilter.from : undefined;
          let dateTo = dateFilter.type !== 'all' ? dateFilter.to : undefined;

          if (dateFrom && dateTo) {
            const today = new Date();
            const yesterday = new Date(today);
            yesterday.setDate(today.getDate() - 1);
            if (
              dateFrom.toLocaleDateString() ===
                yesterday.toLocaleDateString() &&
              dateTo.toLocaleDateString() === today.toLocaleDateString()
            ) {
              dateFrom = yesterday;
              dateTo = today;
            }
          }

          if (categoryFilter === 'genuine') {
            const [cnt, lst] = await Promise.all([
              getGenuineSignaturesAmount(client, dateFrom, dateTo),
              getGenuineSignatures(
                client,
                itemsPerPage,
                (currentPage - 1) * itemsPerPage,
                dateFrom,
                dateTo
              ),
            ]);
            return [cnt, lst];
          } else {
            const [cnt, lst] = await Promise.all([
              getForgedSignaturesAmount(client, dateFrom, dateTo),
              getForgedSignatures(
                client,
                itemsPerPage,
                (currentPage - 1) * itemsPerPage,
                dateFrom,
                dateTo
              ),
            ]);
            return [cnt, lst];
          }
        })();
        setTotalCount(count);
        setSignatures(list);
      } catch (e) {
        console.error(e);
        toast({ description: 'Ошибка загрузки подписей', type: 'foreground' });
      } finally {
        setIsLoading(false);
      }
    },
    [client, page, perPage]
  );

  const performSearch = useCallback(
    async (searchQuery: string) => {
      setIsLoading(true);
      try {
        if (searchQuery.trim()) {
          const signature = await searchSignature(searchQuery, client);
          if (!signature) {
            toast({
              description: 'Подписи с указанным ID не найдены',
              type: 'foreground',
            });
            return;
          }
          setSignatures([signature]);
          setTotalCount(1);
          setIsSearchMode(true);
        }
      } catch (e) {
        console.error(e);
        toast({ description: 'Ошибка поиска подписей', type: 'foreground' });
      } finally {
        setIsLoading(false);
      }
    },
    [client]
  );

  // Загружаем данные только при первой загрузке страницы
  useEffect(() => {
    const loadInitialData = async () => {
      await loadDataWithFilters('genuine', { type: 'all' }, 1, 50);
    };
    loadInitialData();
  }, [loadDataWithFilters]); // Добавляем зависимость

  // Обработчик события signatureDeleted
  useEffect(() => {
    const handleSignatureDeleted = (event: CustomEvent) => {
      const { id: deletedId, type: deletedType } = event.detail;

      // Проверяем, что удаленная подпись соответствует текущей категории
      const currentType = appliedCategory === 'genuine' ? 'genuine' : 'forged';
      if (deletedType !== currentType) {
        return; // Не обновляем состояние, если удаленная подпись не относится к текущей категории
      }

      // Удаляем подпись из локального состояния
      setSignatures(prevSignatures =>
        prevSignatures.filter(signature => signature.id !== deletedId)
      );

      // Обновляем общее количество
      setTotalCount(prevCount => Math.max(0, prevCount - 1));

      // Подпись успешно удалена из локального состояния
    };

    // Добавляем слушатель события
    window.addEventListener(
      'signatureDeleted',
      handleSignatureDeleted as EventListener
    );

    // Очищаем слушатель при размонтировании компонента
    return () => {
      window.removeEventListener(
        'signatureDeleted',
        handleSignatureDeleted as EventListener
      );
    };
  }, [appliedCategory]); // Зависимость от appliedCategory для проверки типа

  // Handlers
  const handleCategoryChange = useCallback((cat: 'genuine' | 'forged') => {
    setCategory(cat);
  }, []);

  const handlePerPageChange = useCallback(
    (value: string | number) => {
      const newPerPage = Number(value);
      setPerPage(newPerPage);
      setPage(1);
      // Загружаем данные с новым количеством элементов на странице
      loadDataWithFilters(appliedCategory, appliedDateFilter, 1, newPerPage);
    },
    [loadDataWithFilters, appliedCategory, appliedDateFilter]
  );

  const navigatePage = useCallback(
    (newPage: number) => {
      if (newPage < 1 || newPage > totalPages) return;
      setPage(newPage);
      // Загружаем данные для новой страницы
      loadDataWithFilters(appliedCategory, appliedDateFilter, newPage, perPage);
    },
    [
      totalPages,
      loadDataWithFilters,
      appliedCategory,
      appliedDateFilter,
      perPage,
    ]
  );

  const applyFilters = useCallback(() => {
    setAppliedDateFilter(dateFilter);
    setAppliedCategory(category);
    setPage(1);

    if (searchId.trim()) {
      performSearch(searchId);
    } else {
      setIsSearchMode(false);
      // Загружаем данные с новыми примененными фильтрами
      loadDataWithFilters(category, dateFilter, 1, perPage);
    }
  }, [
    searchId,
    dateFilter,
    category,
    performSearch,
    loadDataWithFilters,
    perPage,
  ]);

  const resetFilters = useCallback(() => {
    setSearchId('');
    setDateFilter({ type: 'all' });
    setAppliedDateFilter({ type: 'all' });
    setCategory('genuine');
    setAppliedCategory('genuine');
    setIsSearchMode(false);
    setPage(1);
    // Загружаем данные с сброшенными фильтрами
    loadDataWithFilters('genuine', { type: 'all' }, 1, perPage);
  }, [loadDataWithFilters, perPage]);

  const handleSearchIdChange = useCallback((value: string) => {
    setSearchId(value);
  }, []);

  const handleDateFilterChange = useCallback((value: DateFilterValue) => {
    setDateFilter(value);
  }, []);

  const pageNumbers = useMemo(
    () => getPageNumbers(page, totalPages, 5),
    [page, totalPages]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        applyFilters();
      }
    },
    [applyFilters]
  );

  return (
    <div className='p-6 w-full space-y-4'>
      {/* Filter panel */}
      <div className='flex flex-col gap-4 border rounded-lg p-4 bg-muted/20'>
        {/* Search by ID */}
        <div className='space-y-2'>
          <div className='flex items-center gap-2 text-sm font-medium text-muted-foreground'>
            <Search className='h-4 w-4' />
            Поиск по ID
          </div>
          <Input
            placeholder='Введите ID подписи...'
            value={searchId}
            onChange={e => handleSearchIdChange(e.target.value)}
            onKeyDown={handleKeyDown}
            className='flex-1'
          />
        </div>

        {/* Filters and pagination controls */}
        <div className='flex flex-col md:flex-row md:items-center md:justify-between gap-4'>
          <div className='flex flex-col gap-4'>
            {/* Date filter */}
            <DateFilter value={dateFilter} onChange={handleDateFilterChange} />

            <div className='flex flex-row gap-2'>
              {/* Category selector */}
              <div className='flex items-center gap-2'>
                <Filter className='h-4 w-4 text-muted-foreground' />
                <Button
                  variant={category === 'genuine' ? 'default' : 'outline'}
                  size='sm'
                  onClick={() => handleCategoryChange('genuine')}
                  className='flex items-center gap-1'
                >
                  Настоящие
                </Button>
                <Button
                  variant={category === 'forged' ? 'default' : 'outline'}
                  size='sm'
                  onClick={() => handleCategoryChange('forged')}
                  className='flex items-center gap-1'
                >
                  Поддельные
                </Button>
              </div>

              {/* Per page selector */}
              <div className='flex items-center gap-2'>
                <span className='text-sm text-muted-foreground'>
                  Показывать по
                </span>
                <select
                  value={perPage}
                  onChange={e => handlePerPageChange(e.target.value)}
                  className='border border-input bg-background rounded px-2 py-1 text-sm focus:outline-none'
                >
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                  <option value={200}>200</option>
                </select>
              </div>
            </div>

            {/* Apply/Reset buttons */}
            <div className='flex gap-2'>
              <Button
                variant='default'
                size='sm'
                onClick={applyFilters}
                className='px-8'
              >
                Найти
              </Button>
              <Button
                variant='outline'
                size='sm'
                onClick={resetFilters}
                className='px-8'
              >
                Сбросить
              </Button>
            </div>
          </div>

          <div className='flex flex-row gap-2'>
            {/* Total count */}
            <Badge variant='secondary'>
              {isSearchMode ? 'Найдено' : 'Всего'}: {totalCount}
            </Badge>
            {isSearchMode && <Badge variant='outline'>Режим поиска</Badge>}
          </div>
        </div>
      </div>

      {/* Results */}
      <SignatureList
        signatures={signatures}
        loading={isLoading}
        showHeader={false}
      />

      {/* Pagination */}
      {totalPages > 1 && (
        <div className='flex items-center justify-center gap-1 mt-4'>
          <Button
            variant='ghost'
            size='icon'
            onClick={() => navigatePage(1)}
            disabled={page === 1}
          >
            <ChevronFirst className='h-4 w-4' />
          </Button>
          <Button
            variant='ghost'
            size='icon'
            onClick={() => navigatePage(page - 1)}
            disabled={page === 1}
          >
            <ChevronLeft className='h-4 w-4' />
          </Button>
          {pageNumbers.map(num => (
            <Button
              key={num}
              variant={num === page ? 'default' : 'outline'}
              size='sm'
              onClick={() => navigatePage(num)}
            >
              {num}
            </Button>
          ))}
          <Button
            variant='ghost'
            size='icon'
            onClick={() => navigatePage(page + 1)}
            disabled={page === totalPages}
          >
            <ChevronRight className='h-4 w-4' />
          </Button>
          <Button
            variant='ghost'
            size='icon'
            onClick={() => navigatePage(totalPages)}
            disabled={page === totalPages}
          >
            <ChevronLast className='h-4 w-4' />
          </Button>
        </div>
      )}
    </div>
  );
}
