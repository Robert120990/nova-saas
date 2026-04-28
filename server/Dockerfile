FROM node:20-alpine

# Definir directorio de trabajo
WORKDIR /app

# Instalar dependencias primero para cacheo de capas
COPY package*.json ./
RUN npm install

# Instalar nodemon globalmente para desarrollo
RUN npm install -g nodemon

# Copiar el resto del código
COPY . .

# Exponer el puerto del API
EXPOSE 4000

# Comando para ejecutar con nodemon en desarrollo
CMD ["npm", "run", "dev"]
