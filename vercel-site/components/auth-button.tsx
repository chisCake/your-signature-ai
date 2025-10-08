import Link from "next/link";
import { Button } from "./ui/button";
import { getUser } from '@/lib/auth-server-utils';
import { LogoutButton } from "./logout-button";

export async function AuthButton() {
  const user = await getUser();

  return user ? (
    <div className="flex items-center gap-4">
      Привет, {user.email}!
      <LogoutButton />
    </div>
  ) : (
    <div className="flex gap-2">
      <Button asChild size="sm" variant={"outline"}>
        <Link href="/auth/login">Войти</Link>
      </Button>
      <Button asChild size="sm" variant={"default"}>
        <Link href="/auth/sign-up">Зарегистрироваться</Link>
      </Button>
    </div>
  );
}
