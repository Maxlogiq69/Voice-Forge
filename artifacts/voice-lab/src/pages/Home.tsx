import { useState, useRef } from "react";
import { useListVoices } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectGroup,
  SelectLabel,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  Mic,
  Play,
  Download,
  RotateCcw,
  Loader2,
  Wand2,
  Volume2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

const PREVIEW_TEXT = "Hello, I am your selected voice. I am ready to narrate your content.";
const MAX_CHARS = 5000;

function buildApiUrl(path: string) {
  return `${import.meta.env.BASE_URL}${path}`.replace(/\/\/+/g, "/");
}

export default function Home() {
  const { data: voices = [], isLoading: isLoadingVoices } = useListVoices();
  const { toast } = useToast();

  const [text, setText] = useState("");
  const [voice, setVoice] = useState("");
  const [speed, setSpeed] = useState([0]);
  const [pitch, setPitch] = useState([0]);

  const [isGenerating, setIsGenerating] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);

  const selectedVoice = voices.find((v) => v.id === voice);

  const rateStr = `${speed[0] > 0 ? "+" : ""}${speed[0]}%`;
  const pitchStr = `${pitch[0] > 0 ? "+" : ""}${pitch[0]}Hz`;

  async function fetchAudio(inputText: string, voiceId: string, rate: string, pitchVal: string): Promise<Blob> {
    const response = await fetch(buildApiUrl("api/tts/generate"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: inputText, voice: voiceId, rate, pitch: pitchVal }),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: "Generation failed" }));
      throw new Error(err.error || "Generation failed");
    }
    return response.blob();
  }

  const handleGenerate = async () => {
    if (!text.trim()) {
      toast({ title: "Enter some text first", variant: "destructive" });
      return;
    }
    if (!voice) {
      toast({ title: "Select a voice first", variant: "destructive" });
      return;
    }
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
      setAudioUrl(null);
    }
    setIsGenerating(true);
    try {
      const blob = await fetchAudio(text, voice, rateStr, pitchStr);
      setAudioUrl(URL.createObjectURL(blob));
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Something went wrong";
      toast({ title: "Generation failed", description: message, variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePreview = async () => {
    if (!voice) {
      toast({ title: "Select a voice to preview", variant: "destructive" });
      return;
    }
    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
      previewAudioRef.current = null;
    }
    setIsPreviewing(true);
    try {
      const blob = await fetchAudio(PREVIEW_TEXT, voice, "+0%", "+0Hz");
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      previewAudioRef.current = audio;
      audio.play();
      audio.onended = () => {
        URL.revokeObjectURL(url);
        previewAudioRef.current = null;
        setIsPreviewing(false);
      };
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Preview failed";
      toast({ title: "Preview failed", description: message, variant: "destructive" });
      setIsPreviewing(false);
    }
  };

  const handleDownload = () => {
    if (!audioUrl) return;
    const a = document.createElement("a");
    a.href = audioUrl;
    const date = new Date().toISOString().split("T")[0];
    a.download = `logiq-voice-${date}.mp3`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleReset = () => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setText("");
    setAudioUrl(null);
    setSpeed([0]);
    setPitch([0]);
    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
      previewAudioRef.current = null;
      setIsPreviewing(false);
    }
  };

  const voicesByLocale = voices.reduce(
    (acc, v) => {
      if (!acc[v.locale]) acc[v.locale] = [];
      acc[v.locale].push(v);
      return acc;
    },
    {} as Record<string, typeof voices>
  );

  return (
    <div className="min-h-[100dvh] bg-background flex flex-col">
      {/* Top Nav */}
      <header className="border-b border-border bg-background/95 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 md:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Mic className="w-4 h-4 text-white" />
            </div>
            <span className="font-semibold text-foreground text-sm tracking-tight">LogiQ Voice Lab</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleReset}
            className="gap-1.5 text-muted-foreground hover:text-foreground h-8 px-3 text-xs"
            data-testid="button-reset"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset
          </Button>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 md:px-6 py-6 md:py-8">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6">

          {/* Left: Text Input */}
          <div className="flex flex-col gap-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-sm font-medium text-foreground">Script</Label>
                <span
                  className={`text-xs font-mono ${
                    text.length > MAX_CHARS * 0.9 ? "text-destructive" : "text-muted-foreground"
                  }`}
                >
                  {text.length.toLocaleString()} / {MAX_CHARS.toLocaleString()}
                </span>
              </div>
              <Textarea
                placeholder="Type or paste your script here..."
                className="min-h-[280px] md:min-h-[360px] resize-none text-sm md:text-base leading-relaxed bg-background border-border focus-visible:ring-1 focus-visible:ring-primary rounded-xl"
                value={text}
                onChange={(e) => setText(e.target.value)}
                maxLength={MAX_CHARS}
                data-testid="input-text"
              />
            </div>

            {/* Audio Result */}
            {audioUrl && (
              <div className="rounded-xl border border-border bg-card p-4 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Volume2 className="w-4 h-4 text-primary" />
                  </div>
                  <audio
                    controls
                    src={audioUrl}
                    className="flex-1 h-9 min-w-0 outline-none"
                    data-testid="audio-player"
                  />
                </div>
                <Button
                  onClick={handleDownload}
                  variant="outline"
                  size="sm"
                  className="gap-2 shrink-0"
                  data-testid="button-download"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download MP3
                </Button>
              </div>
            )}
          </div>

          {/* Right: Controls */}
          <div className="flex flex-col gap-4">

            {/* Voice */}
            <div className="rounded-xl border border-border bg-card p-5 flex flex-col gap-4">
              <h2 className="text-sm font-semibold text-foreground">Voice</h2>

              <div className="space-y-2">
                <Select value={voice} onValueChange={setVoice} disabled={isLoadingVoices}>
                  <SelectTrigger
                    className="w-full bg-background border-border h-10 rounded-lg text-sm"
                    data-testid="select-voice"
                  >
                    <SelectValue
                      placeholder={isLoadingVoices ? "Loading voices..." : "Choose a voice"}
                    />
                  </SelectTrigger>
                  <SelectContent className="max-h-[280px]">
                    {Object.entries(voicesByLocale).map(([locale, localeVoices]) => (
                      <SelectGroup key={locale}>
                        <SelectLabel className="text-xs text-muted-foreground py-1.5 font-medium">
                          {locale}
                        </SelectLabel>
                        {localeVoices.map((v) => (
                          <SelectItem key={v.id} value={v.id} className="text-sm py-2">
                            <span className="flex items-center gap-2">
                              {v.friendlyName}
                              <Badge
                                variant="outline"
                                className="text-[9px] px-1 py-0 h-4 font-medium leading-none"
                              >
                                {v.gender === "Male" ? "M" : "F"}
                              </Badge>
                            </span>
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    ))}
                  </SelectContent>
                </Select>

                {/* Voice preview row */}
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handlePreview}
                    disabled={!voice || isPreviewing}
                    className="flex-1 gap-1.5 text-xs h-8"
                    data-testid="button-preview-voice"
                  >
                    {isPreviewing ? (
                      <>
                        <Loader2 className="w-3 h-3 animate-spin" />
                        Playing...
                      </>
                    ) : (
                      <>
                        <Play className="w-3 h-3" />
                        Preview voice
                      </>
                    )}
                  </Button>
                  {selectedVoice && (
                    <span className="text-xs text-muted-foreground">
                      {selectedVoice.gender} &middot; {selectedVoice.locale}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Settings */}
            <div className="rounded-xl border border-border bg-card p-5 flex flex-col gap-5">
              <h2 className="text-sm font-semibold text-foreground">Settings</h2>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-medium text-muted-foreground">Speed</Label>
                  <span className="text-xs font-mono bg-muted px-2 py-0.5 rounded text-foreground">
                    {speed[0] > 0 ? "+" : ""}
                    {speed[0]}%
                  </span>
                </div>
                <Slider
                  value={speed}
                  onValueChange={setSpeed}
                  min={-50}
                  max={50}
                  step={1}
                  data-testid="slider-speed"
                />
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>Slower</span>
                  <span>Faster</span>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-medium text-muted-foreground">Pitch</Label>
                  <span className="text-xs font-mono bg-muted px-2 py-0.5 rounded text-foreground">
                    {pitch[0] > 0 ? "+" : ""}
                    {pitch[0]}Hz
                  </span>
                </div>
                <Slider
                  value={pitch}
                  onValueChange={setPitch}
                  min={-20}
                  max={20}
                  step={1}
                  data-testid="slider-pitch"
                />
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>Lower</span>
                  <span>Higher</span>
                </div>
              </div>
            </div>

            {/* Generate */}
            <Button
              size="lg"
              className="w-full h-11 text-sm font-semibold rounded-xl gap-2"
              onClick={handleGenerate}
              disabled={isGenerating || !text.trim() || !voice}
              data-testid="button-generate"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Wand2 className="w-4 h-4" />
                  Generate Speech
                </>
              )}
            </Button>

            <p className="text-[11px] text-muted-foreground text-center leading-relaxed px-2">
              Powered by Microsoft Edge neural voices. No usage limits.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
