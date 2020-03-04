FROM node:12-alpine

RUN apk add --no-cache curl && \
    cd /tmp && curl -Ls https://github.com/dustinblackman/phantomized/releases/download/2.1.1/dockerized-phantomjs.tar.gz | tar xz && \
    cp -R lib lib64 / && \
    cp -R usr/lib/x86_64-linux-gnu /usr/lib && \
    cp -R usr/share/fonts /usr/share && \
    cp -R etc/fonts /etc && \
    curl -k -Ls https://bitbucket.org/ariya/phantomjs/downloads/phantomjs-2.1.1-linux-x86_64.tar.bz2 | tar -jxf - && \
    cp phantomjs-2.1.1-linux-x86_64/bin/phantomjs /usr/local/bin/phantomjs && \
    rm -rf /tmp/* && \
    apk add --no-cache ttf-freefont fontconfig

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .

EXPOSE 1481
VOLUME /usr/share/fonts/app_fonts
CMD [ "npm", "run", "start" ]
