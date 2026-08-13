export type MidiEvent = {
  type: string;
  time: number;
  note?: number;
  velocity?: number;
  channel?: number;
  text?: string;
};

export type MidiNote = {
  id: string;
  note: number;
  velocity: number;
  channel: number;
  startTick: number;
  endTick: number;
  startTime: number;
  endTime: number;
};

export type MidiTrackData = {
  index: number;
  name: string;
  notes: MidiNote[];
};

export type ParsedMidi = {
  format: number;
  ppq: number;
  bpm: number;
  duration: number;
  tracks: MidiTrackData[];
};

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

export function midiNoteName(note: number) {
  const octave = Math.floor(note / 12) - 1;
  return `${NOTE_NAMES[note % 12]}${octave}`;
}

function readString(view: DataView, offset: { value: number }, len: number) {
  let str = "";
  for (let i = 0; i < len; i += 1) {
    str += String.fromCharCode(view.getUint8(offset.value++));
  }
  return str;
}

function readVarInt(view: DataView, offset: { value: number }) {
  let val = 0;
  while (true) {
    const b = view.getUint8(offset.value++);
    if (b & 0x80) {
      val = (val << 7) | (b & 0x7f);
    } else {
      return (val << 7) | b;
    }
  }
}

type RawTrackEvent = {
  tick: number;
  type: "noteOn" | "noteOff" | "trackName";
  note?: number;
  velocity?: number;
  channel?: number;
  text?: string;
};

type TempoChange = { tick: number; microsecondsPerQuarter: number };

function ticksToSeconds(tick: number, ppq: number, tempos: TempoChange[]) {
  let seconds = 0;
  let priorTick = 0;
  let currentTempo = tempos[0]?.microsecondsPerQuarter ?? 500_000;

  for (let i = 1; i < tempos.length; i += 1) {
    const change = tempos[i];
    if (change.tick >= tick) break;
    seconds += ((change.tick - priorTick) / ppq) * (currentTempo / 1_000_000);
    priorTick = change.tick;
    currentTempo = change.microsecondsPerQuarter;
  }

  seconds += ((tick - priorTick) / ppq) * (currentTempo / 1_000_000);
  return seconds;
}

function parseRawTracks(data: ArrayBuffer): {
  format: number;
  ppq: number;
  tempos: TempoChange[];
  rawTracks: RawTrackEvent[][];
} {
  const view = new DataView(data);
  const offset = { value: 0 };

  if (readString(view, offset, 4) !== "MThd") {
    throw new Error("Not a MIDI file");
  }

  offset.value += 4;
  const format = view.getUint16(offset.value);
  offset.value += 2;
  const tracksCount = view.getUint16(offset.value);
  offset.value += 2;
  const timeDivision = view.getUint16(offset.value);
  offset.value += 2;

  const ppq = timeDivision & 0x8000 ? 480 : timeDivision;
  const tempos: TempoChange[] = [{ tick: 0, microsecondsPerQuarter: 500_000 }];
  const rawTracks: RawTrackEvent[][] = [];

  for (let trackIndex = 0; trackIndex < tracksCount; trackIndex += 1) {
    if (readString(view, offset, 4) !== "MTrk") {
      continue;
    }

    const trackLen = view.getUint32(offset.value);
    offset.value += 4;
    const trackEnd = offset.value + trackLen;
    const events: RawTrackEvent[] = [];
    let tick = 0;
    let runningStatus = 0;

    while (offset.value < trackEnd) {
      tick += readVarInt(view, offset);
      let status = view.getUint8(offset.value++);

      if (status < 0x80) {
        status = runningStatus;
        offset.value -= 1;
      } else {
        runningStatus = status;
      }

      const type = status & 0xf0;
      const channel = status & 0x0f;

      if (type === 0x90) {
        const note = view.getUint8(offset.value++);
        const velocity = view.getUint8(offset.value++);
        if (velocity > 0) {
          events.push({ tick, type: "noteOn", note, velocity, channel });
        } else {
          events.push({ tick, type: "noteOff", note, velocity: 0, channel });
        }
      } else if (type === 0x80) {
        const note = view.getUint8(offset.value++);
        const velocity = view.getUint8(offset.value++);
        events.push({ tick, type: "noteOff", note, velocity, channel });
      } else if (status === 0xff) {
        const metaType = view.getUint8(offset.value++);
        const metaLen = readVarInt(view, offset);
        if (metaType === 0x51 && metaLen === 3) {
          const microsecondsPerQuarter =
            (view.getUint8(offset.value) << 16)
            | (view.getUint8(offset.value + 1) << 8)
            | view.getUint8(offset.value + 2);
          offset.value += 3;
          tempos.push({ tick, microsecondsPerQuarter });
        } else if (metaType === 0x03) {
          events.push({ tick, type: "trackName", text: readString(view, offset, metaLen) });
        } else if (metaType === 0x01) {
          offset.value += metaLen;
        } else {
          offset.value += metaLen;
        }
      } else if (type === 0xb0 || type === 0xe0) {
        offset.value += 2;
      } else if (type === 0xc0 || type === 0xd0) {
        offset.value += 1;
      }
    }

    rawTracks.push(events);
  }

  tempos.sort((a, b) => a.tick - b.tick);
  return { format, ppq, tempos, rawTracks };
}

function buildNotesFromTrack(events: RawTrackEvent[], ppq: number, tempos: TempoChange[]): MidiNote[] {
  const active = new Map<string, { startTick: number; velocity: number; channel: number }>();
  const notes: MidiNote[] = [];

  for (const event of events) {
    if (event.type === "noteOn" && event.note !== undefined && event.velocity !== undefined && event.channel !== undefined) {
      active.set(`${event.channel}-${event.note}`, {
        startTick: event.tick,
        velocity: event.velocity,
        channel: event.channel,
      });
    } else if (event.type === "noteOff" && event.note !== undefined && event.channel !== undefined) {
      const key = `${event.channel}-${event.note}`;
      const started = active.get(key);
      if (!started) continue;
      active.delete(key);
      const startTime = ticksToSeconds(started.startTick, ppq, tempos);
      const endTime = ticksToSeconds(event.tick, ppq, tempos);
      notes.push({
        id: crypto.randomUUID(),
        note: event.note,
        velocity: started.velocity,
        channel: started.channel,
        startTick: started.startTick,
        endTick: event.tick,
        startTime,
        endTime: Math.max(endTime, startTime + 0.05),
      });
    }
  }

  return notes.sort((a, b) => a.startTime - b.startTime || a.note - b.note);
}

export function parseMidiFile(data: ArrayBuffer): ParsedMidi {
  const { format, ppq, tempos, rawTracks } = parseRawTracks(data);
  const bpm = Math.round(60_000_000 / (tempos[0]?.microsecondsPerQuarter ?? 500_000));

  const tracks = rawTracks.map((events, index) => {
    const nameEvent = events.find((event) => event.type === "trackName");
    const notes = buildNotesFromTrack(events, ppq, tempos);
    return {
      index,
      name: nameEvent?.text?.trim() || `Track ${index + 1}`,
      notes,
    };
  }).filter((track) => track.notes.length > 0 || track.name !== `Track ${track.index + 1}`);

  const allNotes = tracks.flatMap((track) => track.notes);
  const duration = allNotes.length > 0
    ? Math.max(...allNotes.map((note) => note.endTime))
    : 0;

  return {
    format,
    ppq,
    bpm,
    duration: Math.max(duration, 0.1),
    tracks: tracks.length > 0 ? tracks : [{ index: 0, name: "Track 1", notes: [] }],
  };
}

/** @deprecated Use parseMidiFile for full structure; kept for tab import */
export function parseMidi(data: ArrayBuffer): MidiEvent[] {
  const parsed = parseMidiFile(data);
  const events: MidiEvent[] = [];
  for (const track of parsed.tracks) {
    for (const note of track.notes) {
      events.push({
        type: "noteOn",
        time: note.startTick,
        note: note.note,
        velocity: note.velocity,
        channel: note.channel,
      });
    }
  }
  return events.sort((a, b) => a.time - b.time);
}

export function serializeMidiClip(parsed: ParsedMidi) {
  return {
    bpm: parsed.bpm,
    ppq: parsed.ppq,
    duration: parsed.duration,
    tracks: parsed.tracks.map((track) => ({
      index: track.index,
      name: track.name,
      notes: track.notes.map(({ id, note, velocity, channel, startTick, endTick, startTime, endTime }) => ({
        id,
        note,
        velocity,
        channel,
        startTick,
        endTick,
        startTime,
        endTime,
      })),
    })),
  };
}

export type StoredMidiClip = ReturnType<typeof serializeMidiClip>;

export function restoreMidiClip(stored: StoredMidiClip): ParsedMidi {
  return {
    format: 1,
    ppq: stored.ppq,
    bpm: stored.bpm,
    duration: stored.duration,
    tracks: stored.tracks.map((track) => ({
      index: track.index,
      name: track.name,
      notes: track.notes.map((note) => ({ ...note })),
    })),
  };
}
