# Node 24, the active LTS. Only the build stage needs it — the runtime image
# below is nginx serving the compiled output, so Node never ships to production.
FROM node:24-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
# Rendered into conf.d at container start by the image's envsubst entrypoint,
# which is how WEB_PASSWORD reaches the config without being baked in here.
COPY nginx-templates /etc/nginx/templates
COPY --from=build /app/dist /usr/share/nginx/html
# The login page is served before the cookie exists, so it cannot reach the
# hashed bundle for its styling. Lifting the token sheet to the html root gives
# it the app's own values instead of a second copy of them that could drift.
COPY --from=build /app/src/styles/tokens.css /usr/share/nginx/html/tokens.css
EXPOSE 80
