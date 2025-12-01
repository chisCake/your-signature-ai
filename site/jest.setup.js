// Learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';

// Mock Canvas API
global.HTMLCanvasElement.prototype.getContext = jest.fn(() => {
  return {
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 0,
    lineCap: '',
    lineJoin: '',
    fillRect: jest.fn(),
    beginPath: jest.fn(),
    moveTo: jest.fn(),
    lineTo: jest.fn(),
    stroke: jest.fn(),
  };
});

global.HTMLCanvasElement.prototype.toDataURL = jest.fn(
  () => 'data:image/png;base64,mock'
);

// Mock document.createElement for download tests
const originalCreateElement = document.createElement;
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
