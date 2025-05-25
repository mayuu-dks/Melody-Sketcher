
import type React from 'react';
import { useState, useEffect, useCallback } from 'react';
import { KeyboardKey } from './keyboard-key';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-is-mobile';
import { useIsPortrait } from '@/hooks/use-orientation';

interface VirtualKeyboardProps {
  octaves?: number;
  startMidiNote?: number; // MIDI note for the first key on the left
  onNoteDown: (midiNote: number) => void;
  onNoteUp: (midiNote: number) => void;
  notesInScaleFilter?: number[]; // Notes from the selected key/scale to highlight or filter by
  selectedScaleType?: string; // e.g., "Major", "Chromatic"
}

const MIDI_NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

interface KeyDetail {
  name: string;
  midiNote: number;
  isBlack: boolean;
}

const getNoteDetails = (midiNote: number): KeyDetail => {
  const octave = Math.floor(midiNote / 12) - 1;
  const noteIndex = midiNote % 12;
  const noteName = MIDI_NOTE_NAMES[noteIndex];
  const isBlack = [1, 3, 6, 8, 10].includes(noteIndex);
  return { name: `${noteName}${octave}`, isBlack, midiNote };
};

export const VirtualKeyboard: React.FC<VirtualKeyboardProps> = ({
  octaves = 2,
  startMidiNote = 48, // Default to C3
  onNoteDown,
  onNoteUp,
  notesInScaleFilter = [],
  selectedScaleType = "Major",
}) => {
  const [pressedKeys, setPressedKeys] = useState<Set<number>>(new Set());
  const [keysToDisplay, setKeysToDisplay] = useState<KeyDetail[]>([]);
  const isMobile = useIsMobile();
  const isPortrait = useIsPortrait();

  useEffect(() => {
    // This local variable is scoped to the useEffect hook
    let calculatedKeysLocal: KeyDetail[] = [];
    
    const effectiveOctaves = selectedScaleType === "Chromatic" ? 1.5 : octaves;
    const effectiveBaseMidiNote = startMidiNote;
    const totalSemitonesToConsider = Math.floor(effectiveOctaves * 12);

    if (selectedScaleType === "Chromatic") {
      // For Chromatic scale, display all notes in the range
      for (let i = 0; i < totalSemitonesToConsider; i++) {
        const currentMidiNote = effectiveBaseMidiNote + i;
        if (currentMidiNote > 127) break; // Stay within MIDI range
        calculatedKeysLocal.push(getNoteDetails(currentMidiNote));
      }
    } else {
      // For other scales, display only notes that are in the notesInScaleFilter
      calculatedKeysLocal = notesInScaleFilter
        .filter(note => note >= effectiveBaseMidiNote && note < (effectiveBaseMidiNote + totalSemitonesToConsider) && note <= 127)
        .map(getNoteDetails)
        .sort((a, b) => a.midiNote - b.midiNote);
    }
    setKeysToDisplay(calculatedKeysLocal);
  }, [octaves, startMidiNote, notesInScaleFilter, selectedScaleType]);

  const handleInteractionStart = useCallback((midiNote: number) => {
    onNoteDown(midiNote);
    setPressedKeys(prev => new Set(prev).add(midiNote));
  }, [onNoteDown]);

  const handleInteractionEnd = useCallback((midiNote: number) => {
    onNoteUp(midiNote);
    setPressedKeys(prev => {
      const newSet = new Set(prev);
      newSet.delete(midiNote);
      return newSet;
    });
  }, [onNoteUp]);

  const displayKeysInTwoRows = isMobile && isPortrait && keysToDisplay.length >= 14;
  const keyboardContainerHeightClass = displayKeysInTwoRows ? "h-80" : "h-40 sm:h-48 md:h-64";

  if (keysToDisplay.length === 0) {
    let message: string;
    // Logic for the message should only use props and state variables available in this scope
    if (selectedScaleType === "Chromatic") {
      message = "Selected octave range for Chromatic scale is invalid or out of bounds. Try adjusting the octave.";
      // Check if a scale lock is active but results in no displayable keys in Chromatic mode
      if (notesInScaleFilter.length > 0 && keysToDisplay.length === 0) {
        message = "No notes from the selected scale lock fall within the current keyboard octave range for Chromatic display. Try adjusting the octave or the scale lock.";
      }
    } else { // For non-Chromatic scales
      if (notesInScaleFilter.length === 0) { // No scale lock defined at all
        message = "Select a key and scale to see notes, or adjust octave.";
      } else { // Scale lock is defined, but no notes from it are in the current octave range
        message = "No notes from the selected scale fall within the current keyboard octave range. Try adjusting the octave.";
      }
    }
    return (
      <div className={cn(
        "flex justify-center items-center bg-card rounded-lg shadow-inner border border-border p-1",
        keyboardContainerHeightClass
      )}>
        <p className="text-muted-foreground p-4 text-center">{message}</p>
      </div>
    );
  }
  
  let firstRowKeys: KeyDetail[] = [];
  let secondRowKeys: KeyDetail[] = [];

  if (displayKeysInTwoRows) {
    const splitIndex = Math.ceil(keysToDisplay.length / 2);
    firstRowKeys = keysToDisplay.slice(0, splitIndex);
    secondRowKeys = keysToDisplay.slice(splitIndex);
  } else {
    firstRowKeys = keysToDisplay;
  }

  const renderKey = (keyDetail: KeyDetail) => (
    <KeyboardKey
      key={keyDetail.midiNote}
      noteName={keyDetail.name}
      midiNote={keyDetail.midiNote}
      isBlack={keyDetail.isBlack}
      isPressed={pressedKeys.has(keyDetail.midiNote)}
      isInScale={
        selectedScaleType === "Chromatic" 
          ? notesInScaleFilter.includes(keyDetail.midiNote) // Chromatic highlights based on filter
          : true // Non-chromatic keys are already filtered, so they are always "in scale" if displayed
      }
      onMouseDown={handleInteractionStart}
      onMouseUp={handleInteractionEnd}
      onTouchStart={handleInteractionStart}
      onTouchEnd={handleInteractionEnd}
    />
  );

  return (
    <div
      className={cn(
        "w-full bg-secondary rounded-lg shadow-lg select-none touch-manipulation overflow-hidden border border-foreground/10 p-1",
        keyboardContainerHeightClass
      )}
      role="application"
      aria-label="Virtual Piano Keyboard"
    >
      {displayKeysInTwoRows ? (
        <div className="flex flex-col h-full w-full gap-1">
          <div className="relative flex h-1/2 w-full gap-1">
            {firstRowKeys.map(renderKey)}
          </div>
          <div className="relative flex h-1/2 w-full gap-1">
            {secondRowKeys.map(renderKey)}
          </div>
        </div>
      ) : (
        <div className="relative flex h-full w-full gap-1">
          {firstRowKeys.map(renderKey)}
        </div>
      )}
    </div>
  );
};
