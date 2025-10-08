import { isMod, isAdmin } from '@/lib/auth-server-utils';
import Link from "next/link";

export async function ActionPageList() {
    if (!await isMod()) {
        return null;
    }

    return (
        <div className="flex gap-4 items-center p-3 px-5 text-sm h-12">
            <Link href="/signatures">Подписи</Link>
            <Link href="/users">Пользователи</Link>
            <Link href="/controlled-signature-addition">Контроллируемое добавление</Link>
            {await isAdmin() &&
                <>
                    <Link href="/">ИИ Сервер</Link>
                    <Link href="/">Импорт/Экспорт</Link>
                </>
            }
        </div>
    );
}