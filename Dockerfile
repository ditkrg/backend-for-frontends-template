FROM reg.dev.krd/library/node:14-alpine as build
WORKDIR /app

COPY *.json yarn.lock ./

RUN yarn install 

COPY src ./src
COPY tsconfig.json ./

RUN yarn build

FROM reg.dev.krd/library/node:14-alpine as production

ENV NODE_ENV=production

COPY  --from=build /app/*.json ./
RUN yarn install
COPY --from=build /app/dist ./dist
COPY config /app/config

ENTRYPOINT [ "yarn", "start:prod" ]
