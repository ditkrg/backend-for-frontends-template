import { TokenSet } from "openid-client";

interface ProxyConfig {
    upstream : string 
    prefix?  : string
    enableHTTP2? : boolean,
    httpTimeout : number
}

interface CookieConfig { 
    secret : string 
    parseOptions : {}
    domain : string
    path : string
    encryptionSecret: string
}

interface AuthConfig {
    client_id : string
    client_secret : string
    redirect_endpoint : string
    openidc_discovery_uri : string
}

interface AppConfig {
    useSSL : boolean
    domain : string
}

interface StoreConfig {
    codeVerifierKeyName : string
    tokenCookieName : string
}

interface TokenErrorResponse {
    errorType : "HTTPError" | "Error",
    message : string 
    code? : number
}
export interface TokenResponse { 
    hasExpired? : boolean
    hasRefreshed? : boolean
    tokenSet? : TokenSet
    isError: boolean
    error?: TokenErrorResponse
}


export interface Configurable {
    proxy : ProxyConfig
    cookie: CookieConfig
    auth : AuthConfig
    app  : AppConfig,
    storeConfig: StoreConfig
    host? : string
    redisConnection? : string
}