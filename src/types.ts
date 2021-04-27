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

export interface Configurable {
    proxy : ProxyConfig
    cookie: CookieConfig
    auth : AuthConfig
    app  : AppConfig,
    host? : string
    redisConnection? : string
}