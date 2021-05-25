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
PORT=3002 # The port to listen on
```

## Configurations

The app uses uses [node-config](https://github.com/lorenwest/node-config) for configuration, check their [wiki](https://github.com/lorenwest/node-config/wiki) to see how to provide configuration values.

A template file [example.json](config/example.json) can be found in the config directory.

*You can also check the [types](src/types.ts)* source file to see the allowed configuration values.

## License

  Nest is [MIT licensed](LICENSE).
