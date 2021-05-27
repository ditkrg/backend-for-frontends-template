import { TokenSet } from 'openid-client'
import Sentry from '@sentry/node'

interface ProxyConfig {
    upstream: string
    prefix?: string
    enableHTTP2?: boolean,
    httpTimeout: number
}

interface CookieConfig {
    secret: string
    parseOptions: {}
    domain: string
    path: string
    encryptionSecret: string
}

interface AuthConfig {
    clientId: string
    clientSecret: string
    redirectUrl: string
    discoveryDocumentUrl: string
    scopes?: string[] | string
}

interface StoreConfig {
    codeVerifierKeyName: string
    tokenCookieName: string
}

interface TokenErrorResponse {
    errorType: 'HTTPError' | 'Error',
    message: string
    code?: number
}
export interface TokenResponse {
    status: 'valid' | 'invalid' | 'expired' | 'refreshed'
    tokenSet?: TokenSet
    isError: boolean
    error?: TokenErrorResponse
}
export interface Configurable {
    proxy: ProxyConfig
    cookie: CookieConfig
    auth: AuthConfig
    storeConfig: StoreConfig
    sentry: Sentry.NodeOptions
    baseUrl: string;
    redisConnection?: string
}
