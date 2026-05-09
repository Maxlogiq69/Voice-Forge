import { Router, type IRouter } from "express";
import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";
import { GenerateSpeechBody } from "@workspace/api-zod";
import { logger } from "../lib/logger";

const router: IRouter = Router();

const ALLOWED_VOICES = [
  { id: "en-US-GuyNeural", name: "Guy", locale: "en-US", gender: "Male", friendlyName: "Guy (US)" },
  { id: "en-US-JennyNeural", name: "Jenny", locale: "en-US", gender: "Female", friendlyName: "Jenny (US)" },
  { id: "en-US-AriaNeural", name: "Aria", locale: "en-US", gender: "Female", friendlyName: "Aria (US)" },
  { id: "en-US-DavisNeural", name: "Davis", locale: "en-US", gender: "Male", friendlyName: "Davis (US)" },
  { id: "en-US-TonyNeural", name: "Tony", locale: "en-US", gender: "Male", friendlyName: "Tony (US)" },
  { id: "en-US-NancyNeural", name: "Nancy", locale: "en-US", gender: "Female", friendlyName: "Nancy (US)" },
  { id: "en-US-SaraNeural", name: "Sara", locale: "en-US", gender: "Female", friendlyName: "Sara (US)" },
  { id: "en-US-EricNeural", name: "Eric", locale: "en-US", gender: "Male", friendlyName: "Eric (US)" },
  { id: "en-GB-RyanNeural", name: "Ryan", locale: "en-GB", gender: "Male", friendlyName: "Ryan (UK)" },
  { id: "en-GB-SoniaNeural", name: "Sonia", locale: "en-GB", gender: "Female", friendlyName: "Sonia (UK)" },
  { id: "en-GB-LibbyNeural", name: "Libby", locale: "en-GB", gender: "Female", friendlyName: "Libby (UK)" },
  { id: "en-AU-WilliamNeural", name: "William", locale: "en-AU", gender: "Male", friendlyName: "William (AU)" },
  { id: "en-AU-NatashaNeural", name: "Natasha", locale: "en-AU", gender: "Female", friendlyName: "Natasha (AU)" },
  { id: "en-CA-LiamNeural", name: "Liam", locale: "en-CA", gender: "Male", friendlyName: "Liam (CA)" },
  { id: "en-CA-ClaraNeural", name: "Clara", locale: "en-CA", gender: "Female", friendlyName: "Clara (CA)" },
  { id: "en-IN-NeerjaNeural", name: "Neerja", locale: "en-IN", gender: "Female", friendlyName: "Neerja (IN)" },
  { id: "en-IN-PrabhatNeural", name: "Prabhat", locale: "en-IN", gender: "Male", friendlyName: "Prabhat (IN)" },
  { id: "fr-FR-DeniseNeural", name: "Denise", locale: "fr-FR", gender: "Female", friendlyName: "Denise (FR)" },
  { id: "fr-FR-HenriNeural", name: "Henri", locale: "fr-FR", gender: "Male", friendlyName: "Henri (FR)" },
  { id: "de-DE-KatjaNeural", name: "Katja", locale: "de-DE", gender: "Female", friendlyName: "Katja (DE)" },
  { id: "de-DE-ConradNeural", name: "Conrad", locale: "de-DE", gender: "Male", friendlyName: "Conrad (DE)" },
  { id: "es-ES-ElviraNeural", name: "Elvira", locale: "es-ES", gender: "Female", friendlyName: "Elvira (ES)" },
  { id: "es-ES-AlvaroNeural", name: "Alvaro", locale: "es-ES", gender: "Male", friendlyName: "Alvaro (ES)" },
  { id: "es-MX-DaliaNeural", name: "Dalia", locale: "es-MX", gender: "Female", friendlyName: "Dalia (MX)" },
  { id: "pt-BR-FranciscaNeural", name: "Francisca", locale: "pt-BR", gender: "Female", friendlyName: "Francisca (BR)" },
  { id: "pt-BR-AntonioNeural", name: "Antonio", locale: "pt-BR", gender: "Male", friendlyName: "Antonio (BR)" },
  { id: "it-IT-ElsaNeural", name: "Elsa", locale: "it-IT", gender: "Female", friendlyName: "Elsa (IT)" },
  { id: "it-IT-DiegoNeural", name: "Diego", locale: "it-IT", gender: "Male", friendlyName: "Diego (IT)" },
  { id: "ja-JP-NanamiNeural", name: "Nanami", locale: "ja-JP", gender: "Female", friendlyName: "Nanami (JP)" },
  { id: "zh-CN-XiaoxiaoNeural", name: "Xiaoxiao", locale: "zh-CN", gender: "Female", friendlyName: "Xiaoxiao (CN)" },
  { id: "zh-CN-YunxiNeural", name: "Yunxi", locale: "zh-CN", gender: "Male", friendlyName: "Yunxi (CN)" },
  { id: "ar-SA-ZariyahNeural", name: "Zariyah", locale: "ar-SA", gender: "Female", friendlyName: "Zariyah (SA)" },
  { id: "ko-KR-SunHiNeural", name: "SunHi", locale: "ko-KR", gender: "Female", friendlyName: "SunHi (KR)" },
  { id: "hi-IN-SwaraNeural", name: "Swara", locale: "hi-IN", gender: "Female", friendlyName: "Swara (HI)" },
  { id: "ru-RU-SvetlanaNeural", name: "Svetlana", locale: "ru-RU", gender: "Female", friendlyName: "Svetlana (RU)" },
];

const ALLOWED_VOICE_IDS = new Set(ALLOWED_VOICES.map((v) => v.id));

router.get("/tts/voices", async (_req, res): Promise<void> => {
  res.json(ALLOWED_VOICES);
});

router.post("/tts/generate", async (req, res): Promise<void> => {
  const parsed = GenerateSpeechBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { text, voice, rate = "+0%", pitch = "+0Hz" } = parsed.data;

  if (!ALLOWED_VOICE_IDS.has(voice)) {
    res.status(400).json({ error: `Voice "${voice}" is not allowed` });
    return;
  }

  try {
    const tts = new MsEdgeTTS();
    await tts.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);

    const ssml = `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="en-US">
  <voice name="${voice}">
    <prosody rate="${rate}" pitch="${pitch}">
      ${text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}
    </prosody>
  </voice>
</speak>`;

    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Transfer-Encoding", "chunked");
    res.setHeader("Cache-Control", "no-cache");

    const readable = tts.toStream(ssml);

    readable.on("data", (chunk: Buffer) => {
      res.write(chunk);
    });

    readable.on("end", () => {
      req.log.info({ voice, textLength: text.length }, "TTS generation complete");
      res.end();
    });

    readable.on("error", (err: Error) => {
      req.log.error({ err }, "TTS stream error");
      if (!res.headersSent) {
        res.status(500).json({ error: "TTS generation failed" });
      } else {
        res.end();
      }
    });
  } catch (err) {
    logger.error({ err }, "TTS generation error");
    if (!res.headersSent) {
      res.status(500).json({ error: "TTS generation failed" });
    }
  }
});

export default router;
