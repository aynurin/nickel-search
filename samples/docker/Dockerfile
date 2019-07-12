FROM node:lts-alpine

WORKDIR /nickel

COPY ./samples/dist ./samples/dist/
COPY ./lib ./lib/
COPY ./package.json ./
COPY ./package-lock.json ./

RUN npm i --production

ENTRYPOINT ["node", "./samples/dist/indexer.js"]
