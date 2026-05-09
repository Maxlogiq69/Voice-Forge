import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";

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

  try {
    const tts = new MsEdgeTTS();
    await tts.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);

    const { audioStream } = tts.toStream(text, { rate, pitch });

    const chunks = [];
    await new Promise((resolve, reject) => {
      audioStream.on("data", (chunk) => chunks.push(chunk));
      audioStream.on("close", resolve);
      audioStream.on("error", reject);
    });

    const buffer = Buffer.concat(chunks);

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
    console.error("TTS generation error:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "TTS generation failed" }),
    };
  }
};
