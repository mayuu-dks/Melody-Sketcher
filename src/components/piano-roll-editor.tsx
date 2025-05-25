
"use client";

import type React from 'react';
import { useState, useEffect, useCallback, useRef } from 'react';
import type { MidiNote } from '@/lib/midi-utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Trash2Icon, SigmaIcon, XIcon, PlayIcon, SquareIcon } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import * as Tone from 'tone';

// Constants for piano roll display
const ROW_HEIGHT_PX = 20;
const PIXELS_PER_MS = 0.05;
const GRID_LINE_COLOR = 'hsl(var(--border))';
const NOTE_COLOR = 'hsl(var(--primary))';
const SELECTED_NOTE_COLOR = 'hsl(var(--accent))';
const MIN_PITCH_DISPLAY = 24; // C1
const MAX_PITCH_DISPLAY = 108; // C8
const PITCH_LEGEND_WIDTH_PX = 45; // Width for the pitch name labels

const QUANTIZE_RESOLUTION_16TH = 16;
const QUANTIZE_RESOLUTION_8TH = 8;

const MIDI_NOTE_NAMES_SHARP = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

function getNoteNameFromPitch(pitch: number): string {
  if (pitch < 0 || pitch > 127) return "";
  const octave = Math.floor(pitch / 12) - 1;
  const noteIndex = pitch % 12;
  return MIDI_NOTE_NAMES_SHARP[noteIndex] + octave;
}

interface PianoRollEditorProps {
  initialNotes: MidiNote[];
  onNotesChange: (newNotes: MidiNote[]) => void;
  bpm: number;
  onClose: () => void;
  displayStartOctave?: number;
  onPlay: (notes: MidiNote[], onStopCallback?: () => void) => Promise<void>;
  onStop: () => void;
}

export const PianoRollEditor: React.FC<PianoRollEditorProps> = ({
  initialNotes,
  onNotesChange,
  bpm,
  onClose,
  displayStartOctave = 2, // This is C0-based (0 for C0, 1 for C1, etc.)
  onPlay,
  onStop,
}) => {
  const [notes, setNotes] = useState<MidiNote[]>(initialNotes.map(note => ({ ...note, id: note.id || crypto.randomUUID() })));
  const [selectedNoteIds, setSelectedNoteIds] = useState<Set<string>>(new Set());
  const [maxTimeMs, setMaxTimeMs] = useState(20000);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackHeadPositionMs, setPlaybackHeadPositionMs] = useState<number | null>(null);

  const gridRef = useRef<HTMLDivElement>(null);
  const [interaction, setInteraction] = useState<{
    type: 'move' | 'resize' | null;
    noteId: string | null; 
    startX: number;
    startY: number;
    originalNotesData: Map<string, { originalStartTime: number; originalPitch: number; originalDuration: number }>;
  } | null>(null);

  const minPitch = Math.max(MIN_PITCH_DISPLAY, (displayStartOctave + 1) * 12);
  const numVerticalRows = 3 * 12; // Display 3 octaves
  const maxPitchToRender = Math.min(MAX_PITCH_DISPLAY, minPitch + numVerticalRows -1);


  const isPlayingRef = useRef(isPlaying);
  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  useEffect(() => {
    setNotes(initialNotes.map(note => ({ ...note, id: note.id || crypto.randomUUID() })));
    if (initialNotes.length === 0 && isPlayingRef.current) {
        handleStopFromEditor();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialNotes]);


  const uiUpdateLoopIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (isPlaying) {
      if (uiUpdateLoopIdRef.current === null) {
        uiUpdateLoopIdRef.current = Tone.Transport.scheduleRepeat((time) => {
          Tone.Draw.schedule(() => {
            if (isPlayingRef.current) {
              setPlaybackHeadPositionMs(Tone.Transport.seconds * 1000);
            }
          }, time);
        }, "60hz"); // Update frequently for smooth animation
      }
    } else {
      if (uiUpdateLoopIdRef.current !== null) {
        Tone.Transport.clear(uiUpdateLoopIdRef.current);
        uiUpdateLoopIdRef.current = null;
      }
      setPlaybackHeadPositionMs(null); // Hide playback head
    }
  
    return () => {
      if (uiUpdateLoopIdRef.current !== null) {
        Tone.Transport.clear(uiUpdateLoopIdRef.current);
        uiUpdateLoopIdRef.current = null;
      }
    };
  }, [isPlaying]);
  
  useEffect(() => {
    // Sync playback head on mount if transport is already running (e.g. from main page metronome)
    // Does not change isPlaying state for the editor itself.
    if (Tone.Transport.state === 'started') {
      setPlaybackHeadPositionMs(Tone.Transport.seconds * 1000);
    } else {
      setPlaybackHeadPositionMs(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Runs only on mount


  useEffect(() => {
    const currentMax = notes.reduce((max, note) => Math.max(max, note.startTime + note.duration), 0);
    setMaxTimeMs(Math.max(20000, Math.ceil(currentMax / 1000) * 1000 + 4000));
  }, [notes]);


  const handleDeleteSelected = () => {
    if (isPlayingRef.current) return;
    const newNotes = notes.filter(note => !selectedNoteIds.has(note.id!));
    setNotes(newNotes);
    onNotesChange(newNotes.map(n => ({...n, id: n.id!})));
    setSelectedNoteIds(new Set());
  };

  const quantizeValue = (valueMs: number, currentBpm: number, resolution: number): number => {
    const msPerBeat = 60000 / currentBpm;
    const stepsPerBeat = resolution / 4;
    const msPerGridStep = msPerBeat / stepsPerBeat;
    return Math.max(0, Math.round(valueMs / msPerGridStep) * msPerGridStep);
  };

  const handleQuantizeSelected = (resolution: number) => {
    if (isPlayingRef.current) return;
    const newNotes = notes.map(note => {
      if (selectedNoteIds.has(note.id!)) {
        return {
          ...note,
          startTime: quantizeValue(note.startTime, bpm, resolution),
        };
      }
      return note;
    });
    setNotes(newNotes);
    onNotesChange(newNotes.map(n => ({...n, id: n.id!})));
  };

 const handleMouseDownOnNote = (
    noteToInteractWith: MidiNote,
    e: React.MouseEvent,
    interactionType: 'move' | 'resize'
  ) => {
    e.preventDefault();
    e.stopPropagation();
    if (isPlayingRef.current) return;

    const clickedNoteId = noteToInteractWith.id!;
    let nextSelectedNoteIds: Set<string>;

    if (e.ctrlKey || e.metaKey) {
      nextSelectedNoteIds = new Set(selectedNoteIds);
      if (nextSelectedNoteIds.has(clickedNoteId)) {
        nextSelectedNoteIds.delete(clickedNoteId);
      } else {
        nextSelectedNoteIds.add(clickedNoteId);
      }
    } else {
      // If not using modifier key
      if (!selectedNoteIds.has(clickedNoteId)) {
        // If clicking a new, unselected note (without modifier), select only this one
        nextSelectedNoteIds = new Set([clickedNoteId]);
      } else {
        // If clicking an already selected note (or one in a group of selected notes)
        // without modifier, keep the current selection for dragging.
        nextSelectedNoteIds = new Set(selectedNoteIds);
      }
    }
    setSelectedNoteIds(nextSelectedNoteIds);

    // Proceed to set up interaction only if there's a selection
    if (nextSelectedNoteIds.size > 0) {
      document.body.style.cursor = interactionType === 'move' ? 'grabbing' : 'ew-resize';
      const originalNotesDataForInteraction = new Map<string, { originalStartTime: number; originalPitch: number; originalDuration: number }>();

      notes.forEach(n => {
        if (n.id && nextSelectedNoteIds.has(n.id)) { 
          originalNotesDataForInteraction.set(n.id, {
            originalStartTime: n.startTime,
            originalPitch: n.pitch,
            originalDuration: n.duration,
          });
        }
      });
      
      setInteraction({
        type: interactionType,
        noteId: interactionType === 'resize' ? clickedNoteId : null,
        startX: e.clientX,
        startY: e.clientY,
        originalNotesData: originalNotesDataForInteraction,
      });
    } else {
      setInteraction(null); // No selection, so no interaction
      document.body.style.cursor = 'default';
    }
  };


  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!interaction || !interaction.originalNotesData || interaction.originalNotesData.size === 0) return;

    const dx = e.clientX - interaction.startX;
    const dy = e.clientY - interaction.startY;

    setNotes(prevNotes => {
      return prevNotes.map(n => {
        if (!n.id || !interaction.originalNotesData!.has(n.id)) {
          return n;
        }
        const originalData = interaction.originalNotesData!.get(n.id!)!;
        let newStartTime = originalData.originalStartTime;
        let newPitch = originalData.originalPitch;
        let newDuration = originalData.originalDuration;

        if (interaction.type === 'move') {
          newStartTime = Math.max(0, originalData.originalStartTime + (dx / PIXELS_PER_MS));
          const pitchOffset = Math.round(-dy / ROW_HEIGHT_PX);
          newPitch = Math.max(MIN_PITCH_DISPLAY, Math.min(MAX_PITCH_DISPLAY, originalData.originalPitch + pitchOffset));
        } else if (interaction.type === 'resize' && interaction.noteId === n.id) { 
          newDuration = Math.max(50, originalData.originalDuration + (dx / PIXELS_PER_MS));
        }
        return { ...n, startTime: newStartTime, pitch: newPitch, duration: newDuration, id: n.id! };
      });
    });
  }, [interaction]);

  const handleMouseUp = useCallback(() => {
    if (interaction) {
      onNotesChange(notes.map(n => ({ ...n, id: n.id! }))); 
    }
    setInteraction(null);
    document.body.style.cursor = 'default';
  }, [interaction, notes, onNotesChange]);

  useEffect(() => {
    if (interaction) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    } else {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    }
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'default';
    };
  }, [interaction, handleMouseMove, handleMouseUp]);

  const handlePlayFromEditor = async () => {
    if (notes.length === 0) {
      return; 
    }
    if (isPlayingRef.current) {
      return; 
    }

    setIsPlaying(true);

    try {
      const validNotesToPlay = notes.map(n => {
          if (!n || !n.id || isNaN(n.duration) || n.duration <=0 || isNaN(n.startTime) || typeof n.pitch !== 'number' || isNaN(n.pitch)) {
              console.warn("Skipping note with invalid values or missing id for playback:", n);
              return null;
          }
          return {...n, id: n.id!};
      }).filter(n => n !== null) as MidiNote[];
      
      if (validNotesToPlay.length === 0) {
        setIsPlaying(false); // Nothing valid to play
        return;
      }

      await onPlay(
        validNotesToPlay,
        () => { 
          setIsPlaying(false); // This callback is crucial for stopping UI loop
        }
      );
    } catch (error) {
      console.error("Error during piano roll playback:", error);
      setIsPlaying(false); 
    }
  };

  const handleStopFromEditor = () => {
    // onStop (from useMidiPlayer) will trigger the onStopCallback given to onPlay,
    // which will set isPlaying to false.
    if (isPlayingRef.current || Tone.Transport.state === 'started') {
        onStop(); 
    }
    // Explicitly set isPlaying to false here for immediate UI feedback,
    // as the callback from onStop might have a slight delay.
    // However, this could cause a race if onStop's callback also sets it.
    // Let's rely on the callback chain from useMidiPlayer for consistency.
    // If onStop() doesn't result in isPlaying(false) quickly enough, that's the place to fix.
  };


  const handleEditorClose = () => {
    if (isPlayingRef.current) {
      handleStopFromEditor();
    }
    onClose();
  };

  const handleNoteDoubleClick = (noteId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (isPlayingRef.current) return;
    const newNotes = notes.filter(n => n.id !== noteId);
    setNotes(newNotes);
    onNotesChange(newNotes.map(n => ({ ...n, id: n.id! })));
    setSelectedNoteIds(prev => {
      const newSet = new Set(prev);
      newSet.delete(noteId);
      return newSet;
    });
  };

  const handleGridDoubleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!gridRef.current || isPlayingRef.current) return;

    let targetElement = e.target as HTMLElement;
    let isNoteOrHandle = false;
    
    while (targetElement && targetElement !== gridRef.current && targetElement !== document.body) {
        if (targetElement.hasAttribute('data-midi-note-id') || targetElement.classList.contains('resize-handle')) { // Check for resize handle too
            isNoteOrHandle = true;
            break;
        }
        targetElement = targetElement.parentElement as HTMLElement;
    }
    if(isNoteOrHandle) return;

    const gridRect = gridRef.current.getBoundingClientRect();
    const clickX = e.clientX - gridRect.left + gridRef.current.scrollLeft;
    const clickY = e.clientY - gridRect.top + gridRef.current.scrollTop;

    const timeMs = clickX / PIXELS_PER_MS;
    const clickedPitch = Math.round((minPitch + numVerticalRows - 1) - (clickY / ROW_HEIGHT_PX));

    const finalPitch = Math.max(MIN_PITCH_DISPLAY, Math.min(MAX_PITCH_DISPLAY, clickedPitch));
    if (finalPitch < MIN_PITCH_DISPLAY || finalPitch > MAX_PITCH_DISPLAY) return;

    const quantizedStartTimeMs = quantizeValue(timeMs, bpm, QUANTIZE_RESOLUTION_16TH);
    const msPerBeat = 60000 / bpm;
    const defaultDurationMs = msPerBeat / (QUANTIZE_RESOLUTION_16TH / 4);

    const newNote: MidiNote = {
      id: crypto.randomUUID(),
      pitch: finalPitch,
      startTime: quantizedStartTimeMs,
      duration: Math.max(50, defaultDurationMs),
      velocity: 100,
    };
    const newNotesList = [...notes, newNote].sort((a, b) => a.startTime - b.startTime);
    setNotes(newNotesList);
    onNotesChange(newNotesList.map(n => ({ ...n, id: n.id! })));
  };


  const gridWidth = maxTimeMs * PIXELS_PER_MS;
  const gridHeight = numVerticalRows * ROW_HEIGHT_PX;
  const verticalGridLines: JSX.Element[] = [];
  const msPerBeat = 60000 / bpm;
  const beatWidthPx = msPerBeat * PIXELS_PER_MS;

  for (let t = 0; t <= maxTimeMs; t += msPerBeat) {
    const x = t * PIXELS_PER_MS;
    const isMeasureLine = (t / msPerBeat) % 4 === 0;
    verticalGridLines.push(
      <div key={`v-${t}`} className="absolute top-0 bottom-0" style={{ left: `${x}px`, width: '1px', backgroundColor: GRID_LINE_COLOR, opacity: isMeasureLine ? 0.5 : 0.2, pointerEvents: 'none' }} />
    );
    const stepsPerBeat16th = QUANTIZE_RESOLUTION_16TH / 4;
    const subSteps = stepsPerBeat16th;
    for (let i = 1; i < subSteps; i++) {
      const subX = x + (i * beatWidthPx / subSteps);
      if (subX < gridWidth) {
        verticalGridLines.push(
          <div key={`v-sub-${t}-${i}`} className="absolute top-0 bottom-0" style={{ left: `${subX}px`, width: '1px', backgroundColor: GRID_LINE_COLOR, opacity: 0.1, pointerEvents: 'none' }} />
        );
      }
    }
  }

  const horizontalGridLines: JSX.Element[] = [];
  for (let i = 0; i < numVerticalRows; i++) {
    const pitch = (minPitch + numVerticalRows - 1) - i;
    const isBlackKey = [1, 3, 6, 8, 10].includes(pitch % 12);
    horizontalGridLines.push(
      <div key={`h-${i}`} className="absolute left-0 right-0" style={{ top: `${i * ROW_HEIGHT_PX}px`, height: `${ROW_HEIGHT_PX}px`, backgroundColor: isBlackKey ? 'hsl(var(--muted) / 0.3)' : 'transparent', borderBottom: `1px solid ${GRID_LINE_COLOR}`, opacity: 0.2, pointerEvents: 'none' }} />
    );
  }

  const pitchLegendLabels: JSX.Element[] = [];
  for (let i = 0; i < numVerticalRows; i++) {
    const currentPitch = (minPitch + numVerticalRows - 1) - i;
    if (currentPitch > maxPitchToRender || currentPitch < minPitch) continue;

    const noteName = getNoteNameFromPitch(currentPitch);
    const isBlackKey = [1, 3, 6, 8, 10].includes(currentPitch % 12);
    const isOctaveMarker = currentPitch % 12 === 0;
    pitchLegendLabels.push(
      <div
        key={`pitch-label-${currentPitch}`}
        className={cn(
            "flex items-center justify-end pr-2 text-xs",
            isOctaveMarker ? "text-foreground font-semibold" : "text-muted-foreground"
        )}
        style={{
            height: `${ROW_HEIGHT_PX}px`,
            backgroundColor: isBlackKey ? 'hsl(var(--muted) / 0.15)' : 'hsl(var(--card) / 0.1)',
            borderBottom: `1px solid ${GRID_LINE_COLOR}`, opacity: 0.9
        }}
      >
        {noteName}
      </div>
    );
  }

  return (
    <Card className="w-full shadow-xl bg-card flex flex-col h-[600px]">
      <CardHeader className="flex flex-row items-center justify-between py-3 px-4 border-b">
        <CardTitle className="text-lg text-card-foreground">Piano Roll Editor</CardTitle>
        <Button variant="ghost" size="icon" onClick={handleEditorClose} aria-label="Close Editor">
          <XIcon className="h-5 w-5" />
        </Button>
      </CardHeader>
      <CardContent className="p-0 flex-grow flex flex-col overflow-hidden">
        <div className="p-2 border-b flex gap-2 items-center flex-wrap">
          {!isPlaying ? (
            <Button onClick={handlePlayFromEditor} variant="outline" size="sm" disabled={notes.length === 0}>
              <PlayIcon className="mr-2 h-4 w-4" /> Play
            </Button>
          ) : (
            <Button onClick={handleStopFromEditor} variant="destructive" size="sm">
              <SquareIcon className="mr-2 h-4 w-4" /> Stop
            </Button>
          )}
          <Button onClick={handleDeleteSelected} variant="outline" size="sm" disabled={selectedNoteIds.size === 0 || isPlayingRef.current}>
            <Trash2Icon className="mr-2 h-4 w-4" /> Delete
          </Button>
           <Button onClick={() => handleQuantizeSelected(QUANTIZE_RESOLUTION_8TH)} variant="outline" size="sm" disabled={selectedNoteIds.size === 0 || isPlayingRef.current}>
            <SigmaIcon className="mr-2 h-4 w-4" /> Quantize (8th)
          </Button>
          <Button onClick={() => handleQuantizeSelected(QUANTIZE_RESOLUTION_16TH)} variant="outline" size="sm" disabled={selectedNoteIds.size === 0 || isPlayingRef.current}>
            <SigmaIcon className="mr-2 h-4 w-4" /> Quantize (16th)
          </Button>
          <span className="text-xs text-muted-foreground ml-auto">BPM: {bpm}</span>
        </div>
        <ScrollArea className="flex-grow relative">
          <div className="flex h-full">
            <div
              className="bg-card border-r border-border shrink-0 sticky top-0 z-10"
              style={{ width: `${PITCH_LEGEND_WIDTH_PX}px`, height: `${gridHeight}px` }}
            >
              {pitchLegendLabels}
            </div>
            <div className="flex-grow overflow-auto"> 
              <div
                ref={gridRef}
                className="relative select-none bg-background"
                style={{ width: `${gridWidth}px`, height: `${gridHeight}px` }}
                onClick={(e) => { 
                    let currentTarget = e.target as HTMLElement;
                    let isNoteElement = false;
                    while(currentTarget && currentTarget !== gridRef.current && currentTarget !== document.body) {
                        if (currentTarget.hasAttribute('data-midi-note-id')) {
                            isNoteElement = true;
                            break;
                        }
                        currentTarget = currentTarget.parentElement as HTMLElement;
                    }
                    if (!isNoteElement && !interaction) { 
                      setSelectedNoteIds(new Set());
                    }
                }}
                onDoubleClick={handleGridDoubleClick}
              >
                {horizontalGridLines}
                {verticalGridLines}
                {notes.map(note => {
                  if (!note || !note.id) return null;
                  const y = ((minPitch + numVerticalRows - 1) - note.pitch) * ROW_HEIGHT_PX;
                  const x = note.startTime * PIXELS_PER_MS;
                  const width = note.duration * PIXELS_PER_MS;

                  if (note.pitch < minPitch || note.pitch > maxPitchToRender || y < 0 || y >= gridHeight || x > gridWidth + 100 ) {
                    return null; 
                  }

                  const isSelected = selectedNoteIds.has(note.id);
                  return (
                    <div
                      key={note.id}
                      data-midi-note-id={note.id}
                      className={cn(
                          "absolute rounded-sm cursor-grab active:cursor-grabbing flex items-center justify-end",
                          isSelected ? "border-2 border-accent-foreground shadow-md z-10" : "ring-1 ring-foreground/20"
                      )}
                      style={{
                          left: `${x}px`,
                          top: `${y}px`,
                          width: `${Math.max(width, 5)}px`, 
                          height: `${ROW_HEIGHT_PX -2}px`, 
                          backgroundColor: isSelected ? SELECTED_NOTE_COLOR : NOTE_COLOR,
                          opacity: isSelected ? 1 : (note.velocity ? (note.velocity / 127 * 0.6 + 0.4) : 1), 
                          marginTop: '1px' 
                      }}
                      onMouseDown={(e) => handleMouseDownOnNote(note, e, 'move')}
                      onDoubleClick={(e) => handleNoteDoubleClick(note.id!, e)}
                    >
                      <div
                          className="absolute top-0 right-0 bottom-0 w-2 cursor-ew-resize hover:bg-white/30 resize-handle"
                          style={{ zIndex: 1 }} 
                          onMouseDown={(e) => handleMouseDownOnNote(note, e, 'resize')}
                      />
                    </div>
                  );
                })}
                {playbackHeadPositionMs !== null && (
                  <div
                    className="absolute top-0 bottom-0 w-0.5 bg-accent z-20" 
                    style={{
                      left: `${playbackHeadPositionMs * PIXELS_PER_MS}px`,
                      pointerEvents: 'none', 
                    }}
                  />
                )}
              </div>
            </div>
          </div>
        </ScrollArea>
      </CardContent>
      <CardFooter className="p-2 border-t text-xs text-muted-foreground">
        {selectedNoteIds.size > 0 ? `${selectedNoteIds.size} note(s) selected.` : "Click notes to select. Ctrl/Cmd + Click for multi-select. Double-click grid to add, note to delete."}
        {isPlayingRef.current && <span className="ml-auto text-primary font-semibold">Playing...</span>}
      </CardFooter>
    </Card>
  );
};

