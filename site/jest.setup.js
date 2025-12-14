// Learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';
import 'jest-canvas-mock';

// Mock Canvas API (jest-canvas-mock уже предоставляет базовые моки)
// Дополнительно мокируем toDataURL для возврата предсказуемого значения
global.HTMLCanvasElement.prototype.toDataURL = jest.fn(
  () => 'data:image/png;base64,mock'
);

// Next.js Link мокируется через __mocks__ директорию

// Mock document.createElement for download tests
const originalCreateElement = document.createElement;
// Экспортируем originalCreateElement для использования в тестах
global.originalCreateElement = originalCreateElement;
document.createElement = jest.fn(tagName => {
  if (tagName === 'a') {
    return {
      download: '',
      href: '',
      click: jest.fn(),
    };
  }
  if (tagName === 'canvas') {
    return originalCreateElement.call(document, tagName);
  }
  return originalCreateElement.call(document, tagName);
});

// Mock window.dispatchEvent
window.dispatchEvent = jest.fn();

// Mock AbortSignal.timeout (не поддерживается в jsdom)
if (!AbortSignal.timeout) {
  AbortSignal.timeout = function (ms) {
    // Создаем объект, похожий на AbortSignal
    const controller = new AbortController();
    return controller.signal;
  };
}
