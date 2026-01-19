# Imagem base
FROM node:20-alpine

WORKDIR /app

# Instalar dependências
COPY package*.json ./
RUN npm install --production

# Copiar código
COPY src ./src

# Variáveis necessárias: SUPABASE_URL, SUPABASE_KEY
# A porta é injetada pelo Render automaticamente via variável PORT

# Comando de arranque
CMD ["node", "src/index.js"]