"use client";

import React, { useRef, useEffect, useCallback, memo, useState } from "react";
import { SignaturePoint } from '@/lib/types';
import { RotateCcw, LoaderCircle } from "lucide-react";
import { DEFAULT_CANVAS_SIZE } from "./canvas";

// Палитра цветов для множественных подписей (до 8 цветов)
const SIGNATURE_COLORS = [
  "#000000", // Черный
  "#FF0000", // Красный
  "#00FF00", // Зеленый
  "#0000FF", // Синий
  "#FF8000", // Оранжевый
  "#8000FF", // Фиолетовый
  "#00FFFF", // Голубой
  "#FF0080", // Розовый
];

interface SignatureDisplayProps {
  signatureData: SignaturePoint[] | SignaturePoint[][]; // Поддержка одной или множественных подписей
  width?: number;
  height?: number;
  className?: string;
  canvasClassName?: string; // CSS классы для canvas элемента
  animated?: boolean;
  animationSpeed?: number;
  strokeColor?: string | string[]; // Цвет или массив цветов для множественных подписей
  strokeWidth?: number | number[]; // Толщина или массив толщин
  backgroundColor?: string;
  showPoints?: boolean;
  centerSignature?: boolean;
  bufferSize?: number; // Размер буфера в пикселях (по умолчанию 10% от размера canvas)
  onAnimationComplete?: () => void;
  disablePlayButton?: boolean; // Отключает кнопку воспроизведения анимации
}

interface SignatureDisplayRef {
  playAnimation: () => void;
  pauseAnimation: () => void;
  resetAnimation: () => void;
  getCurrentProgress: () => number;
  setCanvasSize: (width: number, height: number) => void;
}

const SignatureDisplay = memo(React.forwardRef<SignatureDisplayRef, SignatureDisplayProps>(({
  signatureData,
  className = "",
  canvasClassName = "",
  animated = false,
  animationSpeed = 1.0,
  strokeColor = "#000000",
  strokeWidth = 2,
  backgroundColor = "transparent",
  showPoints = false,
  centerSignature = true,
  bufferSize,
  onAnimationComplete,
  disablePlayButton = false
}, ref) => {
  const [isLoading, setIsLoading] = useState(true);
  // Нормализуем данные - всегда работаем с массивом массивов
  const normalizedData = Array.isArray(signatureData[0])
    ? signatureData as SignaturePoint[][]
    : [signatureData as SignaturePoint[]];

  // Нормализуем цвета
  const normalizedColors = Array.isArray(strokeColor)
    ? strokeColor
    : [strokeColor];

  // Нормализуем толщины
  const normalizedWidths = Array.isArray(strokeWidth)
    ? strokeWidth
    : [strokeWidth];
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number | null>(null);
  const currentPointRef = useRef<number>(0);
  const isAnimatingRef = useRef<boolean>(false);
  const startTimeRef = useRef<number>(0);

  // Вычисляем границы всех подписей для центрирования
  const getSignatureBounds = useCallback((data: SignaturePoint[][]) => {
    if (data.length === 0 || data.every(sig => sig.length === 0)) {
      return { minX: 0, maxX: 0, minY: 0, maxY: 0, width: 0, height: 0 };
    }

    const allPoints = data.flat();
    const xs = allPoints.map(p => p.x);
    const ys = allPoints.map(p => p.y);

    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);

    return {
      minX,
      maxX,
      minY,
      maxY,
      width: maxX - minX,
      height: maxY - minY
    };
  }, []);

  // Центрируем все подписи в canvas с буфером
  const getCenteredPoints = useCallback((data: SignaturePoint[][], canvasWidth: number, canvasHeight: number) => {
    if (data.length === 0) return data;

    const bounds = getSignatureBounds(data);

    // Добавляем буфер (10% от размера canvas или минимум 20px, или заданный размер)
    const defaultBufferX = Math.max(canvasWidth * 0.1, 20);
    const defaultBufferY = Math.max(canvasHeight * 0.1, 20);
    const bufferX = bufferSize !== undefined ? bufferSize : defaultBufferX;
    const bufferY = bufferSize !== undefined ? bufferSize : defaultBufferY;

    // Рассчитываем масштаб, чтобы все подписи поместились с буфером
    const scaleX = (canvasWidth - bufferX * 2) / bounds.width;
    const scaleY = (canvasHeight - bufferY * 2) / bounds.height;
    const scale = Math.min(scaleX, scaleY, 1); // Не увеличиваем, только уменьшаем

    const centerX = canvasWidth / 2;
    const centerY = canvasHeight / 2;

    // Центрируем с учетом масштаба
    const offsetX = centerX - (bounds.minX + bounds.width / 2) * scale;
    const offsetY = centerY - (bounds.minY + bounds.height / 2) * scale;

    // console.log(data);
    return data.map(signature =>
      signature.map(point => ({
        ...point,
        x: point.x * scale + offsetX,
        y: point.y * scale + offsetY
      }))
    );
  }, [getSignatureBounds, bufferSize]);

  // Рисуем множественные подписи
  const drawSignature = useCallback((ctx: CanvasRenderingContext2D, data: SignaturePoint[][], upToIndex?: number) => {
    if (data.length === 0) return;

    const centeredData = centerSignature ?
      getCenteredPoints(data, ctx.canvas.width, ctx.canvas.height) :
      data;

    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    // Включаем сглаживание для более плавных линий
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";

    // Всегда рисуем белый фон
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    // Рисуем каждую подпись своим цветом
    centeredData.forEach((signature, signatureIndex) => {
      if (signature.length === 0) return;

      const pointsToDraw = upToIndex !== undefined ? signature.slice(0, upToIndex + 1) : signature;
      const color = normalizedColors[signatureIndex % normalizedColors.length] || SIGNATURE_COLORS[signatureIndex % SIGNATURE_COLORS.length];
      const width = normalizedWidths[signatureIndex % normalizedWidths.length] || 2;

      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.miterLimit = 2;

      // Дополнительные настройки для сглаживания
      ctx.shadowBlur = 0;
      ctx.shadowColor = "transparent";

      // Рисуем сглаженные линии между точками
      if (pointsToDraw.length >= 2) {
        ctx.beginPath();
        ctx.moveTo(pointsToDraw[0].x, pointsToDraw[0].y);

        // Используем кривые Безье для сглаживания
        for (let i = 1; i < pointsToDraw.length; i++) {
          const prevPoint = pointsToDraw[i - 1];
          const currentPoint = pointsToDraw[i];

          // Проверяем, что точки близко по времени (не более 100мс разницы)
          const timeDiff = currentPoint.timestamp - prevPoint.timestamp;
          if (timeDiff <= 100) {
            // Если есть следующая точка, используем её для создания контрольной точки
            if (i < pointsToDraw.length - 1) {
              const nextPoint = pointsToDraw[i + 1];
              const cp1x = prevPoint.x + (currentPoint.x - prevPoint.x) * 0.5;
              const cp1y = prevPoint.y + (currentPoint.y - prevPoint.y) * 0.5;
              const cp2x = currentPoint.x - (nextPoint.x - currentPoint.x) * 0.5;
              const cp2y = currentPoint.y - (nextPoint.y - currentPoint.y) * 0.5;

              ctx.quadraticCurveTo(cp1x, cp1y, currentPoint.x, currentPoint.y);
            } else {
              // Для последней точки рисуем прямую линию
              ctx.lineTo(currentPoint.x, currentPoint.y);
            }
          } else {
            // Если точки далеко по времени, начинаем новый путь
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(currentPoint.x, currentPoint.y);
          }
        }
        ctx.stroke();
      }

      // Показываем точки если нужно
      if (showPoints) {
        ctx.fillStyle = color;
        pointsToDraw.forEach((point, index) => {
          ctx.beginPath();
          ctx.arc(point.x, point.y, 2, 0, 2 * Math.PI);
          ctx.fill();
        });
      }
    });
  }, [centerSignature, getCenteredPoints, backgroundColor, normalizedColors, normalizedWidths, showPoints]);

  // Анимация множественных подписей
  const animateSignature = useCallback(() => {
    const totalPoints = normalizedData.reduce((sum, sig) => sum + sig.length, 0);

    if (!isAnimatingRef.current || currentPointRef.current >= totalPoints) {
      isAnimatingRef.current = false;
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
      onAnimationComplete?.();
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const currentTime = Date.now();
    const elapsed = (currentTime - startTimeRef.current) * animationSpeed;

    // Вычисляем общую длительность всех подписей
    const allPoints = normalizedData.flat();
    const totalDuration = allPoints[allPoints.length - 1]?.timestamp || 0;
    const progress = Math.min(elapsed / totalDuration, 1);
    const targetPointIndex = Math.floor(progress * (totalPoints - 1));

    // Убеждаемся, что рисуем точки последовательно
    if (targetPointIndex > currentPointRef.current) {
      currentPointRef.current = Math.min(targetPointIndex, totalPoints - 1);
      drawSignature(ctx, normalizedData, currentPointRef.current);
    }

    // Если анимация завершена, но еще не все точки нарисованы, дорисовываем их
    if (progress >= 1 && currentPointRef.current < totalPoints - 1) {
      currentPointRef.current = totalPoints - 1;
      drawSignature(ctx, normalizedData, currentPointRef.current);
    }

    animationRef.current = requestAnimationFrame(animateSignature);
  }, [normalizedData, animationSpeed, drawSignature, onAnimationComplete]);

  // Функция для установки размера canvas
  const setCanvasSize = useCallback((newWidth: number, newHeight: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    if (canvas.width !== newWidth || canvas.height !== newHeight) {
      canvas.width = newWidth;
      canvas.height = newHeight;
      
      const ctx = canvas.getContext("2d");
      if (ctx) {
        // Перерисовываем подписи с новым размером
        if (animated) {
          drawSignature(ctx, normalizedData, currentPointRef.current);
        } else {
          drawSignature(ctx, normalizedData);
        }
      }
    }
  }, [normalizedData, animated, drawSignature]);

  // API для внешнего управления
  React.useImperativeHandle(ref, () => ({
    playAnimation: () => {
      if (normalizedData.length === 0) return;
      
      isAnimatingRef.current = true;
      currentPointRef.current = 0;
      startTimeRef.current = Date.now();
      
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      animationRef.current = requestAnimationFrame(animateSignature);
    },
    pauseAnimation: () => {
      isAnimatingRef.current = false;
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
    },
    resetAnimation: () => {
      isAnimatingRef.current = false;
      currentPointRef.current = 0;
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
      
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext("2d");
        if (ctx) {
          drawSignature(ctx, normalizedData, 0);
        }
      }
    },
    getCurrentProgress: () => {
      const totalPoints = normalizedData.reduce((sum, sig) => sum + sig.length, 0);
      return totalPoints > 0 ? currentPointRef.current / (totalPoints - 1) : 0;
    },
    setCanvasSize: (newWidth: number, newHeight: number) => {
      setCanvasSize(newWidth, newHeight);
    }
  }));

  // Управление состоянием загрузки
  useEffect(() => {
    if (signatureData && signatureData.length > 0) {
      // Небольшая задержка для плавного перехода
      const timer = setTimeout(() => {
        setIsLoading(false);
      }, 300);
      return () => clearTimeout(timer);
    } else {
      setIsLoading(true);
    }
  }, [signatureData]);

  // Инициализация и обновление canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const container = containerRef.current;
    if (!container) return;
    
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    
    const handleResize = () => {
      const { width: containerWidth, height: containerHeight } = container.getBoundingClientRect();
      
      if (canvas.width !== containerWidth || canvas.height !== containerHeight) {
        canvas.width = containerWidth;
        canvas.height = containerHeight;
        
        // Сбрасываем анимацию при изменении размера
        if (animationRef.current) {
          cancelAnimationFrame(animationRef.current);
          animationRef.current = null;
        }
        currentPointRef.current = 0;
        isAnimatingRef.current = false;
        
        // Рисуем подписи с новым размером
        if (animated) {
          drawSignature(ctx, normalizedData, 0);
        } else {
          drawSignature(ctx, normalizedData);
        }
      }
    };
    
    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);
    handleResize(); // Устанавливаем начальный размер
    
    return () => {
      resizeObserver.disconnect();
    };
  }, [normalizedData, animated, drawSignature]);

  // Очистка при размонтировании
  useEffect(() => {
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  return (
    <div ref={containerRef} className={`relative inline-block border-2 border-gray-200 rounded-lg bg-white shadow-lg ${className}`}>
      {isLoading ? (
        <div className={`flex items-center justify-center bg-gray-50 rounded-md ${canvasClassName || DEFAULT_CANVAS_SIZE}`}>
          <LoaderCircle className="text-black w-12 h-12 animate-spin" />
        </div>
      ) : (
        <>
          <canvas
            ref={canvasRef}
            className={`block bg-white rounded-md
                       ${canvasClassName || DEFAULT_CANVAS_SIZE}`}
            style={{ backgroundColor: "#ffffff" }}
          />
          {!disablePlayButton && (
            <button
              className="absolute top-2 right-2 md:top-4 md:right-4 w-8 h-8 md:w-10 md:h-10 border-none rounded-full bg-blue-500 text-white text-base font-bold cursor-pointer flex items-center justify-center transition-all duration-200 shadow-md z-10 hover:bg-blue-600 hover:shadow-lg"
              onClick={() => {
                const canvas = canvasRef.current;
                if (canvas) {
                  const ctx = canvas.getContext("2d");
                  if (ctx) {
                    // Сбрасываем анимацию и запускаем заново
                    isAnimatingRef.current = false;
                    currentPointRef.current = 0;
                    if (animationRef.current) {
                      cancelAnimationFrame(animationRef.current);
                      animationRef.current = null;
                    }

                    // Запускаем анимацию
                    isAnimatingRef.current = true;
                    startTimeRef.current = Date.now();
                    animationRef.current = requestAnimationFrame(animateSignature);
                  }
                }
              }}
              type="button"
              aria-label="Проиграть анимацию рисования"
            >
              <RotateCcw className="w-full h-5 md:h-6" />
            </button>
          )}
        </>
      )}
    </div>
  );
}));

SignatureDisplay.displayName = "SignatureDisplay";

export default SignatureDisplay;
export type { SignatureDisplayRef };
