import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { MsEdgeTTS, OUTPUT_FORMAT } = require("msedge-tts");

const ALLOWED_VOICE_IDS = new Set([
  "en-US-GuyNeural", "en-US-JennyNeural", "en-US-AriaNeural", "en-US-DavisNeural",
  "en-US-TonyNeural", "en-US-NancyNeural", "en-US-SaraNeural", "en-US-EricNeural",
  "en-GB-RyanNeural", "en-GB-SoniaNeural", "en-GB-LibbyNeural",
  "en-AU-WilliamNeural", "en-AU-NatashaNeural",
  "en-CA-LiamNeural", "en-CA-ClaraNeural",
  "en-IN-NeerjaNeural", "en-IN-PrabhatNeural",
  "fr-FR-DeniseNeural", "fr-FR-HenriNeural",
  "de-DE-KatjaNeural", "de-DE-ConradNeural",
  "es-ES-ElviraNeural", "es-ES-AlvaroNeural", "es-MX-DaliaNeural",
  "pt-BR-FranciscaNeural", "pt-BR-AntonioNeural",
  "it-IT-ElsaNeural", "it-IT-DiegoNeural",
  "ja-JP-NanamiNeural",
  "zh-CN-XiaoxiaoNeural", "zh-CN-YunxiNeural",
  "ar-SA-ZariyahNeural", "ko-KR-SunHiNeural",
  "hi-IN-SwaraNeural", "ru-RU-SvetlanaNeural",
]);

const TIMEOUT_MS = 20000;

function generateAudio(voice, text, rate, pitch) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error("TTS timed out after 20s"));
    }, TIMEOUT_MS);

    (async () => {
      try {
        const tts = new MsEdgeTTS();
        await tts.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
        const { audioStream } = tts.toStream(text, { rate, pitch });

        const chunks = [];
        let resolved = false;

        function finish() {
          if (resolved) return;
          resolved = true;
          clearTimeout(timer);
          const buf = Buffer.concat(chunks);
          if (buf.length === 0) {
            reject(new Error("TTS returned empty audio"));
          } else {
            resolve(buf);
          }
        }

        audioStream.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
        audioStream.on("end", finish);
        audioStream.on("close", finish);
        audioStream.on("error", (err) => {
          if (resolved) return;
          resolved = true;
          clearTimeout(timer);
          reject(err);
        });
      } catch (err) {
        clearTimeout(timer);
        reject(err);
      }
    })();
  });
}

export const handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: "Invalid JSON" }) };
  }

  const { text, voice, rate = "+0%", pitch = "+0Hz" } = body;

  if (!text || typeof text !== "string" || text.trim().length === 0) {
    return { statusCode: 400, body: JSON.stringify({ error: "text is required" }) };
  }
  if (!voice || !ALLOWED_VOICE_IDS.has(voice)) {
    return { statusCode: 400, body: JSON.stringify({ error: "Invalid voice" }) };
  }

  let lastErr;

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const buffer = await generateAudio(voice, text, rate, pitch);
      return {
        statusCode: 200,
        headers: {
          "Content-Type": "audio/mpeg",
          "Cache-Control": "no-cache",
        },
        body: buffer.toString("base64"),
        isBase64Encoded: true,
      };
    } catch (err) {
      lastErr = err;
      console.error(`TTS attempt ${attempt} failed:`, err?.message || err);
      if (attempt < 2) {
        await new Promise((r) => setTimeout(r, 800));
      }
    }
  }

  return {
    statusCode: 500,
    body: JSON.stringify({ error: "Speech generation failed. Please try again." }),
  };
};
