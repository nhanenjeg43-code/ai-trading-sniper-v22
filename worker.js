
export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders() });
    }

    if (url.pathname === "/api/analyze" && request.method === "POST") {
      try {
        const body = await request.json();
        const { mode, note, htfBase64, ltfBase64, htfMimeType, ltfMimeType } = body || {};

        if (!htfBase64 || !ltfBase64) {
          return jsonResponse({ error: "Both charts are required." }, 400);
        }

        if (!env.GEMINI_API_KEY) {
          return jsonResponse({ error: "Missing GEMINI_API_KEY secret." }, 500);
        }

        const modeSafe = mode === "sniper" ? "sniper" : "quick";
        const noteSafe = note || "NONE";

        const quickPrompt = `
You are an expert candlestick trading analyst trained using the Candlestick Trading Bible.

The user uploaded:
- Image 1 = higher timeframe chart
- Image 2 = lower timeframe chart

Your job:
Analyze both charts using candlestick patterns as the main basis for direction.

Use:
- trend direction
- reversal patterns
- continuation context
- candlestick confluence
- chart pattern confirmation from the cheat sheet

Candlestick patterns to detect:

Bullish:
- bullish engulfing
- morning star
- hammer
- bullish pin bar
- dragonfly doji
- bullish inside bar breakout

Bearish:
- bearish engulfing
- evening star
- shooting star
- bearish pin bar
- gravestone doji
- bearish inside bar breakout

Neutral / caution:
- doji
- spinning top

Secondary chart-pattern confirmation:
- Bullish Double Bottom
- Bearish Double Top
- Bullish Inverted Head and Shoulder
- Bearish Head Shoulders
- Bullish Falling Wedge
- Bearish Rising Wedge
- Bullish Triple Bottom
- Bearish Triple Top
- Bullish Flag Pattern
- Bearish Flag Pattern
- Bullish Pennant Pattern
- Bearish Pennant Pattern
- Descending Triangle

Instruction from user:
${noteSafe}

Rules:
- Strong bullish confluence → BUY
- Strong bearish confluence → SELL
- Mixed or weak signals → WAIT
- Do NOT guess
- Be strict and realistic

Return ONLY valid JSON:

{
  "signal": "BUY or SELL or WAIT",
  "confidence": 0,
  "reason": "",
  "trend": "UPTREND or DOWNTREND or SIDEWAYS or UNCLEAR",
  "candlestick_pattern": "NONE or BULLISH_ENGULFING or BEARISH_ENGULFING or DOJI or DRAGONFLY_DOJI or GRAVESTONE_DOJI or MORNING_STAR or EVENING_STAR or HAMMER or SHOOTING_STAR or BULLISH_PIN_BAR or BEARISH_PIN_BAR or BULLISH_INSIDE_BAR_BREAKOUT or BEARISH_INSIDE_BAR_BREAKOUT",
  "pattern_strength": "STRONG or MEDIUM or WEAK",
  "market_sentiment": "BULLISH or BEARISH or NEUTRAL",
  "risk_level": "LOW or MEDIUM or HIGH",
  "entry_quality": "SNIPER or NORMAL or WEAK",
  "confirmation": "CONFIRMED or PARTIAL or NONE",
  "chart_pattern": "NONE or Bullish Double Bottom or Bearish Double Top or Bullish Inverted Head and Shoulder or Bearish Head Shoulders or Bullish Falling Wedge or Bearish Rising Wedge or Bullish Triple Bottom or Bearish Triple Top or Bullish Flag Pattern or Bearish Flag Pattern or Bullish Pennant Pattern or Bearish Pennant Pattern or Descending Triangle",
  "stop_loss": "",
  "take_profit": ""
}
        `.trim();

        const sniperPrompt = `
You are an elite candlestick trading analyst trained on the Candlestick Trading Bible.

The user uploaded:
- Image 1 = higher timeframe chart
- Image 2 = lower timeframe chart

Your job:
Analyze both charts using candlestick principles and return only high-quality sniper setups.

You must evaluate:
- trend context
- candlestick reversal / continuation patterns
- chart pattern confirmation
- whether the setup is sniper quality

Bullish sniper patterns:
- bullish engulfing
- morning star
- hammer
- bullish pin bar
- dragonfly doji
- bullish inside bar breakout

Bearish sniper patterns:
- bearish engulfing
- evening star
- shooting star
- bearish pin bar
- gravestone doji
- bearish inside bar breakout

Neutral / caution:
- doji
- spinning top
- weak indecision candles

Secondary chart-pattern confirmation:
- Bullish Double Bottom
- Bearish Double Top
- Bullish Inverted Head and Shoulder
- Bearish Head Shoulders
- Bullish Falling Wedge
- Bearish Rising Wedge
- Bullish Triple Bottom
- Bearish Triple Top
- Bullish Flag Pattern
- Bearish Flag Pattern
- Bullish Pennant Pattern
- Bearish Pennant Pattern
- Descending Triangle

Instruction from user:
${noteSafe}

Sniper rules:
- Return BUY only if bullish pattern is strong, clean, and supported by context
- Return SELL only if bearish pattern is strong, clean, and supported by context
- Return WAIT if:
  - pattern is weak
  - candles are mixed
  - market is sideways
  - no clear confirmation exists
  - setup quality is not sniper-level
- Prefer WAIT over guessing

Return ONLY valid JSON:

{
  "signal": "BUY or SELL or WAIT",
  "confidence": 0,
  "reason": "",
  "trend": "UPTREND or DOWNTREND or SIDEWAYS or UNCLEAR",
  "candlestick_pattern": "NONE or BULLISH_ENGULFING or BEARISH_ENGULFING or DOJI or DRAGONFLY_DOJI or GRAVESTONE_DOJI or MORNING_STAR or EVENING_STAR or HAMMER or SHOOTING_STAR or BULLISH_PIN_BAR or BEARISH_PIN_BAR or BULLISH_INSIDE_BAR_BREAKOUT or BEARISH_INSIDE_BAR_BREAKOUT",
  "pattern_strength": "STRONG or MEDIUM or WEAK",
  "market_sentiment": "BULLISH or BEARISH or NEUTRAL",
  "risk_level": "LOW or MEDIUM or HIGH",
  "entry_quality": "SNIPER or NORMAL or WEAK",
  "confirmation": "CONFIRMED or PARTIAL or NONE",
  "chart_pattern": "NONE or Bullish Double Bottom or Bearish Double Top or Bullish Inverted Head and Shoulder or Bearish Head Shoulders or Bullish Falling Wedge or Bearish Rising Wedge or Bullish Triple Bottom or Bearish Triple Top or Bullish Flag Pattern or Bearish Flag Pattern or Bullish Pennant Pattern or Bearish Pennant Pattern or Descending Triangle",
  "stop_loss": "",
  "take_profit": ""
}
        `.trim();

        const prompt = modeSafe === "sniper" ? sniperPrompt : quickPrompt;

        const geminiUrl =
          "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" +
          encodeURIComponent(env.GEMINI_API_KEY);

        const geminiResponse = await fetch(geminiUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{
              parts: [
                { text: prompt },
                { inlineData: { mimeType: htfMimeType || "image/png", data: htfBase64 } },
                { inlineData: { mimeType: ltfMimeType || "image/png", data: ltfBase64 } }
              ]
            }],
            generationConfig: {
              temperature: 0.2,
              responseMimeType: "application/json"
            }
          })
        });

        const geminiData = await geminiResponse.json();

        if (!geminiResponse.ok) {
          return jsonResponse({ error: geminiData?.error?.message || "Gemini request failed." }, geminiResponse.status);
        }

        const text = geminiData?.candidates?.[0]?.content?.parts?.map(part => part.text || "").join("\n") || "";
        const finalOutput = extractJson(text);

        const sniperFiltered =
          modeSafe === "sniper" &&
          (
            !finalOutput ||
            typeof finalOutput.confidence !== "number" ||
            finalOutput.confidence < 80 ||
            finalOutput.entry_quality !== "SNIPER" ||
            finalOutput.pattern_strength !== "STRONG" ||
            finalOutput.confirmation !== "CONFIRMED" ||
            finalOutput.trend === "SIDEWAYS" ||
            !["BUY", "SELL", "WAIT"].includes(finalOutput.signal)
          );

        const displayOutput = sniperFiltered ? {
          signal: "WAIT",
          confidence: finalOutput?.confidence ?? 0,
          reason: "Filtered out: setup is not sniper quality.",
          trend: finalOutput?.trend || "UNCLEAR",
          candlestick_pattern: finalOutput?.candlestick_pattern || "NONE",
          pattern_strength: finalOutput?.pattern_strength || "WEAK",
          market_sentiment: finalOutput?.market_sentiment || "NEUTRAL",
          risk_level: finalOutput?.risk_level || "HIGH",
          entry_quality: finalOutput?.entry_quality || "WEAK",
          confirmation: finalOutput?.confirmation || "NONE",
          chart_pattern: finalOutput?.chart_pattern || "NONE",
          stop_loss: finalOutput?.stop_loss || "",
          take_profit: finalOutput?.take_profit || ""
        } : finalOutput;

        return jsonResponse(displayOutput, 200);
      } catch (error) {
        return jsonResponse({ error: error?.message || String(error) || "Unexpected error." }, 500);
      }
    }

    return env.ASSETS.fetch(request);
  }
};

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders() }
  });
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  };
}

function extractJson(text) {
  if (!text) throw new Error("Empty model response.");
  let cleaned = text.trim();
  if (cleaned.startsWith("```")) cleaned = cleaned.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  if (firstBrace === -1 || lastBrace === -1) throw new Error("Could not find JSON in model response.");
  return JSON.parse(cleaned.slice(firstBrace, lastBrace + 1));
}
