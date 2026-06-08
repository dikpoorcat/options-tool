import cors from "@fastify/cors";
import Fastify from "fastify";
import { fetchBtcPutSnapshot } from "./binance";

const port = Number(process.env.PORT ?? 8787);
const host = process.env.HOST ?? "127.0.0.1";

const app = Fastify({
  logger: true
});

await app.register(cors, {
  origin: true
});

app.get("/api/health", async () => ({
  ok: true,
  now: Date.now()
}));

app.get("/api/options/btc-put", async (_request, reply) => {
  try {
    return await fetchBtcPutSnapshot();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load Binance option data";
    return reply.code(502).send({
      error: message
    });
  }
});

await app.listen({ port, host });
