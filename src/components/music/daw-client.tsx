"use client";

import { useMemo, useRef, useState } from "react";

import { Button, Chip } from "@heroui/react";
import { Download, Plus, Trash2, Upload } from "lucide-react";

import { downloadBlob } from "@/lib/music/client";

type AssetKind = "audio" | "midi" | "project" | "other";

type AssetRecord = {
  id: string;
  name: string;
  kind: AssetKind;
  format: string;
  size: number;
  file?: File;
};

type LayerRecord = {
  id: string;
  name: string;
  kind: "audio" | "midi" | "instrument" | "aux";
  assetId: string;
  gain: number;
  pan: number;
  mute: boolean;
  solo: boolean;
};

function classifyKind(file: File): AssetKind {
  const lower = file.name.toLowerCase();
  if (lower.endsWith(".mid") || lower.endsWith(".midi")) {
    return "midi";
  }
  if ([".mp3", ".wav", ".ogg", ".flac", ".aac", ".m4a"].some((ext) => lower.endsWith(ext))) {
    return "audio";
  }
  if (lower.endsWith(".json")) {
    return "project";
  }
  return "other";
}

export function DawClient() {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [assets, setAssets] = useState<AssetRecord[]>([]);
  const [layers, setLayers] = useState<LayerRecord[]>([]);
  const [newLayerName, setNewLayerName] = useState("Kick bus");
  const [newLayerKind, setNewLayerKind] = useState<LayerRecord["kind"]>("audio");

  const playableAssets = useMemo(() => assets.filter((asset) => asset.kind === "audio" || asset.kind === "midi"), [assets]);

  function importFiles(files: FileList | null) {
    if (!files) {
      return;
    }

    const next = Array.from(files).map((file) => ({
      id: crypto.randomUUID(),
      name: file.name,
      kind: classifyKind(file),
      format: file.name.split(".").pop()?.toLowerCase() || "",
      size: file.size,
      file,
    } satisfies AssetRecord));
    setAssets((current) => [...current, ...next]);
  }

  function addLayer() {
    setLayers((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        name: newLayerName,
        kind: newLayerKind,
        assetId: "",
        gain: 75,
        pan: 0,
        mute: false,
        solo: false,
      },
    ]);
  }

  function exportManifest() {
    downloadBlob("daw-manifest.json", JSON.stringify({ assets, layers }, null, 2));
  }

  return (
    <div className="space-y-6">
      <div className="panel rounded-[1.75rem] p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="eyebrow">Web DAW Lab</div>
            <h2 className="mt-2 text-3xl font-black">Asset library</h2>
          </div>
          <div className="flex gap-2">
            <input ref={inputRef} type="file" multiple className="hidden" onChange={(event) => importFiles(event.target.files)} />
            <Button className="bg-[var(--color-copper)] text-white" radius="full" onPress={() => inputRef.current?.click()}>
              <Upload className="h-4 w-4" />
              Import files
            </Button>
            <Button radius="full" variant="bordered" onPress={exportManifest}>
              <Download className="h-4 w-4" />
              Export manifest
            </Button>
          </div>
        </div>
        <div className="mt-6 overflow-auto rounded-[1.25rem] border border-white/8">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-white/8 bg-white/5 text-[0.72rem] uppercase tracking-[0.22em] text-[var(--color-sand-2)]">
              <tr>
                <th className="px-4 py-3">Asset</th>
                <th className="px-4 py-3">Kind</th>
                <th className="px-4 py-3">Format</th>
                <th className="px-4 py-3">Size</th>
                <th className="px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {assets.map((asset) => (
                <tr key={asset.id} className="border-b border-white/6 last:border-b-0">
                  <td className="px-4 py-3 font-semibold">{asset.name}</td>
                  <td className="px-4 py-3"><Chip size="sm" variant="flat">{asset.kind}</Chip></td>
                  <td className="px-4 py-3 text-[var(--color-sand-2)]">{asset.format}</td>
                  <td className="px-4 py-3 text-[var(--color-sand-2)]">{Math.round(asset.size / 1024)} KB</td>
                  <td className="px-4 py-3">
                    <Button size="sm" variant="light" color="danger" onPress={() => setAssets((current) => current.filter((item) => item.id !== asset.id))}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="panel rounded-[1.75rem] p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="eyebrow">Layer rack</div>
            <h2 className="mt-2 text-3xl font-black">Browser mixer</h2>
          </div>
          <div className="grid gap-2 sm:grid-cols-[1fr_180px_auto]">
            <input className="field" value={newLayerName} onChange={(event) => setNewLayerName(event.target.value)} />
            <select className="field" value={newLayerKind} onChange={(event) => setNewLayerKind(event.target.value as LayerRecord["kind"])}>
              <option value="audio">audio</option>
              <option value="midi">midi</option>
              <option value="instrument">instrument</option>
              <option value="aux">aux</option>
            </select>
            <Button className="bg-[var(--color-mint)] text-[var(--color-ink)]" radius="full" onPress={addLayer}>
              <Plus className="h-4 w-4" />
              Add layer
            </Button>
          </div>
        </div>
        <div className="mt-6 space-y-3">
          {layers.map((layer) => (
            <div key={layer.id} className="rounded-[1.25rem] border border-white/8 bg-white/4 p-4">
              <div className="grid gap-3 lg:grid-cols-[1fr_180px_120px_120px_auto] lg:items-center">
                <input className="field" value={layer.name} onChange={(event) => setLayers((current) => current.map((item) => item.id === layer.id ? { ...item, name: event.target.value } : item))} />
                <select className="field" value={layer.assetId} onChange={(event) => setLayers((current) => current.map((item) => item.id === layer.id ? { ...item, assetId: event.target.value } : item))}>
                  <option value="">No asset</option>
                  {playableAssets.map((asset) => <option key={asset.id} value={asset.id}>{asset.name}</option>)}
                </select>
                <input className="field" type="number" value={layer.gain} onChange={(event) => setLayers((current) => current.map((item) => item.id === layer.id ? { ...item, gain: Number(event.target.value) || 0 } : item))} placeholder="Gain" />
                <input className="field" type="number" value={layer.pan} onChange={(event) => setLayers((current) => current.map((item) => item.id === layer.id ? { ...item, pan: Number(event.target.value) || 0 } : item))} placeholder="Pan" />
                <div className="flex gap-2">
                  <Button size="sm" radius="full" variant={layer.mute ? "solid" : "bordered"} onPress={() => setLayers((current) => current.map((item) => item.id === layer.id ? { ...item, mute: !item.mute } : item))}>Mute</Button>
                  <Button size="sm" radius="full" variant={layer.solo ? "solid" : "bordered"} onPress={() => setLayers((current) => current.map((item) => item.id === layer.id ? { ...item, solo: !item.solo } : item))}>Solo</Button>
                  <Button size="sm" variant="light" color="danger" onPress={() => setLayers((current) => current.filter((item) => item.id !== layer.id))}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
          {layers.length === 0 ? <div className="rounded-[1.25rem] border border-dashed border-white/12 p-6 text-sm text-[var(--color-sand-2)]">No layers yet. Import files, then create a layer rack like a lightweight browser DAW.</div> : null}
        </div>
      </div>
    </div>
  );
}