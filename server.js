const express = require("express");
const TelegramBot = require("node-telegram-bot-api");
const protobuf = require("protobufjs");
const crypto = require("crypto");

const PORT = Number(process.env.PORT || 8080);
const BOT_TOKEN = process.env.BOT_TOKEN;
const DEFAULT_REGION = String(process.env.FF_DEFAULT_REGION || "PK").trim().toUpperCase();
const OB_VERSION = normalizeObVersion(process.env.FF_OB_VERSION || "OB55");
const LIKE_COUNT = clampInt(process.env.FF_LIKE_COUNT || "100", 1, 100);
const MAX_CONCURRENT_LIKES = 1;

const SUPPORTED_REGIONS = new Set([
  "SG", "IND", "ID", "ME", "BR", "VN", "BD", "EU", "TH",
  "SAC", "NA", "RU", "TW", "PK", "CIS", "US", "MY"
]);

// Public game-client configuration values used by the direct integration.
// They are not the Telegram bot token.
const GARENA_CLIENT_ID = "100067";
const GARENA_CLIENT_SECRET = "2ee44819e9b4598845141067b281621874d0d5d7af9d8f7e00c1e54715b7d1e3";
const AES_KEY = Buffer.from("Yg&tc%DEuh6%Zc^8", "binary");
const AES_IV = Buffer.from("6oyZDr22E3ychjM%", "binary");

const GARENA_TOKEN_URL =
  "https://ffmconnect.live.gop.garenanow.com/oauth/guest/token/grant";
const GUEST_REGISTER_URL =
  "https://ffmconnect.live.gop.garenanow.com/oauth/guest/register";
const MAJOR_LOGIN_URL = "https://loginbp.ggblueshark.com/MajorLogin";
const LIKE_PATH = "/LikeProfile";

const COMMON_HEADERS = {
  "User-Agent": "Dalvik/2.1.0 (Linux; U; Android 13; A063 Build/TKQ1.221220.001)",
  "Connection": "Keep-Alive",
  "Accept-Encoding": "gzip",
  "Expect": "100-continue",
  "X-Unity-Version": "2018.4.11f1",
  "X-GA": "v1 1",
  "Content-Type": "application/x-www-form-urlencoded",
  "ReleaseVersion": OB_VERSION
};

const GARENA_HEADERS = {
  "User-Agent": "GarenaMSDK/4.0.19P9(A063 ;Android 13;en;IN;)",
  "Connection": "Keep-Alive",
  "Accept-Encoding": "gzip"
};

const MAJOR_LOGIN_PROTO = `
syntax = "proto3";
package MajorLogin;

message request {
  uint64 accountid = 1;
  string gameserverid = 2;
  string eventtime = 3;
  string gameid = 4;
  uint32 platid = 5;
  uint32 zoneareaid = 6;
  string clientversion = 7;
  string systemsoftware = 8;
  string systemhardware = 9;
  string telecomoper = 10;
  string network = 11;
  uint32 screenwidth = 12;
  uint32 screenhight = 13;
  string dpi = 14;
  string cpuhardware = 15;
  uint32 memory = 16;
  string glrender = 17;
  string glversion = 18;
  string deviceid = 19;
  string clientip = 20;
  string language = 21;
  string openid = 22;
  string openidtype = 23;
  string devicetype = 24;
  string devicemodel = 25;
  string region = 26;
  string ipregion = 27;
  string others = 28;
  string logintoken = 29;
  uint32 platformsdkid = 30;
  uint32 level = 31;
  uint64 clanid = 32;
  uint64 platformuid = 33;
  string nickname = 34;
  string networkoperatora = 35;
  string networktypea = 36;
  string line1numa = 37;
  bool isemulator = 38;
  string ipaddress = 39;
  string signaturemd5 = 40;
  uint32 emulatorscore = 41;
  int32 sdcardtotalstorage = 42;
  int32 sdcardavailstorage = 43;
  int32 innertotalstorage = 44;
  int32 inneravailstorage = 45;
  int32 gameinstalleddiskavailstorage = 46;
  int32 gameinstalleddisktotalstorage = 47;
  uint32 loginby = 50;
  string notiregion = 51;
  uint32 regavatar = 53;
  uint32 lockregiontime = 54;
  uint32 quality = 55;
  string libpath = 56;
  string libtoken = 58;
  uint32 channeltype = 59;
  uint32 cputype = 60;
  string cpuarchitecture = 61;
  string clientversioncode = 62;
  int64 tokenexpiresat = 63;
  string systemgraphicsapi = 65;
  uint32 supportedastcbitset = 66;
  uint32 loginopenidtype = 67;
  string ipcity = 68;
  string ipsubdivision = 69;
  uint32 loadingtime = 70;
  string releasechannel = 71;
  bytes gindetail = 72;
  uint32 androidengineinitflag = 73;
  string extrainfo = 74;
  bool ifpush = 75;
  bool isvpn = 76;
  string orignplatformtype = 77;
  string primaryplatformtype = 78;
  string clientreportip = 79;
  bytes ffantidetail = 80;
  string armtype = 81;
  uint64 buildNumber = 83;
  string graphicsApi = 86;
  uint32 graphicsFlags = 87;
  uint32 graphicsLevel = 88;
  uint32 performanceScore = 92;
  string profileName = 93;
  string secureToken = 94;
  uint32 sessionId = 95;
  string refreshRates = 96;
  uint32 featureFlag = 98;
  string platform = 99;
  string mainactiveplatform = 100;
}

message response {
  uint64 accountId = 1;
  string lockRegion = 2;
  string notiRegion = 3;
  string ipRegion = 4;
  string agoraEnvironment = 5;
  string newActiveRegion = 6;
  repeated string recommendRegions = 7;
  string token = 8;
  uint32 ttl = 9;
  string serverUrl = 10;
  uint32 emulatorScore = 11;
  uint32 appServerId = 12;
  string tpUrl = 13;
  string ipCity = 16;
  string ipSubdivision = 17;
  uint32 kts = 18;
  string ipCityDetail = 19;
  string ipSubdivisionDetail = 20;
  uint32 ktsDetail = 21;
  bytes ak = 22;
  bytes aiv = 23;
  string ffantiUrl = 24;
  bytes ffantiDetail = 25;
}
`;

let majorLoginTypesPromise = null;
function getMajorLoginTypes() {
  if (!majorLoginTypesPromise) {
    majorLoginTypesPromise = protobuf.parse(MAJOR_LOGIN_PROTO).root;
  }
  return majorLoginTypesPromise;
}

function clampInt(value, min, max) {
  const n = Number.parseInt(String(value), 10);
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}

function normalizeObVersion(value) {
  const raw = String(value || "").trim().toUpperCase();
  if (!raw) return "OB55";
  const digits = raw.startsWith("OB") ? raw.slice(2) : raw;
  return /^\d+$/.test(digits) ? `OB${digits}` : "OB55";
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isValidUid(uid) {
  return /^\d{5,15}$/.test(String(uid));
}

function normalizeRegion(value) {
  const region = String(value || DEFAULT_REGION).trim().toUpperCase();
  return SUPPORTED_REGIONS.has(region) ? region : null;
}

function encrypt(buffer) {
  const cipher = crypto.createCipheriv("aes-128-cbc", AES_KEY, AES_IV);
  return Buffer.concat([cipher.update(buffer), cipher.final()]);
}

function getBaseUrl(region) {
  const r = region.toUpperCase();
  if (r === "IND") return "https://client.ind.freefiremobile.com";
  if (["BR", "US", "SAC", "NA"].includes(r)) {
    return "https://client.us.freefiremobile.com";
  }
  return "https://clientbp.ggblueshark.com";
}

async function postForm(url, params, headers, timeoutMs = 30000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: "POST",
      headers,
      body: params,
      signal: controller.signal
    });
    const text = await response.text();
    let data = null;
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
    return { response, data };
  } finally {
    clearTimeout(timer);
  }
}

async function registerGuest() {
  const password = String(
    Math.floor(Math.random() * 9000000000) + 1000000000
  );
  const passwordHash = crypto
    .createHash("sha256")
    .update(password)
    .digest("hex")
    .toUpperCase();

  const params = new URLSearchParams();
  params.set("password", passwordHash);
  params.set("client_type", "2");
  params.set("source", "2");
  params.set("app_id", GARENA_CLIENT_ID);

  const signature = crypto
    .createHmac("sha256", GARENA_CLIENT_SECRET)
    .update(params.toString())
    .digest("hex");

  const { response, data } = await postForm(
    GUEST_REGISTER_URL,
    params,
    {
      ...GARENA_HEADERS,
      Authorization: `Signature ${signature}`,
      "Content-Type": "application/x-www-form-urlencoded"
    }
  );

  if (!response.ok || !data || !data.uid) {
    throw new Error(
      `Guest registration failed: HTTP ${response.status} ${JSON.stringify(data).slice(0, 400)}`
    );
  }

  return { uid: String(data.uid), passwordHash };
}

async function getGuestToken(uid, passwordHash) {
  const params = new URLSearchParams();
  params.set("uid", uid);
  params.set("password", passwordHash);
  params.set("response_type", "token");
  params.set("client_type", "2");
  params.set("client_secret", GARENA_CLIENT_SECRET);
  params.set("client_id", GARENA_CLIENT_ID);

  const { response, data } = await postForm(
    GARENA_TOKEN_URL,
    params,
    {
      ...GARENA_HEADERS,
      "Content-Type": "application/x-www-form-urlencoded"
    }
  );

  if (!response.ok || !data || !data.access_token || !data.open_id) {
    throw new Error(
      `Guest token failed: HTTP ${response.status} ${JSON.stringify(data).slice(0, 400)}`
    );
  }

  return data;
}

async function majorLogin(accessToken, openId, region) {
  const root = await getMajorLoginTypes();
  const RequestType = root.lookupType("MajorLogin.request");
  const payload = {
    openid: openId,
    logintoken: accessToken,
    platform: "4",
    region,
    devicetype: "Android",
    clientversion: "1.109.1",
    language: "en",
    network: "wifi",
    deviceid: crypto.randomUUID()
  };

  const verificationError = RequestType.verify(payload);
  if (verificationError) {
    throw new Error(`MajorLogin payload invalid: ${verificationError}`);
  }

  const message = RequestType.create(payload);
  const encoded = RequestType.encode(message).finish();
  const encryptedBody = encrypt(Buffer.from(encoded));

  const response = await fetch(MAJOR_LOGIN_URL, {
    method: "POST",
    headers: {
      ...COMMON_HEADERS,
      Authorization: "Bearer",
      "Content-Type": "application/octet-stream"
    },
    body: encryptedBody,
    signal: AbortSignal.timeout(30000)
  });

  const body = Buffer.from(await response.arrayBuffer());

  if (!response.ok) {
    throw new Error(
      `MajorLogin failed: HTTP ${response.status} ${body.toString("hex").slice(0, 160)}`
    );
  }

  const ResponseType = root.lookupType("MajorLogin.response");
  const decoded = ResponseType.decode(body);
  const result = ResponseType.toObject(decoded, {
    longs: String,
    enums: String,
    bytes: Buffer,
    defaults: true
  });

  if (!result.token) {
    throw new Error("MajorLogin succeeded but no token was returned.");
  }

  return {
    token: result.token,
    serverUrl: result.serverUrl || getBaseUrl(region)
  };
}

function createLikePayload(targetUid, region) {
  const targetBytes = Buffer.from(String(targetUid), "utf8");
  const regionBytes = Buffer.from(String(region), "utf8");

  if (targetBytes.length > 127 || regionBytes.length > 127) {
    throw new Error("Like payload value is unexpectedly long.");
  }

  const plain = Buffer.concat([
    Buffer.from([0x0a, targetBytes.length]),
    targetBytes,
    Buffer.from([0x12, regionBytes.length]),
    regionBytes
  ]);

  return encrypt(plain);
}

async function sendOneLike(targetUid, region) {
  const guest = await registerGuest();
  const tokenData = await getGuestToken(guest.uid, guest.passwordHash);
  const auth = await majorLogin(tokenData.access_token, tokenData.open_id, region);

  const serverUrl = auth.serverUrl || getBaseUrl(region);
  const base = {
    ...COMMON_HEADERS,
    "Content-Type": "application/octet-stream"
  };

  const response = await fetch(`${serverUrl}${LIKE_PATH}`, {
    method: "POST",
    headers: {
      "User-Agent": base["User-Agent"],
      Connection: base.Connection,
      "Accept-Encoding": base["Accept-Encoding"],
      "Content-Type": "application/octet-stream",
      Expect: base.Expect,
      Authorization: `Bearer ${auth.token}`,
      "X-Unity-Version": base["X-Unity-Version"],
      "X-GA": base["X-GA"],
      ReleaseVersion: base.ReleaseVersion
    },
    body: createLikePayload(targetUid, region),
    signal: AbortSignal.timeout(30000)
  });

  const responseBytes = Buffer.from(await response.arrayBuffer());

  if (!response.ok) {
    throw new Error(
      `LikeProfile failed: HTTP ${response.status} ${responseBytes.toString("hex").slice(0, 120)}`
    );
  }

  return true;
}

async function sendLikes(targetUid, region, requestedCount) {
  const count = Math.min(requestedCount, 100);
  let successCount = 0;
  let failedCount = 0;
  let lastError = "";

  for (let i = 0; i < count; i++) {
    try {
      await sendOneLike(targetUid, region);
      successCount++;
      console.log(`[Likes] ${i + 1}/${count} successful`);
    } catch (error) {
      failedCount++;
      lastError = error instanceof Error ? error.message : String(error);
      console.error(`[Likes] ${i + 1}/${count} failed: ${lastError}`);

      // Stop after repeated infrastructure/auth failures instead of hammering the service.
      if (failedCount >= 3 && successCount === 0) {
        break;
      }
    }

    if (i < count - 1) {
      await sleep(1000);
    }
  }

  return {
    success: successCount > 0,
    successCount,
    failedCount,
    requestedCount: count,
    message: successCount
      ? `Sent ${successCount} likes to ${targetUid}.`
      : `No likes were sent to ${targetUid}.`,
    lastError
  };
}

// ---------------- Telegram + web server ----------------

if (!BOT_TOKEN) {
  console.error("BOT_TOKEN is missing. Add BOT_TOKEN in Railway Variables.");
  process.exit(1);
}

const app = express();

app.get("/", (_req, res) => {
  res.status(200).send("Free Fire Telegram Likes Bot is running.");
});

app.get("/health", (_req, res) => {
  res.status(200).json({
    ok: true,
    service: "free-fire-telegram-bot",
    region: DEFAULT_REGION,
    obVersion: OB_VERSION
  });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Web server listening on port ${PORT}`);
});

const bot = new TelegramBot(BOT_TOKEN, { polling: true });
let likeJobRunning = false;

bot.onText(/^\/start$/i, async (msg) => {
  await bot.sendMessage(
    msg.chat.id,
    "🔥 Free Fire Likes Bot\n\n" +
      "UID bhejo:\n" +
      `/like ${DEFAULT_REGION} 14262702036\n\n` +
      "Ya default region ke liye:\n" +
      "/like 14262702036\n\n" +
      `Default region: ${DEFAULT_REGION}\n` +
      `Likes per request: ${LIKE_COUNT}`
  );
});

bot.onText(/^\/help$/i, async (msg) => {
  await bot.sendMessage(
    msg.chat.id,
    "📖 Commands\n\n" +
      "/start\n" +
      "/like <UID>\n" +
      "/like <REGION> <UID>\n\n" +
      "Example:\n" +
      "/like 14262702036\n" +
      "/like PK 14262702036"
  );
});

bot.onText(/^\/like(?:\s+([A-Za-z]+))?\s+(\d{5,15})$/i, async (msg, match) => {
  const chatId = msg.chat.id;
  const region = normalizeRegion(match?.[1] || DEFAULT_REGION);
  const uid = match?.[2] || "";

  if (!region) {
    await bot.sendMessage(
      chatId,
      "❌ Invalid region.\nExample: /like PK 14262702036"
    );
    return;
  }

  if (!isValidUid(uid)) {
    await bot.sendMessage(chatId, "❌ UID invalid hai. 5–15 digits honi chahiye.");
    return;
  }

  if (likeJobRunning) {
    await bot.sendMessage(
      chatId,
      "⏳ Ek likes request already process ho rahi hai. Pehle usko complete hone do."
    );
    return;
  }

  likeJobRunning = true;

  try {
    await bot.sendMessage(
      chatId,
      `⏳ UID ${uid} receive ho gaya.\n` +
        `Region: ${region}\n` +
        `Target likes: ${LIKE_COUNT}\n\n` +
        "Likes process ho rahe hain..."
    );

    const result = await sendLikes(uid, region, LIKE_COUNT);

    if (result.success) {
      await bot.sendMessage(
        chatId,
        "❤️ Free Fire Likes Result\n\n" +
          `UID: ${uid}\n` +
          `Region: ${region}\n` +
          `Requested: ${result.requestedCount}\n` +
          `Successfully sent: ${result.successCount}\n` +
          `Failed: ${result.failedCount}\n\n` +
          "✅ Real server response ke basis par result diya gaya hai."
      );
    } else {
      await bot.sendMessage(
        chatId,
        "❌ Likes send nahi ho sake.\n\n" +
          `UID: ${uid}\nRegion: ${region}\n\n` +
          `Reason: ${result.lastError || "Unknown error"}`
      );
    }
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    console.error("Like command failed:", error);
    await bot.sendMessage(
      chatId,
      `❌ Likes service error:\n${detail.slice(0, 700)}`
    );
  } finally {
    likeJobRunning = false;
  }
});

bot.on("polling_error", (error) => {
  console.error("Telegram polling error:", error);
});

bot.on("error", (error) => {
  console.error("Telegram bot error:", error);
});

bot.getMe()
  .then((me) => {
    console.log(`Telegram bot connected: @${me.username}`);
    console.log(`Default region: ${DEFAULT_REGION}`);
    console.log(`OB version: ${OB_VERSION}`);
    console.log(`Likes per request: ${LIKE_COUNT}`);
  })
  .catch((error) => {
    console.error("Telegram getMe failed:", error);
  });
