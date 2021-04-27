FROM reg.dev.krd/library/node:12-alpine as setupEnv

RUN set -eux \
    & apk add \
        --no-cache \
        yarn

FROM setupEnv as buildEnv
WORKDIR /app

COPY *.json yarn.lock ./

RUN yarn install 

COPY src ./src
COPY tsconfig.json ./

RUN yarn build

FROM buildEnv as runEnv

ENV NODE_ENV=production

COPY  --from=buildEnv /app/*.json ./
RUN yarn install
COPY --from=buildEnv /app/dist ./dist


ENTRYPOINT [ "yarn", "start:prod" ]
