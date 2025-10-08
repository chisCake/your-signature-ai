import { UserRole } from "@/lib/types";

export function getUserRole(user: any): UserRole | null {
    if (!user) return null;
    return user.user_metadata.role as UserRole;
}

export function hasRole(user: any, requiredRole: UserRole) {
    const userRole = getUserRole(user);
    if (!userRole) return false;

    const roleHierarchy: Record<UserRole, number> = {
        user: 1,
        mod: 2,
        admin: 3,
    };

    return roleHierarchy[userRole] >= roleHierarchy[requiredRole];
};