import { RedisClient } from 'redis';
interface Redisable {
    get    : (key : string, onResolve : () => any, onReject : () => any) => Promise<any>
    set    : (key : string, payload : any, onResolve : () => any, onReject : () => any) => Promise<any>
    delete : (key : string, onResolve : () => any, onReject : () => any) => Promise<any>
}

export default class AsyncRedisWrapper implements Redisable {

    constructor(
        private readonly redisClient : RedisClient
    ) {
        this.redisClient = redisClient
    }

    get(key : string, onResolve : (response : any) => any, onReject : (error : unknown) => any) : Promise<any> {
        return new Promise((resolve, reject) => {
            this.redisClient.get(key, function(getError, getResponse) {
                if(getError){
                    reject(onReject(getError))
                    return;
                }
                resolve(onResolve(getResponse));
            })
        })
    }

    set(key : string, payload : any, onResolve : (response : any) => any, onReject : (error : unknown) => any) : Promise<any> {
        return new Promise((resolve, reject) => {
            this.redisClient.set(key, payload, function(getError, getResponse) {
                if(getError){
                    reject(onReject(getError))
                    return;
                }
                resolve(onResolve(getResponse));
            })
        })
    }

    delete(key : string, onResolve : (response : any) => any, onReject : (error : unknown) => any) : Promise<any> {
        return new Promise((resolve, reject) => {
            this.redisClient.del(key, function(getError, getResponse) {
                if(getError){
                    reject(onReject(getError))
                    return;
                }
                resolve(onResolve(getResponse));
            })
        })
    }
}