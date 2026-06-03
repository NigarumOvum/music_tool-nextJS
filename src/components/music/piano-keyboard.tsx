"use client";

import { useEffect, useState } from "react";

const WHITE_KEYS = ["C", "D", "E", "F", "G", "A", "B"];
const BLACK_KEYS = ["C#", "D#", "F#", "G#", "A#"];

interface PianoKeyboardProps {
  onNotePlay?: (note: string) => void;
  activeNotes?: string[];
  octave?: number;
}

export function PianoKeyboard({ onNotePlay, activeNotes = [], octave = 4 }: PianoKeyboardProps) {
  const [pressedKey, setPressedKey] = useState<string | null>(null);

  const isNoteActive = (note: string) => activeNotes.includes(note);

  const handleNote = (note: string) => {
    setPressedKey(note);
    onNotePlay?.(note);
    setTimeout(() => setPressedKey(null), 150);
  };

  return (
    <div className="flex select-none justify-center">
      <div className="relative flex h-48 w-full max-w-2xl bg-zinc-950 rounded-2xl p-2 shadow-2xl border border-white/5">
        <div className="flex w-full gap-[2px]">
          {WHITE_KEYS.map((note) => (
            <div
              key={note}
              onClick={() => handleNote(note)}
              className={`relative flex-1 rounded-sm transition-all duration-75 cursor-pointer ${
                isNoteActive(note) 
                  ? "bg-[var(--color-copper)]" 
                  : pressedKey === note 
                    ? "bg-zinc-200" 
                    : "bg-white"
              } shadow-[inset_0_-5px_0_rgba(0,0,0,0.1)] hover:bg-zinc-100 active:translate-y-[2px] active:shadow-none`}
            >
              <span className="absolute bottom-2 left-1/2 -translate-x-1/2 text-[10px] font-bold text-zinc-400">
                {note}
              </span>
            </div>
          ))}
        </div>
        
        {/* Black keys overlaid */}
        <div className="absolute inset-x-2 top-2 h-28 pointer-events-none">
          <div className="relative flex w-full h-full gap-[2px]">
             {/* Spacing logic for black keys */}
             {[
               { note: "C#", left: "9%" },
               { note: "D#", left: "23%" },
               { note: "F#", left: "52%" },
               { note: "G#", left: "66%" },
               { note: "A#", left: "80%" },
             ].map((key) => (
               <div
                 key={key.note}
                 onClick={(e) => { e.stopPropagation(); handleNote(key.note); }}
                 className={`absolute w-[10%] h-full rounded-sm pointer-events-auto transition-all duration-75 cursor-pointer ${
                    isNoteActive(key.note)
                      ? "bg-[var(--color-copper)] border-2 border-white/20"
                      : pressedKey === key.note
                        ? "bg-zinc-700"
                        : "bg-zinc-900"
                 } shadow-[0_4px_8px_rgba(0,0,0,0.5)] active:translate-y-[2px] border border-white/5`}
                 style={{ left: key.left }}
               >
                 <span className="absolute bottom-2 left-1/2 -translate-x-1/2 text-[8px] font-bold text-zinc-600">
                   {key.note}
                 </span>
               </div>
             ))}
          </div>
        </div>
      </div>
    </div>
  );
}
