FROM reg.dev.krd/library/node:14-alpine as setup

RUN set -eux \
    & apk add \
    --no-cache \
    yarn

FROM setup as build
WORKDIR /app

COPY *.json yarn.lock ./

RUN yarn install 

COPY src ./src
COPY tsconfig.json ./

RUN yarn build

FROM build as production

ENV NODE_ENV=production

COPY  --from=build /app/*.json ./
RUN yarn install
COPY --from=build /app/dist ./dist


ENTRYPOINT [ "yarn", "start:prod" ]
