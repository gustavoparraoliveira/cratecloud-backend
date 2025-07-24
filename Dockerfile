FROM node:20

# Atualiza o apt e instala ffmpeg, curl, bash, python3 e pip
RUN apt-get update && apt-get install -y \
    ffmpeg \
    curl \
    bash \
    python3 \
    python3-venv \
    python3-pip && \
    rm -rf /var/lib/apt/lists/*

# Cria ambiente virtual, instala yt-dlp dentro dele e cria link simbólico
RUN python3 -m venv /opt/venv && \
    /opt/venv/bin/pip install --upgrade pip yt-dlp && \
    ln -s /opt/venv/bin/yt-dlp /usr/local/bin/yt-dlp

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

RUN npx prisma generate

EXPOSE 3000

CMD npx prisma migrate deploy && node src/index.js
