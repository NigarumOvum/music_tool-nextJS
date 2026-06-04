export type MidiEvent = {
  type: string;
  time: number;
  note?: number;
  velocity?: number;
  channel?: number;
  text?: string;
};

export function parseMidi(data: ArrayBuffer): MidiEvent[] {
  const view = new DataView(data);
  let offset = 0;

  const readString = (len: number) => {
    let str = "";
    for (let i = 0; i < len; i++) str += String.fromCharCode(view.getUint8(offset++));
    return str;
  };

  const readVarInt = () => {
    let val = 0;
    while (true) {
      const b = view.getUint8(offset++);
      if (b & 0x80) {
        val = (val << 7) | (b & 0x7f);
      } else {
        return (val << 7) | b;
      }
    }
  };

  if (readString(4) !== "MThd") throw new Error("Not a MIDI file");
  offset += 4; // skip length
  const format = view.getUint16(offset); offset += 2;
  const tracksCount = view.getUint16(offset); offset += 2;
  const timeDivision = view.getUint16(offset); offset += 2;

  const events: MidiEvent[] = [];

  for (let i = 0; i < tracksCount; i++) {
    if (readString(4) !== "MTrk") {
        // Skip till next MTrk or end
        continue;
    }
    const trackLen = view.getUint32(offset); offset += 4;
    const trackEnd = offset + trackLen;
    let tick = 0;
    let runningStatus = 0;

    while (offset < trackEnd) {
      tick += readVarInt();
      let status = view.getUint8(offset++);

      if (status < 0x80) {
        status = runningStatus;
        offset--;
      } else {
        runningStatus = status;
      }

      const type = status & 0xf0;
      const channel = status & 0x0f;

      if (type === 0x80 || type === 0x90) {
        const note = view.getUint8(offset++);
        const velocity = view.getUint8(offset++);
        events.push({
          type: type === 0x90 && velocity > 0 ? "noteOn" : "noteOff",
          time: tick,
          note,
          velocity,
          channel,
        });
      } else if (status === 0xff) {
        const metaType = view.getUint8(offset++);
        const metaLen = readVarInt();
        if (metaType === 0x01 || metaType === 0x03) {
            events.push({ type: "text", time: tick, text: readString(metaLen) });
        } else {
            offset += metaLen;
        }
      } else if (type === 0xb0 || type === 0xe0) {
        offset += 2;
      } else if (type === 0xc0 || type === 0xd0) {
        offset += 1;
      }
    }
  }

  return events.sort((a, b) => a.time - b.time);
}
