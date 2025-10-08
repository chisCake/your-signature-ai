"use client";

import React, { useRef, useCallback, forwardRef, useImperativeHandle } from "react";
import { SignaturePoint } from '@/lib/types';
import { X } from "lucide-react";

// Типы ввода
export type InputType = "mouse" | "touch" | "pen" | null;

// Локальные типы для Canvas компонента
export interface CanvasRef {
  clear: () => void;
  getImageData: () => string | null;
  getCanvas: () => HTMLCanvasElement | null;
  getSignatureData: () => SignaturePoint[];
  getInputType: () => InputType;
}

export const DEFAULT_CANVAS_SIZE = `w-[400px] h-[300px]
                   sm:w-[400px] sm:h-[300px]
                   md:w-[600px] md:h-[480px]
                   lg:w-[640px] lg:h-[480px]
                   xl:w-[800px] xl:h-[600px]`;

interface CanvasProps {
  className?: string;
  canvasClassName?: string;
}

const Canvas = forwardRef<CanvasRef, CanvasProps>(({
  className = "",
  canvasClassName = ""
}, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isDrawingRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const signatureDataRef = useRef<SignaturePoint[]>([]);
  const startTimeRef = useRef<number>(0);
  const inputTypeRef = useRef<InputType>(null);

  // API для внешнего доступа к холсту
  useImperativeHandle(ref, () => ({
    clear: () => {
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          // Очищаем данные подписи и тип ввода
          signatureDataRef.current = [];
          inputTypeRef.current = null;
        }
      }
    },
    getImageData: () => {
      const canvas = canvasRef.current;
      if (canvas) {
        return canvas.toDataURL("image/png");
      }
      return null;
    },
    getCanvas: () => {
      return canvasRef.current;
    },
    getSignatureData: () => {
      return [...signatureDataRef.current];
    },
    getInputType: () => {
      return inputTypeRef.current;
    }
  }));

  // Функция для определения типа ввода
  const detectInputType = useCallback((e: React.MouseEvent | React.TouchEvent | PointerEvent): InputType => {
    // Проверяем наличие pointerType для стилуса
    if ("pointerType" in e) {
      if (e.pointerType === "pen") {
        return "pen";
      }
      if (e.pointerType === "touch") {
        return "touch";
      }
      if (e.pointerType === "mouse") {
        return "mouse";
      }
    }

    // Проверяем наличие touches для касания
    if ("touches" in e && e.touches.length > 0) {
      // Дополнительная проверка: если это TouchEvent, но pointerType не определен,
      // то это скорее всего касание пальцем
      return "touch";
    }

    // По умолчанию считаем мышкой
    return "mouse";
  }, []);

  // Функция для проверки совместимости типа ввода
  const isInputTypeCompatible = useCallback((newInputType: InputType): boolean => {
    // Если это первая подпись, разрешаем любой тип
    if (inputTypeRef.current === null) {
      return true;
    }

    // Если тип уже установлен, разрешаем только тот же тип
    return inputTypeRef.current === newInputType;
  }, []);

  const startDrawing = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const inputType = detectInputType(e);

    // Проверяем совместимость типа ввода
    if (!isInputTypeCompatible(inputType)) {
      // console.log(`Игнорируем ввод типа ${inputType}, уже используется ${inputTypeRef.current}`);
      return;
    }

    // Устанавливаем тип ввода только при первом вводе
    if (inputTypeRef.current === null) {
      inputTypeRef.current = inputType;
      // console.log(`Тип ввода установлен: ${inputType}`);
    }

    isDrawingRef.current = true;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = Math.round(e.clientX - rect.left);
    const y = Math.round(e.clientY - rect.top);

    lastPointRef.current = { x, y };

    // Инициализируем время начала рисования только если это первый штрих
    if (signatureDataRef.current.length === 0) {
      startTimeRef.current = Date.now();
    }

    // Добавляем первую точку нового штриха
    const currentTime = Date.now();
    const timestamp = signatureDataRef.current.length === 0 ? 0 : currentTime - startTimeRef.current;

    signatureDataRef.current.push({
      timestamp,
      x,
      y,
      pressure: 1.0, // Для мыши всегда максимальное давление
      // для мыши не записываем tilt/azimuth
    });
  }, [detectInputType, isInputTypeCompatible]);

  const draw = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) {
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) {
      console.error("draw: No canvas found")
      return;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      console.error("draw: No context found")
      return;
    }

    const rect = canvas.getBoundingClientRect();
    const currentX = Math.round(e.clientX - rect.left);
    const currentY = Math.round(e.clientY - rect.top);

    if (lastPointRef.current) {
      ctx.beginPath();
      ctx.moveTo(lastPointRef.current.x, lastPointRef.current.y);
      ctx.lineTo(currentX, currentY);
      ctx.stroke();
    }

    // Добавляем точку в данные подписи
    const currentTime = Date.now();
    const timestamp = currentTime - startTimeRef.current;

    signatureDataRef.current.push({
      timestamp,
      x: currentX,
      y: currentY,
      pressure: 1.0, // Для мыши всегда максимальное давление
      // для мыши не записываем tilt/azimuth
    });

    lastPointRef.current = { x: currentX, y: currentY };
  }, []);

  const stopDrawing = useCallback(() => {
    isDrawingRef.current = false;
    lastPointRef.current = null;
  }, []);

  const handleClear = useCallback(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        // Очищаем данные подписи и тип ввода
        signatureDataRef.current = [];
        inputTypeRef.current = null;
      }
    }
  }, []);

  // Инициализация и ресайз холста
  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      console.error("useEffect: No canvas found");
      return;
    }
    const container = containerRef.current;
    if (!container) {
      console.error("useEffect: No container found");
      return;
    }

    const setCanvasSize = () => {
        const { width, height } = container.getBoundingClientRect();
        
        if (canvas.width !== width || canvas.height !== height) {
            canvas.width = width;
            canvas.height = height;

            const ctx = canvas.getContext("2d");
            if (ctx) {
                // Настройка стиля рисования
                ctx.strokeStyle = "#000000";
                ctx.lineWidth = 2;
                ctx.lineCap = "round";
                ctx.lineJoin = "round";
    
                // Очистка холста белым фоном
                ctx.fillStyle = "#ffffff";
                ctx.fillRect(0, 0, canvas.width, canvas.height);
            }
        }
    };

    const resizeObserver = new ResizeObserver(setCanvasSize);
    resizeObserver.observe(container);
    setCanvasSize(); // initial size

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  return (
    <div ref={containerRef} className={`relative inline-block border-2 border-gray-200 rounded-lg bg-white shadow-lg ${className}`}>
      <canvas
        ref={canvasRef}
        className={`block cursor-crosshair bg-white rounded-md
                   ${canvasClassName || DEFAULT_CANVAS_SIZE}`}
        style={{
          touchAction: "none",
          userSelect: "none",
          WebkitUserSelect: "none",
          WebkitTouchCallout: "none"
        }}
        onPointerDown={startDrawing}
        onPointerMove={draw}
        onPointerUp={stopDrawing}
        onPointerLeave={stopDrawing}
        onPointerCancel={stopDrawing}
      />
      <button
        className="absolute top-2 right-2 md:top-4 md:right-4 w-8 h-8 md:w-10 md:h-10 border-none rounded-full bg-red-500 text-white text-base font-bold cursor-pointer flex items-center justify-center transition-all duration-200 shadow-md z-10 hover:bg-red-600 hover:scale-105 hover:shadow-lg active:scale-95"
        onClick={handleClear}
        type="button"
        aria-label="Очистить холст"
      >
        <X className="w-full h-6 md:h-8" />
      </button>
    </div>
  );
});

Canvas.displayName = "Canvas";

export default Canvas;
