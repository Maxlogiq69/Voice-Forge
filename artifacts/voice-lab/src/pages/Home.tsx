import { useState, useRef } from "react";
import { Drawer } from "vaul";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import {
  Mic, Play, Download, RotateCcw, Loader2, Wand2,
  Volume2, Star, Clapperboard, Settings2, ChevronRight,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

const FEATURED_VOICE_IDS = [
  "en-GB-RyanNeural",
  "en-US-GuyNeural",
  "en-GB-SoniaNeural",
  "en-US-DavisNeural",
  "en-US-TonyNeural",
];

const PREVIEW_TEXT = "Hello, I am your selected voice. Ready to narrate your story with clarity and power.";

const NARRATOR_PRESETS = [
  { label: "Standard",    speed: 0,   pitch: 0,   description: "Natural, balanced delivery" },
  { label: "Documentary", speed: -10, pitch: -5,  description: "Measured, authoritative tone" },
  { label: "Audiobook",   speed: -5,  pitch: 0,   description: "Warm, relaxed storytelling" },
  { label: "Dramatic",    speed: -20, pitch: -10, description: "Deep, cinematic intensity" },
  { label: "News Cast",   speed: 15,  pitch: 3,   description: "Crisp, energetic broadcast" },
] as const;

function buildApiUrl(path: string) {
  return `${import.meta.env.BASE_URL}${path}`.replace(/\/\/+/g, "/");
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

function countWords(text: string): number {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

function estimateDuration(wordCount: number, speedPct: number): number {
  const baseWPM = 140;
  const adjustedWPM = baseWPM * (1 + speedPct / 100);
  return (wordCount / adjustedWPM) * 60;
}

export default function Home() {
  const { data: voices = [], isLoading: isLoadingVoices } = useListVoices();
  const { toast } = useToast();

  const [text, setText] = useState("");
  const [voice, setVoice] = useState("");
  const [speed, setSpeed] = useState([0]);
  const [pitch, setPitch] = useState([0]);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const [isGenerating, setIsGenerating] = useState(false);
  const [previewingId, setPreviewingId] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);

  const selectedVoice = voices.find((v) => v.id === voice);
  const featuredVoices = voices.filter((v) => FEATURED_VOICE_IDS.includes(v.id));
  const rateStr = `${speed[0] > 0 ? "+" : ""}${speed[0]}%`;
  const pitchStr = `${pitch[0] > 0 ? "+" : ""}${pitch[0]}Hz`;

  const charCount = text.length;
  const wordCount = countWords(text);
  const estSeconds = estimateDuration(wordCount, speed[0]);

  const activePreset = NARRATOR_PRESETS.find(
    (p) => p.speed === speed[0] && p.pitch === pitch[0],
  );

  const voicesByLocale = voices.reduce(
    (acc, v) => {
      if (!acc[v.locale]) acc[v.locale] = [];
      acc[v.locale].push(v);
      return acc;
    },
    {} as Record<string, typeof voices>,
  );

  async function fetchAudio(
    inputText: string,
    voiceId: string,
    rate: string,
    pitchVal: string,
  ): Promise<Blob> {
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
    setDrawerOpen(false);
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

  const handlePreview = async (voiceId: string) => {
    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
      previewAudioRef.current = null;
    }
    setPreviewingId(voiceId);
    try {
      const blob = await fetchAudio(PREVIEW_TEXT, voiceId, "+0%", "+0Hz");
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      previewAudioRef.current = audio;
      audio.play();
      audio.onended = () => {
        URL.revokeObjectURL(url);
        previewAudioRef.current = null;
        setPreviewingId(null);
      };
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Preview failed";
      toast({ title: "Preview failed", description: message, variant: "destructive" });
      setPreviewingId(null);
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
      setPreviewingId(null);
    }
  };

  const ControlsPanel = () => (
    <>
      {/* Voice Selector */}
      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-foreground">Voice</h2>
        <Tabs defaultValue="featured">
          <TabsList className="w-full h-8 mb-3">
            <TabsTrigger value="featured" className="flex-1 text-xs gap-1.5">
              <Star className="w-3 h-3" />
              Featured
            </TabsTrigger>
            <TabsTrigger value="all" className="flex-1 text-xs">
              All Voices
            </TabsTrigger>
          </TabsList>

          <TabsContent value="featured" className="mt-0 space-y-2">
            {isLoadingVoices ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
              </div>
            ) : (
              featuredVoices.map((v) => (
                <div
                  key={v.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => setVoice(v.id)}
                  onKeyDown={(e) => e.key === "Enter" && setVoice(v.id)}
                  data-testid={`card-voice-${v.id}`}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg border text-left transition-all cursor-pointer ${
                    voice === v.id
                      ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                      : "border-border bg-background hover:border-primary/40 hover:bg-muted/30"
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div
                      className={`w-2 h-2 rounded-full shrink-0 ${
                        voice === v.id ? "bg-primary" : "bg-muted-foreground/30"
                      }`}
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground leading-none mb-0.5">
                        {v.friendlyName}
                      </p>
                      <p className="text-[10px] text-muted-foreground">{v.gender}</p>
                    </div>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); handlePreview(v.id); }}
                    disabled={previewingId === v.id}
                    data-testid={`button-preview-${v.id}`}
                    className="ml-2 w-7 h-7 rounded-md flex items-center justify-center bg-muted hover:bg-primary hover:text-white transition-colors shrink-0 text-muted-foreground disabled:opacity-50"
                  >
                    {previewingId === v.id ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Play className="w-3 h-3" />
                    )}
                  </button>
                </div>
              ))
            )}
          </TabsContent>

          <TabsContent value="all" className="mt-0 space-y-2">
            <Select value={voice} onValueChange={setVoice} disabled={isLoadingVoices}>
              <SelectTrigger
                className="w-full bg-background border-border h-10 rounded-lg text-sm"
                data-testid="select-voice"
              >
                <SelectValue placeholder={isLoadingVoices ? "Loading..." : "Choose a voice"} />
              </SelectTrigger>
              <SelectContent className="max-h-[260px]">
                {Object.entries(voicesByLocale).map(([locale, localeVoices]) => (
                  <SelectGroup key={locale}>
                    <SelectLabel className="text-xs text-muted-foreground py-1.5 font-medium">
                      {locale}
                    </SelectLabel>
                    {localeVoices.map((v) => (
                      <SelectItem key={v.id} value={v.id} className="text-sm py-2">
                        <span className="flex items-center gap-2">
                          {v.friendlyName}
                          <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 font-medium leading-none">
                            {v.gender === "Male" ? "M" : "F"}
                          </Badge>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>

            {voice && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePreview(voice)}
                disabled={!!previewingId}
                className="w-full gap-1.5 text-xs h-8"
                data-testid="button-preview-selected"
              >
                {previewingId === voice ? (
                  <><Loader2 className="w-3 h-3 animate-spin" />Playing...</>
                ) : (
                  <><Play className="w-3 h-3" />Preview selected voice</>
                )}
              </Button>
            )}
          </TabsContent>
        </Tabs>

        {selectedVoice && (
          <p className="text-[11px] text-muted-foreground">
            Selected: <span className="font-medium text-foreground">{selectedVoice.friendlyName}</span>
            {" "}&middot; {selectedVoice.gender} &middot; {selectedVoice.locale}
          </p>
        )}
      </div>

      <div className="h-px bg-border" />

      {/* Settings */}
      <div className="flex flex-col gap-5">
        <h2 className="text-sm font-semibold text-foreground">Settings</h2>

        {/* Narrator Mode Presets */}
        <div className="space-y-2.5">
          <div className="flex items-center gap-1.5">
            <Clapperboard className="w-3.5 h-3.5 text-muted-foreground" />
            <Label className="text-xs font-medium text-muted-foreground">Narrator Mode</Label>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {NARRATOR_PRESETS.map((preset) => {
              const isActive = speed[0] === preset.speed && pitch[0] === preset.pitch;
              return (
                <button
                  key={preset.label}
                  title={preset.description}
                  data-testid={`preset-${preset.label.toLowerCase().replace(" ", "-")}`}
                  onClick={() => { setSpeed([preset.speed]); setPitch([preset.pitch]); }}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-medium border transition-all ${
                    isActive
                      ? "bg-primary text-white border-primary shadow-sm"
                      : "bg-background text-muted-foreground border-border hover:border-primary/50 hover:text-foreground"
                  }`}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>
          {activePreset && (
            <p className="text-[10px] text-muted-foreground italic">{activePreset.description}</p>
          )}
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-medium text-muted-foreground">Speed</Label>
            <span className="text-xs font-mono bg-muted px-2 py-0.5 rounded text-foreground">
              {speed[0] > 0 ? "+" : ""}{speed[0]}%
            </span>
          </div>
          <Slider value={speed} onValueChange={setSpeed} min={-50} max={50} step={1} data-testid="slider-speed" />
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>Slower</span>
            <span>Faster</span>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-medium text-muted-foreground">Pitch</Label>
            <span className="text-xs font-mono bg-muted px-2 py-0.5 rounded text-foreground">
              {pitch[0] > 0 ? "+" : ""}{pitch[0]}Hz
            </span>
          </div>
          <Slider value={pitch} onValueChange={setPitch} min={-20} max={20} step={1} data-testid="slider-pitch" />
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>Lower</span>
            <span>Higher</span>
          </div>
        </div>
      </div>
    </>
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
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 md:px-6 py-6 md:py-8 pb-28 lg:pb-8">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6">

          {/* Left: Text Input */}
          <div className="flex flex-col gap-4">
            <div>
              <Label className="text-sm font-medium text-foreground mb-2 block">Script</Label>
              <Textarea
                placeholder="Type or paste your script here..."
                className="min-h-[280px] md:min-h-[360px] resize-none text-sm md:text-base leading-relaxed bg-background border-border focus-visible:ring-1 focus-visible:ring-primary rounded-xl"
                value={text}
                onChange={(e) => setText(e.target.value)}
                data-testid="input-text"
              />
              <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
                <span data-testid="stat-chars">
                  <span className="font-medium text-foreground">{charCount.toLocaleString()}</span> characters
                </span>
                <span className="text-border">|</span>
                <span data-testid="stat-words">
                  <span className="font-medium text-foreground">{wordCount.toLocaleString()}</span> words
                </span>
                {wordCount > 0 && (
                  <>
                    <span className="text-border">|</span>
                    <span data-testid="stat-duration">
                      Est. <span className="font-medium text-foreground">{formatDuration(estSeconds)}</span> at current speed
                    </span>
                  </>
                )}
              </div>
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

          {/* Right: Controls — desktop only */}
          <div className="hidden lg:flex flex-col gap-4">
            <div className="rounded-xl border border-border bg-card p-5 flex flex-col gap-5">
              <ControlsPanel />
            </div>

            <Button
              size="lg"
              className="w-full h-11 text-sm font-semibold rounded-xl gap-2"
              onClick={handleGenerate}
              disabled={isGenerating || !text.trim() || !voice}
              data-testid="button-generate"
            >
              {isGenerating ? (
                <><Loader2 className="w-4 h-4 animate-spin" />Generating...</>
              ) : (
                <><Wand2 className="w-4 h-4" />Generate Speech</>
              )}
            </Button>

            <p className="text-[11px] text-muted-foreground text-center leading-relaxed px-2">
              Powered By LogiQ History
            </p>
          </div>
        </div>
      </main>

      {/* Mobile bottom action bar */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-20 bg-background/95 backdrop-blur-sm border-t border-border px-4 py-3 safe-area-bottom">
        <div className="flex items-center gap-2 max-w-6xl mx-auto">

          {/* Settings / Voice drawer trigger */}
          <Drawer.Root open={drawerOpen} onOpenChange={setDrawerOpen}>
            <Drawer.Trigger asChild>
              <button
                className="flex items-center gap-2 flex-1 min-w-0 h-10 px-3 rounded-xl border border-border bg-card text-left transition-colors hover:border-primary/40 active:bg-muted"
              >
                <Settings2 className="w-4 h-4 text-muted-foreground shrink-0" />
                <span className="flex-1 min-w-0 truncate text-xs text-foreground">
                  {selectedVoice ? selectedVoice.friendlyName : "Select voice & settings"}
                </span>
                {activePreset && (
                  <span className="text-[10px] text-primary font-medium shrink-0">{activePreset.label}</span>
                )}
                <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0 rotate-[-90deg]" />
              </button>
            </Drawer.Trigger>

            <Drawer.Portal>
              <Drawer.Overlay className="fixed inset-0 bg-black/40 z-40" />
              <Drawer.Content
                className="fixed bottom-0 left-0 right-0 z-50 flex flex-col bg-background rounded-t-2xl border-t border-border max-h-[90dvh]"
              >
                {/* Drag handle */}
                <div className="flex justify-center pt-3 pb-1 shrink-0">
                  <div className="w-10 h-1 rounded-full bg-muted-foreground/25" />
                </div>

                {/* Drawer header */}
                <div className="px-5 pt-2 pb-3 flex items-center justify-between shrink-0 border-b border-border">
                  <span className="text-sm font-semibold text-foreground">Voice &amp; Settings</span>
                  <button
                    onClick={() => setDrawerOpen(false)}
                    className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded"
                  >
                    Done
                  </button>
                </div>

                {/* Scrollable controls */}
                <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-5">
                  <ControlsPanel />
                </div>

                {/* Generate inside drawer */}
                <div className="shrink-0 px-5 py-4 border-t border-border">
                  <Button
                    size="lg"
                    className="w-full h-11 text-sm font-semibold rounded-xl gap-2"
                    onClick={handleGenerate}
                    disabled={isGenerating || !text.trim() || !voice}
                    data-testid="button-generate-drawer"
                  >
                    {isGenerating ? (
                      <><Loader2 className="w-4 h-4 animate-spin" />Generating...</>
                    ) : (
                      <><Wand2 className="w-4 h-4" />Generate Speech</>
                    )}
                  </Button>
                  <p className="text-[10px] text-muted-foreground text-center mt-2">
                    Powered By LogiQ History
                  </p>
                </div>
              </Drawer.Content>
            </Drawer.Portal>
          </Drawer.Root>

          {/* Quick generate button */}
          <Button
            size="default"
            className="h-10 px-4 text-sm font-semibold rounded-xl gap-1.5 shrink-0"
            onClick={handleGenerate}
            disabled={isGenerating || !text.trim() || !voice}
            data-testid="button-generate"
          >
            {isGenerating ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <><Wand2 className="w-4 h-4" />Generate</>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
