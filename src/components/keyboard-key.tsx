import type React from 'react';
import { cn } from '@/lib/utils';

interface KeyboardKeyProps {
  noteName: string;
  midiNote: number;
  isBlack: boolean;
  isPressed: boolean;
  isInScale: boolean;
  onMouseDown: (midiNote: number) => void;
  onMouseUp: (midiNote: number) => void;
  onTouchStart: (midiNote: number) => void;
  onTouchEnd: (midiNote: number) => void;
  onPointerDown?: (midiNote: number) => void;
  onPointerUp?: (midiNote: number) => void;
  // slotBasisCount is no longer needed for width calculation here
}

export const KeyboardKey: React.FC<KeyboardKeyProps> = ({
  noteName,
  midiNote,
  isBlack,
  isPressed,
  isInScale,
  onMouseDown,
  onMouseUp,
  onTouchStart,
  onTouchEnd,
  onPointerDown,
  onPointerUp,
}) => {
  const keyBaseClasses = 'relative flex items-end justify-center select-none h-full shrink-0 ring-1 ring-inset rounded-md';
  
  let colorClasses = isBlack ? 'bg-foreground text-background' : 'bg-card text-card-foreground';
  let ringColorClass = 'ring-border'; 

  if (isInScale && !isPressed) {
    colorClasses = isBlack ? 'bg-accent/70 text-accent-foreground' : 'bg-accent/30 text-foreground';
    ringColorClass = 'ring-accent'; 
  }
  
  if (isPressed) {
    colorClasses = 'bg-primary text-primary-foreground brightness-110';
    ringColorClass = 'ring-primary'; 
  }

  return (
    <button
      type="button"
      onMouseDown={(e) => { e.preventDefault(); onMouseDown(midiNote);}}
      onMouseUp={(e) => { e.preventDefault(); onMouseUp(midiNote);}}
      onMouseLeave={(e) => {e.preventDefault(); if(isPressed) onMouseUp(midiNote);}} 
      onTouchStart={(e) => { e.preventDefault(); onTouchStart(midiNote); }}
      onTouchEnd={(e) => { e.preventDefault(); onTouchEnd(midiNote); }}
      onPointerDown={(e) => { e.preventDefault(); onPointerDown?.(midiNote); }}
      onPointerUp  ={(e) => { e.preventDefault(); onPointerUp  ?. (midiNote); }}
      className={cn(
        keyBaseClasses,
        'flex-1', // Added flex-1 for responsive width
        colorClasses,
        ringColorClass,
        'rounded-md' // Ensure rounding is applied
      )}
      // Removed style={{ width: `calc(100% / ${slotBasisCount})` }}
      aria-label={noteName}
      data-midi-note={midiNote}
    >
      <span className={cn(
          'text-[0.6rem] sm:text-xs pointer-events-none select-none pb-1',
          isPressed ? 'text-primary-foreground' : 
          (isInScale && isBlack && !isPressed) ? 'text-accent-foreground' : 
          (isBlack ? 'text-background' : 'text-foreground')
        )}
      >
        {noteName.replace(/[0-9#b]/g, '')}
      </span>
    </button>
  );
};
