FROM reg.dev.krd/hub.docker/library/node:16-alpine as build
WORKDIR /app

COPY package.json yarn.lock ./

RUN yarn install 

COPY src ./src
COPY tsconfig.json ./

RUN yarn build

FROM reg.dev.krd/hub.docker/library/node:16-alpine as production

WORKDIR /app
ENV NODE_ENV=production

COPY  --from=build /app/yarn.lock ./
COPY  --from=build /app/package.json ./

RUN yarn install

COPY config /app/config
COPY --from=build /app/dist ./dist

ENTRYPOINT [ "yarn", "start:prod" ]
