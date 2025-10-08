import Link from "next/link";
import { getUser, isMod, isAdmin } from '@/lib/auth-server-utils';
import { Button } from "./ui/button";

export async function DashboardList() {
  const user = await getUser();
  const isModerator = await isMod(user);

  return (user &&
    <div className="flex gap-2 items-center">
      {!isModerator &&
        <Button asChild size="sm" variant={"outline"}>
          <Link href="/dashboard">Dashboard</Link>
        </Button>}

      {isModerator &&
        <>
          <span>Dashboards</span>
          <Button asChild size="sm" variant={"outline"}>
            <Link href="/dashboard">User</Link>
          </Button>
          <Button asChild size="sm" variant={"outline"}>
            <Link href="/dashboard-mod">Mod</Link>
          </Button>
          {await isAdmin() &&
            <Button asChild size="sm" variant={"outline"}>
              <Link href="/dashboard-admin">Admin</Link>
            </Button>}
        </>
      }
    </div>
  )
}