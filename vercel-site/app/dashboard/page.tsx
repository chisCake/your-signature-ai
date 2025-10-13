"use client";

import CreateSignatureSection from "@/components/create-signature-section";
import { Button } from "@/components/ui/button";
import { DashboardSection } from "@/components/dashboard-section";
import { Profile, Signature } from "@/lib/types";
import { SignatureList, PreviewField } from "@/components/signature-list";
import { formatSignatureDate, getShortSignatureId } from "@/lib/signature-utils";
import { User as UserIcon, Mail, Calendar, Shield, LoaderCircle } from "lucide-react";
import { getSignatures } from "@/lib/supabase/user-utils";
import { getProfile } from "@/lib/supabase/user-utils";
import { useState, useEffect, useCallback } from "react";

export default function UserDashboard() {
    const [signatures, setSignatures] = useState<Signature[]>([]);
    const [signaturesLoading, setSignaturesLoading] = useState(true);
    const [currentUser, setCurrentUser] = useState<Profile | null>(null);
    const [userEmail, setUserEmail] = useState<string>("");

    // Загрузка подписей пользователя
    const fetchSignatures = useCallback(async () => {
        try {
            setSignaturesLoading(true);
            const data = await getSignatures();
            setSignatures(data || []);
        } catch (error) {
            console.error("Ошибка сети:", error);
        } finally {
            setSignaturesLoading(false);
        }
    }, []);

    // Загрузка данных пользователя
    const fetchUserData = useCallback(async () => {
        try {
            const userData = await getProfile();
            setCurrentUser(userData ?? null);
            setUserEmail(userData?.email ?? "");
        } catch (error) {
            console.error("Ошибка загрузки данных пользователя:", error);
        }
    }, []);

    const signatureDeletedHandler = useCallback(() => {
        fetchSignatures();
    }, [fetchSignatures]);

    useEffect(() => {
        // Загружаем подписи и данные пользователя при инициализации
        fetchSignatures();
        fetchUserData();

        // Подписываемся на событие удаления подписи
        window.addEventListener("signatureDeleted", signatureDeletedHandler);

        return () => {
            window.removeEventListener("signatureDeleted", signatureDeletedHandler);
        };
    }, [fetchSignatures, fetchUserData, signatureDeletedHandler]);

    const bulkUpdateForgery = async (allow: boolean) => {
        if (!window.confirm(allow ? "Разрешить использование всех ваших подписей как примеров для подделки?" : "Запретить использование всех ваших подписей как примеров для подделки?")) {
            return;
        }
        try {
            const res = await fetch("/api/signatures", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ userForForgery: allow })
            });
            if (!res.ok) {
                const msg = await res.json().catch(() => ({}));
                alert(msg.error || "Ошибка обновления");
                return;
            }
            // обновляем локальное состояние
            setSignatures(prev => prev.map(s => ({ ...s, user_for_forgery: allow })));
            // Даем подписи обновиться через пропсы; если всё равно нужен глобальный сигнал,
            // делаем его асинхронно, чтобы избежать setState во время рендера
            setTimeout(() => {
                signatures.forEach(sig => {
                    window.dispatchEvent(new CustomEvent("signatureUpdated", { detail: { id: sig.id, user_for_forgery: allow } }));
                });
            }, 0);
            alert("Настройки обновлены");
        } catch (err) {
            console.error("Network error", err);
            alert("Ошибка сети");
        }
    };

    // Кастомные поля для отображения в превью
    const previewFields: PreviewField[] = [
        {
            key: "id",
            label: "ID",
            getValue: (signature) => getShortSignatureId(signature)
        },
        {
            key: "created_at",
            label: "Создана",
            getValue: (signature) => formatSignatureDate(signature)
        }
    ];

    return (
        <div className="flex flex-col items-center justify-center h-full gap-4 p-4 px-6">
            <DashboardSection title="Информация о профиле">
                {currentUser ? (
                    <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="text-sm font-medium text-muted-foreground">Имя</label>
                                <div className="text-lg font-semibold flex items-center gap-2">
                                    <UserIcon className="h-5 w-5" />
                                    {currentUser.display_name || "Не указано"}
                                </div>
                            </div>
                            <div>
                                <label className="text-sm font-medium text-muted-foreground">Роль</label>
                                <div className="text-sm flex items-center gap-2 mt-1">
                                    <Shield className="h-4 w-4" />
                                    {currentUser.role || "user"}
                                </div>
                            </div>
                            <div>
                                <label className="text-sm font-medium text-muted-foreground">ID</label>
                                <div className="text-sm font-mono">
                                    {currentUser.id}
                                </div>
                            </div>
                            <div>
                                <label className="text-sm font-medium text-muted-foreground">Email</label>
                                <div className="text-sm flex items-center gap-1">
                                    <Mail className="h-4 w-4" />
                                    {userEmail}
                                </div>
                            </div>
                            <div>
                                <label className="text-sm font-medium text-muted-foreground">Дата регистрации</label>
                                <div className="text-sm flex items-center gap-1">
                                    <Calendar className="h-4 w-4" />
                                    {currentUser.created_at ? new Date(currentUser.created_at).toLocaleDateString("ru-RU", {
                                        year: "numeric",
                                        month: "long",
                                        day: "numeric"
                                    }) : "Неизвестно"}
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="text-center py-8 text-muted-foreground">
                        <UserIcon className="h-12 w-12 mx-auto mb-2 opacity-50" />
                        <div className="text-sm flex flex-row items-center justify-center gap-2"><LoaderCircle className="animate-spin" /> Загрузка данных пользователя</div>
                    </div>
                )}
            </DashboardSection>

            <DashboardSection title="Создать подпись">
                <CreateSignatureSection onSignatureSaved={fetchSignatures} />
            </DashboardSection>

            <DashboardSection title="Приватность">
                <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-2">
                        <span>Использование подписей как примеров для подделки</span>
                        <div className="flex items-center gap-2">
                            <Button variant="confirm" onClick={() => bulkUpdateForgery(true)}>Разрешить все</Button>
                            <Button variant="destructive" onClick={() => bulkUpdateForgery(false)}>Запретить все</Button>
                        </div>
                    </div>

                </div>
            </DashboardSection>

            <DashboardSection title="Мои подписи">
                <SignatureList
                    signatures={signatures}
                    loading={signaturesLoading}
                    previewFields={previewFields}
                />
            </DashboardSection>
        </div>
    );
}