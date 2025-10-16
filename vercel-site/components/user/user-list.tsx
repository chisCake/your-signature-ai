'use client';

import { useState, useEffect, useCallback } from 'react';
import { User, getUserName, isProfile, isPseudouser } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { UserIcon, LoaderCircle } from 'lucide-react';

export interface UserPreviewField {
  key: string;
  label: string;
  getValue: (user: User) => string;
}

interface UserListProps {
  users: User[];
  loading?: boolean;
  previewFields?: UserPreviewField[];
  emptyStateTitle?: string;
  emptyStateDescription?: string;
  showHeader?: boolean;
  onUserSelect?: (user: User) => void;
  selectedUserId?: string | null;
  batchSize?: number;
}

export function UserList({
  users,
  loading = false,
  previewFields: _previewFields,
  emptyStateTitle = 'Пользователи не найдены',
  emptyStateDescription = 'Попробуйте изменить критерии поиска',
  showHeader = true,
  onUserSelect,
  selectedUserId = null,
  batchSize = 50,
}: UserListProps) {
  const [visibleCount, setVisibleCount] = useState(batchSize);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const visibleUsers = users.slice(0, visibleCount);
  const hasMore = visibleCount < users.length;

  // Сбрасываем счетчик при изменении списка пользователей
  useEffect(() => {
    setVisibleCount(batchSize);
  }, [users, batchSize]);

  const loadMore = useCallback(() => {
    if (isLoadingMore || !hasMore) return;
    
    setIsLoadingMore(true);
    // Имитируем небольшую задержку для плавности
    setTimeout(() => {
      setVisibleCount(prev => Math.min(prev + batchSize, users.length));
      setIsLoadingMore(false);
    }, 100);
  }, [isLoadingMore, hasMore, users.length, batchSize]);

  if (loading) {
    return (
      <div className='flex items-center justify-center py-8'>
        <div className='text-gray-500 flex items-center gap-2'>
          <LoaderCircle className='animate-spin' /> Загрузка пользователей
        </div>
      </div>
    );
  }

  if (users.length === 0) {
    return (
      <div className='text-center py-8 text-gray-500'>
        <div className='text-lg mb-2'>{emptyStateTitle}</div>
        <div className='text-sm'>{emptyStateDescription}</div>
      </div>
    );
  }

  return (
    <div className='space-y-4'>
      {/* Заголовок с количеством */}
      {showHeader && (
        <div className='flex items-center justify-between mb-2'>
          <h3 className='text-lg font-semibold'>
            Найдено: {users.length}
          </h3>
        </div>
      )}

      {/* Список пользователей */}
      <div className='space-y-1'>
        {visibleUsers.map((user) => (
          <div
            key={user.data.id}
            onClick={() => onUserSelect?.(user)}
            className={`p-3 rounded-lg border cursor-pointer transition-all hover:bg-muted/50 ${
              selectedUserId === user.data.id ? "border-primary bg-primary/10" : "border-border"
            }`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`p-2 rounded-full ${
                  user.type === "user"
                    ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-900 dark:text-emerald-400"
                    : "bg-violet-100 text-violet-600 dark:bg-violet-900 dark:text-violet-400"
                }`}
              >
                <UserIcon className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{getUserName(user)}</div>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant={user.type === "user" ? "default" : "secondary"} className="text-xs">
                    {user.type === "user" ? "Пользователь" : "Псевдо"}
                  </Badge>
                  {isProfile(user) && (
                    <Badge variant="outline" className="text-xs">
                      {user.data.role}
                    </Badge>
                  )}
                  {isPseudouser(user) && (
                    <Badge variant="outline" className="text-xs">
                      {user.data.source}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
        
        {/* Кнопка загрузки дополнительных пользователей */}
        {hasMore && (
          <div className="flex justify-center py-4">
            <Button
              variant="outline"
              size="sm"
              onClick={loadMore}
              disabled={isLoadingMore}
              className="w-full"
            >
              {isLoadingMore ? (
                <>
                  <LoaderCircle className="h-4 w-4 animate-spin mr-2" />
                  Загрузка...
                </>
              ) : (
                `Показать еще (${users.length - visibleCount} осталось)`
              )}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
