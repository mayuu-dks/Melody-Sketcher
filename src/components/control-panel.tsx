
import type React from 'react';
import { CircleIcon, PlayIcon, SquareIcon, DownloadIcon, Music3Icon, KeyIcon, Trash2Icon, Volume2, BellIcon, BellOffIcon, Edit3Icon, XIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import type { ScaleItem, KeyItem } from '@/constants/scales';
import { Separator } from '@/components/ui/separator';

interface ControlPanelProps {
  isRecording: boolean;
  onRecordToggle: () => void;
  onPlay: () => void;
  onExport: () => void;
  onClearRecording: () => void;
  hasRecording: boolean;

  scales: ScaleItem[];
  keys: KeyItem[];
  selectedScale: ScaleItem;
  selectedKey: KeyItem;
  onScaleChange: (scaleName: string) => void;
  onKeyChange: (keyName: string) => void;
  audioInitialized: boolean;
  onInitializeAudio: () => void;
  currentStartOctave: number;
  onOctaveChange: (value: number[]) => void;

  metronomeBpm: number;
  isMetronomeActive: boolean;
  onMetronomeBpmChange: (value: number[]) => void;
  onMetronomeToggle: () => void;

  onTogglePianoRoll: () => void;
  isPianoRollVisible: boolean;
}

export const ControlPanel: React.FC<ControlPanelProps> = ({
  isRecording,
  onRecordToggle,
  onPlay,
  onExport,
  onClearRecording,
  hasRecording,
  scales,
  keys,
  selectedScale,
  selectedKey,
  onScaleChange,
  onKeyChange,
  audioInitialized,
  onInitializeAudio,
  currentStartOctave,
  onOctaveChange,
  metronomeBpm,
  isMetronomeActive,
  onMetronomeBpmChange,
  onMetronomeToggle,
  onTogglePianoRoll,
  isPianoRollVisible,
}) => {
  const isOctaveSliderDisabled = !audioInitialized || (isPianoRollVisible && hasRecording);

  return (
    <Card className="w-full shadow-xl bg-card">
      <CardHeader>
        <CardTitle className="text-xl text-card-foreground">Controls</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {!audioInitialized && (
           <Button onClick={onInitializeAudio} className="w-full bg-primary hover:bg-primary/90 text-primary-foreground" size="lg">
            <Volume2 className="mr-2 h-5 w-5" /> Initialize Audio & Start
          </Button>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-4">
           <Button onClick={onTogglePianoRoll} variant="outline" className="w-full" aria-label={isPianoRollVisible ? "Close Editor" : "Edit MIDI"} disabled={!audioInitialized || isRecording || (!hasRecording && !isPianoRollVisible)}>
            {isPianoRollVisible ? <XIcon className="mr-1 sm:mr-2 h-4 w-4 sm:h-5 sm:w-5" /> : <Edit3Icon className="mr-1 sm:mr-2 h-4 w-4 sm:h-5 sm:w-5" />}
            <span className="text-xs sm:text-sm">{isPianoRollVisible ? "Close Edit" : "Edit MIDI"}</span>
          </Button>
          <Button onClick={onClearRecording} disabled={!audioInitialized || isRecording || !hasRecording || isPianoRollVisible} variant="outline" className="w-full" aria-label="Clear Recording">
            <Trash2Icon className="mr-1 sm:mr-2 h-4 w-4 sm:h-5 sm:w-5" />
            <span className="text-xs sm:text-sm">Clear</span>
          </Button>
          <Button onClick={onExport} disabled={!audioInitialized || isRecording || !hasRecording || isPianoRollVisible} variant="outline" className="w-full" aria-label="Export MIDI">
            <DownloadIcon className="mr-1 sm:mr-2 h-4 w-4 sm:h-5 sm:w-5" />
            <span className="text-xs sm:text-sm">Export</span>
          </Button>
        </div>

        <Separator />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-6">
          <div>
            <Label htmlFor="key-select" className="block text-sm font-medium text-foreground mb-1">Key</Label>
            <Select value={selectedKey.name} onValueChange={onKeyChange} disabled={!audioInitialized || isPianoRollVisible}>
              <SelectTrigger id="key-select" className="w-full">
                <KeyIcon className="mr-2 opacity-70 h-4 w-4" />
                <SelectValue placeholder="Select Key" />
              </SelectTrigger>
              <SelectContent>
                {keys.map(key => (
                  <SelectItem key={key.name} value={key.name}>{key.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="scale-select" className="block text-sm font-medium text-foreground mb-1">Scale</Label>
            <Select value={selectedScale.name} onValueChange={onScaleChange} disabled={!audioInitialized || isPianoRollVisible}>
              <SelectTrigger id="scale-select" className="w-full">
                <Music3Icon className="mr-2 opacity-70 h-4 w-4" />
                <SelectValue placeholder="Select Scale" />
              </SelectTrigger>
              <SelectContent>
                {scales.map(scale => (
                  <SelectItem key={scale.name} value={scale.name}>{scale.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="octave-slider" className="text-sm font-medium text-foreground">
              Start Octave: C{currentStartOctave}
              {(isPianoRollVisible && hasRecording) ? " (Piano Roll auto-adjusts)" : ""}
            </Label>
            <Slider
              id="octave-slider"
              min={0}
              max={7}
              step={1}
              value={[currentStartOctave]}
              onValueChange={onOctaveChange}
              disabled={isOctaveSliderDisabled}
              aria-label={`Start Octave C${currentStartOctave}`}
              className="mt-1"
            />
          </div>
        </div>

        <Separator />

        <div>
            <CardTitle className="text-lg text-card-foreground mb-3">Metronome</CardTitle>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-4 gap-y-4 items-center">
                <Button
                    onClick={onMetronomeToggle}
                    variant={isMetronomeActive ? "secondary" : "outline"}
                    className="w-full sm:w-auto"
                    aria-label={isMetronomeActive ? "Stop Metronome" : "Start Metronome"}
                    disabled={!audioInitialized || isPianoRollVisible}
                >
                    {isMetronomeActive ? <BellOffIcon className="mr-1 sm:mr-2 h-4 w-4 sm:h-5 sm:w-5" /> : <BellIcon className="mr-1 sm:mr-2 h-4 w-4 sm:h-5 sm:w-5" />}
                    <span className="text-xs sm:text-sm">{isMetronomeActive ? "Metronome Off" : "Metronome On"}</span>
                </Button>
                <div className="sm:col-span-2 space-y-2">
                    <Label htmlFor="bpm-slider" className="text-sm font-medium text-foreground">
                    BPM: {metronomeBpm}
                    </Label>
                    <Slider
                    id="bpm-slider"
                    min={30}
                    max={220}
                    step={1}
                    value={[metronomeBpm]}
                    onValueChange={onMetronomeBpmChange}
                    disabled={!audioInitialized || isPianoRollVisible}
                    aria-label={`Metronome BPM ${metronomeBpm}`}
                    className="mt-1"
                    />
                </div>
            </div>
        </div>
        <Separator />
        <div className="grid grid-cols-2 gap-2 sm:gap-4">
          <Button
            onClick={onRecordToggle}
            variant={isRecording ? "destructive" : "default"}
            className="w-full"
            aria-label={isRecording ? "Stop Recording" : "Start Recording"}
            disabled={!audioInitialized || isPianoRollVisible}
          >
            {isRecording ? <SquareIcon className="mr-1 sm:mr-2 h-4 w-4 sm:h-5 sm:w-5" /> : <CircleIcon className="mr-1 sm:mr-2 h-4 w-4 sm:h-5 sm:w-5" />}
            <span className="text-xs sm:text-sm">{isRecording ? "Stop" : "Record"}</span>
          </Button>
          <Button onClick={onPlay} disabled={!audioInitialized || isRecording || !hasRecording || isPianoRollVisible} className="w-full" aria-label="Play Recording">
            <PlayIcon className="mr-1 sm:mr-2 h-4 w-4 sm:h-5 sm:w-5" />
            <span className="text-xs sm:text-sm">Play</span>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
