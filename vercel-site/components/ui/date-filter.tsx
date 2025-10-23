'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, Clock } from 'lucide-react';
import { format } from 'date-fns';

export type DateFilterType = 
  | 'all'
  | 'last-day'
  | 'last-3-days'
  | 'last-week'
  | 'custom';

export interface DateFilterValue {
  type: DateFilterType;
  from?: Date;
  to?: Date;
}

interface DateFilterProps {
  value: DateFilterValue;
  onChange: (value: DateFilterValue) => void;
  disabled?: boolean;
}

export function DateFilter({ value, onChange, disabled = false }: DateFilterProps) {
  const [isCustomOpen, setIsCustomOpen] = useState(false);

  const handlePresetChange = (type: DateFilterType) => {
    if (type === 'custom') {
      setIsCustomOpen(true);
      return;
    }

    let from: Date | undefined;
    let to: Date | undefined;

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    switch (type) {
      case 'last-day':
        from = new Date(today);
        from.setDate(from.getDate() - 1);
        to = new Date(today);
        break;
      case 'last-3-days':
        from = new Date(today);
        from.setDate(from.getDate() - 3);
        to = new Date(today);
        break;
      case 'last-week':
        from = new Date(today);
        from.setDate(from.getDate() - 7);
        to = new Date(today);
        break;
      case 'all':
      default:
        from = undefined;
        to = undefined;
        break;
    }

    onChange({ type, from, to });
  };

  const handleCustomDateChange = (from?: Date, to?: Date) => {
    onChange({ type: 'custom', from, to });
    setIsCustomOpen(false);
  };

  const getDisplayText = () => {
    switch (value.type) {
      case 'all':
        return 'За все время';
      case 'last-day':
        return 'За последние сутки';
      case 'last-3-days':
        return 'За последние 3 суток';
      case 'last-week':
        return 'За последнюю неделю';
      case 'custom':
        if (value.from && value.to) {
          return `${format(value.from, 'dd.MM.yyyy')} - ${format(value.to, 'dd.MM.yyyy')}`;
        } else if (value.from) {
          return `С ${format(value.from, 'dd.MM.yyyy')}`;
        } else if (value.to) {
          return `До ${format(value.to, 'dd.MM.yyyy')}`;
        }
        return 'Выберите период';
      default:
        return 'За все время';
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Clock className="h-4 w-4 text-muted-foreground" />
      <div className="flex items-center gap-1">
        <Button
          variant={value.type === 'all' ? 'default' : 'outline'}
          size="sm"
          onClick={() => handlePresetChange('all')}
          disabled={disabled}
        >
          За все время
        </Button>
        <Button
          variant={value.type === 'last-day' ? 'default' : 'outline'}
          size="sm"
          onClick={() => handlePresetChange('last-day')}
          disabled={disabled}
        >
          Сутки
        </Button>
        <Button
          variant={value.type === 'last-3-days' ? 'default' : 'outline'}
          size="sm"
          onClick={() => handlePresetChange('last-3-days')}
          disabled={disabled}
        >
          3 дня
        </Button>
        <Button
          variant={value.type === 'last-week' ? 'default' : 'outline'}
          size="sm"
          onClick={() => handlePresetChange('last-week')}
          disabled={disabled}
        >
          Неделя
        </Button>
        <Popover open={isCustomOpen} onOpenChange={setIsCustomOpen}>
          <PopoverTrigger asChild>
            <Button
              variant={value.type === 'custom' ? 'default' : 'outline'}
              size="sm"
              disabled={disabled}
              className="flex items-center gap-1"
            >
              <CalendarIcon className="h-4 w-4" />
              Период
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <CustomDatePicker
              from={value.from}
              to={value.to}
              onChange={handleCustomDateChange}
              onCancel={() => setIsCustomOpen(false)}
            />
          </PopoverContent>
        </Popover>
      </div>
      {value.type !== 'all' && (
        <div className="text-sm text-muted-foreground">
          {getDisplayText()}
        </div>
      )}
    </div>
  );
}

interface CustomDatePickerProps {
  from?: Date;
  to?: Date;
  onChange: (from?: Date, to?: Date) => void;
  onCancel: () => void;
}

function CustomDatePicker({ from, to, onChange, onCancel }: CustomDatePickerProps) {
  const [selectedRange, setSelectedRange] = useState<{from?: Date, to?: Date}>({ from, to });

  const handleRangeSelect = (range: {from?: Date, to?: Date} | undefined) => {
    if (range) {
      setSelectedRange(range);
    }
  };

  const handleApply = () => {
    onChange(selectedRange.from, selectedRange.to);
  };

  const handleClear = () => {
    setSelectedRange({});
    // Не вызываем onChange, только очищаем локальное состояние
  };

  const handleCancel = () => {
    // Восстанавливаем исходные значения
    setSelectedRange({ from, to });
    // Закрываем попап через переданную функцию
    onCancel();
  };

  const today = new Date();
  const maxDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  return (
    <div className="p-4 space-y-4">
      <div className="space-y-2">
        <div className="text-sm font-medium">
          Выберите период
        </div>
        <Calendar
          mode="range"
          selected={
            selectedRange.from && selectedRange.to
              ? { from: selectedRange.from, to: selectedRange.to }
              : undefined
          }
          onSelect={handleRangeSelect}
          disabled={{ after: maxDate }}
          className="rounded-md border"
        />
      </div>
      
      {(selectedRange.from || selectedRange.to) && (
        <div className="space-y-2">
          <div className="text-sm text-muted-foreground">
            Выбранный период:
          </div>
          <div className="text-sm">
            {selectedRange.from && (
              <div>С: {format(selectedRange.from, 'dd.MM.yyyy')}</div>
            )}
            {selectedRange.to && (
              <div>До: {format(selectedRange.to, 'dd.MM.yyyy')}</div>
            )}
          </div>
        </div>
      )}

      <div className="flex gap-2">
        <Button
          onClick={handleApply}
          size="sm"
          className="flex-1"
          disabled={!selectedRange.from && !selectedRange.to}
        >
          Применить
        </Button>
        <Button
          onClick={handleClear}
          variant="outline"
          size="sm"
        >
          Очистить
        </Button>
        <Button
          onClick={handleCancel}
          variant="ghost"
          size="sm"
        >
          Отмена
        </Button>
      </div>
    </div>
  );
}
