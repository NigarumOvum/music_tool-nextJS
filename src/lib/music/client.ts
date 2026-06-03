import type {
  MusicPartitureRecord,
  MusicSnapshotRecord,
  MusicSongDetail,
  MusicSongSummary,
  MusicTaskTemplateRecord,
} from "@/lib/music/types";

async function requestJson<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const response = await fetch(input, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
    cache: "no-store",
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error((payload as { error?: string }).error || "Request failed");
  }

  return payload as T;
}

export function fetchSongs(search?: string) {
  const params = search ? `?search=${encodeURIComponent(search)}` : "";
  return requestJson<{ songs: MusicSongSummary[] }>(`/api/music/songs${params}`);
}

export function fetchSongDetail(id: string) {
  return requestJson<{ song: MusicSongDetail }>(`/api/music/songs/${id}`);
}

export function createSong(payload: Record<string, unknown>) {
  return requestJson<{ song: MusicSongDetail }>("/api/music/songs", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateSong(id: string, payload: Record<string, unknown>) {
  return requestJson<{ song: MusicSongDetail }>(`/api/music/songs/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function saveSongPart(id: string, payload: Record<string, unknown>) {
  return requestJson<{ song: MusicSongDetail }>(`/api/music/songs/${id}/parts`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function deleteSongPart(id: string, payload: Record<string, unknown>) {
  return requestJson<{ song: MusicSongDetail }>(`/api/music/songs/${id}/parts`, {
    method: "DELETE",
    body: JSON.stringify(payload),
  });
}

export function fetchTemplates() {
  return requestJson<{ templates: MusicTaskTemplateRecord[] }>("/api/music/templates");
}

export function createTemplate(payload: Record<string, unknown>) {
  return requestJson<{ template: MusicTaskTemplateRecord }>("/api/music/templates", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateTemplate(id: string, payload: Record<string, unknown>) {
  return requestJson<{ template: MusicTaskTemplateRecord }>(`/api/music/templates/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function deleteTemplate(id: string) {
  return requestJson<{ ok: true }>(`/api/music/templates/${id}`, {
    method: "DELETE",
  });
}

export function fetchSnapshots(songId: string) {
  return requestJson<{ snapshots: MusicSnapshotRecord[] }>(`/api/music/songs/${songId}/snapshots`);
}

export function createSnapshot(songId: string, payload: Record<string, unknown>) {
  return requestJson<{ snapshot: MusicSnapshotRecord }>(`/api/music/songs/${songId}/snapshots`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function restoreSnapshot(snapshotId: string, payload?: Record<string, unknown>) {
  return requestJson<{ song: MusicSongDetail }>(`/api/music/snapshots/${snapshotId}/restore`, {
    method: "POST",
    body: JSON.stringify(payload || {}),
  });
}

export function generateDraft(payload: Record<string, unknown>) {
  return requestJson<{ draft: Record<string, unknown> }>("/api/music/ai/generate", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function enhanceContent(payload: Record<string, unknown>) {
  return requestJson<{ result: Record<string, unknown> }>("/api/music/ai/enhance", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function fetchPartitures(songId: string) {
  return requestJson<{ partitures: MusicPartitureRecord[] }>(`/api/music/songs/${songId}/partitures`);
}

export function createPartiture(songId: string, payload: Record<string, unknown>) {
  return requestJson<{ partiture: MusicPartitureRecord }>(`/api/music/songs/${songId}/partitures`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updatePartiture(id: string, payload: Record<string, unknown>) {
  return requestJson<{ partiture: MusicPartitureRecord }>(`/api/music/partitures/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function deletePartiture(id: string) {
  return requestJson<{ ok: true }>(`/api/music/partitures/${id}`, {
    method: "DELETE",
  });
}

export function downloadBlob(name: string, content: string, type = "application/json") {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
}