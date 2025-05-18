import "dotenv/config";
import { createServer } from "node:http";
import { availableParallelism } from "node:os";
import { Client, type ShardStatus } from "oceanic.js";
import pm2, { type ProcessDescription } from "pm2";
import winston from "winston";
import { init as dbInit } from "../database.js";

const logger = winston.createLogger({
  levels: {
    error: 0,
    warn: 1,
    info: 2,
    main: 3,
    debug: 4,
  },
  transports: [
    new winston.transports.Console({ format: winston.format.colorize({ all: true }), stderrLevels: ["error", "warn"] }),
  ],
  level: process.env.DEBUG_LOG ? "debug" : "main",
  format: winston.format.combine(
    winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    winston.format.printf((info) => {
      const { timestamp, level, message, ...args } = info;

      return `[${timestamp}]: [${level.toUpperCase()}] - ${message} ${Object.keys(args).length ? JSON.stringify(args, null, 2) : ""}`;
    }),
  ),
});

winston.addColors({
  info: "green",
  main: "gray",
  debug: "magenta",
  warn: "yellow",
  error: "red",
});

type ShardData = {
  id: number;
  procId: number;
  latency: number;
  status: ShardStatus;
};

type BaseProcMessage = {
  data?: {
    type: string;
  };
};

type ServerCountMessage = {
  data: {
    type: "serverCounts";
    guilds: number;
    shards: ShardData[];
  };
};

type IncomingProcMessage = BaseProcMessage | ServerCountMessage;

let serverCount = 0;
let shardData: ShardData[] = [];
let clusterCount = 0;
let responseCount = 0;

let timeout: ReturnType<typeof setTimeout> | undefined;

process.on("message", (packet: IncomingProcMessage) => {
  if (packet.data?.type === "getCount") {
    process.send?.({
      type: "process:msg",
      data: {
        type: "countResponse",
        serverCount,
      },
    });
  }
});

function getProcesses(): Promise<ProcessDescription[]> {
  return new Promise((resolve, reject) => {
    pm2.list((err, list) => {
      if (err) reject(err);
      resolve(list.filter((v) => v.name?.includes("esmBot-proc")));
    });
  });
}

async function updateStats() {
  serverCount = 0;
  shardData = [];
  clusterCount = 0;
  responseCount = 0;
  const processes = await getProcesses();
  clusterCount = processes.length;
  const listener = (packet: IncomingProcMessage) => {
    if (packet.data?.type === "serverCounts") {
      const countData = packet as ServerCountMessage;
      clearTimeout(timeout);
      serverCount += countData.data.guilds;
      shardData = [...shardData, ...countData.data.shards].sort((a, b) => a.id - b.id);
      responseCount += 1;
      if (responseCount >= clusterCount) {
        process.removeListener("message", listener);
        return;
      }
      timeout = setTimeout(() => {
        process.removeListener("message", listener);
        logger.error("Timed out while waiting for stats");
      }, 5000);
    }
  };
  timeout = setTimeout(() => {
    process.removeListener("message", listener);
    logger.error("Timed out while waiting for stats");
  }, 5000);
  process.on("message", listener);
  process.send?.({
    type: "process:msg",
    data: {
      type: "serverCounts",
    },
  });
}

if (process.env.METRICS && process.env.METRICS !== "") {
  const database = await dbInit();
  const httpServer = createServer(async (req, res) => {
    if (req.method !== "GET") {
      res.statusCode = 405;
      return res.end("GET only");
    }
    if (!req.url) throw Error("URL not found");

    const reqUrl = new URL(req.url, `http://${req.headers.host}`);
    if (reqUrl.pathname === "/" || reqUrl.pathname === "/metrics") {
      res.write(`# HELP esmbot_command_count Number of times a command has been run
# TYPE esmbot_command_count counter
`);
      if (database) {
        const counts = await database.getCounts(true);
        for (const [i, w] of counts.entries()) {
          res.write(`esmbot_command_count{command="${i}"} ${w}\n`);
        }
      }

      res.write(`# HELP esmbot_servers Number of servers/guilds the bot is in
# TYPE esmbot_servers gauge
esmbot_servers ${serverCount}
# HELP esmbot_shards Number of shards the bot has
# TYPE esmbot_shards gauge
esmbot_shards ${shardData.length}
# HELP esmbot_shard_ping Latency of each of the bot's shards
# TYPE esmbot_shard_ping gauge
`);

      for (const shard of shardData) {
        if (shard.latency) res.write(`esmbot_shard_ping{shard="${shard.id}"} ${shard.latency}\n`);
      }

      res.end();
    } else if (reqUrl.pathname === "/shard") {
      if (!reqUrl.searchParams.has("id")) {
        res.statusCode = 400;
        return res.end("400 Bad Request");
      }
      const id = Number(reqUrl.searchParams.get("id"));
      if (!shardData[id]) {
        res.statusCode = 400;
        return res.end("400 Bad Request");
      }
      return res.end(JSON.stringify(shardData[id]));
    } else if (reqUrl.pathname === "/proc") {
      if (!reqUrl.searchParams.has("id")) {
        res.statusCode = 400;
        return res.end("400 Bad Request");
      }
      const id = Number(reqUrl.searchParams.get("id"));
      const procData = shardData.filter((v) => v.procId === id);
      if (procData.length === 0) {
        res.statusCode = 400;
        return res.end("400 Bad Request");
      }
      return res.end(JSON.stringify(procData));
    } else {
      res.statusCode = 404;
      return res.end("404 Not Found");
    }
  });
  httpServer.listen(process.env.METRICS, () => {
    logger.log("info", `Serving metrics at ${process.env.METRICS}`);
  });
}

setInterval(updateStats, 60000); // 1 minute
setTimeout(updateStats, 10000);

logger.info("Started esmBot management process.");

// from eris-fleet
function calcShards(shards: number[], procs: number) {
  if (procs < 2) return [shards];

  const length = shards.length;
  const r = [];
  let i = 0;
  let size: number;
  let remainder: number;
  let processes = procs;

  if (length % processes === 0) {
    size = Math.floor(length / processes);
    remainder = size % 16;
    if (size > 16 && remainder) {
      size -= remainder;
    }
    while (i < length) {
      let added = 0;
      if (remainder) {
        added = 1;
        remainder--;
      }
      const end = i + size + size * added;
      r.push(shards.slice(i, end));
      i = end;
    }
  } else {
    while (i < length) {
      size = Math.ceil((length - i) / processes--);
      r.push(shards.slice(i, i + size));
      i += size;
    }
  }

  return r;
}

async function getGatewayData() {
  logger.log("main", "Getting gateway connection data...");
  const client = new Client({
    auth: `Bot ${process.env.TOKEN}`,
    disableCache: "no-warning",
    gateway: {
      concurrency: "auto",
      maxShards: "auto",
      presence: {
        status: "idle",
        activities: [
          {
            type: 0,
            name: "Starting esmBot...",
          },
        ],
      },
      intents: [],
    },
    rest: {
      baseURL: process.env.REST_PROXY && process.env.REST_PROXY !== "" ? process.env.REST_PROXY : undefined,
    },
  });

  const connectionData = await client.rest.getBotGateway();
  const cpuAmount = availableParallelism();
  const procAmount = Math.min(connectionData.shards, cpuAmount);
  client.disconnect();
  return {
    procAmount,
    connectionData,
  };
}

(async function init() {
  const { procAmount, connectionData } = await getGatewayData();
  logger.log(
    "main",
    `Obtained data, connecting with ${connectionData.shards} shard(s) across ${procAmount} process(es)...`,
  );

  const runningProc = await getProcesses();
  if (runningProc.length === procAmount) {
    logger.log("main", "All processes already running");
    return;
  }

  const shardArray = [];
  for (let i = 0; i < connectionData.shards; i++) {
    shardArray.push(i);
  }
  const shardArrays = calcShards(shardArray, procAmount);

  let i = 1;

  if (runningProc.length < procAmount && runningProc.length !== 0) {
    i = runningProc.length + 1;
    logger.log(
      "main",
      `Some processes already running, attempting to start ${shardArrays.length - runningProc.length} missing processes starting from ${i}...`,
    );
  }

  for (i; i <= shardArrays.length; i++) {
    await awaitStart(i, shardArrays);
  }

  await updateStats();
})();

function awaitStart(i: number, shardArrays: number[][]): Promise<void> {
  return new Promise((resolve) => {
    pm2.start(
      {
        name: `esmBot-proc${i}`,
        script: "dist/app.js",
        autorestart: true,
        exp_backoff_restart_delay: 1000,
        wait_ready: true,
        listen_timeout: 60000,
        watch: false,
        env: {
          SHARDS: JSON.stringify(shardArrays),
        },
      },
      (err) => {
        if (err) {
          logger.error(`Failed to start esmBot process ${i}: ${err}`);
          process.exit(0);
        } else {
          logger.info(`Started esmBot process ${i}.`);
          resolve();
        }
      },
    );
  });
}
