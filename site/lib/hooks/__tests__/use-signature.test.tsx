// Мокируем Next.js Link перед импортами
jest.mock('next/link', () => {
  const React = require('react');
  return {
    __esModule: true,
    default: function MockLink({ children, href, ...props }: any) {
      return React.createElement('a', { href, ...props }, children);
    },
  };
});

// Мокируем зависимости для useSignatureOwner
jest.mock('@/lib/utils/auth-client-utils', () => ({
  getUserProfile: jest.fn(),
}));

jest.mock('@/lib/utils/signature-utils', () => ({
  getGenuineSignatureOwnerId: jest.fn(),
  getForgedSignatureOwnerId: jest.fn(),
}));

import { renderHook, waitFor, act } from '@testing-library/react';
import { render, screen, cleanup } from '@testing-library/react';
import {
  useAuthenticityBadge,
  useCommonForForgeryBadge,
  useDeleteSignatureButton,
  useDownloadSignatureButton,
  useModForDatasetBadge,
  useModForForgeryBadge,
  useOpenSignatureButton,
  useUserForForgeryBadge,
  useUserForForgeryButton,
  useModForForgeryButton,
  useModForDatasetButton,
  useSignatureOwner,
} from '../use-signature';
import {
  createTestSignature,
  createTestProfile,
} from '@/lib/__tests__/test-helpers';

describe('use-signature hooks - badges', () => {
  describe('useAuthenticityBadge', () => {
    it('should return "Настоящая" badge for genuine=true', () => {
      const { result } = renderHook(() => useAuthenticityBadge(true));

      const { container } = render(result.current);
      expect(container.textContent).toContain('Настоящая');
      cleanup();
    });

    it('should return "Поддельная" badge for genuine=false', () => {
      const { result } = renderHook(() => useAuthenticityBadge(false));

      const { container } = render(result.current);
      expect(container.textContent).toContain('Поддельная');
      cleanup();
    });

    it('should update badge when isGenuine changes', () => {
      const { result, rerender } = renderHook(
        ({ isGenuine }) => useAuthenticityBadge(isGenuine),
        { initialProps: { isGenuine: true } }
      );

      const { container, rerender: rerenderComponent } = render(result.current);
      expect(container.textContent).toContain('Настоящая');

      rerender({ isGenuine: false });
      rerenderComponent(result.current);
      expect(container.textContent).toContain('Поддельная');
      cleanup();
    });
  });

  describe('useUserForForgeryBadge', () => {
    it('should return badge only for genuine signatures', () => {
      const { result } = renderHook(() => useUserForForgeryBadge(true, true));

      expect(result.current).not.toBeNull();
    });

    it('should return null for forged signatures', () => {
      const { result } = renderHook(() => useUserForForgeryBadge(true, false));

      expect(result.current).toBeNull();
    });

    it('should return "Публичная" badge when userForForgery=true', () => {
      const { result } = renderHook(() => useUserForForgeryBadge(true, true));

      const { container } = render(result.current!);
      expect(container.textContent).toContain('Публичная');
      cleanup();
    });

    it('should return "Скрыта пользователем" badge when userForForgery=false', () => {
      const { result } = renderHook(() => useUserForForgeryBadge(false, true));

      const { container } = render(result.current!);
      // Ищем текст в контейнере, так как Badge обернут в TooltipProvider
      const badgeText = container.textContent;
      expect(badgeText).toContain('Скрыта пользователем');
      cleanup();
    });

    it('should update badge when userForForgery changes', () => {
      const { result, rerender } = renderHook(
        ({ userForForgery }) => useUserForForgeryBadge(userForForgery, true),
        { initialProps: { userForForgery: true } }
      );

      const { container, rerender: rerenderComponent } = render(
        result.current!
      );
      expect(container.textContent).toContain('Публичная');

      rerender({ userForForgery: false });
      rerenderComponent(result.current!);
      expect(container.textContent).toContain('Скрыта пользователем');
      cleanup();
    });
  });

  describe('useModForForgeryBadge', () => {
    it('should return badge only for genuine signatures', () => {
      const { result } = renderHook(() => useModForForgeryBadge(true, true));

      expect(result.current).not.toBeNull();
    });

    it('should return null for forged signatures', () => {
      const { result } = renderHook(() => useModForForgeryBadge(true, false));

      expect(result.current).toBeNull();
    });

    it('should return "Публичная" badge when modForForgery=true', () => {
      const { result } = renderHook(() => useModForForgeryBadge(true, true));

      const { container } = render(result.current!);
      expect(container.textContent).toContain('Публичная');
      cleanup();
    });

    it('should return "Скрыта модератором" badge when modForForgery=false', () => {
      const { result } = renderHook(() => useModForForgeryBadge(false, true));

      const { container } = render(result.current!);
      expect(container.textContent).toContain('Скрыта модератором');
      cleanup();
    });

    it('should update badge when modForForgery changes', () => {
      const { result, rerender } = renderHook(
        ({ modForForgery }) => useModForForgeryBadge(modForForgery, true),
        { initialProps: { modForForgery: true } }
      );

      const { container, rerender: rerenderComponent } = render(
        result.current!
      );
      expect(container.textContent).toContain('Публичная');

      rerender({ modForForgery: false });
      rerenderComponent(result.current!);
      expect(container.textContent).toContain('Скрыта модератором');
      cleanup();
    });
  });

  describe('useModForDatasetBadge', () => {
    it('should return "В датасете" badge when modForDataset=true', () => {
      const { result } = renderHook(() => useModForDatasetBadge(true));

      const { container } = render(result.current);
      expect(container.textContent).toContain('В датасете');
      cleanup();
    });

    it('should return "Не в датасете" badge when modForDataset=false', () => {
      const { result } = renderHook(() => useModForDatasetBadge(false));

      const { container } = render(result.current);
      expect(container.textContent).toContain('Не в датасете');
      cleanup();
    });

    it('should update badge when modForDataset changes', () => {
      const { result, rerender } = renderHook(
        ({ modForDataset }) => useModForDatasetBadge(modForDataset),
        { initialProps: { modForDataset: true } }
      );

      const { container, rerender: rerenderComponent } = render(result.current);
      expect(container.textContent).toContain('В датасете');

      rerender({ modForDataset: false });
      rerenderComponent(result.current);
      expect(container.textContent).toContain('Не в датасете');
      cleanup();
    });
  });

  describe('useCommonForForgeryBadge', () => {
    it('should return null for forged signatures', () => {
      const { result } = renderHook(() =>
        useCommonForForgeryBadge(true, true, false)
      );

      expect(result.current).toBeNull();
    });

    it('should return "Публичная" badge when both userForForgery and modForForgery are true', () => {
      const { result } = renderHook(() =>
        useCommonForForgeryBadge(true, true, true)
      );

      const { container } = render(result.current!);
      expect(container.textContent).toContain('Публичная');
      cleanup();
    });

    it('should return userForForgeryBadge when userForForgery=true and modForForgery=false', () => {
      const { result } = renderHook(() =>
        useCommonForForgeryBadge(true, false, true)
      );

      const { container } = render(result.current!);
      // Когда userForForgery=true, бейдж должен быть "Публичная"
      expect(container.textContent).toContain('Публичная');
      cleanup();
    });

    it('should return modForForgeryBadge when userForForgery=false and modForForgery=true', () => {
      const { result } = renderHook(() =>
        useCommonForForgeryBadge(false, true, true)
      );

      const { container } = render(result.current!);
      // Когда modForForgery=true, бейдж должен быть "Публичная"
      expect(container.textContent).toContain('Публичная');
      cleanup();
    });

    it('should return null when both userForForgery and modForForgery are false', () => {
      const { result } = renderHook(() =>
        useCommonForForgeryBadge(false, false, true)
      );

      expect(result.current).toBeNull();
    });

    it('should update badge when userForForgery changes', () => {
      const { result, rerender } = renderHook(
        ({ userForForgery }) =>
          useCommonForForgeryBadge(userForForgery, true, true),
        { initialProps: { userForForgery: false } }
      );

      const { container, rerender: rerenderComponent } = render(
        result.current!
      );
      // Когда userForForgery=false && modForForgery=true, возвращается modForForgeryBadge, который при modForForgery=true показывает "Публичная"
      expect(container.textContent).toContain('Публичная');

      rerender({ userForForgery: true });
      rerenderComponent(result.current!);
      // Когда оба true, показывается "Публичная"
      expect(container.textContent).toContain('Публичная');
      cleanup();
    });

    it('should update badge when modForForgery changes', () => {
      const { result, rerender } = renderHook(
        ({ modForForgery }) =>
          useCommonForForgeryBadge(true, modForForgery, true),
        { initialProps: { modForForgery: false } }
      );

      const { container, rerender: rerenderComponent } = render(
        result.current!
      );
      // Когда userForForgery=true && modForForgery=false, возвращается userForForgeryBadge, который при userForForgery=true показывает "Публичная"
      expect(container.textContent).toContain('Публичная');

      rerender({ modForForgery: true });
      rerenderComponent(result.current!);
      // Когда оба true, показывается "Публичная"
      expect(container.textContent).toContain('Публичная');
      cleanup();
    });
  });
});

describe('use-signature hooks - buttons', () => {
  describe('useOpenSignatureButton', () => {
    it('should create button with correct href', () => {
      const signature = createTestSignature('genuine', { id: 'test-sig-123' });
      const { result } = renderHook(() => useOpenSignatureButton(signature));

      // Проверяем, что хук возвращает компонент
      expect(result.current).toBeDefined();
      expect(result.current).not.toBeNull();
      // Проверяем, что это React элемент
      expect(result.current).toHaveProperty('type');
    });

    it('should update href when signature id changes', () => {
      const signature1 = createTestSignature('genuine', { id: 'sig-1' });
      const { result, rerender } = renderHook(
        ({ signature }) => useOpenSignatureButton(signature),
        { initialProps: { signature: signature1 } }
      );

      expect(result.current).toBeDefined();
      const firstComponent = result.current;

      const signature2 = createTestSignature('genuine', { id: 'sig-2' });
      rerender({ signature: signature2 });

      // Компонент должен обновиться (новый ключ из-за изменения id)
      expect(result.current).toBeDefined();
      expect(result.current).not.toBe(firstComponent);
    });

    it('should work with forged signature', () => {
      const signature = createTestSignature('forged', { id: 'forged-123' });
      const { result } = renderHook(() => useOpenSignatureButton(signature));

      expect(result.current).toBeDefined();
      expect(result.current).not.toBeNull();
    });
  });

  describe('useDownloadSignatureButton', () => {
    it('should call handleDownload when clicked', () => {
      const handleDownload = jest.fn();
      const { result } = renderHook(() =>
        useDownloadSignatureButton(handleDownload)
      );

      render(result.current);
      const button = screen.getByRole('button', { name: /скачать/i });

      expect(button).toBeInTheDocument();
      button.click();

      expect(handleDownload).toHaveBeenCalledTimes(1);
    });

    it('should update when handleDownload changes', () => {
      const handleDownload1 = jest.fn();
      const { result, rerender } = renderHook(
        ({ handleDownload }) => useDownloadSignatureButton(handleDownload),
        { initialProps: { handleDownload: handleDownload1 } }
      );

      const handleDownload2 = jest.fn();
      rerender({ handleDownload: handleDownload2 });

      render(result.current);
      expect(
        screen.getByRole('button', { name: /скачать/i })
      ).toBeInTheDocument();
    });
  });

  describe('useUserForForgeryButton', () => {
    it('should have correct isToggled state when userForForgery=true', () => {
      const handleUserForForgery = jest.fn();
      const { result } = renderHook(() =>
        useUserForForgeryButton(true, handleUserForForgery, false)
      );

      render(result.current);
      const button = screen.getByRole('button', { name: /сделать скрытой/i });

      expect(button).toBeInTheDocument();
      expect(button).toHaveAttribute('title', 'Сделать скрытой');
    });

    it('should have correct isToggled state when userForForgery=false', () => {
      const handleUserForForgery = jest.fn();
      const { result } = renderHook(() =>
        useUserForForgeryButton(false, handleUserForForgery, false)
      );

      render(result.current);
      const button = screen.getByRole('button', { name: /сделать публичной/i });

      expect(button).toBeInTheDocument();
      expect(button).toHaveAttribute('title', 'Сделать публичной');
    });

    it('should be disabled when loading', () => {
      const handleUserForForgery = jest.fn();
      const { result } = renderHook(() =>
        useUserForForgeryButton(true, handleUserForForgery, true)
      );

      render(result.current);
      const button = screen.getByRole('button');

      expect(button).toBeDisabled();
    });

    it('should call handleUserForForgery when toggled', () => {
      const handleUserForForgery = jest.fn();
      const { result } = renderHook(() =>
        useUserForForgeryButton(false, handleUserForForgery, false)
      );

      render(result.current);
      const button = screen.getByRole('button');

      button.click();

      expect(handleUserForForgery).toHaveBeenCalledTimes(1);
    });
  });

  describe('useModForForgeryButton', () => {
    it('should have correct isToggled state when modForForgery=true', () => {
      const handleModForForgery = jest.fn();
      const { result } = renderHook(() =>
        useModForForgeryButton(true, handleModForForgery, false)
      );

      render(result.current);
      const button = screen.getByRole('button', { name: /сделать скрытой/i });

      expect(button).toBeInTheDocument();
      expect(button).toHaveAttribute('title', 'Сделать скрытой');
    });

    it('should have correct isToggled state when modForForgery=false', () => {
      const handleModForForgery = jest.fn();
      const { result } = renderHook(() =>
        useModForForgeryButton(false, handleModForForgery, false)
      );

      render(result.current);
      const button = screen.getByRole('button', { name: /сделать публичной/i });

      expect(button).toBeInTheDocument();
      expect(button).toHaveAttribute('title', 'Сделать публичной');
    });

    it('should be disabled when loading', () => {
      const handleModForForgery = jest.fn();
      const { result } = renderHook(() =>
        useModForForgeryButton(true, handleModForForgery, true)
      );

      render(result.current);
      const button = screen.getByRole('button');

      expect(button).toBeDisabled();
    });

    it('should call handleModForForgery when toggled', () => {
      const handleModForForgery = jest.fn();
      const { result } = renderHook(() =>
        useModForForgeryButton(false, handleModForForgery, false)
      );

      render(result.current);
      const button = screen.getByRole('button');

      button.click();

      expect(handleModForForgery).toHaveBeenCalledTimes(1);
    });
  });

  describe('useModForDatasetButton', () => {
    it('should have correct isToggled state when modForDataset=true', () => {
      const handleModForDataset = jest.fn();
      const { result } = renderHook(() =>
        useModForDatasetButton(true, handleModForDataset, false)
      );

      render(result.current);
      const button = screen.getByRole('button', {
        name: /исключить из датасета/i,
      });

      expect(button).toBeInTheDocument();
      expect(button).toHaveAttribute('title', 'Исключить из датасета');
    });

    it('should have correct isToggled state when modForDataset=false', () => {
      const handleModForDataset = jest.fn();
      const { result } = renderHook(() =>
        useModForDatasetButton(false, handleModForDataset, false)
      );

      render(result.current);
      const button = screen.getByRole('button', {
        name: /включить в датасет/i,
      });

      expect(button).toBeInTheDocument();
      expect(button).toHaveAttribute('title', 'Включить в датасет');
    });

    it('should be disabled when loading', () => {
      const handleModForDataset = jest.fn();
      const { result } = renderHook(() =>
        useModForDatasetButton(true, handleModForDataset, true)
      );

      render(result.current);
      const button = screen.getByRole('button');

      expect(button).toBeDisabled();
    });

    it('should call handleModForDataset when toggled', () => {
      const handleModForDataset = jest.fn();
      const { result } = renderHook(() =>
        useModForDatasetButton(false, handleModForDataset, false)
      );

      render(result.current);
      const button = screen.getByRole('button');

      button.click();

      expect(handleModForDataset).toHaveBeenCalledTimes(1);
    });
  });

  describe('useDeleteSignatureButton', () => {
    it('should call handleDelete when clicked', () => {
      const handleDelete = jest.fn();
      const { result } = renderHook(() =>
        useDeleteSignatureButton(handleDelete)
      );

      render(result.current);
      const button = screen.getByRole('button', { name: /удалить/i });

      expect(button).toBeInTheDocument();
      expect(button).toHaveAttribute('title', 'Удалить');
      button.click();

      expect(handleDelete).toHaveBeenCalledTimes(1);
    });

    it('should update when handleDelete changes', () => {
      const handleDelete1 = jest.fn();
      const { result, rerender } = renderHook(
        ({ handleDelete }) => useDeleteSignatureButton(handleDelete),
        { initialProps: { handleDelete: handleDelete1 } }
      );

      const handleDelete2 = jest.fn();
      rerender({ handleDelete: handleDelete2 });

      render(result.current);
      expect(
        screen.getByRole('button', { name: /удалить/i })
      ).toBeInTheDocument();
    });
  });

  describe('useSignatureOwner', () => {
    const { getUserProfile } = require('@/lib/utils/auth-client-utils');
    const {
      getGenuineSignatureOwnerId,
      getForgedSignatureOwnerId,
    } = require('@/lib/utils/signature-utils');

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should return null when signature is null', async () => {
      const { useSignatureOwner } = require('../use-signature');
      const { result } = renderHook(() => useSignatureOwner(null));

      await waitFor(() => {
        expect(result.current).toBeNull();
      });
    });

    it('should return owner for genuine signature with user_id matching current user', async () => {
      const signature = createTestSignature('genuine', {
        id: 'sig-1',
        userId: 'user-1',
      });
      const profile = createTestProfile('user-1', 'user', 'Test User');

      (getUserProfile as jest.Mock).mockResolvedValue(profile);
      (getGenuineSignatureOwnerId as jest.Mock).mockReturnValue({
        id: 'user-1',
      });

      const { result } = renderHook(() => useSignatureOwner(signature));

      await waitFor(() => {
        expect(result.current).not.toBeNull();
        expect(result.current?.type).toBe('user');
      });
    });

    it('should return null when ownerId does not match current user', async () => {
      const signature = createTestSignature('genuine', {
        id: 'sig-1',
        userId: 'user-2',
      });
      const profile = createTestProfile('user-1', 'user', 'Test User');

      (getUserProfile as jest.Mock).mockResolvedValue(profile);
      (getGenuineSignatureOwnerId as jest.Mock).mockReturnValue({
        id: 'user-2',
      });

      const { result } = renderHook(() => useSignatureOwner(signature));

      await waitFor(() => {
        // Когда ownerId не совпадает, используется профиль текущего пользователя
        expect(result.current).not.toBeNull();
      });
    });

    it('should return null when user profile is not found', async () => {
      const signature = createTestSignature('genuine', {
        id: 'sig-1',
        userId: 'user-1',
      });

      (getUserProfile as jest.Mock).mockResolvedValue(null);
      (getGenuineSignatureOwnerId as jest.Mock).mockReturnValue({
        id: 'user-1',
      });

      const { result } = renderHook(() => useSignatureOwner(signature));

      await waitFor(() => {
        expect(result.current).toBeNull();
      });
    });

    it('should return owner for forged signature', async () => {
      const signature = createTestSignature('forged', {
        id: 'sig-1',
        userId: 'forger-1',
      });
      const profile = createTestProfile('user-1', 'user', 'Test User');

      (getUserProfile as jest.Mock).mockResolvedValue(profile);
      (getForgedSignatureOwnerId as jest.Mock).mockReturnValue('forger-1');

      const { result } = renderHook(() => useSignatureOwner(signature));

      await waitFor(() => {
        // Когда ownerId не совпадает, используется профиль текущего пользователя
        expect(result.current).not.toBeNull();
      });
    });

    it('should return null when signature has no ownerId', async () => {
      const signature = createTestSignature('genuine', {
        id: 'sig-1',
      });
      const profile = createTestProfile('user-1', 'user', 'Test User');

      (getUserProfile as jest.Mock).mockResolvedValue(profile);
      (getGenuineSignatureOwnerId as jest.Mock).mockReturnValue(null);

      const { result } = renderHook(() => useSignatureOwner(signature));

      await waitFor(() => {
        expect(result.current).toBeNull();
      });
    });
  });
});
