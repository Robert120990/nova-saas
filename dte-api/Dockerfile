FROM node:20-alpine

# Definir directorio de trabajo
WORKDIR /app

# Instalar dependencias
COPY package*.json ./
RUN npm install

# Instalar nodemon globalmente para desarrollo
RUN npm install -g nodemon

# Copiar el resto del código
COPY . .

# Exponer el puerto del microservicio
EXPOSE 5000

# Comando para desarrollo
CMD ["npm", "run", "dev"]
