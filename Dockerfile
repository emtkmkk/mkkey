FROM node:11-alpine AS base

ENV NODE_ENV=production

RUN npm i -g npm@latest

WORKDIR /misskey

FROM base AS builder

RUN unlink /usr/bin/free
RUN apk add --no-cache \
    autoconf \
    automake \
    file \
    g++ \
    gcc \
    libc-dev \
    libtool \
    make \
    nasm \
    pkgconfig \
    procps \
    python \
    zlib-dev
RUN npm i -g node-gyp

COPY ./package.json ./
RUN npm i

COPY . ./
RUN node-gyp configure \
 && node-gyp build \
 && npm run build

FROM base AS runner

RUN apk add --no-cache \
    ffmpeg \
    tini
ENTRYPOINT ["/sbin/tini", "--"]

COPY --from=builder /misskey/node_modules ./node_modules
COPY --from=builder /misskey/built ./built
COPY . ./

CMD ["npm", "start"]
