/**
 * @fileoverview SERVER-ONLY: Signature management policies
 * @restricted This file should NEVER be imported in client components
 * @security Contains sensitive business logic that must only run on server
 */

'use server';

import { Profile, Signature, User, UserRole } from '@/lib/types';
import { getUserProfile } from '@/lib/utils/auth-server-utils';
import { getSignatureOwner } from '@/lib/utils/client-utils';
import { createServerClient } from '@/lib/supabase/server';

// ========================================
// Система политик для управления подписями
// ========================================
//
// === Поля настоящей подписи ===
// 1. userForForgery: bool - разрешение пользователя на использование его настоящей подписи как образца для подделки
// 2. modForForgery: bool - разрешение модератора на использование любой другой настоящей подписи как образца для подделки
// Выдача подписи осуществляется по принципу (userForForgery && modForForgery), т.е.:
// - userForForgery=true И modForForgery=true => подпись может выдаваться случайно сервером как образец для подделки
// - userForForgery=false запрещает использование подписи, даже если modForForgery=true
// - modForForgery=false запрещает использование подписи, даже если userForForgery=true
// Примечание, с точки зрения политики конфиденциальности:
// - userForForgery - согласие пользователя на выдачу
// - modForForgery - запрет модератора на выдачу
// - модератор может ограничить выдачу подписей пользователя, даже если пользователь дал свое согласие
//
// === Пользователь ===
// 1.1. Может создать настоящую подпись
// 1.2. Может создать поддельную подпись на основе подписей других пользователей
// (подпись другого пользователя для образца выдается случайно сервером)
// 2.1. Может просматривать свои настоящие подписи
// 2.2. Может просматривать подделки, созданные на основе его настоящих подписей
// 3. Может редактировать только поле userForForgery своих настоящих подписи
// 4. Может удалять только свои настоящие подписи
//
// === Модератор ===
// 0. Имеет все права пользователя
// 1. Может создавать подписи для псевдопользователей
// 2. Может просматривать все настоящие и поддельные подписи
// 3. Может редактировать поля всех настоящих/поддельных подписей, но:
// 3.1. Может редактировать поле userForForgery только для своих собственных настоящих подписей
// 3.2. Не может редактировать подписи других модераторов/админов
// 4.1. Может удалять все настоящие/поддельные подписи
// 4.2. За исключением подписей других модераторов/админов
//
// === Админ ===
// 0. Имеет все права пользователя
// 1. Может создавать подписи для псевдопользователей
// 2. Может просматривать все настоящие и поддельные подписи
// 3. Может редактировать поля (включая modForForgery) всех настоящих/поддельных подписей, но:
// 3.1. Может редактировать поле userForForgery только для своих собственных настоящих подписей
// 3.2. Не может редактировать подписи других админов
// 4.1. Может удалять все настоящие/поддельные подписи
// 4.2. За исключением подписей других админов
//
// === Подделки ===
// 1. Любой пользователь может создать подделку
// 2. Сервер случайно выдает образец из настоящих подписей с userForForgery=true И modForForgery=true
// 3. Модератор/админ может создать подделку для любой подписи любого пользователя, обходя ограничение userForForgery и modForForgery
// 4. Пользователь не имеет полей, доступных для изменения в поддельной подписи. Только модераторы могут изменять поля в поддельной подписи
//
// === Псевдопользователи ===
// 1. Создаются только модераторами/админами
// 2. Подписи псевдопользователей имеют те же правила, что и обычных пользователей
// 3. Псевдопользователи не могут самостоятельно управлять своими подписями (так как не имеют аккаунта и, соответственно, личного кабинета)
// 4. Псевдопользователи могут создавать настоящие и поддельные подписи только под физическом курировании модератором/администратором
// 4.1 Во время создания настоящей подписи псевдопользователь может задать userForForgery, но после никто не может изменить данное поле

async function getCheckingData(
  signature: Signature
): Promise<{ user: Profile; userRole: UserRole; owner: User | null } | null> {
  const client = await createServerClient();
  const user = await getUserProfile(client);
  if (!user) return null;
  const userRole = user.role;
  const owner = await getSignatureOwner(signature, client);
  return { user, userRole, owner };
}

function ModAndAdminGeneralPermissions(
  user: Profile,
  userRole: UserRole,
  owner: User
): boolean {
  return (
    userIsOwner(user, owner) ||
    signatureBelongsToPseudouser(owner) ||
    (userRole === 'admin' && signatureBelongsToUserOrMod(owner)) ||
    (userRole === 'mod' && signatureBelongsToUser(owner))
  );
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function userHasAccessToExternalSignatures(
  userRole: UserRole,
  owner: User | null
): boolean {
  return owner === null && (userRole === 'mod' || userRole === 'admin');
}

function userIsOwner(user: Profile, owner: User): boolean {
  return owner && user.id === owner.data.id;
}

function signatureBelongsToPseudouser(owner: User): boolean {
  return owner.type === 'pseudouser';
}

function signatureBelongsToUserOrMod(owner: User): boolean {
  return (owner.data as Profile).role !== 'admin';
}

function signatureBelongsToUser(owner: User): boolean {
  return (owner.data as Profile).role === 'user';
}

export async function canEditSignature(signature: Signature): Promise<boolean> {
  const data = await getCheckingData(signature);
  if (!data) return false;
  const { user, userRole, owner } = data;

  // Пользователь не может редактировать даже свою подпись
  // Исключение: пользователь может изменять поле userForForgery своей настоящей подписи, но здесь это не проходит
  if (userRole === 'user') return false;

  if (!owner) return true;

  return ModAndAdminGeneralPermissions(user, userRole, owner);
}

export async function canDeleteSignature(
  signature: Signature
): Promise<boolean> {
  const data = await getCheckingData(signature);
  if (!data) return false;
  const { user, userRole, owner } = data;

  if (userRole === 'user')
    return owner !== null && signatureBelongsToUser(owner);

  if (!owner) return true;

  return ModAndAdminGeneralPermissions(user, userRole, owner);
}
