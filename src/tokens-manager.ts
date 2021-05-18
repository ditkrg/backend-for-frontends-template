import { TokenSet } from "openid-client";
import { RedisClient } from "redis";
import { decrypt } from "./encryption";
import { Configurable } from "./types";
import { Client as OpenIDClient } from "openid-client";
import { TokenResponse } from "./types";


export default class TokensManager { 
    private currentTokenSet? : TokenSet;

    constructor(
        private readonly openIDClient : OpenIDClient,
        private readonly redisClient : RedisClient,
        private readonly config : Configurable,
        private readonly encryptedToken : string,
    ){
        this.redisClient    = redisClient
        this.encryptedToken = encryptedToken
    }


    retrieveToken() : Promise<TokenResponse> {
        return new Promise((resolve, reject) => {

            if(this.encryptedToken == "" || this.encryptedToken == undefined || this.encryptedToken == null) {
                reject({
                    isError: true,
                    hasExpired: false,
                    error: {
                        errorType: "Error",
                        message: "No cookie was set"
                    }
                } as TokenResponse)
            }

            const decrypted = decrypt(this.encryptedToken, this.config.cookie.encryptionSecret)


            this.redisClient.get(decrypted, (err : any, response : any) => {
                if(err || response == null){
                    reject({
                        isError: true,
                        error: {
                            errorType: "Error",
                            message: "Failed to associate cookie with any records. This could be a possible cookie hijacking attack!"
                        }
                    } as TokenResponse)
                    return;
                }

                resolve({
                    isError: false,
                    hasExpired: false,
                    hasRefreshed: false,
                    tokenSet: new TokenSet(JSON.parse(response as string))
                })
            })
        })
    }

    validateToken() : Promise<TokenResponse> {
        return new Promise(async (resolve, reject) => {
            try {
                const token = await this.retrieveToken() as TokenResponse
                this.currentTokenSet = token.tokenSet
        
                if(this.currentTokenSet?.expired()){
                    reject({
                        hasExpired: true,
                        hasRefreshed: false,
                        isError: true,
                        tokenSet: this.currentTokenSet,
                        error: {
                            errorType: "Error",
                            message: "Token has expired"
                        }
                    })
                }else {
                    resolve({
                        hasExpired: false,
                        hasRefreshed: false,
                        isError: false,
                        tokenSet: this.currentTokenSet
                    })
                }

            }catch(e){
                console.log({
                    edd: e
                })
                reject(e)
            }
        })
    }

    refreshToken() : Promise<TokenResponse> {
        return new Promise(async (resolve, reject) => {
            try {
                const newTokenSet = await this.openIDClient.refresh(this.currentTokenSet as TokenSet)
                
                this.redisClient.set(newTokenSet.refresh_token as string, JSON.stringify(newTokenSet), (err : any, response : any) => {
                    if(err){
                        reject({
                            hasExpired: true,
                            hasRefreshed: true,
                            isError: true,
                            error: {
                                errorType: "Error",
                                message: "Failed to update the store with new access token"
                            }
                        })
                        return;
                    }
                    
                    this.redisClient.del(this.currentTokenSet?.refresh_token as string)

                    resolve({
                        hasExpired: true,
                        hasRefreshed: true,
                        tokenSet: newTokenSet,
                        isError: false
                    })
                })
            }catch(e){
                reject({
                    hasExpired: true,
                    hasRefreshed: false,
                    isError: true,
                    error: {
                        errorType: "Error",
                        message: e.message
                    }
                })
            }
        })
    }

    async checkToken() : Promise<TokenResponse> {
        return new Promise(async (resolve, reject) => {
            try {
                const isCurrentTokenValid = await this.validateToken();
                console.log({
                    isCurrentTokenValid,
                    tokenSet: this.currentTokenSet
                })
                if(!isCurrentTokenValid.hasExpired){
                    resolve({
                        isError: false,
                        hasExpired: false,
                        hasRefreshed: false,
                        tokenSet: this.currentTokenSet
                    })
                }
            }catch(err){
                if(err.isError && err.hasExpired){
                    try {
                        const refresh : TokenResponse = await this.refreshToken() 
                        resolve(refresh)
                    }catch(e){
                        if(e.hasExpired && !e.hasRefreshed){
                            reject(new Error("403"))
    
                        }else {
                            this.redisClient.del(this.currentTokenSet?.refresh_token as string, (error : any, response : any) => {
                                if(error){
                                    console.log({error, e})
                                    reject(new Error("403"))
                                    return;
                                }
                            })
                        }
                    }
                }else {
                    reject(new Error("403"))

                }

                
            }
        })
    }
}