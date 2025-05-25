
export type ScaleItem = { name: string; intervals: number[] };
export type KeyItem = { name: string; rootMidiNote: number };

export const SCALES: ScaleItem[] = [
  { name: "Major", intervals: [0, 2, 4, 5, 7, 9, 11] },
  { name: "Minor (Natural)", intervals: [0, 2, 3, 5, 7, 8, 10] }, // Also Aeolian
  { name: "Minor (Harmonic)", intervals: [0, 2, 3, 5, 7, 8, 11] },
  { name: "Minor (Melodic)", intervals: [0, 2, 3, 5, 7, 9, 11] },
  { name: "Dorian", intervals: [0, 2, 3, 5, 7, 9, 10] },
  { name: "Phrygian", intervals: [0, 1, 3, 5, 7, 8, 10] },
  { name: "Lydian", intervals: [0, 2, 4, 6, 7, 9, 11] },
  { name: "Mixolydian", intervals: [0, 2, 4, 5, 7, 9, 10] },
  { name: "Locrian", intervals: [0, 1, 3, 5, 6, 8, 10] },
  { name: "Pentatonic Major", intervals: [0, 2, 4, 7, 9] },
  { name: "Pentatonic Minor", intervals: [0, 3, 5, 7, 10] },
  { name: "Blues", intervals: [0, 3, 5, 6, 7, 10] },
  { name: "Whole Tone", intervals: [0, 2, 4, 6, 8, 10] },
  { name: "Diminished (Half-Whole)", intervals: [0, 1, 3, 4, 6, 7, 9, 10] }, // Starts with a half step
  { name: "Lydian Dominant", intervals: [0, 2, 4, 6, 7, 9, 10] }, // Lydian with a b7
  { name: "Chromatic", intervals: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] },
];

export const KEYS: KeyItem[] = [
  { name: "C", rootMidiNote: 48 }, // C3
  { name: "C# / Db", rootMidiNote: 49 },
  { name: "D", rootMidiNote: 50 },
  { name: "D# / Eb", rootMidiNote: 51 },
  { name: "E", rootMidiNote: 52 },
  { name: "F", rootMidiNote: 53 },
  { name: "F# / Gb", rootMidiNote: 54 },
  { name: "G", rootMidiNote: 55 },
  { name: "G# / Ab", rootMidiNote: 56 },
  { name: "A", rootMidiNote: 57 },
  { name: "A# / Bb", rootMidiNote: 58 },
  { name: "B", rootMidiNote: 59 },
];

export const DEFAULT_SCALE = SCALES.find(s => s.name === "Major")!;
export const DEFAULT_KEY = KEYS.find(k => k.name === "C")!;
