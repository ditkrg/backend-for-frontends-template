interface ProxyConfig {
    upstream : string 
    prefix?  : string
    enableHTTP2? : boolean,
    httpTimeout: number
}

interface CookieConfig { 
    secret: string 
    parseOptions: {}
    domain: string
    path: string
}

export interface Configurable {
    proxy : ProxyConfig
    cookie: CookieConfig
}