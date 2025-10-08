"use client";

import React, { useState, useEffect } from "react";
import { SignatureGenuine, SignatureForged, isSignatureGenuine } from '@/lib/types';
import { Button } from './ui/button';
import { ToggleButton } from './ui/toggle-button';
import { Badge } from './ui/badge';
import { PreviewField } from './signature-list';
import { deleteSignature, downloadSignatureAsPNG, generateSignaturePreview, toggleModForDataset, toggleModForForgery, toggleUserForForgery } from '@/lib/signature-utils';
import { X, Download, Eye, EyeOff, ShieldCheck, ShieldX, Database, Ban } from "lucide-react";
import { getUser, isMod } from '@/lib/auth-client-utils'

interface SignaturePreviewProps {
    signature: SignatureGenuine | SignatureForged;
    previewFields?: PreviewField[];
    onOpenModal: (signature: SignatureGenuine | SignatureForged) => void;
}

export function SignaturePreview({
    signature,
    previewFields,
    onOpenModal,
}: SignaturePreviewProps) {
    const [userForForgery, setUserForForgery] = useState<boolean>(
        "user_for_forgery" in signature ? (signature.user_for_forgery ?? false) : false
    );
    const [modForForgery, setModForForgery] = useState<boolean>(
        "mod_for_forgery" in signature ? (signature.mod_for_forgery ?? false) : false
    );
    const [modForDataset, setModForDataset] = useState<boolean>(
        "mod_for_dataset" in signature ? (signature.mod_for_dataset ?? false) : false
    );
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);
    const [isCurrentUserMod, setIsCurrentUserMod] = useState<boolean>(false);
    const [deleted, setDeleted] = useState<boolean>(false);
    const [isProfileLoading, setIsProfileLoading] = useState<boolean>(true);

    useEffect(() => {
        const getCurentUserData = async () => {
            const user = await getUser();
            setIsCurrentUserMod(await isMod(user));
            setCurrentUserId(user?.id || null);
            setIsProfileLoading(false);
        };
        getCurentUserData();
    }, []);

    // Sync local state when parent passes new signature object
    useEffect(() => {
        if ("user_for_forgery" in signature) {
            setUserForForgery(signature.user_for_forgery ?? false);
        }
    }, ["user_for_forgery" in signature ? signature.user_for_forgery : undefined]);

    useEffect(() => {
        if ("mod_for_forgery" in signature) {
            setModForForgery(signature.mod_for_forgery ?? false);
        }
    }, ["mod_for_forgery" in signature ? signature.mod_for_forgery : undefined]);

    useEffect(() => {
        if ("mod_for_dataset" in signature) {
            setModForDataset(signature.mod_for_dataset ?? false);
        }
    }, ["mod_for_dataset" in signature ? signature.mod_for_dataset : undefined]);

    // Listen to global updates from SignatureUtils
    useEffect(() => {
        const handler = (e: Event) => {
            const detail = (e as CustomEvent).detail as { id: string; user_for_forgery?: boolean; mod_for_forgery?: boolean; mod_for_dataset?: boolean };
            if (detail.id !== signature.id) return;
            if (detail.user_for_forgery !== undefined) {
                setUserForForgery(detail.user_for_forgery);
            }
            if (detail.mod_for_forgery !== undefined) {
                setModForForgery(detail.mod_for_forgery);
            }
            if (detail.mod_for_dataset !== undefined) {
                setModForDataset(detail.mod_for_dataset);
            }
        };
        window.addEventListener("signatureUpdated", handler);
        return () => window.removeEventListener("signatureUpdated", handler);
    }, [signature.id]);

    const previewUrl = generateSignaturePreview(signature);

    const handleDownload = (e: React.MouseEvent) => {
        e.stopPropagation();
        downloadSignatureAsPNG(signature);
    };

    const handleUserForForgery = (e?: React.MouseEvent) => {
        e?.stopPropagation();
        toggleUserForForgery(signature as SignatureGenuine);
        setUserForForgery(prev => !prev);
    };

    const handleModForForgery = (e?: React.MouseEvent) => {
        e?.stopPropagation();
        toggleModForForgery(signature as SignatureGenuine);
        setModForForgery(prev => !prev);
    };

    const handleModForDataset = (e?: React.MouseEvent) => {
        e?.stopPropagation();
        toggleModForDataset(signature);
        setModForDataset(prev => !prev);
    };

    const handleDelete = (e: React.MouseEvent) => {
        e.stopPropagation();
        deleteSignature(signature).then(success => {
            if (success) {
                setDeleted(true);
            }
        });
    };

    const renderBages = () => {
        if (isProfileLoading) {
            return <Badge variant="default" tooltip="Загрузка...">Загрузка...</Badge>;
        }

        const isGenuine = isSignatureGenuine(signature);
        const authenticityBadge = isGenuine ? (
            <Badge variant="default" tooltip="Подпись является настоящей">Настоящая</Badge>
        ) : (
            <Badge variant="default" tooltip="Подпись является поддельной">Поддельная</Badge>
        );

        if (!isGenuine) {
            return authenticityBadge;
        }

        const userForForgeryBadge = userForForgery ? (
            <Badge variant="green" tooltip="Разрешено использование как примера для подделки">Публичная</Badge>
        ) : (
            <Badge variant="yellow" tooltip="Запрещено использование как примера для подделки">Скрыта пользователем</Badge>
        );

        if (isCurrentUserMod) {
            const userId = "user_id" in signature ? signature.user_id :
                "original_user_id" in signature ? signature.original_user_id : undefined;
            if (userId === currentUserId) {
                // Мод видит свою подпись
                return (
                    <>
                        {authenticityBadge}

                        {userForForgeryBadge}

                        {!modForForgery &&
                            <Badge variant="red" tooltip="Запрещено использование как примера для подделки модератором">Скрыта модератором</Badge>
                        }

                        {!modForDataset &&
                            <Badge variant="red" tooltip="Подпись не участвует в датасете">Не в датасете</Badge>
                        }
                    </>
                );
            }
            // Мод видит чужую подпись
            return (
                <>
                    {authenticityBadge}

                    {userForForgery && modForForgery &&
                        <Badge variant="green" tooltip="Разрешено использование как примера для подделки">Публичная</Badge>
                    }

                    {!userForForgery &&
                        <Badge variant="yellow" tooltip="Запрещено использование как примера для подделки">Скрыта пользователем</Badge>
                    }

                    {!modForForgery &&
                        <Badge variant="red" tooltip="Запрещено использование как примера для подделки модератором">Скрыта модератором</Badge>
                    }

                    {!modForDataset &&
                        <Badge variant="red" tooltip="Подпись не участвует в датасете">Не в датасете</Badge>
                    }
                </>
            );
        }
        // Пользователь видит свою подпись
        return userForForgeryBadge;
    };

    const renderButtons = () => {
        if (isProfileLoading) {
            return <Badge variant="default" tooltip="Загрузка...">Загрузка...</Badge>;
        }

        if (isCurrentUserMod) {
            const userId = "user_id" in signature ? signature.user_id :
                "original_user_id" in signature ? signature.original_user_id : undefined;
            if (userId === currentUserId) {
                // Мод видит свою подпись
                return (
                    <>
                        <Button
                            size="icon"
                            variant="outline"
                            onClick={handleDownload}
                            title="Скачать" >
                            <Download size={24} />
                        </Button>

                        <ToggleButton
                            size="icon"
                            variant="secondary"
                            title={userForForgery ? "Сделать скрытой" : "Сделать публичной"}
                            iconOn={Eye}
                            iconOff={EyeOff}
                            iconSize={24}
                            isToggled={userForForgery}
                            onToggledChange={() => handleUserForForgery()}
                        />

                        <ToggleButton
                            size="icon"
                            variant="secondary"
                            title={modForForgery ? "Сделать скрытой" : "Сделать публичной"}
                            iconOn={ShieldCheck}
                            iconOff={ShieldX}
                            iconSize={24}
                            isToggled={modForForgery}
                            onToggledChange={() => handleModForForgery()}
                        />

                        <ToggleButton
                            size="icon"
                            variant="secondary"
                            title={modForDataset ? "Исключить из датасета" : "Включить в датасет"}
                            iconOn={Database}
                            iconOff={Ban}
                            iconSize={24}
                            isToggled={modForDataset}
                            onToggledChange={() => handleModForDataset()}
                        />

                        <Button
                            size="icon"
                            variant="destructive"
                            onClick={handleDelete}
                            title="Удалить">
                            <X size={24} />
                        </Button>
                    </>
                );
            }
            // Мод видит чужую подпись
            return (
                <>
                    <Button
                        size="icon"
                        variant="outline"
                        onClick={handleDownload}
                        title="Скачать" >
                        <Download size={24} />
                    </Button>

                    <ToggleButton
                        size="icon"
                        variant="secondary"
                        title={modForForgery ? "Сделать скрытой" : "Сделать публичной"}
                        iconOn={ShieldCheck}
                        iconOff={ShieldX}
                        iconSize={24}
                        isToggled={modForForgery}
                        onToggledChange={() => handleModForForgery()}
                    />

                    <ToggleButton
                        size="icon"
                        variant="secondary"
                        title={modForDataset ? "Исключить из датасета" : "Включить в датасет"}
                        iconOn={Database}
                        iconOff={Ban}
                        iconSize={24}
                        isToggled={modForDataset}
                        onToggledChange={() => handleModForDataset()}
                    />

                    <Button
                        size="icon"
                        variant="destructive"
                        onClick={handleDelete}
                        title="Удалить">
                        <X size={24} />
                    </Button>
                </>
            );
        }
        // Пользователь видит свою подпись
        return (
            <>
                <Button
                    size="icon"
                    variant="secondary"
                    onClick={handleDownload}
                    title="Скачать" >
                    <Download size={24} />
                </Button>

                <ToggleButton
                    size="icon"
                    variant="secondary"
                    title={userForForgery ? "Сделать скрытой" : "Сделать публичной"}
                    iconOn={Eye}
                    iconOff={EyeOff}
                    iconSize={24}
                    isToggled={userForForgery}
                    onToggledChange={() => handleUserForForgery()}
                />

                <Button
                    size="icon"
                    variant="destructive"
                    onClick={handleDelete}
                    title="Удалить">
                    <X size={24} />
                </Button>
            </>
        );
    };

    return (
        deleted ? null : (
        <div className="relative border border-gray-200 rounded-lg p-4 bg-white shadow-sm hover:shadow-md transition-shadow cursor-pointer group w-full">
            {/* Кликабельная область для открытия модального окна */}
            <div
                className="absolute inset-0 z-10"
                onClick={() => onOpenModal(signature)}
                title="Нажмите для просмотра деталей"
            />

            {/* Превью подписи */}
            {previewUrl && (
                <div className="flex items-center justify-center mb-3">
                    <img
                        src={previewUrl}
                        alt="Превью подписи"
                        className="max-w-full object-contain"
                    />
                </div>
            )}

            {/* Информация о подписи */}
            <div className="text-sm text-gray-600 mb-2">
                {previewFields && previewFields.length > 0 ? (
                    previewFields.map((field) => (
                        <div key={field.key}>
                            {field.label}: {field.getValue(signature)}
                        </div>
                    ))
                ) : (
                    <>
                        <div>ID: {signature.id.slice(0, 8)}...</div>
                        <div>Создана: {new Date(signature.created_at).toLocaleDateString()}</div>
                    </>
                )}
            </div>

            <div className="flex items-center gap-2 flex-wrap">
                {renderBages()}
            </div>

            {/* Кнопки действий (справа-сверху) */}
            <div className="absolute top-2 right-2 z-20 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {renderButtons()}
            </div>
        </div>
        )
    );
}
