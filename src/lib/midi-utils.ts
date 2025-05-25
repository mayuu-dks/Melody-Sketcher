import type { ScaleItem, KeyItem } from '@/constants/scales';

export interface MidiNote {
  pitch: number; // MIDI note number (0-127)
  startTime: number; // in milliseconds, relative to start of recording
  duration: number; // in milliseconds
  velocity?: number; // 0-127, default 100
}

export function getNotesInScaleForKey(key: KeyItem, scale: ScaleItem): number[] {
  const notesInScale: number[] = [];
  const rootNoteInOctave0 = key.rootMidiNote % 12; 

  for (let oct = 0; oct < 10; oct++) { // Cover MIDI range 0-119 approx.
    scale.intervals.forEach(interval => {
      const note = rootNoteInOctave0 + interval + (oct * 12);
      if (note <= 127) { // Max MIDI note
        notesInScale.push(note);
      }
    });
  }
  return [...new Set(notesInScale)].sort((a, b) => a - b); // Unique and sorted
}

// Constants for MIDI file generation
const HEADER_CHUNK_TYPE = [0x4d, 0x54, 0x68, 0x64]; // MThd
const HEADER_CHUNK_LENGTH = [0x00, 0x00, 0x00, 0x06]; // 6 bytes
const FORMAT_0 = [0x00, 0x00]; // Single track
const NUMBER_OF_TRACKS = [0x00, 0x01]; // 1 track
const DEFAULT_TICKS_PER_QUARTER_NOTE = 96; // Common value
const TICKS_PER_QUARTER_NOTE_BYTES = [
    (DEFAULT_TICKS_PER_QUARTER_NOTE >> 8) & 0xff,
    DEFAULT_TICKS_PER_QUARTER_NOTE & 0xff
];


const TRACK_CHUNK_TYPE = [0x4d, 0x54, 0x72, 0x6b]; // MTrk
const META_EVENT_PREFIX = 0xff;
const END_OF_TRACK_EVENT = [META_EVENT_PREFIX, 0x2f, 0x00];

function toVariableLengthQuantity(value: number): number[] {
  if (value === 0) return [0x00];
  
  let buffer = value;
  const bytes = [];
  
  bytes.push(buffer & 0x7F);
  buffer >>= 7;
  
  while (buffer > 0) {
    bytes.push((buffer & 0x7F) | 0x80);
    buffer >>= 7;
  }
  
  return bytes.reverse();
}


export function generateMidiFile(notes: MidiNote[], ticksPerQuarterNote: number = DEFAULT_TICKS_PER_QUARTER_NOTE, bpm: number = 120): Uint8Array {
  const trackEvents: number[] = [];
  let lastTimeTicks = 0;

  // Sort notes by start time, then by pitch (for tie-breaking, though not strictly necessary here)
  const sortedNotes = [...notes].sort((a, b) => {
    if (a.startTime !== b.startTime) {
      return a.startTime - b.startTime;
    }
    return a.pitch - b.pitch;
  });
  
  // Calculate ticks per millisecond
  // (BPM / 60) = quarter notes per second
  // ticksPerQuarterNote * (BPM / 60) = ticks per second
  // (ticksPerQuarterNote * (BPM / 60)) / 1000 = ticks per millisecond
  const ticksPerMillisecond = (ticksPerQuarterNote * (bpm / 60)) / 1000;

  const scheduledEvents: { timeTicks: number, type: 'on' | 'off', pitch: number, velocity: number }[] = [];

  sortedNotes.forEach(note => {
    const startTimeTicks = Math.round(note.startTime * ticksPerMillisecond);
    const durationTicks = Math.round(note.duration * ticksPerMillisecond);
    const endTimeTicks = startTimeTicks + durationTicks;
    const velocity = note.velocity || 100;

    scheduledEvents.push({ timeTicks: startTimeTicks, type: 'on', pitch: note.pitch, velocity });
    scheduledEvents.push({ timeTicks: endTimeTicks, type: 'off', pitch: note.pitch, velocity: 0 }); // Velocity 0 for note off
  });

  // Sort all events by time
  scheduledEvents.sort((a,b) => a.timeTicks - b.timeTicks);

  scheduledEvents.forEach(event => {
    const deltaTime = event.timeTicks - lastTimeTicks;
    trackEvents.push(...toVariableLengthQuantity(deltaTime));
    if (event.type === 'on') {
      trackEvents.push(0x90, event.pitch, event.velocity); // Channel 0 Note On
    } else {
      trackEvents.push(0x80, event.pitch, event.velocity); // Channel 0 Note Off
    }
    lastTimeTicks = event.timeTicks;
  });


  // End of Track event
  trackEvents.push(...toVariableLengthQuantity(0)); // Delta time 0 for EOT
  trackEvents.push(...END_OF_TRACK_EVENT);

  const trackChunkLength = trackEvents.length;
  const trackChunkLengthBytes = [
    (trackChunkLength >> 24) & 0xff,
    (trackChunkLength >> 16) & 0xff,
    (trackChunkLength >> 8) & 0xff,
    trackChunkLength & 0xff,
  ];

  const divisionBytes = [
    (ticksPerQuarterNote >> 8) & 0xff,
    ticksPerQuarterNote & 0xff
  ];

  const midiData = [
    ...HEADER_CHUNK_TYPE,
    ...HEADER_CHUNK_LENGTH,
    ...FORMAT_0,
    ...NUMBER_OF_TRACKS,
    ...divisionBytes,
    ...TRACK_CHUNK_TYPE,
    ...trackChunkLengthBytes,
    ...trackEvents,
  ];

  return new Uint8Array(midiData);
}
