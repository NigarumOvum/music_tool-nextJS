"use client";

import { createContext, useContext, useRef, ReactNode } from "react";

interface AudioContextType {
  getAudioContext: () => AudioContext;
}

const AudioContextInstance = createContext<AudioContextType | null>(null);

export function AudioProvider({ children }: { children: ReactNode }) {
  const audioContextRef = useRef<AudioContext | null>(null);

  const getAudioContext = () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (audioContextRef.current.state === "suspended") {
      void audioContextRef.current.resume();
    }
    return audioContextRef.current;
  };

  return (
    <AudioContextInstance.Provider value={{ getAudioContext }}>
      {children}
    </AudioContextInstance.Provider>
  );
}

export const useAudio = () => {
  const context = useContext(AudioContextInstance);
  if (!context) throw new Error("useAudio must be used within AudioProvider");
  return context;
};
