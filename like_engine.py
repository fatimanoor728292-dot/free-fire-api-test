import asyncio
import base64
import json
import os
import time
from pathlib import Path

import httpx
from Crypto.Cipher import AES
from Crypto.Util.Padding import pad
from google.protobuf import json_format

from ff_proto import freefire_pb2
from ff_proto.send_like_pb2 import like as LikeProfileReq

MAIN_KEY = base64.b64decode("WWcmdGMlREV1aDYlWmNeOA==")
MAIN_IV = base64.b64decode("Nm95WkRyMjJFM3ljaGpNJQ==")
CLIENT_SECRET = "2ee44819e9b4598845141067b281621874d0d5d7af9d8f7e00c1e54715b7d1e3"
CLIENT_ID = 100067
RELEASE_VERSION = os.getenv("FF_RELEASE_VERSION", "OB50")

OAUTH_URL = "https://ffmconnect.live.gop.garenanow.com/oauth/guest/token/grant"
MAJOR_LOGIN_URL = "https://loginbp.ggblueshark.com/MajorLogin"

DATA_DIR = Path("data")
DATA_DIR.mkdir(exist_ok=True)
USAGE_FILE = DATA_DIR / "guest_usage_by_target.json"

def load_usage():
    if not USAGE_FILE.exists():
        return {}
    try:
        return json.loads(USAGE_FILE.read_text())
    except Exception:
        return {}

def save_usage(data):
    USAGE_FILE.write_text(json.dumps(data, indent=2))

USAGE = load_usage()

def used(target, guest):
    return guest in USAGE.get(target, {})

def mark_used(target, guest):
    USAGE.setdefault(target, {})[guest] = int(time.time())
    save_usage(USAGE)

def guest_base_url(region):
    if region == "IND":
        return "https://client.ind.freefiremobile.com"
    if region in {"BR", "US", "SAC", "NA"}:
        return "https://client.us.freefiremobile.com"
    return "https://clientbp.ggblueshark.com"

def aes_encrypt(key, iv, plaintext):
    return AES.new(key, AES.MODE_CBC, iv).encrypt(pad(plaintext, 16))

async def create_jwt(client, uid, password):
    payload = {
        "uid": str(uid),
        "password": password,
        "response_type": "token",
        "client_type": 2,
        "client_secret": CLIENT_SECRET,
        "client_id": CLIENT_ID,
    }
    headers = {
        "User-Agent": "GarenaMSDK/4.0.19P10(I2404 ;Android 15;en;US;)",
        "Connection": "Keep-Alive",
        "Accept-Encoding": "gzip",
        "Content-Type": "application/x-www-form-urlencoded",
    }
    r = await client.post(OAUTH_URL, data=payload, headers=headers, timeout=20)
    r.raise_for_status()
    data = r.json()
    access_token = data.get("access_token") or data.get("data", {}).get("access_token")
    open_id = data.get("open_id") or data.get("data", {}).get("open_id")
    if not access_token or not open_id:
        raise RuntimeError(f"OAuth failed: {data}")

    req = freefire_pb2.LoginReq(
        open_id=open_id,
        open_id_type="4",
        login_token=access_token,
        orign_platform_type="4",
    )
    body = aes_encrypt(MAIN_KEY, MAIN_IV, req.SerializeToString())
    headers2 = {
        "User-Agent": "Dalvik/2.1.0 (Linux; U; Android 13; CPH2095 Build/RKQ1.211119.001)",
        "Connection": "Keep-Alive",
        "Accept-Encoding": "gzip",
        "Content-Type": "application/octet-stream",
        "Expect": "100-continue",
        "X-Unity-Version": "2018.4.11f1",
        "X-GA": "v1 1",
        "ReleaseVersion": RELEASE_VERSION,
    }
    r2 = await client.post(
        MAJOR_LOGIN_URL,
        content=body,
        headers=headers2,
        timeout=25
    )

    print("========== MAJOR LOGIN DIAGNOSTIC ==========")
    print("URL:", MAJOR_LOGIN_URL)
    print("STATUS:", r2.status_code)
    print("RESPONSE_LENGTH:", len(r2.content))
    print("CONTENT_TYPE:", r2.headers.get("content-type"))
    print("SERVER:", r2.headers.get("server"))
    print("RESPONSE_BODY:", r2.text[:1000])
    print("============================================")

    r2.raise_for_status()
    res = freefire_pb2.LoginRes()
    res.ParseFromString(r2.content)
    if not res.token:
        raise RuntimeError("MajorLogin returned no JWT")
    return res.token, (res.lock_region or "PK"), (res.server_url or "")

def make_like_payload(target_uid, region):
    msg = LikeProfileReq(uid=int(target_uid), region=region)
    return aes_encrypt(MAIN_KEY, MAIN_IV, msg.SerializeToString())

async def send_one(client, guest, target_uid, semaphore):
    guest_uid = str(guest["uid"])
    if used(target_uid, guest_uid):
        return False, guest_uid, "already used for this target"

    async with semaphore:
        try:
            jwt, region, server_url = await create_jwt(client, guest_uid, guest["password"])
            base = server_url.rstrip("/") if server_url else guest_base_url(region)
            if "http" not in base:
                base = guest_base_url(region)
            url = f"{base}/LikeProfile"
            headers = {
                "User-Agent": "Dalvik/2.1.0 (Linux; U; Android 14; Pixel 8 Build/UP1A.231005.007)",
                "Connection": "Keep-Alive",
                "Accept-Encoding": "gzip",
                "Content-Type": "application/octet-stream",
                "Expect": "100-continue",
                "Authorization": f"Bearer {jwt}",
                "X-Unity-Version": "2018.4.11f1",
                "X-GA": "v1 1",
                "ReleaseVersion": RELEASE_VERSION,
            }
            r = await client.post(url, content=make_like_payload(target_uid, region), headers=headers, timeout=30)
            r.raise_for_status()
            mark_used(target_uid, guest_uid)
            return True, guest_uid, f"HTTP {r.status_code}"
        except Exception as e:
            return False, guest_uid, str(e)

async def send_likes(target_uid, requested=100):
    raw = os.getenv("FF_GUESTS_JSON", "[]")
    try:
        guests = json.loads(raw)
    except Exception as e:
        raise RuntimeError(f"FF_GUESTS_JSON invalid JSON: {e}")
    if not isinstance(guests, list) or not guests:
        raise RuntimeError("No guest accounts configured in FF_GUESTS_JSON")

    available = [g for g in guests if isinstance(g, dict) and "uid" in g and "password" in g and not used(target_uid, str(g["uid"]))]
    planned = available[:max(0, min(int(requested), 100))]
    if not planned:
        return {"success": 0, "planned": 0, "details": [], "message": "No unused guest accounts available for this target."}

    concurrency = max(1, min(int(os.getenv("LIKE_CONCURRENCY", "5")), 20))
    sem = asyncio.Semaphore(concurrency)
    async with httpx.AsyncClient(http2=False) as client:
        results = await asyncio.gather(*(send_one(client, g, target_uid, sem) for g in planned))

    success = sum(1 for ok, _, _ in results if ok)
    return {
        "success": success,
        "planned": len(planned),
        "details": [{"ok": ok, "guest": uid, "info": info} for ok, uid, info in results],
    }
