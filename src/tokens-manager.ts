/* eslint-disable */
import { TokenSet } from "openid-client";
import { Client as OpenIDClient } from "openid-client";
import { Configurable, TokenResponse } from "./types";

export default class TokensManager {

  // Key used to store token in redis
  private tokenKey: string = "";

  refreshedTokenExpired: boolean = false

  constructor(
    private readonly openIDClient: OpenIDClient,
    private readonly redisClient: any,
    private readonly config: Configurable
  ) {
    this.redisClient = redisClient;
  }

  async validateToken(tokenKey: string): Promise<TokenResponse> {
    this.tokenKey = tokenKey;

    try {
      const existingToken: TokenResponse = await this.retriveExistingToken();
      const existingTokenHasExpired = this.checkExpiry(existingToken.tokenSet)

      if (existingTokenHasExpired) {
        return await this.refreshToken(existingToken.tokenSet as TokenSet)
      }

      return existingToken;

    } catch (error: unknown) {
      console.log({ topLevelError: error })
      throw new Error("401")
    }
  }

  async retriveExistingToken(): Promise<TokenResponse> {
    if (!this.tokenKey) {
      throw ({
        isError: true,
        status: "invalid",
        error: {
          errorType: "Error",
          message: "No cookie was set",
        },
      });
    }

    const tokenSet = await this.redisClient.get(this.tokenKey);

    if (tokenSet == null) {
      throw ({
        isError: true,
        status: "invalid",
        error: {
          errorType: "Error",
          message: "Cookie could not be matched with any results!",
        },
      });
    }

    return ({
      isError: false,
      status: "valid",
      tokenSet: new TokenSet(JSON.parse(tokenSet))
    })

  }

  async refreshToken(tokenSet: TokenSet): Promise<TokenResponse> {
    try {
      const refreshedToken = await this.openIDClient.refresh(tokenSet);

      await this.redisClient.set(this.tokenKey, JSON.stringify(refreshedToken), { EX: 60 * 60 * 24 * (this.config.cookie.expiryinDays || 30) });

      return ({
        status: "refreshed",
        isError: false,
        tokenSet: refreshedToken
      })
    } catch (error: any) {
      /* 
        OPError will be thrown if the server replies with "invalid_grant". 
        With the current flow of code, such a behavior will occur due to rapid requests that come after one another and the token manager will try to reconsume the same refresh token twice, to which the server replies with "invalid grant"; 
        For that reason, if such a thing happens, the token manager will need to just get the tokenset from the DB and return it.
      */
      console.log("Error thrown while refreshing the token: ", { error  })
      if (error.name == "OPError") {
        this.refreshedTokenExpired = true
        return ({
          status: "refreshed",
          isError: false,
          tokenSet: await this.redisClient.get(this.tokenKey)
        })

      } else {
        throw error;
      }
    }
  }

  async deleteExistingToken(): Promise<boolean> {
    return await this.redisClient.del(this.tokenKey)
  }

  checkExpiry(tokenSet: TokenSet | undefined): boolean {
    return tokenSet?.expired() ?? false;
  }

  async logOut(tokenKey: string): Promise<boolean> {
    this.tokenKey = tokenKey;
    try {
      const retriveExistingToken: TokenResponse = await this.retriveExistingToken();

      await this.openIDClient.revoke(retriveExistingToken?.tokenSet?.access_token as string)
      await this.deleteExistingToken();

      return true

    } catch (error: unknown) {
      return false
    }
  }
}
