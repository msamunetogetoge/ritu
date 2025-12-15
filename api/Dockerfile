# Build and run RITU API on Cloud Run (Deno 2.x)
FROM denoland/deno:2.5.4 AS builder
WORKDIR /app

# Prefetch dependencies
COPY api/deno.json api/deno.lock ./ 
COPY api/main.ts ./main.ts
COPY api/src ./src
RUN deno cache main.ts

FROM denoland/deno:2.5.4
WORKDIR /app
ENV DENO_DIR=/deno-dir

COPY --from=builder /deno-dir /deno-dir
COPY api/deno.json api/deno.lock ./ 
COPY api/main.ts ./main.ts
COPY api/src ./src

EXPOSE 8080
CMD ["run", "--allow-env", "--allow-net", "--allow-read=/app,/etc/ssl/certs", "main.ts"]
