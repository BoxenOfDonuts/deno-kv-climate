FROM denoland/deno

EXPOSE 8000

WORKDIR /app

# prefer not to run as root
USER deno

# Cache the dependencies as a layer (the following two steps are re-run only when deps.ts is modified).
# Ideally cache deps.ts will download and compile _all_ external files used in main.ts.
COPY . /app
RUN deno cache main.ts

CMD ["run", "--allow-net", "--allow-env", "--allow-read", "--unstable-kv", "main.ts"]