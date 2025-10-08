"use client";

import { useState, useEffect, useCallback } from "react";
import { SignatureList } from '@/components/signature-list';
import {
    SignatureGenuine,
    SignatureForged,
} from '@/lib/types';
import {
    getGenuineSignatures,
    getForgedSignatures,
    getGenuineSignaturesAmount,
    getForgedSignaturesAmount,
} from '@/lib/supabase/queries';
import { toast } from '@/components/ui/toast';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    ChevronFirst,
    ChevronLast,
    ChevronLeft,
    ChevronRight,
    Filter,
} from "lucide-react";
import { createBrowserClient } from '@/lib/supabase/client';

// Helper to build list of page numbers to render (max 5 items)
function getPageNumbers(current: number, total: number, max = 5): number[] {
    if (total <= max) return Array.from({ length: total }, (_, i) => i + 1);
    const half = Math.floor(max / 2);
    let start = Math.max(1, current - half);
    let end = start + max - 1;
    if (end > total) {
        end = total;
        start = end - max + 1;
    }
    return Array.from({ length: max }, (_, i) => start + i);
}

export default function SignaturesPage() {
    // Category genuine | forged
    const [category, setCategory] = useState<"genuine" | "forged">("genuine");
    // Pagination
    const [perPage, setPerPage] = useState<number>(50);
    const [page, setPage] = useState<number>(1);

    // Data
    const [signatures, setSignatures] = useState<(SignatureGenuine | SignatureForged)[]>([]);
    const [totalCount, setTotalCount] = useState<number>(0);
    const [isLoading, setIsLoading] = useState<boolean>(true);

    const totalPages = Math.max(1, Math.ceil(totalCount / perPage));

    const client = createBrowserClient();

    const loadData = useCallback(async () => {
        setIsLoading(true);
        try {
            const [count, list] = await (async () => {
                if (category === "genuine") {
                    const [cnt, lst] = await Promise.all([
                        getGenuineSignaturesAmount(client),
                        getGenuineSignatures(client, perPage, (page - 1) * perPage),
                    ]);
                    return [cnt, lst];
                } else {
                    const [cnt, lst] = await Promise.all([
                        getForgedSignaturesAmount(client),
                        getForgedSignatures(client, perPage, (page - 1) * perPage),
                    ]);
                    return [cnt, lst];
                }
            })();
            setTotalCount(count);
            setSignatures(list);
        } catch (e) {
            console.error(e);
            toast({ description: "Ошибка загрузки подписей", type: "foreground" });
        } finally {
            setIsLoading(false);
        }
    }, [category, perPage, page]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    // Handlers
    const handleCategoryChange = (cat: "genuine" | "forged") => {
        setCategory(cat);
        setPage(1); // reset page
    };

    const handlePerPageChange = (value: string | number) => {
        setPerPage(Number(value));
        setPage(1);
    };

    const navigatePage = (newPage: number) => {
        if (newPage < 1 || newPage > totalPages) return;
        setPage(newPage);
    };

    const pageNumbers = getPageNumbers(page, totalPages, 5);

    return (
        <div className="p-6 w-full space-y-4">
            {/* Filter panel */}
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border rounded-lg p-4 bg-muted/20">
            <div className="flex flex-row gap-2">
                    {/* Category selector */}
                    <div className="flex items-center gap-2">
                        <Filter className="h-4 w-4 text-muted-foreground" />
                        <Button
                            variant={category === "genuine" ? "default" : "outline"}
                            size="sm"
                            onClick={() => handleCategoryChange("genuine")}
                            className="flex items-center gap-1"
                        > Настоящие
                        </Button>
                        <Button
                            variant={category === "forged" ? "default" : "outline"}
                            size="sm"
                            onClick={() => handleCategoryChange("forged")}
                            className="flex items-center gap-1"
                        > Поддельные
                        </Button>
                    </div>

                    {/* Per page selector */}
                    <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">Показывать по</span>
                        <select
                            value={perPage}
                            onChange={(e) => handlePerPageChange(e.target.value)}
                            className="border border-input bg-background rounded px-2 py-1 text-sm focus:outline-none"
                        >
                            <option value={50}>50</option>
                            <option value={100}>100</option>
                            <option value={200}>200</option>
                        </select>
                    </div>
                </div>

                <div className="flex flex-row gap-2">
                    {/* Total count */}
                    <Badge variant="secondary">Всего: {totalCount}</Badge>
                </div>
            </div>

            {/* Results */}
            <SignatureList signatures={signatures} loading={isLoading} showHeader={false} />

            {/* Pagination */}
            <div className="flex items-center justify-center gap-1 mt-4">
                <Button variant="ghost" size="icon" onClick={() => navigatePage(1)} disabled={page === 1}>
                    <ChevronFirst className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => navigatePage(page - 1)} disabled={page === 1}>
                    <ChevronLeft className="h-4 w-4" />
                </Button>
                {pageNumbers.map((num) => (
                    <Button
                        key={num}
                        variant={num === page ? "default" : "outline"}
                        size="sm"
                        onClick={() => navigatePage(num)}
                    >
                        {num}
                    </Button>
                ))}
                <Button variant="ghost" size="icon" onClick={() => navigatePage(page + 1)} disabled={page === totalPages}>
                    <ChevronRight className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => navigatePage(totalPages)} disabled={page === totalPages}>
                    <ChevronLast className="h-4 w-4" />
                </Button>
            </div>
        </div>
    );
}