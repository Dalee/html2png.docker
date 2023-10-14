FROM node:18-alpine

RUN apk add --update --no-cache ttf-freefont fontconfig

WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .

EXPOSE 8888
VOLUME /usr/share/fonts/app_fonts
CMD [ "npm", "run", "start" ]
