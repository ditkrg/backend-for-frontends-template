import { TokenSet } from "openid-client";
import { decrypt } from "./encryption";
import { Configurable } from "./types";
import { Client as OpenIDClient } from "openid-client";
import { TokenResponse } from "./types";
import { Token } from 'typescript';

export default class TokensManager {
  private currentTokenSet?: TokenSet;
  private encryptedToken : string = "";
  private decryptedToken : string = "";

  
  constructor(
    private readonly openIDClient: OpenIDClient,
    private readonly redisClient: any,
    private readonly config: Configurable,
  ) {
    this.redisClient = redisClient;
  }

  

  async validateToken(encryptedToken : string) : Promise<TokenResponse> { 
    this.encryptedToken = encryptedToken;
    
    try {
      const retriveExistingToken : TokenResponse = await this.retriveExistingToken();
      const existingTokenHasExpired = this.checkExpiry(retriveExistingToken.tokenSet as TokenSet)

      if(existingTokenHasExpired){
        return await this.refreshToken(retriveExistingToken.tokenSet as TokenSet)
      }else {
        return retriveExistingToken;
      }
    }catch(error : unknown){
      console.log({topLevelError: error})
      throw new Error("401")
    }
  }

  async retriveExistingToken() : Promise<TokenResponse> {
    try {
      if (
        this.encryptedToken == "" ||
        this.encryptedToken == undefined ||
        this.encryptedToken == null
      ) {
        throw({
          isError: true,
          status: "invalid",
          error: {
            errorType: "Error",
            message: "No cookie was set",
          },
        });
      }

      this.decryptedToken = decrypt(this.encryptedToken, this.config.cookie.encryptionSecret);
      console.log({
        decrypted: this.decryptedToken
      })
      const getCurrentTokenSet = await this.redisClient.get(this.decryptedToken);

      if(getCurrentTokenSet == null){
        throw({
          isError: true,
          status: "invalid",
          error: {
            errorType: "Error",
            message: "Cookie could not be matched with any results!",
          },
        }); 
      }

      return({
        isError: false,
        status: "valid",
        tokenSet: new TokenSet(JSON.parse(await getCurrentTokenSet))
      })
    }catch(error : any){
      throw error;
    }
  }

  async refreshToken(tokenSet : TokenSet) : Promise<TokenResponse> {
    try { 
      const refreshedToken = await this.openIDClient.refresh(tokenSet);

      await this.redisClient.set(this.decryptedToken, JSON.stringify(refreshedToken));
      
      return({
        status: "refreshed",
        isError: false,
        tokenSet: refreshedToken
      })
    }catch(error : any){
      console.log({
        error,
        type: error?.name
      })

      /* 
        OPError will be thrown if the server replies with "invalid_grant". 
        With the current flow of code, such a behavior will occur due to rapid requests that come after one another and the token manager will try to reconsume the same refresh token twice, to which the server replies with "invalid grant"; 
        For that reaspn, if such a thing happens, the token manager will need to just get the tokenset from the DB and return it.
      */
      if(error.name == "OPError"){
        try {
          return this.redisClient.get(this.decryptedToken)
        }catch(e : any){
          throw e;
        }
      }else {
        throw error;
      }
    }
  } 

  async deleteExistingToken() : Promise<boolean>{ 
    try {
      return this.redisClient.del(this.decryptedToken)
    } catch (error : unknown) {
      throw error;
    }
  }

  checkExpiry(tokenSet : TokenSet) : boolean {
    return tokenSet.expired();
  }



  
}
