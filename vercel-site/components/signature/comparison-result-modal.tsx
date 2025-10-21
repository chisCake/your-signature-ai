"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle, XCircle, AlertCircle, X } from "lucide-react";
import { formatForgeryResult, getForgeryColor, ForgeryAnalysisResponse } from "@/lib/inference-client";

interface ForgeryAnalysisResult extends ForgeryAnalysisResponse {
  error?: string;
}

interface ComparisonResultModalProps {
  isOpen: boolean;
  onClose: () => void;
  result: ForgeryAnalysisResult | null;
  isLoading: boolean;
  error: string | null;
}

export function ComparisonResultModal({
  isOpen,
  onClose,
  result,
  isLoading,
  error,
}: ComparisonResultModalProps) {
  const [formattedResult, setFormattedResult] = useState<{
    similarityPercent: number;
    isForgery: boolean;
    threshold: number;
    similarityScore: number;
    message: string;
  } | null>(null);

  useEffect(() => {
    if (result && !result.error) {
      setFormattedResult(formatForgeryResult(result));
    } else {
      setFormattedResult(null);
    }
  }, [result]);

  const getStatusIcon = () => {
    if (isLoading) {
      return <Loader2 className="h-6 w-6 animate-spin text-blue-600" />;
    }
    
    if (error) {
      return <AlertCircle className="h-6 w-6 text-red-600" />;
    }
    
    if (formattedResult) {
      return formattedResult.isForgery ? (
        <XCircle className="h-6 w-6 text-red-600" />
      ) : (
        <CheckCircle className="h-6 w-6 text-green-600" />
      );
    }
    
    return null;
  };

  const getStatusBadge = () => {
    if (isLoading) {
      return <Badge variant="secondary">Анализ...</Badge>;
    }
    
    if (error) {
      return <Badge variant="destructive">Ошибка</Badge>;
    }
    
    if (formattedResult) {
      return formattedResult.isForgery ? (
        <Badge variant="destructive">Поддельная</Badge>
      ) : (
        <Badge variant="default" className="bg-green-600 hover:bg-green-700">
          Подлинная
        </Badge>
      );
    }
    
    return null;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/50" 
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative bg-background rounded-lg shadow-lg max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center gap-2">
            {getStatusIcon()}
            <h2 className="text-lg font-semibold">
              Результат анализа подделки
            </h2>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-8 w-8 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Description */}
        <div className="px-6 pt-4">
          <p className="text-sm text-muted-foreground">
            Анализ подлинности подписи с использованием SignatureEncoder модели
          </p>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {isLoading && (
            <div className="text-center py-4">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-blue-600" />
              <p className="text-sm text-muted-foreground">
                Вычисляем эмбеддинги и сравниваем подписи...
              </p>
            </div>
          )}

          {error && (
            <div className="text-center py-4">
              <AlertCircle className="h-8 w-8 mx-auto mb-2 text-red-600" />
              <p className="text-sm text-red-600 mb-2">Произошла ошибка:</p>
              <p className="text-xs text-muted-foreground break-words">
                {error}
              </p>
            </div>
          )}

          {formattedResult && (
            <div className="space-y-4">
              {/* Статус */}
              <div className="text-center">
                {getStatusBadge()}
              </div>

              {/* Основная информация */}
              <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Схожесть:</span>
                  <span className={`text-lg font-bold ${result ? getForgeryColor(result) : ''}`}>
                    {formattedResult.similarityPercent}%
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Порог:</span>
                  <span className="text-sm text-muted-foreground">
                    {formattedResult.threshold}%
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Результат:</span>
                  <span className={`text-sm font-medium ${
                    formattedResult.isForgery ? 'text-red-600' : 'text-green-600'
                  }`}>
                    {formattedResult.isForgery ? 'Поддельная' : 'Подлинная'}
                  </span>
                </div>
              </div>

              {/* Прогресс-бар схожести */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Схожесть</span>
                  <span>{Math.min(formattedResult.similarityPercent > 0 ? formattedResult.similarityPercent : 0, 100)}%</span>
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all duration-500 ${
                      formattedResult.similarityPercent >= 85
                        ? 'bg-green-500'
                        : formattedResult.similarityPercent >= 80
                        ? 'bg-yellow-500'
                        : 'bg-red-500'
                    }`}
                    style={{ width: `${formattedResult.similarityPercent}%` }}
                  />
                </div>
              </div>

              {/* Дополнительная информация */}
              <div className="text-xs text-muted-foreground space-y-1">
                <p>• Использована модель SignatureEncoder (CNN+BiGRU+Attention)</p>
                <p>• Анализ основан на 11 признаках подписи</p>
                <p>• Эмбеддинги вычислены автоматически</p>
                <p>• Порог схожести: {formattedResult.threshold}%</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 p-6 border-t">
          <Button onClick={onClose} variant="outline">
            Закрыть
          </Button>
          {formattedResult && (
            <Button 
              onClick={() => {
                // Можно добавить дополнительную функциональность
                // console.log('Detailed analysis:', result);
              }}
              variant="secondary"
            >
              Подробнее
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
