"use client";

import { useState, useEffect, useCallback } from "react";
import { UserSearchDropdown } from "@/components/user-search-dropdown";
import { ensurePseudouser, getUserGenuineSignatures } from "@/lib/supabase/mod-utils";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { SignatureList } from "@/components/signature-list";
import { User, SignatureGenuine, createPseudouserUser, getUserName, isProfile, isPseudouser } from "@/lib/types";
import CreateSignatureSection from "@/components/create-signature-section";
import { saveForAnotherSignature } from "@/lib/signature-utils";
import { Badge } from "@/components/ui/badge";

const CANVAS_SIZE = `w-[560px] h-[420px]
                   sm:w-[580px] sm:h-[435px]
                   md:w-[580px] md:h-[435px]
                   lg:w-[580px] lg:h-[435px]
                   xl:w-[580px] xl:h-[435px]`;

export default function ControlledSignatureAddition() {
    const [message, setMessage] = useState<string>("");
    const [selectedUser, setSelectedUser] = useState<User | null>(null);
    const [latestQuery, setLatestQuery] = useState<string>("");
    const [latestResults, setLatestResults] = useState<User[]>([]);
    const [inputChanged, setInputChanged] = useState<boolean>(false);
    const [signatures, setSignatures] = useState<SignatureGenuine[]>([]);
    const [signaturesLoading, setSignaturesLoading] = useState<boolean>(false);
    const [modalOpen, setModalOpen] = useState<boolean>(false);
    const exactPseudouserExists = latestResults.some(
        (r) => r.type === "pseudouser" && r.data.name === latestQuery,
    );

    const fetchSignatures = useCallback(async () => {
        if (!selectedUser) {
            setSignatures([]);
            return;
        }

        setSignaturesLoading(true);
        getUserGenuineSignatures(selectedUser.data.id, selectedUser.type)
            .then((result) => {
                // console.log("setting signatures", result.length);
                setSignatures(result);
            })
            .catch((error) => {
                console.error("Error fetching signatures:", error);
                setSignatures([]);
            })
            .finally(() => setSignaturesLoading(false));
    }, [selectedUser]);

    const signatureDeletedHandler = useCallback(() => {
        fetchSignatures();
    }, [fetchSignatures]);

    useEffect(() => {
        window.addEventListener("signatureDeleted", signatureDeletedHandler);
        return () => {
            window.removeEventListener("signatureDeleted", signatureDeletedHandler);
        };
    }, [signatureDeletedHandler]);

    // Fetch signatures when user is selected
    useEffect(() => {
        fetchSignatures();
    }, [fetchSignatures]);

    const handleCreate = async () => {
        if (!latestQuery.trim()) return;
        try {
            const { pseudouser, created } = await ensurePseudouser(latestQuery.trim(), "manual");
            setSelectedUser(createPseudouserUser(pseudouser));
            setMessage(created ? "Пользователь создан" : "Пользователь уже существовал. Выбран.");
        } catch (e) {
            console.error(e);
            setMessage("Ошибка создания пользователя");
        }
    };

    return (
        <>
            <div className="flex flex-col items-center justify-center h-full gap-4 p-4 px-6">
                <h1 className="text-2xl font-bold">Выбор пользователя</h1>
                <div className="flex flex-col gap-4 items-center w-full">
                    <Label htmlFor="user-search" className="self-start">Введите имя пользователя</Label>
                    <UserSearchDropdown
                        autoSearch
                        searchIntervalMs={1000}
                        onSelect={(item) => {
                            setSelectedUser(item);
                            setMessage("");
                        }}
                        onSearchComplete={(q, results) => {
                            setLatestQuery(q);
                            setLatestResults(results);
                            setInputChanged(false); // Reset input changed flag when search completes
                        }}
                        onInputChange={(q) => {
                            setInputChanged(true); // Mark input as changed
                        }}
                    />
                    <Button onClick={handleCreate} disabled={!latestQuery.trim() || exactPseudouserExists || inputChanged}>
                        Создать
                    </Button>

                    {message && (
                        <div className={`text-sm p-3 rounded-md max-w-md text-center`}>
                            {message}
                        </div>
                    )}

                    {selectedUser && (
                        <div className="w-full rounded-md border p-4 text-sm space-y-2">
                            <div className="flex items-center gap-2">
                                <div className="font-medium text-lg">{getUserName(selectedUser)}</div>
                                <Badge variant={selectedUser.type === "user" ? "default" : "secondary"}>
                                    {selectedUser.type === "user" ? "Пользователь" : "Псевдо"}
                                </Badge>
                                {isProfile(selectedUser) && (
                                    <Badge variant="outline">
                                        {selectedUser.data.role}
                                    </Badge>
                                )}
                            </div>
                            <div className="text-muted-foreground text-xs break-all">ID: {selectedUser.data.id}</div>
                            <div className="text-muted-foreground text-xs">Дата создания: {new Date(selectedUser.data.created_at).toLocaleDateString("ru-RU")}</div>
                            {isPseudouser(selectedUser) && (
                                <div className="text-muted-foreground text-xs">Источник: {selectedUser.data.source}</div>
                            )}
                        </div>
                    )}

                    {/* Кнопка "Начать" */}
                    {selectedUser && (
                        <Button variant="confirm" onClick={() => setModalOpen(true)}>
                            Начать
                        </Button>
                    )}

                    {selectedUser && (
                        <div className="w-full">
                            <h2 className="text-xl font-semibold mb-4">Подписи пользователя</h2>
                            <SignatureList
                                signatures={signatures}
                                loading={signaturesLoading}
                            />
                        </div>
                    )}
                </div>
            </div>
            {modalOpen && (
                <div className="fixed top-0 bottom-0 left-0 right-0 bg-black/50 z-10 w-full h-full flex items-center justify-center">
                    <div className="flex flex-col gap-4 border border-secondary rounded-lg p-4 bg-primary-foreground m-4 max-h-[95vh] overflow-y-auto">
                        <CreateSignatureSection
                            canvasClassName={CANVAS_SIZE}
                            onSignatureSaved={() => {
                                if (selectedUser) {
                                    getUserGenuineSignatures(selectedUser.data.id, selectedUser.type)
                                        .then(setSignatures)
                                        .catch(console.error);
                                }
                            }}
                            saveSignature={async (opts) => {
                                if (!selectedUser) throw new Error("User not selected");
                                return saveForAnotherSignature({
                                    ...opts,
                                    targetTable: selectedUser.type === "user" ? "profiles" : "pseudousers",
                                    targetId: selectedUser.data.id,
                                });
                            }}
                        />
                        <Button variant="secondary" onClick={() => setModalOpen(false)}>
                            Закончить
                        </Button>
                        <div>{selectedUser ? getUserName(selectedUser) : ""} - сохраненно подписей: {signatures.length}</div>
                    </div>
                </div>
            )}
        </>
    );
}