import { apiConfig } from './config';
import { tokens } from './tokens';

/**
 * Client HTTP de l'API Kaza.
 * - Envoie la clé `x-api-key` et, pour les routes connectées, le jeton d'accès.
 * - Jeton expiré : un seul rafraîchissement à la fois (le jeton de rafraîchissement est à usage
 *   unique), puis la requête est rejouée. Session révoquée : `onSessionExpired`.
 * - Les messages d'erreur viennent du serveur, en français, prêts à afficher.
 */

export class ApiError extends Error {
  constructor(
    message: string,
    /** `statusCodeKey` du serveur (`otpInvalid`, `unitNotVacant`…), ou `network` */
    readonly key: string,
    readonly status: number,
    readonly data?: Record<string, unknown>,
  ) {
    super(message);
  }
}

export type Tokens = {
  tokenType: string;
  accessToken: string;
  expiresIn: number;
  refreshToken: string;
  refreshTokenExpiresAt: string;
};

type RequestOptions = {
  body?: unknown;
  /** Route connectée : jeton d'accès requis */
  auth?: boolean;
  /** En-tête Idempotency-Key, pour rejouer une écriture sans doublon */
  idempotencyKey?: string;
};

let sessionExpiredHandler: (() => void) | null = null;
let refreshing: Promise<boolean> | null = null;

async function send<T>(method: string, path: string, { body, auth, idempotencyKey }: RequestOptions): Promise<T> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'x-api-key': apiConfig.key,
    'x-custom-lang': 'fr',
  };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;
  const access = tokens.getAccess();
  if (auth && access) headers.Authorization = `Bearer ${access}`;

  let res: Response;
  try {
    res = await fetch(`${apiConfig.url}/api/v1${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError('Pas de connexion. Vérifiez internet et réessayez.', 'network', 0);
  }

  const json = (await res.json().catch(() => ({}))) as {
    message?: string;
    statusCodeKey?: string;
    data?: unknown;
  };
  if (!res.ok) {
    throw new ApiError(
      json.message ?? 'Le serveur n’a pas pu traiter la demande. Réessayez.',
      json.statusCodeKey ?? 'unknown',
      res.status,
      (json.data ?? undefined) as Record<string, unknown> | undefined,
    );
  }
  return json.data as T;
}

/** Échange le jeton de rafraîchissement contre une nouvelle paire. Faux si la session est perdue. */
async function refreshSession(): Promise<boolean> {
  const refreshToken = await tokens.getRefresh();
  if (!refreshToken) return false;
  try {
    const next = await send<Tokens>('POST', '/public/auth/refresh', { body: { refreshToken } });
    await saveTokens(next);
    return true;
  } catch (error) {
    // Hors ligne : la session reste valable, on réessaiera plus tard
    if (error instanceof ApiError && error.key === 'network') throw error;
    await tokens.clear();
    return false;
  }
}

export async function saveTokens(next: Tokens): Promise<void> {
  // Le nouveau jeton de rafraîchissement est enregistré avant toute autre requête
  await tokens.setRefresh(next.refreshToken);
  tokens.setAccess(next.accessToken);
}

async function request<T>(method: string, path: string, options: RequestOptions = {}): Promise<T> {
  if (options.auth && !tokens.getAccess()) {
    refreshing ??= refreshSession().finally(() => (refreshing = null));
    if (!(await refreshing)) {
      sessionExpiredHandler?.();
      throw new ApiError('Votre session a expiré. Reconnectez-vous.', 'forbidden', 401);
    }
  }
  try {
    return await send<T>(method, path, options);
  } catch (error) {
    const expired =
      options.auth &&
      error instanceof ApiError &&
      error.status === 401 &&
      (error.key === 'jwtAccessTokenInvalid' || error.key === 'forbidden');
    if (!expired) throw error;

    tokens.setAccess(null);
    refreshing ??= refreshSession().finally(() => (refreshing = null));
    if (!(await refreshing)) {
      sessionExpiredHandler?.();
      throw error;
    }
    return send<T>(method, path, options);
  }
}

export const api = {
  get: <T>(path: string, options?: RequestOptions) => request<T>('GET', path, { ...options, auth: options?.auth ?? true }),
  post: <T>(path: string, body: unknown, options?: RequestOptions) =>
    request<T>('POST', path, { ...options, body, auth: options?.auth ?? true }),
  patch: <T>(path: string, body: unknown, options?: RequestOptions) =>
    request<T>('PATCH', path, { ...options, body, auth: options?.auth ?? true }),
  put: <T>(path: string, body: unknown, options?: RequestOptions) =>
    request<T>('PUT', path, { ...options, body, auth: options?.auth ?? true }),
  delete: <T>(path: string, options?: RequestOptions) => request<T>('DELETE', path, { ...options, auth: options?.auth ?? true }),
  /** Appelé quand la session ne peut plus être renouvelée (révoquée ou expirée) */
  onSessionExpired(handler: (() => void) | null) {
    sessionExpiredHandler = handler;
  },
};

/** Clé unique pour l'en-tête Idempotency-Key. */
export function newIdempotencyKey(): string {
  const random = globalThis.crypto?.randomUUID?.();
  return random ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

/** Message à afficher pour une erreur quelconque. */
export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return 'Une erreur est survenue. Réessayez.';
}
