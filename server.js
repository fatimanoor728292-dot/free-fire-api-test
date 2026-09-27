const express = require("express");
const app = express();
const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => res.send("Free Fire API test server is running. Use /test?uid=YOUR_UID"));

app.get("/test", async (req, res) => {
  const uid = String(req.query.uid || "").trim();
  if (!/^\d+$/.test(uid)) {
    return res.status(400).json({success:false,error:"Enter a valid numeric UID."});
  }

  const apiUrl = "https://botlikesff.rexapi.com.br/api/v2/likes?uid=" + encodeURIComponent(uid);

  try {
    const r = await fetch(apiUrl, {
      headers: {"Accept":"application/json","User-Agent":"FreeFireApiTest/1.0"}
    });
    const text = await r.text();
    let data;
    try { data = JSON.parse(text); } catch { data = {raw:text}; }

    res.status(r.status).json({
      success: r.ok,
      apiStatus: r.status,
      apiResponse: data
    });
  } catch (e) {
    res.status(502).json({
      success:false,
      error:"Could not reach the likes API.",
      details:e.message
    });
  }
});

app.listen(PORT, () => console.log("Server running on port " + PORT));
