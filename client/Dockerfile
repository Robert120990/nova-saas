# Etapa de construcción
FROM node:20-alpine AS build

WORKDIR /app

# Copiar archivo de env para producción
COPY .env.docker .env

# Instalar dependencias primero para aprovechar el cache de capas
COPY package*.json ./
RUN npm install

# Copiar el resto del código y construir
COPY . .
RUN npm run build

# Etapa de ejecución (Producción con Node)
FROM node:20-alpine

WORKDIR /app

# Instalar 'serve' para servir el contenido estático
RUN npm install -g serve

# Copiar archivo de env para producción
COPY .env.docker .env

# Copiar solo el build de la etapa anterior
COPY --from=build /app/dist ./dist

# Exponer el puerto solicitado
EXPOSE 3000

# Comando para servir la aplicación en el puerto 3000
CMD ["serve", "-s", "dist", "-l", "3000"]
