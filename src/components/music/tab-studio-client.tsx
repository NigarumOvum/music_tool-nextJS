"use client";

import { useMemo, useRef, useState } from "react";

import { Button, Chip } from "@heroui/react";
import { Download, Play, Plus, Upload } from "lucide-react";

import { downloadBlob } from "@/lib/music/client";

type TabFile = {
  id: string;
  name: string;
  extension: string;
  preview: string;
  markers: string[];
  size: number;
};

function extractMarkers(content: string) {
  return content
    .split(/\r?\n/)
    .filter((line) => /^\[.*\]$|^(verse|chorus|bridge|intro|outro)/i.test(line.trim()))
    .slice(0, 12);
}

function makeEmptyGrid() {
  return ["E", "A", "D", "G", "B", "e"].map((label) => ({ label, cells: Array.from({ length: 8 }, () => "-") }));
}

export function TabStudioClient() {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [files, setFiles] = useState<TabFile[]>([]);
  const [activeFileId, setActiveFileId] = useState("");
  const [grid, setGrid] = useState(makeEmptyGrid());

  const activeFile = useMemo(() => files.find((file) => file.id === activeFileId) || null, [activeFileId, files]);

  function importFiles(fileList: FileList | null) {
    if (!fileList) {
      return;
    }

    void Promise.all(Array.from(fileList).map(async (file) => {
      const preview = await file.text().catch(() => "Binary preview unavailable for this file type.");
      return {
        id: crypto.randomUUID(),
        name: file.name,
        extension: file.name.split(".").pop()?.toLowerCase() || "",
        preview,
        markers: extractMarkers(preview),
        size: file.size,
      } satisfies TabFile;
    })).then((next) => {
      setFiles((current) => [...current, ...next]);
      if (!activeFileId && next[0]) {
        setActiveFileId(next[0].id);
      }
    });
  }

  function addStep() {
    setGrid((current) => current.map((row) => ({ ...row, cells: [...row.cells, "-"] })));
  }

  function exportTabText() {
    const lines = grid.map((row) => `${row.label}|-${row.cells.join("-")}-|`);
    downloadBlob("tab-export.txt", lines.join("\n"), "text/plain");
  }

  function exportMidiMetadata() {
    const parts = grid.map((row) => ({
      stringLabel: row.label,
      notes: row.cells.filter((cell) => /^\d+$/.test(cell)).map((cell, index) => ({ step: index + 1, fret: Number(cell) })),
    }));
    downloadBlob("tab-midi-score.json", JSON.stringify({ bpm: 110, parts }, null, 2));
  }

  return (
    <div className="space-y-6">
      <div className="panel rounded-[1.75rem] p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="eyebrow">Guitar Pro like intake</div>
            <h2 className="mt-2 text-3xl font-black">Tab library</h2>
          </div>
          <div className="flex gap-2">
            <input ref={inputRef} className="hidden" type="file" multiple accept=".gp,.gp3,.gp4,.gp5,.gpx,.ptb,.xml,.musicxml,.mxl,.mid,.midi,.tab,.txt" onChange={(event) => importFiles(event.target.files)} />
            <Button className="bg-[var(--color-copper)] text-white" radius="full" onPress={() => inputRef.current?.click()}>
              <Upload className="h-4 w-4" />
              Import files
            </Button>
            <Button radius="full" variant="bordered" onPress={exportTabText}>
              <Download className="h-4 w-4" />
              Export text
            </Button>
            <Button radius="full" variant="bordered" onPress={exportMidiMetadata}>
              <Play className="h-4 w-4" />
              Export score
            </Button>
          </div>
        </div>
        <div className="mt-6 grid gap-6 lg:grid-cols-[320px_1fr]">
          <div className="space-y-2">
            {files.map((file) => (
              <button key={file.id} type="button" onClick={() => setActiveFileId(file.id)} className={`w-full rounded-[1.25rem] border px-4 py-4 text-left ${file.id === activeFileId ? "border-[var(--color-brass)] bg-white/8" : "border-white/8 bg-white/3"}`}>
                <div className="font-bold">{file.name}</div>
                <div className="mt-2 flex gap-2">
                  <Chip size="sm" variant="flat">{file.extension || "unknown"}</Chip>
                  <Chip size="sm" variant="flat">{Math.round(file.size / 1024)} KB</Chip>
                </div>
              </button>
            ))}
          </div>
          <div className="space-y-4">
            <div className="rounded-[1.25rem] border border-white/8 bg-white/4 p-4">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <div className="eyebrow">Interactive grid</div>
                  <h3 className="mt-2 text-2xl font-black">Editable fret steps</h3>
                </div>
                <Button radius="full" className="bg-[var(--color-mint)] text-[var(--color-ink)]" onPress={addStep}>
                  <Plus className="h-4 w-4" />
                  Add step
                </Button>
              </div>
              <div className="overflow-auto">
                <table className="min-w-full border-separate border-spacing-2 text-center text-sm">
                  <thead>
                    <tr>
                      <th className="px-2 py-1 text-left">String</th>
                      {grid[0].cells.map((_, index) => <th key={index} className="px-2 py-1">{index + 1}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {grid.map((row, rowIndex) => (
                      <tr key={row.label}>
                        <td className="px-2 py-1 text-left font-black">{row.label}</td>
                        {row.cells.map((cell, cellIndex) => (
                          <td key={`${row.label}-${cellIndex}`}>
                            <input className="field w-16 text-center" value={cell === "-" ? "" : cell} onChange={(event) => setGrid((current) => current.map((currentRow, currentRowIndex) => currentRowIndex === rowIndex ? {
                              ...currentRow,
                              cells: currentRow.cells.map((currentCell, currentCellIndex) => currentCellIndex === cellIndex ? event.target.value || "-" : currentCell),
                            } : currentRow))} placeholder="-" />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              <div className="rounded-[1.25rem] border border-white/8 bg-white/4 p-4">
                <div className="eyebrow">Markers</div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {activeFile?.markers.length ? activeFile.markers.map((marker) => <Chip key={marker} size="sm" variant="flat">{marker}</Chip>) : <span className="text-sm text-[var(--color-sand-2)]">No markers extracted yet.</span>}
                </div>
              </div>
              <div className="rounded-[1.25rem] border border-white/8 bg-white/4 p-4">
                <div className="eyebrow">Preview</div>
                <pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap text-xs text-[var(--color-sand-2)]">{activeFile?.preview || "Import a tab or notation file to inspect it here."}</pre>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}