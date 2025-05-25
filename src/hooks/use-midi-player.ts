
"use client";
import { useState, useEffect, useCallback, useRef } from 'react';
import type { MidiNote } from '@/lib/midi-utils';
import * as Tone from 'tone';

interface UseMidiPlayerProps {
  onNotePlayed?: (pitch: number, velocity: number) => void;
}

export function useMidiPlayer({ onNotePlayed }: UseMidiPlayerProps = {}) {
  const synthRef = useRef<Tone.PolySynth | null>(null);
  const activeNotesRef = useRef<Map<number, { startTime: number }>>(new Map());
  const [recordedNotes, setRecordedNotes] = useState<MidiNote[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const recordingStartTimeRef = useRef<number | null>(null);

  const metronomeSynthRef = useRef<Tone.Synth | null>(null);
  const metronomeScheduleIdRef = useRef<number | null>(null);

  const playbackPartRef = useRef<Tone.Part<MidiNote> | null>(null);
  const onStopCallbackRef = useRef<(() => void) | null>(null);
  const transportStopEventIdRef = useRef<number | null>(null);


  useEffect(() => {
    try {
      const polySynth = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: "triangle" },
        envelope: {
          attack: 0.02,
          decay: 0.1,
          sustain: 0.3,
          release: 0.5,
        },
      }).toDestination();
      synthRef.current = polySynth;

      metronomeSynthRef.current = new Tone.Synth({
        oscillator: { type: 'sine' },
        envelope: {
          attack: 0.001,
          decay: 0.05,
          sustain: 0,
          release: 0.05,
        },
        volume: -10, // Quieter metronome
      }).toDestination();
      
      if (Tone.Transport.bpm.value !== 120) {
         Tone.Transport.bpm.value = 120;
      }

      playbackPartRef.current = new Tone.Part<MidiNote>((time, event) => {
        if (!synthRef.current || !event || typeof event.pitch !== 'number' || isNaN(event.pitch) || typeof event.duration !== 'number' || isNaN(event.duration) || event.duration <=0) {
            console.warn("Playback: Skipping invalid note event", event);
            return;
        }
        try {
          const freq = Tone.Frequency(event.pitch, "midi").toFrequency();
          if (isNaN(freq)) {
            console.error("Playback: Calculated frequency is NaN for pitch", event.pitch);
            return;
          }
          const normalizedVelocity = (event.velocity || 100) / 127;
          synthRef.current.triggerAttackRelease(freq, event.duration, time, normalizedVelocity);
        } catch (e) {
          console.error("Error in playback part callback:", e, event);
        }
      }, []); 
      playbackPartRef.current.loop = false;
    } catch (error) {
      console.error("Error initializing Tone.js components in useMidiPlayer useEffect:", error);
    }


    return () => {
      synthRef.current?.dispose();
      metronomeSynthRef.current?.dispose();
      if (playbackPartRef.current) {
        playbackPartRef.current.dispose();
      }
      if (metronomeScheduleIdRef.current !== null) {
        Tone.Transport.clear(metronomeScheduleIdRef.current);
      }
      if (transportStopEventIdRef.current !== null) {
        Tone.Transport.off('stop', transportStopEventIdRef.current);
      }
      // Try to stop and cancel transport only if it was started by this hook's instance
      // or if a general cleanup is needed and it's running.
      if (Tone.Transport.state === 'started') {
        try {
          Tone.Transport.stop();
          Tone.Transport.cancel(0);
        } catch (e) {
          // console.error("Error stopping/cancelling transport on cleanup:", e);
          // It's possible another part of the app controls transport, so be gentle.
        }
      }
    };
  }, []);

  const playNote = useCallback((pitch: number, velocity: number = 100) => {
    console.log(`playNote called. Pitch: ${pitch}, Tone.context.state: ${Tone.context.state}`);
    if (typeof pitch !== 'number' || isNaN(pitch)) {
      console.error("playNote called with invalid pitch:", pitch);
      return;
    }
    if (!synthRef.current) {
      console.warn("playNote: Synth not initialized.");
      return;
    }
    if (Tone.context.state !== 'running') {
      console.warn("playNote: AudioContext not running. Please initialize audio by clicking the 'Initialize Audio' button.");
      return; 
    }

    try {
      const freq = Tone.Frequency(pitch, "midi").toFrequency();
      if (isNaN(freq)) {
        console.error(`playNote: Calculated frequency is NaN for pitch ${pitch}`);
        return;
      }
      const normalizedVelocity = velocity / 127;
      synthRef.current.triggerAttack(freq, Tone.now(), normalizedVelocity);

      if (isRecording && recordingStartTimeRef.current !== null) {
        if (!activeNotesRef.current.has(pitch)) {
          const startTime = performance.now() - recordingStartTimeRef.current;
          activeNotesRef.current.set(pitch, { startTime });
        }
      }
      onNotePlayed?.(pitch, velocity);
    } catch (error) {
      console.error("Error in playNote triggerAttack:", error, { pitch, velocity });
    }
  }, [isRecording, onNotePlayed]);

  const stopNote = useCallback((pitch: number) => {
    if (typeof pitch !== 'number' || isNaN(pitch)) {
      console.error("stopNote called with invalid pitch:", pitch);
      return;
    }
    if (!synthRef.current) {
      console.warn("stopNote: Synth not initialized.");
      return;
    }
    if (Tone.context.state !== 'running') {
      // No warning here, as this can happen if context was not started or stopped.
      return;
    }
    
    try {
      const freq = Tone.Frequency(pitch, "midi").toFrequency();
       if (isNaN(freq)) {
        console.error(`stopNote: Calculated frequency is NaN for pitch ${pitch}`);
        return;
      }
      synthRef.current.triggerRelease(freq, Tone.now());

      if (isRecording && recordingStartTimeRef.current !== null && activeNotesRef.current.has(pitch)) {
        const noteRecordInfo = activeNotesRef.current.get(pitch)!;
        const duration = (performance.now() - recordingStartTimeRef.current!) - noteRecordInfo.startTime;
        const id = crypto.randomUUID();
        if (duration > 50) { 
          setRecordedNotes(prev => [...prev, { id, pitch, startTime: noteRecordInfo.startTime, duration, velocity: 100 }].sort((a,b) => a.startTime - b.startTime));
        }
        activeNotesRef.current.delete(pitch);
      }
    } catch (error) {
      console.error("Error in stopNote triggerRelease:", error, { pitch });
    }
  }, [isRecording]);

  const startRecording = useCallback(async () => {
    if (Tone.context.state !== 'running') {
      console.warn("Cannot start recording: AudioContext not running. Please initialize audio.");
      // Optionally, try to start it, but this must be user-initiated on iOS
      // await Tone.start().catch(e => console.error("Failed to start audio for recording:", e));
      // if (Tone.context.state !== 'running') return; // Exit if still not running
      return; // Prefer explicit initialization
    }
    setIsRecording(true);
    setRecordedNotes([]); 
    activeNotesRef.current.clear();
    recordingStartTimeRef.current = performance.now();
  }, []);

  const stopRecording = useCallback(() => {
    setIsRecording(false);
    if (recordingStartTimeRef.current !== null) {
        const now = performance.now();
        const newNotesBatch: MidiNote[] = [];
        activeNotesRef.current.forEach(({startTime}, pitchValue) => {
            const duration = now - recordingStartTimeRef.current! - startTime;
            if (duration > 50) { 
              const id = crypto.randomUUID();
              newNotesBatch.push({ id, pitch: pitchValue, startTime, duration, velocity: 100 });
            }
        });
        activeNotesRef.current.clear();
        
        if (newNotesBatch.length > 0) {
            setRecordedNotes(prev => [...prev, ...newNotesBatch].sort((a,b) => a.startTime - b.startTime));
        }
    }
    recordingStartTimeRef.current = null;
  }, []);


  const playback = useCallback(async (notesToPlayInput?: MidiNote[], onPlaybackStopped?: () => void) => {
    const notesForPlayback = notesToPlayInput || recordedNotes;
    const validNotesForPart = notesForPlayback.filter(note =>
        note && typeof note.id === 'string' &&
        typeof note.pitch === 'number' && !isNaN(note.pitch) &&
        typeof note.startTime === 'number' && !isNaN(note.startTime) &&
        typeof note.duration === 'number' && !isNaN(note.duration) && note.duration > 0
    );

    if (!synthRef.current || !playbackPartRef.current) {
      console.warn("Playback: Synth or PlaybackPart not initialized.");
      if (onPlaybackStopped) setTimeout(onPlaybackStopped, 10); // Defer callback
      return;
    }
    if (validNotesForPart.length === 0) {
      console.log("Playback: No valid notes to play.");
      if (onPlaybackStopped) setTimeout(onPlaybackStopped, 10); // Defer callback
      return;
    }
  
    if (Tone.context.state !== 'running') {
      console.warn("Playback: AudioContext not running. Attempting to start.");
      try {
        await Tone.start();
        console.log("Playback: Tone.start() successful.");
      } catch (e) {
        console.error("Playback: Failed to start audio context for playback:", e);
        if (onPlaybackStopped) setTimeout(onPlaybackStopped, 10); // Defer callback
        return;
      }
    }
  
    if (Tone.Transport.state === 'started') {
      Tone.Transport.stop();
    }
    Tone.Transport.cancel(0);
    playbackPartRef.current.clear();
  
    let maxEndTimeSec = 0;
    validNotesForPart.forEach(note => {
      const durationSec = Math.max(0.01, note.duration / 1000); 
      const startTimeSec = note.startTime / 1000;
      
      playbackPartRef.current!.add(startTimeSec, { 
        ...note, 
        duration: durationSec 
      });
      maxEndTimeSec = Math.max(maxEndTimeSec, startTimeSec + durationSec);
    });
    
    playbackPartRef.current.loop = false;
    Tone.Transport.position = 0;
  
    // Clear previous stop listener if any
    if (transportStopEventIdRef.current !== null) {
      Tone.Transport.off('stop', transportStopEventIdRef.current);
      transportStopEventIdRef.current = null;
    }
    if (onStopCallbackRef.current) { // Clear any stale callback reference
        onStopCallbackRef.current = null;
    }

    // Schedule the transport to stop slightly after the last note
    const transportStopTime = Math.max(0.05, maxEndTimeSec + 0.1); 
    Tone.Transport.scheduleOnce(() => {
        if (Tone.Transport.state === 'started') {
            Tone.Transport.stop(); 
        }
    }, transportStopTime); 

    // Set up the new onStop callback and listener
    if (onPlaybackStopped) {
        onStopCallbackRef.current = onPlaybackStopped; // Store the fresh callback
        transportStopEventIdRef.current = Tone.Transport.on('stop', () => {
            if (onStopCallbackRef.current) {
                onStopCallbackRef.current(); // Call the stored callback
                onStopCallbackRef.current = null; // Clear it after use
            }
            // Ensure the event listener itself is also cleaned up to prevent duplicates
            if (transportStopEventIdRef.current !== null) {
                Tone.Transport.off('stop', transportStopEventIdRef.current); 
                transportStopEventIdRef.current = null;
            }
        });
    }

    console.log("Playback: Starting transport and part.");
    Tone.Transport.start(Tone.now() + 0.05); 
    playbackPartRef.current.start(0); 
    
  }, [recordedNotes]);


  const stopPlayback = useCallback(() => {
    console.log("stopPlayback called. Tone.Transport.state:", Tone.Transport.state);
    if (Tone.Transport.state === 'started') {
      Tone.Transport.stop(); // This will trigger the 'stop' event listener if one is set
    } else {
      // If transport wasn't started, but we need to signal a stop (e.g. UI initiated)
      if (onStopCallbackRef.current) {
        onStopCallbackRef.current();
        onStopCallbackRef.current = null;
      }
      if (transportStopEventIdRef.current !== null) {
        Tone.Transport.off('stop', transportStopEventIdRef.current);
        transportStopEventIdRef.current = null;
      }
    }
    // Ensure the part is cleared of notes regardless of transport state
    playbackPartRef.current?.clear();
    // Release any sounding notes from the synth directly
    synthRef.current?.releaseAll(Tone.now());
  }, []);


  const clearRecording = useCallback(() => {
    setRecordedNotes([]);
  }, []);

  const startMetronome = useCallback(async (bpm: number) => {
    if (!metronomeSynthRef.current) {
      console.warn("Metronome synth not initialized.");
      return;
    }
    if (Tone.context.state !== 'running') {
       console.warn("Metronome: AudioContext not running. Attempting to start.");
      try {
        await Tone.start();
         console.log("Metronome: Tone.start() successful.");
      } catch (e) {
        console.error("Metronome: Failed to start audio context for metronome:", e);
        return;
      }
    }

    Tone.Transport.bpm.value = bpm;

    if (metronomeScheduleIdRef.current !== null) {
        Tone.Transport.clear(metronomeScheduleIdRef.current);
    }
    
    // If metronome starts, ensure any playback part is cleared to avoid conflict
    if (Tone.Transport.state !== 'started') {
        playbackPartRef.current?.clear(); 
    }


    metronomeScheduleIdRef.current = Tone.Transport.scheduleRepeat(
      (time) => {
        if (metronomeSynthRef.current && Tone.context.state === 'running') {
          metronomeSynthRef.current?.triggerAttackRelease('C6', '32n', time);
        }
      },
      '4n' // Every quarter note
    );

    if (Tone.Transport.state !== 'started') {
      console.log("Metronome: Starting transport for metronome.");
      Tone.Transport.start();
    }
  }, []);

  const stopMetronome = useCallback(() => {
    if (metronomeScheduleIdRef.current !== null) {
      Tone.Transport.clear(metronomeScheduleIdRef.current);
      metronomeScheduleIdRef.current = null;
      console.log("Metronome stopped and schedule cleared.");
      // Consider stopping transport only if nothing else (like playback) is using it.
      // For now, let's assume metronome stop doesn't auto-stop transport.
    }
  }, []);

  return {
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
  };
}

// This function is now part of page.tsx (handleInitializeAudio -> ensureAudioContextStartedAndPrime)
// export const ensureAudioContextStarted = async () => { ... };

    