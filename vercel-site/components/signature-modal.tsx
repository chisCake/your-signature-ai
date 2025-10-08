"use client";

import React, { useEffect } from "react";
import { SignatureGenuine, SignatureForged } from '@/lib/types';
import SignatureDisplay from './canvas/signature-display';
import { Button } from './ui/button';
import { csvToPoints, formatSignatureDateTime, getSignatureStats, downloadSignatureAsPNG, deleteSignature } from '@/lib/signature-utils';
import { X } from "lucide-react";

interface SignatureModalProps {
    signature: SignatureGenuine | SignatureForged | null;
    isOpen: boolean;
    onClose: () => void;
}

export function SignatureModal({
    signature,
    isOpen,
    onClose,
}: SignatureModalProps) {
    if (!isOpen || !signature) return null;

    // Слушаем событие удаления подписи для автоматического закрытия модального окна
    useEffect(() => {
        const handleSignatureDeleted = (e: Event) => {
            const customEvent = e as CustomEvent;
            if (customEvent.detail?.id === signature.id) {
                onClose();
            }
        };

        window.addEventListener("signatureDeleted", handleSignatureDeleted);

        return () => {
            window.removeEventListener("signatureDeleted", handleSignatureDeleted);
        };
    }, [signature.id, onClose]);

    const handleBackdropClick = (e: React.MouseEvent) => {
        if (e.target === e.currentTarget) {
            onClose();
        }
    };

    const handleDownload = () => {
        downloadSignatureAsPNG(signature);
    };

    return (
        <div
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
            onClick={handleBackdropClick}
        >
            <div className="bg-card rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col">
                {/* Заголовок - фиксированный */}
                <div className="flex items-center justify-between p-6 border-b flex-shrink-0">
                    <h2 className="text-2xl font-bold">Детали подписи</h2>
                    <Button variant="ghost" size="icon" onClick={onClose} className="text-xl">
                        <X />
                    </Button>
                </div>

                {/* Прокручиваемое содержимое */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {/* Отображение подписи */}
                    <div className="flex justify-center">
                        <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                            <SignatureDisplay
                                signatureData={csvToPoints(signature)}
                                width={600}
                                height={300}
                                className="border border-gray-300 rounded"
                            />
                        </div>
                    </div>

                    {/* Информация о подписи */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <h3 className="font-semibold text-lg">Основная информация</h3>
                            <div className="space-y-1 text-sm">
                                <div><span className="font-medium">ID:</span> {signature.id}</div>
                                <div><span className="font-medium">Создана:</span> {formatSignatureDateTime(signature)}</div>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <h3 className="font-semibold text-lg">Технические данные</h3>
                            <div className="space-y-1 text-sm">
                                {(() => {
                                    const stats = getSignatureStats(signature);
                                    return (
                                        <>
                                            <div><span className="font-medium">Количество точек:</span> {stats.pointCount}</div>
                                            <div><span className="font-medium">Длительность:</span> {stats.duration.toFixed(2)}с</div>
                                            <div><span className="font-medium">Среднее давление:</span> {stats.averagePressure.toFixed(2)}</div>
                                            <div><span className="font-medium">Размер:</span> {stats.bounds.width.toFixed(0)} × {stats.bounds.height.toFixed(0)}px</div>
                                        </>
                                    );
                                })()}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Кнопки действий - фиксированные */}
                <div className="flex gap-3 justify-end p-6 border-t flex-shrink-0">
                    <Button variant="outline" onClick={handleDownload}>
                        Скачать PNG
                    </Button>
                    <Button variant="destructive" onClick={() => deleteSignature(signature)}>
                        Удалить
                    </Button>
                    <Button onClick={onClose}>
                        Закрыть
                    </Button>
                </div>
            </div>
        </div>
    );
}
