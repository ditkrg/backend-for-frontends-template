<p align="center">
  <a href="http://gov.krd/" target="blank"><img src="https://gov.krd/media/2893/krg_logo_2480x2056.png" width="320" alt="Nest Logo" /></a>
</p>

  <p align="center">Backend For Frontends is a reusable, production-ready, containerized implementation of the BFF Pattern in TypeScript and Node.js</p>

<a href="#"><img src="https://img.shields.io/npm/l/@nestjs/core.svg" alt="Package License" /></a>

## Description

The Backend for Frontends implements the BFF pattern. It is intended to conceal access tokens obtained from an Authorization Server from the browser by storing and refreshing access tokens on an intermediary backend through which the client communicates to the APIs. Authentication of the client requests happen through a SAMESITE, Secure, HTTP-Only Cookie. 

## Installation

```bash
$ yarn install
```

## Running the app

```bash
# development watch mode
$ yarn start:dev

# production mode
$ yarn start:prod
```

## Environment Variables

```bash
CONFIGURATIONS_FILE_PATH=/path/to/config.json
PORT=3002
REDIS_URL=redis://127.0.0.1:6397
```

## Configurations

The following configurations need to be given to the software in order for it to run properly. Reference this file in the Environment variable "CONFIGURATIONS_FILE_PATH", relative to the dist directory. 

A template file named "config.example.json" can be found in the root directory:

```json
{
    "proxy": {
        "upstream": "<UPSTREAM URL>",
        "prefix": "<URL PREFIX TO REVERSE>",
        "enableHTTP2": false,
        "httpTimeout": 10000
    },
    "cookie": {
        "secret": "<COOKIE SECRET>",
        "parseOptions": {},
        "domain": "localhost",
        "path": "/",
        "encryptionSecret": "1234"
    },
    "auth": {
        "client_id": "<OAUTH2 CLIENT ID>",
        "client_secret": "<OAUTH2 CLIENT SECRET>",
        "redirect_endpoint": "<CALLBACK ENDPOINT USED BY IDP>",
        "openidc_discovery_uri": "<OPEN ID PROVIDER .well-known CONFIGS>"
    },
    "app": {
        "useSSL": false,
        "domain": "localhost"
    },
    "storeConfig": {
        "codeVerifierKeyName": "code_verifier",
        "tokenCookieName": "token"
    },
    "sentryConfig": {
        "dsn": "<SENTRY DSN>"
    }
}
```

## License

  Nest is [MIT licensed](LICENSE).
