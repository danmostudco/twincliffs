# syntax=docker/dockerfile:1

# Stage 1 — compile the CSS with Tailwind's standalone CLI. No Node, no npm.
FROM debian:stable-slim AS css
ARG TAILWIND_VERSION=v4.3.3
ADD --chmod=755 https://github.com/tailwindlabs/tailwindcss/releases/download/${TAILWIND_VERSION}/tailwindcss-linux-x64 /usr/local/bin/tailwindcss
WORKDIR /build
COPY src ./src
COPY site ./site
RUN tailwindcss --input src/app.css --output site/css/app.css --minify

# Stage 2 — nginx serves the finished files.
FROM nginx:stable-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=css /build/site /usr/share/nginx/html
