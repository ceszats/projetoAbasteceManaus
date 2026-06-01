import { Platform } from 'react-native';
import * as Api from '@/lib/_core/api';
import * as Auth from '@/lib/_core/auth';

export interface AuthenticatedUser {
  id: number;
  name: string | null;
  email: string | null;
  openId: string;
  profilePictureUrl?: string;
}

export function authUserToAppUser(user: Auth.User): AuthenticatedUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    openId: user.openId,
  };
}

export async function persistAuthUser(user: Auth.User): Promise<AuthenticatedUser> {
  await Auth.setUserInfo(user);
  return authUserToAppUser(user);
}

export async function clearAuthSession(): Promise<void> {
  try {
    await Api.logout();
  } catch {
    // segue limpando sessão local
  }
  await Auth.removeSessionToken();
  await Auth.clearUserInfo();
}

async function userFromApi(): Promise<AuthenticatedUser | null> {
  const apiUser = await Api.getMe();
  if (!apiUser) return null;

  const userInfo: Auth.User = {
    id: apiUser.id,
    openId: apiUser.openId,
    name: apiUser.name,
    email: apiUser.email,
    loginMethod: apiUser.loginMethod,
    lastSignedIn: new Date(apiUser.lastSignedIn),
  };
  await Auth.setUserInfo(userInfo);
  return authUserToAppUser(userInfo);
}

/** Restaura usuário do SecureStore / cookie + API */
export async function restoreSessionUser(): Promise<AuthenticatedUser | null> {
  if (Platform.OS === 'web') {
    return userFromApi();
  }

  const sessionToken = await Auth.getSessionToken();
  if (!sessionToken) {
    await Auth.clearUserInfo();
    return null;
  }

  const cached = await Auth.getUserInfo();
  if (cached) {
    return authUserToAppUser(cached);
  }

  return userFromApi();
}
