import { useState } from "react";
import { useListVoices } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Mic2, Play, Download, Trash2, Settings2, Loader2, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function Home() {
  const { data: voices = [], isLoading: isLoadingVoices } = useListVoices();
  const { toast } = useToast();

  const [text, setText] = useState("");
  const [voice, setVoice] = useState("");
  const [rate, setRate] = useState([0]); // -50 to 50
  const [pitch, setPitch] = useState([0]); // -20 to 20
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  const MAX_CHARS = 5000;

  const handleGenerate = async () => {
    if (!text.trim()) {
      toast({ title: "Please enter some text", variant: "destructive" });
      return;
    }
    if (!voice) {
      toast({ title: "Please select a voice", variant: "destructive" });
      return;
    }

    setIsGenerating(true);
    setAudioUrl(null);

    const rateStr = `${rate[0] > 0 ? "+" : ""}${rate[0]}%`;
    const pitchStr = `${pitch[0] > 0 ? "+" : ""}${pitch[0]}Hz`;

    try {
      const response = await fetch(`${import.meta.env.BASE_URL}api/tts/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, voice, rate: rateStr, pitch: pitchStr }),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Generation failed");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      setAudioUrl(url);
      toast({ title: "Audio generated successfully" });
    } catch (e: any) {
      toast({ title: "Generation Failed", description: e.message, variant: "destructive" });
    } finally {
      setIsGenerating(false);
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

  const handleClear = () => {
    setText("");
    setAudioUrl(null);
    setRate([0]);
    setPitch([0]);
  };

  // Group voices by locale
  const voicesByLocale = voices.reduce((acc, v) => {
    if (!acc[v.locale]) acc[v.locale] = [];
    acc[v.locale].push(v);
    return acc;
  }, {} as Record<string, typeof voices>);

  return (
    <div className="min-h-[100dvh] w-full bg-background flex flex-col items-center p-4 md:p-8">
      <div className="w-full max-w-4xl flex flex-col gap-6 md:gap-8 mt-4 md:mt-8">
        
        {/* Header */}
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center border border-primary/30">
              <Mic2 className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-bold tracking-tight text-foreground">LogiQ Voice Lab</h1>
              <p className="text-sm text-muted-foreground font-medium">Studio-grade neural text-to-speech</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={handleClear} data-testid="button-clear" title="Reset Session">
            <Trash2 className="w-5 h-5 text-muted-foreground hover:text-foreground transition-colors" />
          </Button>
        </header>

        {/* Main Studio Area */}
        <main className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* Left Column: Text Input */}
          <div className="lg:col-span-8 flex flex-col gap-4">
            <div className="relative">
              <Textarea
                placeholder="Enter your script here..."
                className="min-h-[300px] md:min-h-[400px] lg:min-h-[500px] resize-none text-base md:text-lg leading-relaxed p-6 bg-card border-card-border focus-visible:ring-1 focus-visible:ring-primary shadow-sm rounded-2xl"
                value={text}
                onChange={(e) => setText(e.target.value)}
                maxLength={MAX_CHARS}
                data-testid="input-text"
              />
              <div className="absolute bottom-4 right-4 flex items-center gap-2">
                <span className={`text-xs font-mono font-medium ${text.length > MAX_CHARS * 0.9 ? 'text-destructive' : 'text-muted-foreground'}`}>
                  {text.length} / {MAX_CHARS}
                </span>
              </div>
            </div>

            {/* Audio Player Result */}
            {audioUrl && (
              <div className="p-4 rounded-2xl bg-card border border-card-border shadow-sm flex flex-col md:flex-row items-center gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <audio controls src={audioUrl} className="w-full h-12 outline-none" data-testid="audio-player" />
                <Button onClick={handleDownload} variant="secondary" className="w-full md:w-auto shrink-0 gap-2 font-medium" data-testid="button-download">
                  <Download className="w-4 h-4" /> Download MP3
                </Button>
              </div>
            )}
          </div>

          {/* Right Column: Controls */}
          <div className="lg:col-span-4 flex flex-col gap-6">
            <div className="p-6 rounded-2xl bg-card border border-card-border shadow-sm flex flex-col gap-6">
              
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground uppercase tracking-wider mb-2">
                <Settings2 className="w-4 h-4 text-primary" /> Configuration
              </div>

              {/* Voice Selection */}
              <div className="space-y-3">
                <Label className="text-sm font-medium text-muted-foreground">Voice Actor</Label>
                <Select value={voice} onValueChange={setVoice} disabled={isLoadingVoices}>
                  <SelectTrigger className="w-full bg-background border-border h-12 px-4 rounded-xl" data-testid="select-voice">
                    <SelectValue placeholder={isLoadingVoices ? "Loading voices..." : "Select a voice"} />
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px]">
                    {Object.entries(voicesByLocale).map(([locale, localeVoices]) => (
                      <SelectGroup key={locale}>
                        <SelectLabel className="font-mono text-xs text-muted-foreground bg-muted/30 py-2">{locale}</SelectLabel>
                        {localeVoices.map(v => (
                          <SelectItem key={v.id} value={v.id} className="py-2.5">
                            <div className="flex items-center justify-between w-full pr-4">
                              <span className="font-medium">{v.friendlyName}</span>
                              <Badge variant="outline" className="ml-2 text-[10px] uppercase font-mono tracking-wider opacity-60">
                                {v.gender}
                              </Badge>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="h-px w-full bg-border" />

              {/* Speed Control */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium text-muted-foreground">Speed</Label>
                  <span className="text-xs font-mono font-medium bg-background px-2 py-1 rounded-md border border-border">
                    {rate[0] > 0 ? "+" : ""}{rate[0]}%
                  </span>
                </div>
                <Slider
                  value={rate}
                  onValueChange={setRate}
                  min={-50}
                  max={50}
                  step={1}
                  className="py-2"
                  data-testid="slider-rate"
                />
              </div>

              {/* Pitch Control */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium text-muted-foreground">Pitch</Label>
                  <span className="text-xs font-mono font-medium bg-background px-2 py-1 rounded-md border border-border">
                    {pitch[0] > 0 ? "+" : ""}{pitch[0]}Hz
                  </span>
                </div>
                <Slider
                  value={pitch}
                  onValueChange={setPitch}
                  min={-20}
                  max={20}
                  step={1}
                  className="py-2"
                  data-testid="slider-pitch"
                />
              </div>

            </div>

            <Button 
              size="lg" 
              className="w-full h-14 text-base font-semibold rounded-xl shadow-md gap-2" 
              onClick={handleGenerate}
              disabled={isGenerating || !text.trim() || !voice}
              data-testid="button-generate"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Generating Audio...
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5" />
                  Generate Narration
                </>
              )}
            </Button>

          </div>
        </main>
      </div>
    </div>
  );
}
