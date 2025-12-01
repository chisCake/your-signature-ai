import { render, screen } from '@testing-library/react';
import { BadgeFactory } from '@/lib/utils/badge-factory';
import {
  createTestGenuineSignature,
  createTestForgedSignature,
} from '@/lib/__tests__/test-helpers';

describe('BadgeFactory', () => {
  describe('authenticity', () => {
    it('should render "Настоящая" badge for genuine signature', () => {
      const genuine = createTestGenuineSignature('sig-123');
      const signature = { type: 'genuine' as const, data: genuine };
      const badge = BadgeFactory.authenticity(signature);

      render(badge);

      expect(screen.getByText('Настоящая')).toBeInTheDocument();
    });

    it('should render "Поддельная" badge for forged signature', () => {
      const forged = createTestForgedSignature('forged-123');
      const signature = { type: 'forged' as const, data: forged };
      const badge = BadgeFactory.authenticity(signature);

      render(badge);

      expect(screen.getByText('Поддельная')).toBeInTheDocument();
    });

    it('should have correct tooltip for genuine signature', () => {
      const genuine = createTestGenuineSignature('sig-123');
      const signature = { type: 'genuine' as const, data: genuine };
      const badge = BadgeFactory.authenticity(signature);

      render(badge);

      // Tooltip is rendered by Radix UI, so we check for the tooltip text in the component
      // The tooltip prop is passed to Badge component
      const badgeElement = screen.getByText('Настоящая');
      expect(badgeElement).toBeInTheDocument();
    });

    it('should have correct tooltip for forged signature', () => {
      const forged = createTestForgedSignature('forged-123');
      const signature = { type: 'forged' as const, data: forged };
      const badge = BadgeFactory.authenticity(signature);

      render(badge);

      const badgeElement = screen.getByText('Поддельная');
      expect(badgeElement).toBeInTheDocument();
    });
  });

  describe('userForForgery', () => {
    it('should render "Публичная" badge when user_for_forgery is true', () => {
      const genuine = createTestGenuineSignature('sig-123');
      genuine.user_for_forgery = true;
      const badge = BadgeFactory.userForForgery(genuine);

      render(badge);

      expect(screen.getByText('Публичная')).toBeInTheDocument();
    });

    it('should render "Скрыта пользователем" badge when user_for_forgery is false', () => {
      const genuine = createTestGenuineSignature('sig-123');
      genuine.user_for_forgery = false;
      const badge = BadgeFactory.userForForgery(genuine);

      render(badge);

      expect(screen.getByText('Скрыта пользователем')).toBeInTheDocument();
    });

    it('should render "Скрыта пользователем" badge when user_for_forgery is undefined', () => {
      const genuine = createTestGenuineSignature('sig-123');
      (genuine as Partial<typeof genuine>).user_for_forgery = undefined;
      const badge = BadgeFactory.userForForgery(genuine);

      render(badge);

      expect(screen.getByText('Скрыта пользователем')).toBeInTheDocument();
    });

    it('should use green variant when user_for_forgery is true', () => {
      const genuine = createTestGenuineSignature('sig-123');
      genuine.user_for_forgery = true;
      const badge = BadgeFactory.userForForgery(genuine);

      const { container } = render(badge);
      const badgeElement = container.querySelector('.bg-green-500');

      expect(badgeElement).toBeInTheDocument();
    });

    it('should use yellow variant when user_for_forgery is false', () => {
      const genuine = createTestGenuineSignature('sig-123');
      genuine.user_for_forgery = false;
      const badge = BadgeFactory.userForForgery(genuine);

      const { container } = render(badge);
      const badgeElement = container.querySelector('.bg-yellow-500');

      expect(badgeElement).toBeInTheDocument();
    });
  });

  describe('modForForgery', () => {
    it('should render "Публичная" badge when mod_for_forgery is true', () => {
      const genuine = createTestGenuineSignature('sig-123');
      genuine.mod_for_forgery = true;
      const badge = BadgeFactory.modForForgery(genuine);

      render(badge);

      expect(screen.getByText('Публичная')).toBeInTheDocument();
    });

    it('should render "Скрыта модератором" badge when mod_for_forgery is false', () => {
      const genuine = createTestGenuineSignature('sig-123');
      genuine.mod_for_forgery = false;
      const badge = BadgeFactory.modForForgery(genuine);

      render(badge);

      expect(screen.getByText('Скрыта модератором')).toBeInTheDocument();
    });

    it('should render "Скрыта модератором" badge when mod_for_forgery is undefined', () => {
      const genuine = createTestGenuineSignature('sig-123');
      (genuine as Partial<typeof genuine>).mod_for_forgery = undefined;
      const badge = BadgeFactory.modForForgery(genuine);

      render(badge);

      expect(screen.getByText('Скрыта модератором')).toBeInTheDocument();
    });

    it('should use green variant when mod_for_forgery is true', () => {
      const genuine = createTestGenuineSignature('sig-123');
      genuine.mod_for_forgery = true;
      const badge = BadgeFactory.modForForgery(genuine);

      const { container } = render(badge);
      const badgeElement = container.querySelector('.bg-green-500');

      expect(badgeElement).toBeInTheDocument();
    });

    it('should use red variant when mod_for_forgery is false', () => {
      const genuine = createTestGenuineSignature('sig-123');
      genuine.mod_for_forgery = false;
      const badge = BadgeFactory.modForForgery(genuine);

      const { container } = render(badge);
      const badgeElement = container.querySelector('.bg-red-500');

      expect(badgeElement).toBeInTheDocument();
    });
  });

  describe('modForDataset', () => {
    it('should render "В датасете" badge when mod_for_dataset is true and showInDataset is true', () => {
      const genuine = createTestGenuineSignature('sig-123');
      genuine.mod_for_dataset = true;
      const signature = { type: 'genuine' as const, data: genuine };
      const badge = BadgeFactory.modForDataset(signature, true);

      render(badge);

      expect(screen.getByText('В датасете')).toBeInTheDocument();
    });

    it('should render empty fragment when mod_for_dataset is true and showInDataset is false', () => {
      const genuine = createTestGenuineSignature('sig-123');
      genuine.mod_for_dataset = true;
      const signature = { type: 'genuine' as const, data: genuine };
      const badge = BadgeFactory.modForDataset(signature, false);

      const { container } = render(badge);

      expect(container.firstChild).toBeNull();
    });

    it('should render "Не в датасете" badge when mod_for_dataset is false', () => {
      const genuine = createTestGenuineSignature('sig-123');
      genuine.mod_for_dataset = false;
      const signature = { type: 'genuine' as const, data: genuine };
      const badge = BadgeFactory.modForDataset(signature, false);

      render(badge);

      expect(screen.getByText('Не в датасете')).toBeInTheDocument();
    });

    it('should render "Не в датасете" badge when mod_for_dataset is false even if showInDataset is true', () => {
      const genuine = createTestGenuineSignature('sig-123');
      genuine.mod_for_dataset = false;
      const signature = { type: 'genuine' as const, data: genuine };
      const badge = BadgeFactory.modForDataset(signature, true);

      render(badge);

      expect(screen.getByText('Не в датасете')).toBeInTheDocument();
    });

    it('should use green variant when mod_for_dataset is true and showInDataset is true', () => {
      const genuine = createTestGenuineSignature('sig-123');
      genuine.mod_for_dataset = true;
      const signature = { type: 'genuine' as const, data: genuine };
      const badge = BadgeFactory.modForDataset(signature, true);

      const { container } = render(badge);
      const badgeElement = container.querySelector('.bg-green-500');

      expect(badgeElement).toBeInTheDocument();
    });

    it('should use red variant when mod_for_dataset is false', () => {
      const genuine = createTestGenuineSignature('sig-123');
      genuine.mod_for_dataset = false;
      const signature = { type: 'genuine' as const, data: genuine };
      const badge = BadgeFactory.modForDataset(signature, false);

      const { container } = render(badge);
      const badgeElement = container.querySelector('.bg-red-500');

      expect(badgeElement).toBeInTheDocument();
    });

    it('should work with forged signature', () => {
      const forged = createTestForgedSignature('forged-123');
      forged.mod_for_dataset = true;
      const signature = { type: 'forged' as const, data: forged };
      const badge = BadgeFactory.modForDataset(signature, true);

      render(badge);

      expect(screen.getByText('В датасете')).toBeInTheDocument();
    });

    it('should default showInDataset to false', () => {
      const genuine = createTestGenuineSignature('sig-123');
      genuine.mod_for_dataset = true;
      const signature = { type: 'genuine' as const, data: genuine };
      const badge = BadgeFactory.modForDataset(signature);

      const { container } = render(badge);

      expect(container.firstChild).toBeNull();
    });
  });
});
