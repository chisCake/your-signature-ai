'use client';

import {
  getUsers,
  getPseudousers,
  getUserGenuineSignatures,
} from '@/lib/supabase/mod-utils';
import {
  Profile,
  Pseudouser,
  User,
  SignatureGenuine,
  SignatureForged,
  createProfileUser,
  createPseudouserUser,
  getUserName,
  isProfile,
  isPseudouser,
} from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CheckboxWithLabel } from '@/components/ui/checkbox-with-label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { SignatureList, PreviewField } from '@/components/signature-list';
import { UserList } from '@/components/user-list';
import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  LoaderCircle,
  User as UserIcon,
  Users,
  Search,
  Filter,
  Calendar,
  Signature as SignatureIcon,
  Mail,
  Settings,
  Shield,
  Database,
  Edit,
  ExternalLink,
  PlusCircle,
  Ban,
} from 'lucide-react';
import { getProfile } from '@/lib/supabase/user-utils';


export default function UsersPage() {
  const [users, setUsers] = useState<Profile[]>([]);
  const [pseudousers, setPseudousers] = useState<Pseudouser[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [userSignatures, setUserSignatures] = useState<
    (SignatureGenuine | SignatureForged)[]
  >([]);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<Profile | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [signaturesLoading, setSignaturesLoading] = useState<boolean>(false);
  const [userEmailLoading, setUserEmailLoading] = useState<boolean>(true);

  const [usersChecked, setUsersChecked] = useState<boolean>(true);
  const [pseudousersChecked, setPseudousersChecked] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [appliedSearchQuery, setAppliedSearchQuery] = useState<string>('');
  const [sourceInput, setSourceInput] = useState<string>('');
  const [appliedSourceInput, setAppliedSourceInput] = useState<string>('');
  // true – включающий режим, false – исключающий
  const [sourceIncludeMode, setSourceIncludeMode] = useState<boolean>(true);
  const [appliedSourceIncludeMode, setAppliedSourceIncludeMode] =
    useState<boolean>(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([getUsers(), getPseudousers(), getProfile()])
      .then(([usersData, pseudousersData, currentUserData]) => {
        setUsers(usersData);
        setPseudousers(pseudousersData);
        setCurrentUser(currentUserData);
      })
      .finally(() => setLoading(false));
  }, []);

  // Фильтрация пользователей
  const filteredUsers = useMemo(() => {
    const allUsers: User[] = [
      ...(usersChecked ? users.map(createProfileUser) : []),
      ...(pseudousersChecked ? pseudousers.map(createPseudouserUser) : []),
    ];

    if (!appliedSearchQuery.trim() && !appliedSourceInput.trim()) {
      return allUsers;
    }

    const query = appliedSearchQuery.toLowerCase();
    const byName = allUsers.filter(user =>
      getUserName(user).toLowerCase().includes(query)
    );

    // Фильтр по source только для псевдопользователей
    const sources = appliedSourceInput
      .split(/[,;\n]+/)
      .map(s => s.trim().toLowerCase())
      .filter(Boolean);

    if (sources.length === 0) return byName;

    return byName.filter(user => {
      if (isProfile(user)) return false;
      const userSource = user.data.source.toLowerCase();
      const match = sources.includes(userSource);
      return appliedSourceIncludeMode ? match : !match;
    });
  }, [
    users,
    pseudousers,
    usersChecked,
    pseudousersChecked,
    appliedSearchQuery,
    appliedSourceInput,
    appliedSourceIncludeMode,
  ]);

  // Загрузка подписей и email выбранного пользователя
  useEffect(() => {
    setUserEmailLoading(true);
    setUserEmail(null);
    setUserSignatures([]);

    if (!selectedUser) {
      return;
    }

    setSignaturesLoading(true);
    getUserGenuineSignatures(selectedUser.data.id, selectedUser.type)
      .then(setUserSignatures)
      .finally(() => setSignaturesLoading(false));

    // Загружаем email только для обычных пользователей
    if (isProfile(selectedUser)) {
      (async () => {
        fetch(`/api/users/${selectedUser.data.id}`)
          .then(res => res.json())
          .then(data => {
            setUserEmail(data.email);
          })
          .catch(error => {
            console.error('Ошибка загрузки email:', error);
            setUserEmail(null);
          })
          .finally(() => setUserEmailLoading(false));
      })();
    }
  }, [selectedUser]);

  const handleUserSelect = useCallback((user: User) => {
    setSelectedUser(user);
  }, []);

  const applyFilters = () => {
    setAppliedSearchQuery(searchQuery);
    setAppliedSourceInput(sourceInput);
    setAppliedSourceIncludeMode(sourceIncludeMode);
  };

  const resetFilters = () => {
    setUsersChecked(true);
    setPseudousersChecked(true);
    setSearchQuery('');
    setAppliedSearchQuery('');
    setSourceInput('');
    setAppliedSourceInput('');
    setSourceIncludeMode(true);
  };

  // Проверки для управления пользователем
  const canManageUser = () => {
    if (!selectedUser || !currentUser) return false;

    // Если это псевдопользователь, можно управлять
    if (isPseudouser(selectedUser)) return true;

    // Если это обычный пользователь с ролью user, можно управлять
    if (isProfile(selectedUser) && selectedUser.data.role === 'user')
      return true;

    // Если это модератор или админ, нельзя управлять
    if (
      isProfile(selectedUser) &&
      (selectedUser.data.role === 'mod' || selectedUser.data.role === 'admin')
    ) {
      return false;
    }

    return true;
  };

  const isOwnProfile = () => {
    if (!selectedUser || !currentUser) return false;

    // Проверяем только для обычных пользователей
    if (isProfile(selectedUser)) {
      return selectedUser.data.id === currentUser.id;
    }

    return false;
  };

  // Поля для отображения в списке подписей
  const signaturePreviewFields: PreviewField[] = [
    {
      key: 'id',
      label: 'ID',
      getValue: signature => signature.id.slice(0, 8) + '...',
    },
    {
      key: 'input_type',
      label: 'Тип ввода',
      getValue: signature => signature.input_type || 'неизвестно',
    },
    {
      key: 'created_at',
      label: 'Дата создания',
      getValue: signature =>
        new Date(signature.created_at).toLocaleDateString('ru-RU'),
    },
  ];

  return (
    <div className='min-h-screen bg-background p-6'>
      <div className='mx-auto'>
        {/* Заголовок */}
        <div className='mb-8'>
          <h1 className='text-3xl font-bold mb-2'>Управление пользователями</h1>
          <p className='text-muted-foreground'>
            Просмотр и управление пользователями системы и их подписями
          </p>
        </div>

        <div className='grid grid-cols-1 lg:grid-cols-3 gap-6'>
          {/* Левая панель - Список пользователей */}
          <div className='lg:col-span-1'>
            <Card>
              <CardHeader>
                <CardTitle className='flex items-center gap-2'>
                  <Users className='h-5 w-5' />
                  Пользователи
                </CardTitle>
                <CardDescription>
                  Выберите пользователя для просмотра подробной информации
                </CardDescription>
              </CardHeader>
              <CardContent className='space-y-4'>
                {/* Фильтры */}
                <div className='space-y-4'>
                  <div className='flex items-center gap-2 text-sm font-medium text-muted-foreground'>
                    <Filter className='h-4 w-4' />
                    Фильтры
                  </div>

                  <div className='space-y-3'>
                    <CheckboxWithLabel
                      id='users'
                      checked={usersChecked}
                      onCheckedChange={() => setUsersChecked(!usersChecked)}
                      label='Обычные пользователи'
                    />
                    <CheckboxWithLabel
                      id='pseudousers'
                      checked={pseudousersChecked}
                      onCheckedChange={() =>
                        setPseudousersChecked(!pseudousersChecked)
                      }
                      label='Псевдопользователи'
                    />
                  </div>

                  <div className='space-y-2'>
                    <div className='flex items-center gap-2 text-sm font-medium text-muted-foreground'>
                      <Search className='h-4 w-4' />
                      Поиск
                    </div>
                    <Input
                      placeholder='Введите имя пользователя...'
                      value={searchQuery}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setSearchQuery(e.target.value)
                      }
                    />
                  </div>

                  {/* Фильтр по source для псевдопользователей */}
                  <div className='space-y-2 pt-2 border-t border-border'>
                    <div className='flex items-center gap-2 text-sm font-medium text-muted-foreground'>
                      <Filter className='h-4 w-4' />
                      Источник (псевдо)
                    </div>
                    <div className='flex gap-2'>
                      <Button
                        variant='outline'
                        size='default'
                        onClick={() => setSourceIncludeMode(!sourceIncludeMode)}
                        icon={sourceIncludeMode ? PlusCircle : Ban}
                        className='shrink-0'
                      >
                        {sourceIncludeMode ? 'Включая' : 'Исключая'}
                      </Button>
                      <Input
                        placeholder='Введите source, через запятую...'
                        value={sourceInput}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                          setSourceInput(e.target.value);
                        }}
                        className='flex-1'
                      />
                    </div>
                  </div>

                  <div className='flex gap-2'>
                    <Button
                      variant='default'
                      size='sm'
                      onClick={applyFilters}
                      className='flex-1'
                    >
                      Найти
                    </Button>
                    <Button
                      variant='outline'
                      size='sm'
                      onClick={resetFilters}
                      className='flex-1'
                    >
                      Сбросить
                    </Button>
                  </div>
                </div>

                <div className='border-t border-border' />

                {/* Список пользователей */}
                <div className='space-y-2'>
                  <div className='flex items-center justify-between'>
                    <span className='text-sm font-medium text-muted-foreground'>
                      Найдено: {filteredUsers.length}
                    </span>
                    {loading && (
                      <LoaderCircle className='h-4 w-4 animate-spin' />
                    )}
                  </div>

                  <div className='max-h-96 overflow-y-auto'>
                    <UserList 
                      users={filteredUsers}
                      loading={loading}
                      selectedUserId={selectedUser?.data.id ?? null}
                      onUserSelect={handleUserSelect}
                      emptyStateTitle="Пользователи не найдены"
                      emptyStateDescription="Попробуйте изменить критерии поиска"
                      showHeader={false}
                      batchSize={50}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Правая панель - Информация о пользователе */}
          <div className='lg:col-span-2'>
            {selectedUser ? (
              <div className='space-y-6'>
                {/* Информация о пользователе */}
                <Card>
                  <CardHeader>
                    <CardTitle className='flex items-center gap-2'>
                      <UserIcon className='h-5 w-5' />
                      Информация о пользователе
                    </CardTitle>
                  </CardHeader>
                  <CardContent className='space-y-4'>
                    <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                      <div>
                        <label className='text-sm font-medium text-muted-foreground'>
                          Имя
                        </label>
                        <div className='text-lg font-semibold'>
                          {getUserName(selectedUser)}
                        </div>
                      </div>
                      <div>
                        <label className='text-sm font-medium text-muted-foreground'>
                          Тип
                        </label>
                        <div className='flex items-center gap-2 mt-1'>
                          <Badge
                            variant={
                              selectedUser.type === 'user'
                                ? 'default'
                                : 'secondary'
                            }
                          >
                            {selectedUser.type === 'user'
                              ? 'Обычный пользователь'
                              : 'Псевдопользователь'}
                          </Badge>
                          {isProfile(selectedUser) && (
                            <Badge variant='outline'>
                              {selectedUser.data.role}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div>
                        <label className='text-sm font-medium text-muted-foreground'>
                          ID
                        </label>
                        <div className='text-sm font-mono'>
                          {selectedUser.data.id}
                        </div>
                      </div>
                      <div>
                        <label className='text-sm font-medium text-muted-foreground'>
                          Дата создания
                        </label>
                        <div className='text-sm flex items-center gap-1'>
                          <Calendar className='h-4 w-4' />
                          {new Date(
                            selectedUser.data.created_at
                          ).toLocaleDateString('ru-RU', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </div>
                      </div>
                      {isProfile(selectedUser) && (
                        <div>
                          <label className='text-sm font-medium text-muted-foreground'>
                            Email
                          </label>
                          <div className='text-sm flex items-center gap-1'>
                            <Mail className='h-4 w-4' />
                            {userEmailLoading ? <LoaderCircle className='animate-spin' /> : userEmail}
                          </div>
                        </div>
                      )}
                      {isPseudouser(selectedUser) && (
                        <div>
                          <label className='text-sm font-medium text-muted-foreground'>
                            Источник
                          </label>
                          <div className='text-sm'>
                            {selectedUser.data.source}
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Управление пользователем */}
                <Card>
                  <CardHeader>
                    <CardTitle className='flex items-center gap-2'>
                      <Settings className='h-5 w-5' />
                      Управление
                    </CardTitle>
                    <CardDescription>
                      Управление настройками и данными пользователя
                    </CardDescription>
                  </CardHeader>
                  <CardContent className='space-y-6'>
                    {/* Проверка прав доступа */}
                    {!canManageUser() ? (
                      <div className='text-center py-8'>
                        <div className='text-muted-foreground mb-4'>
                          <Shield className='h-12 w-12 mx-auto mb-2 opacity-50' />
                          <p className='text-lg font-medium mb-2'>
                            Вы не можете изменять настройки этого профиля
                          </p>
                          <p className='text-sm'>
                            {isProfile(selectedUser) &&
                            (selectedUser.data.role === 'mod' ||
                              selectedUser.data.role === 'admin')
                              ? 'Управление профилями модераторов и администраторов ограничено'
                              : 'Недостаточно прав для управления этим профилем'}
                          </p>
                        </div>
                        {isOwnProfile() && (
                          <div className='mt-4'>
                            <Button asChild variant='outline'>
                              <a
                                href='/dashboard'
                                className='flex items-center gap-2'
                              >
                                <ExternalLink className='h-4 w-4' />
                                Управление профилем доступно здесь
                              </a>
                            </Button>
                          </div>
                        )}
                      </div>
                    ) : (
                      <>
                        {/* Использование подписей как примеров для подделки */}
                        <div className='space-y-3'>
                          <div className='flex items-center gap-2'>
                            <Shield className='h-4 w-4 text-muted-foreground' />
                            <h4 className='font-medium'>
                              Использование подписей как примеров для подделки
                            </h4>
                          </div>
                          <div className='flex gap-2'>
                            <Button
                              variant='default'
                              size='sm'
                              className='flex-1'
                            >
                              Разрешить все
                            </Button>
                            <Button
                              variant='destructive'
                              size='sm'
                              className='flex-1'
                            >
                              Запретить все
                            </Button>
                          </div>
                        </div>

                        {/* Использование подписей в датасете */}
                        <div className='space-y-3'>
                          <div className='flex items-center gap-2'>
                            <Database className='h-4 w-4 text-muted-foreground' />
                            <h4 className='font-medium'>
                              Использование подписей в датасете
                            </h4>
                          </div>
                          <div className='flex gap-2'>
                            <Button
                              variant='default'
                              size='sm'
                              className='flex-1'
                            >
                              Разрешить все
                            </Button>
                            <Button
                              variant='destructive'
                              size='sm'
                              className='flex-1'
                            >
                              Запретить все
                            </Button>
                          </div>
                        </div>

                        {/* Профиль */}
                        <div className='space-y-3'>
                          <div className='flex items-center gap-2'>
                            <Edit className='h-4 w-4 text-muted-foreground' />
                            <h4 className='font-medium'>Профиль</h4>
                          </div>
                          <div className='flex gap-2'>
                            <Button
                              variant='outline'
                              size='sm'
                              className='flex-1'
                            >
                              Переименовать
                            </Button>
                            <Button
                              variant='outline'
                              size='sm'
                              className='flex-1'
                            >
                              {isProfile(selectedUser)
                                ? 'Изменить email'
                                : 'Изменить источник'}
                            </Button>
                          </div>
                          <div className='flex gap-2'>
                            <Button
                              variant='destructive'
                              size='sm'
                              className='flex-1'
                            >
                              Удалить подписи
                            </Button>
                            <Button
                              variant='destructive'
                              size='sm'
                              className='flex-1'
                            >
                              Удалить профиль
                            </Button>
                          </div>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>

                {/* Подписи пользователя */}
                <Card>
                  <CardHeader>
                    <CardTitle className='flex items-center gap-2'>
                      <SignatureIcon className='h-5 w-5' />
                      Подписи пользователя
                    </CardTitle>
                    <CardDescription>
                      Все подписи, созданные этим пользователем
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <SignatureList
                      signatures={userSignatures}
                      loading={signaturesLoading}
                      previewFields={signaturePreviewFields}
                      emptyStateTitle='У пользователя нет подписей'
                      emptyStateDescription='Этот пользователь еще не создавал подписи в системе'
                    />
                  </CardContent>
                </Card>
              </div>
            ) : (
              <Card>
                <CardContent className='flex flex-col items-center justify-center py-12'>
                  <UserIcon className='h-16 w-16 text-muted-foreground/50 mb-4' />
                  <h3 className='text-lg font-medium mb-2'>
                    Выберите пользователя
                  </h3>
                  <p className='text-muted-foreground text-center'>
                    Выберите пользователя из списка слева, чтобы просмотреть
                    подробную информацию и его подписи
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
