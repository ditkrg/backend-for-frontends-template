interface RewriteHeadersOptions {
    
}

interface Proxy {
    upstream : string 
    prefix?  : string
    enableHTTP2? : boolean,
    rewriteHeadersOptions: RewriteHeadersOptions
}


export interface Configurable {
    proxies : Proxy[]    
}