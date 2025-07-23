# Usa imagem oficial do Node.js
FROM node:20

# Instala dependências do sistema, incluindo ffmpeg e yt-dlp
RUN apt-get update && \
    apt-get install -y ffmpeg curl && \
    curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp && \
    chmod a+rx /usr/local/bin/yt-dlp

# Define diretório de trabalho
WORKDIR /app

# Copia arquivos de dependências
COPY package*.json ./

# Instala dependências do Node.js
RUN npm install

# Copia o restante do projeto
COPY . .

# Gera Prisma Client
RUN npx prisma generate

# Expõe porta
EXPOSE 3000

# Inicia o servidor
CMD ["node", "src/index.js"]
