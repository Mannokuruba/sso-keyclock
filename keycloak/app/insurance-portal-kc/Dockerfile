# Stage 1 — build the Vite app
FROM node:20-alpine AS build
WORKDIR /app

# Accept Keycloak env vars at build time (Vite embeds them in the JS bundle)
ARG VITE_KEYCLOAK_URL=http://localhost:8080
ARG VITE_KEYCLOAK_REALM=insurance
ARG VITE_KEYCLOAK_CLIENT_ID=insurance-portal
ARG VITE_APP_NAME=InsureConnect
ARG VITE_APP_ENV=production

ENV VITE_KEYCLOAK_URL=$VITE_KEYCLOAK_URL
ENV VITE_KEYCLOAK_REALM=$VITE_KEYCLOAK_REALM
ENV VITE_KEYCLOAK_CLIENT_ID=$VITE_KEYCLOAK_CLIENT_ID
ENV VITE_APP_NAME=$VITE_APP_NAME
ENV VITE_APP_ENV=$VITE_APP_ENV

COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2 — serve built files with nginx
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx-spa.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
