
"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { VirtualKeyboard } from '@/components/virtual-keyboard';
import { ControlPanel } from '@/components/control-panel';
import { PianoRollEditor } from '@/components/piano-roll-editor';
import { useMidiPlayer } from '@/hooks/use-midi-player';
import { generateMidiFile, getNotesInScaleForKey, type MidiNote } from '@/lib/midi-utils';
import { SCALES, KEYS, DEFAULT_SCALE, DEFAULT_KEY } from '@/constants/scales';
import type { ScaleItem, KeyItem } from '@/constants/scales';
import { useToast } from "@/hooks/use-toast";
import * as Tone from 'tone'; // Import Tone for priming

export default function MelodySketcherPage() {
  const { toast } = useToast();
  const {
    playNote,
    stopNote,
    startRecording,
    stopRecording,
    playback,
    stopPlayback,
    isRecording,
    recordedNotes,
    setRecordedNotes,
    clearRecording,
    startMetronome,
    stopMetronome,
  } = useMidiPlayer();
// フェールバック用ビープ音を用意
  const fallbackBeep = useRef<HTMLAudioElement | null>(null);

  const [selectedKey, setSelectedKey] = useState<KeyItem>(DEFAULT_KEY);
  const [selectedScale, setSelectedScale] = useState<ScaleItem>(DEFAULT_SCALE);
  const [notesInCurrentScale, setNotesInCurrentScale] = useState<number[]>([]);
  const [audioContextInitialized, setAudioContextInitialized] = useState(false);
  
  const [octaveSliderValue, setOctaveSliderValue] = useState<number>(Math.floor(DEFAULT_KEY.rootMidiNote / 12) - 1); 
  const [keyboardStartMidiNote, setKeyboardStartMidiNote] = useState<number>(
    ((Math.floor(DEFAULT_KEY.rootMidiNote / 12) - 1 + 1) * 12) + (DEFAULT_KEY.rootMidiNote % 12)
  );

  const [pianoRollViewStartOctave, setPianoRollViewStartOctave] = useState(3); 
  const [metronomeBpm, setMetronomeBpm] = useState(120);
  const [isMetronomeActive, setIsMetronomeActive] = useState(false);
  const [showPianoRoll, setShowPianoRoll] = useState(false);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    const notes = getNotesInScaleForKey(selectedKey, selectedScale);
    setNotesInCurrentScale(notes);
  }, [selectedKey, selectedScale]);

  useEffect(() => {
    if (isMetronomeActive && audioContextInitialized) {
      startMetronome(metronomeBpm);
    } else {
      stopMetronome();
    }
    return () => {
      stopMetronome();
    };
  }, [isMetronomeActive, metronomeBpm, audioContextInitialized, startMetronome, stopMetronome]);

  useEffect(() => {
    let newEffectiveStartOctave = octaveSliderValue; 
    if (showPianoRoll && recordedNotes.length > 0) {
      const pitches = recordedNotes.map(n => n.pitch);
      const minRecordedPitch = Math.min(...pitches);
      const maxRecordedPitch = Math.max(...pitches);
      const midRecordedPitch = (minRecordedPitch + maxRecordedPitch) / 2;

      const idealDisplayBottomMidi = midRecordedPitch - 18; 
      const minAllowedDisplayBottomMidi = minRecordedPitch - 6; 
      
      const actualDisplayBottomMidi = Math.max(0, Math.min(idealDisplayBottomMidi, minAllowedDisplayBottomMidi));
      let calculatedStartOctavePropValue = Math.floor(actualDisplayBottomMidi / 12); 
      
      newEffectiveStartOctave = Math.max(0, Math.min(6, calculatedStartOctavePropValue));
    }
    setPianoRollViewStartOctave(newEffectiveStartOctave);
  }, [recordedNotes, showPianoRoll, octaveSliderValue]);

  const ensureAudioContextStartedAndPrime = async () => {
    console.log("Attempting to ensure audio context is started...");
    if (Tone.context.state !== 'running') {
      try {
        console.log("Tone.context.state before Tone.start():", Tone.context.state);
        await Tone.start();
        console.log("Tone.start() resolved. Tone.context.state after Tone.start():", Tone.context.state);
        
        if (Tone.context.state === 'running') {
          console.log("Audio context is running. Priming audio...");
          // Priming oscillator with extended duration and onstop disposal
          const primer = new Tone.Oscillator({
            frequency: 0,    // Can be inaudible
            volume: -100,    // Effectively silent
            type: 'sine'
          }).toDestination();

          const now = Tone.now();
          primer.start(now);
          primer.stop(now + 0.1); // Extend duration to 0.1 seconds

          primer.onstop = () => {
            if (!primer.disposed) {
                console.log('Priming oscillator stopped and disposing.');
                primer.dispose();
            }
          };
        } else {
          console.warn("Tone.start() resolved, but context is still not running:", Tone.context.state);
        }
      } catch (error) {
        console.error("ensureAudioContextStartedAndPrime: Failed to start or prime Tone.js AudioContext", error);
        throw error; 
      }
    } else {
      console.log("Audio context already running.");
    }
  };

  const handleInitializeAudio = useCallback(async () => {
debugger;
    if (audioContextInitialized) return;
    try {
      await ensureAudioContextStartedAndPrime();
      if (Tone.context.state === 'running') {
  // ---- 1. m4a を試す ---------------------------------
  const srcList = [
    '/Melody-Sketcher/beep.m4a',   // ① m4a
    '/Melody-Sketcher/beep.wav'    // ② wav (fallback)
  ];

  // 最初に成功したものを fallbackBeep.current に入れる
  for (const src of srcList) {
    console.error('🔍 try', src);
    const audio = new Audio(src);
    audio.preload = 'auto';
audio.style.display = 'none';
document.body.appendChild(audio);

    // ↓↓↓ 「この 1 行」だけで即 GET が飛びます
    audio.load();

    // イベントを Promise 化して待つ
    const ok = await new Promise<boolean>((resolve) => {
      const timer = setTimeout(() => resolve(false), 1500);   // 1.5 秒待って諦め
      audio.addEventListener('canplaythrough', () => {
        clearTimeout(timer);
        resolve(true);
      });
      audio.addEventListener('error', (e) => {
        console.warn('🟥 error', src, audio.error);
      });
    });

    if (ok) {
      console.error('✅ loaded', src);
      fallbackBeep.current = audio;
      break;
    }
  }

  if (!fallbackBeep.current) {
    console.error('🆘 どのフォーマットもロード出来ませんでした');
  }

        setAudioContextInitialized(true);

        toast({ title: "Audio Initialized", description: "Melody Sketcher is ready!" });
        console.log("Audio context successfully initialized and primed.");
      } else {
        toast({ title: "Audio Not Started", description: "Audio context did not start. Try interacting with the page or check browser permissions.", variant: "destructive" });
        console.error("Audio context failed to start or remain running after ensureAudioContextStartedAndPrime.");
      }
    } catch (error) {
      toast({ title: "Audio Error", description: "Could not initialize audio. Please try again or check browser permissions.", variant: "destructive" });
      console.error("Failed to initialize audio context in handleInitializeAudio:", error);
    }
  }, [audioContextInitialized, toast]);

  const handleRecordToggle = () => {
    if (!audioContextInitialized) {
      toast({ title: "Audio Not Ready", description: "Please initialize audio first by clicking the 'Initialize Audio' button.", variant: "destructive" });
      return;
    }
    if (isRecording) {
      stopRecording();
      toast({ title: "Recording Stopped"});
    } else {
      startRecording();
      toast({ title: "Recording Started" });
    }
  };

  const handlePlay = async () => {
    if (!audioContextInitialized) {
      toast({ title: "Audio Not Ready", description: "Please initialize audio first.", variant: "destructive" });
      return;
    }
    if (recordedNotes.length === 0) {
      toast({ title: "Nothing to Play", description: "Record some notes first." });
      return;
    }
    toast({ title: "Playing Recording..." });
    await playback(); 
  };

  const handleClearRecording = () => {
    clearRecording();
    toast({ title: "Recording Cleared" });
  };

  const handleExport = () => {
    if (recordedNotes.length === 0) {
      toast({ title: "Nothing to Export", description: "Record some notes first." });
      return;
    }
    try {
      const midiFile = generateMidiFile(recordedNotes, undefined, metronomeBpm);
      const blob = new Blob([midiFile], { type: 'audio/midi' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `melody-sketch-${new Date().toISOString().slice(0,10)}.mid`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({ title: "MIDI Exported", description: "Check your downloads folder." });
    } catch (error) {
      console.error("MIDI Export failed:", error);
      toast({ title: "Export Failed", description: "Could not generate MIDI file. See console for details.", variant: "destructive" });
    }
  };

  const handleScaleChange = (scaleName: string) => {
    const newScale = SCALES.find(s => s.name === scaleName) || DEFAULT_SCALE;
    setSelectedScale(newScale);
  };

  const handleKeyChange = (keyName: string) => {
    const newKey = KEYS.find(k => k.name === keyName) || DEFAULT_KEY;
    setSelectedKey(newKey);
    setKeyboardStartMidiNote(((octaveSliderValue + 1) * 12) + (newKey.rootMidiNote % 12));
  };

  const handleOctaveChange = (newOctaveValue: number[]) => {
    const selectedOctaveBySlider = newOctaveValue[0];
    setOctaveSliderValue(selectedOctaveBySlider);
    setKeyboardStartMidiNote(((selectedOctaveBySlider + 1) * 12) + (selectedKey.rootMidiNote % 12));
  };

   const handleNoteDown = useCallback(async (midiNote: number) => {
  // ── iOS は <audio> でフェールバック ───────────
  const isiOS = /iP(hone|od|ad)/.test(navigator.userAgent);
  if (isiOS && fallbackBeep.current) {
    fallbackBeep.current.currentTime = 0;
    fallbackBeep.current.play().catch(console.error);
    return;
  }

  // ── それ以外は Tone.js ─────────────────────
  if (!audioContextInitialized) return;        // ボタン未押下なら何もしない

  try {
    playNote(midiNote, 100);                   // 通常再生
  } catch (err) {
    console.warn("Tone.js 再生失敗 → Audioタグでフォールバック", err);
    fallbackBeep.current?.play().catch(console.error);
  }
// ★★★ コールバックはここで閉じる ★★★
}, [audioContextInitialized, playNote]);

  const handleNoteUp = useCallback((midiNote: number) => {
    if (!audioContextInitialized) {
      return;
    }
    stopNote(midiNote);
  }, [audioContextInitialized, stopNote]);

  const handleMetronomeBpmChange = (newBpm: number[]) => {
    setMetronomeBpm(newBpm[0]);
  };

  const handleMetronomeToggle = () => {
     if (!audioContextInitialized) {
      toast({ title: "Audio Not Ready", description: "Please initialize audio first.", variant: "destructive" });
      return;
    }
    setIsMetronomeActive(prev => !prev);
  };

  const handleTogglePianoRoll = () => {
    if (recordedNotes.length === 0 && !showPianoRoll) {
      toast({ title: "No MIDI to Edit", description: "Record some notes first before opening the editor." });
      return;
    }
    if (showPianoRoll && Tone.Transport.state === 'started') { 
        stopPlayback(); 
    }
    setShowPianoRoll(prev => !prev);
  };

  const handleNotesChangeFromEditor = (updatedNotes: MidiNote[]) => {
    setRecordedNotes(updatedNotes);
  };
  
  const playNotesFromEditor = async (notes: MidiNote[], onStopCallback?: () => void) => {
     if (!audioContextInitialized) {
      toast({ title: "Audio Not Ready", description: "Please initialize audio first.", variant: "destructive" });
      if (onStopCallback) {
        setTimeout(onStopCallback, 10);
      }
      return;
    }
    if (notes.length === 0) {
      toast({ title: "Nothing to Play", description: "No notes in editor." });
      if (onStopCallback) {
        setTimeout(onStopCallback, 10);
      }
      return;
    }
    await playback(notes, onStopCallback); 
  };

  const keyboardOctaves = selectedScale.name === "Chromatic" ? 1.5 : 2;

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col items-center p-2 sm:p-4 md:p-8 space-y-4 md:space-y-6">
      <header className="text-center mt-4 sm:mt-0">
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-primary">Melody Sketcher</h1>
        <p className="text-muted-foreground text-sm sm:text-base mt-1 sm:mt-2">Craft your melodies. Record. Edit. Export.</p>
      </header>

      <main className="w-full max-w-5xl xl:max-w-7xl space-y-4 md:space-y-6">

        {!isClient ? (
          <div className="flex justify-center items-center h-64">
            <p className="text-muted-foreground">Loading Melody Sketcher...</p>
          </div>
        ) : (
          <>
            <ControlPanel
              isRecording={isRecording}
              onRecordToggle={handleRecordToggle}
              onPlay={handlePlay}
              onExport={handleExport}
              onClearRecording={handleClearRecording}
              hasRecording={recordedNotes.length > 0}
              scales={SCALES}
              keys={KEYS}
              selectedScale={selectedScale}
              selectedKey={selectedKey}
              onScaleChange={handleScaleChange}
              onKeyChange={handleKeyChange}
              audioInitialized={audioContextInitialized}
              onInitializeAudio={handleInitializeAudio}
              currentStartOctave={octaveSliderValue}
              onOctaveChange={handleOctaveChange}
              metronomeBpm={metronomeBpm}
              isMetronomeActive={isMetronomeActive}
              onMetronomeBpmChange={handleMetronomeBpmChange}
              onMetronomeToggle={handleMetronomeToggle}
              onTogglePianoRoll={handleTogglePianoRoll}
              isPianoRollVisible={showPianoRoll}
            />
            {showPianoRoll ? (
              <PianoRollEditor
                initialNotes={recordedNotes}
                onNotesChange={handleNotesChangeFromEditor}
                bpm={metronomeBpm}
                onClose={handleTogglePianoRoll}
                displayStartOctave={pianoRollViewStartOctave}
                onPlay={playNotesFromEditor} 
                onStop={stopPlayback} 
              />
            ) : (
              <VirtualKeyboard
                octaves={keyboardOctaves}
                startMidiNote={keyboardStartMidiNote}
                onNoteDown={handleNoteDown}
                onNoteUp={handleNoteUp}
                notesInScaleFilter={notesInCurrentScale}
                selectedScaleType={selectedScale.name}
              />
            )}
          </>
        )}
      </main>
      <footer className="text-center text-xs text-muted-foreground py-4">
        <p>&copy; {new Date().getFullYear()} Melody Sketcher. Create something amazing!</p>
      </footer>
    </div>
  );
}

    
