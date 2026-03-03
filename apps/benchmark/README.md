# Benchmark

This directory contains a benchmark for `nuxt-auto-api` vs manual handlers.

## Usage

1. Build and run with Docker Compose:
   ```bash
   docker compose up --build
   ```

2. View k6 results in the console.

## Structure

- `app`: A minimal Nuxt app using `nuxt-auto-api` and manual handlers.
- `k6`: k6 load testing scripts.
