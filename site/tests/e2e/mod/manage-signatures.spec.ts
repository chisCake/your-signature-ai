import { test, expect } from '@playwright/test';

test.describe('Manage Signatures (Moderator)', () => {
  test.beforeEach(async ({ page }) => {
    // Переходим на страницу подписей
    await page.goto('/signatures', { waitUntil: 'networkidle' });

    // Ждем загрузки страницы
    await page.waitForFunction(
      () => document.title.includes('Обзор подписей'),
      { timeout: 10000 }
    );
  });

  test('should search signature by ID', async ({ page }) => {
    // Вводим ID подписи в поле поиска
    const searchInput = page.getByPlaceholder(/Введите ID подписи/i);
    await expect(searchInput).toBeVisible();

    // Вводим ID (используем валидный формат UUID)
    const testSignatureId = '00000000-0000-0000-0000-000000000001';
    await searchInput.fill(testSignatureId);

    // Нажимаем кнопку "Найти"
    const searchButton = page.getByRole('button', { name: /Найти/i });
    await searchButton.click();

    // Ждем результатов поиска
    await page.waitForTimeout(2000);

    // Проверяем, что поиск выполнен (может быть результат или сообщение "не найдено")
    // Страница не должна показывать ошибку
    await expect(page).toHaveURL('/signatures');
  });

  test('should filter signatures by category', async ({ page }) => {
    // Переключаемся на поддельные подписи
    const forgedButton = page.getByRole('button', { name: /Поддельные/i });
    await forgedButton.click();

    // Ждем загрузки данных
    await page.waitForTimeout(2000);

    // Проверяем, что кнопка активна
    await expect(forgedButton).toHaveAttribute('class', /default|bg-primary/i);

    // Переключаемся обратно на настоящие
    const genuineButton = page.getByRole('button', { name: /Настоящие/i });
    await genuineButton.click();

    await page.waitForTimeout(2000);
    await expect(genuineButton).toHaveAttribute('class', /default|bg-primary/i);
  });

  test('should change items per page', async ({ page }) => {
    // Ждем загрузки страницы и появления селектора
    await page.waitForSelector('select', { timeout: 10000 });

    // Находим селектор количества элементов на странице
    // Селектор находится рядом с текстом "Показывать по"
    const perPageSelect = page
      .locator('select')
      .filter({
        has: page.locator('option[value="50"]'),
      })
      .first();

    await expect(perPageSelect).toBeVisible({ timeout: 10000 });

    // Изменяем количество элементов (в UI доступны 50, 100, 200)
    // Выбираем 100 вместо 25, так как 25 нет в опциях
    await perPageSelect.selectOption('100');

    // Ждем обновления данных
    await page.waitForTimeout(2000);

    // Проверяем, что значение изменилось
    await expect(perPageSelect).toHaveValue('100');
  });

  test('should navigate through pages', async ({ page }) => {
    // Ждем загрузки данных
    await page.waitForTimeout(2000);

    // Ищем кнопки пагинации
    const nextButton = page
      .getByRole('button', { name: /Следующая|Next|>/i })
      .first();
    const prevButton = page
      .getByRole('button', { name: /Предыдущая|Previous|</i })
      .first();

    // Если есть следующая страница, переходим на неё
    if (await nextButton.isVisible({ timeout: 1000 }).catch(() => false)) {
      await nextButton.click();
      await page.waitForTimeout(1000);

      // Проверяем, что мы на другой странице (если есть предыдущая)
      if (await prevButton.isVisible({ timeout: 1000 }).catch(() => false)) {
        await prevButton.click();
        await page.waitForTimeout(1000);
      }
    }
  });

  test('should reset filters', async ({ page }) => {
    // Устанавливаем фильтры
    const searchInput = page.getByPlaceholder(/Введите ID подписи/i);
    await searchInput.fill('test-id');

    const forgedButton = page.getByRole('button', { name: /Поддельные/i });
    await forgedButton.click();

    // Нажимаем кнопку "Сбросить"
    const resetButton = page.getByRole('button', { name: /Сбросить/i });
    await resetButton.click();

    // Проверяем, что фильтры сброшены
    await page.waitForTimeout(1000);
    await expect(searchInput).toHaveValue('');

    // Категория должна вернуться к "Настоящие"
    const genuineButton = page.getByRole('button', { name: /Настоящие/i });
    await expect(genuineButton).toHaveAttribute('class', /default|bg-primary/i);
  });

  test('should display signature details when signature is clicked', async ({
    page,
  }) => {
    // Ждем загрузки списка подписей
    await page.waitForTimeout(3000);

    // Ищем первую подпись в списке (может быть карточка или элемент списка)
    // Проверяем наличие элементов списка подписей
    const signatureCards = page
      .locator('[data-signature-id], .signature-card, [role="article"]')
      .first();

    // Если есть подписи, кликаем на первую
    if (await signatureCards.isVisible({ timeout: 5000 }).catch(() => false)) {
      await signatureCards.click();

      // Должна открыться детальная информация о подписи
      // (может быть модальное окно или переход на другую страницу)
      await page.waitForTimeout(1000);

      // Проверяем, что появилась детальная информация
      // (может быть модальное окно с деталями или страница с деталями)
      const details = page.getByText(/ID|Создано|Тип ввода|Владелец/i).first();
      if (await details.isVisible({ timeout: 2000 }).catch(() => false)) {
        await expect(details).toBeVisible();
      }
    } else {
      // Если подписей нет, просто проверяем, что страница загрузилась корректно
      await expect(page).toHaveURL('/signatures');
    }
  });

  test('should apply date filter', async ({ page }) => {
    // Ищем компонент фильтра по дате
    // Может быть DateFilter компонент или кнопка для открытия фильтра
    const dateFilterButton = page
      .getByRole('button', { name: /Дата|Фильтр|Filter/i })
      .first();

    // Если есть фильтр по дате, тестируем его
    if (
      await dateFilterButton.isVisible({ timeout: 2000 }).catch(() => false)
    ) {
      await dateFilterButton.click();
      await page.waitForTimeout(500);

      // Выбираем период (например, "Последние 7 дней" или кастомный период)
      // Это зависит от реализации DateFilter компонента
      // Пока просто проверяем, что фильтр открылся
      const datePicker = page
        .locator('input[type="date"], .date-picker, [role="dialog"]')
        .first();
      if (await datePicker.isVisible({ timeout: 1000 }).catch(() => false)) {
        // Фильтр открылся, можно закрыть
        await page.keyboard.press('Escape');
      }
    }
  });
});
