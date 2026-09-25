"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Music,
  Plus,
  Search,
  Users,
  Disc3,
  Sparkles,
  Trash2,
  Edit3,
  Globe2,
  Music2,
  X,
  FolderInput,
  MoreVertical,
  Copy,
  Download,
  Share2,
  Tag,
  Play,
  Pause,
  Filter,
  ChevronDown,
  FilterX,
  MessageSquare,
  GripVertical,
  LayoutGrid,
  Kanban,
  List,
  Bookmark,
  BookmarkCheck,
  Command,
  Zap,
  Layers,
  Settings,
  RefreshCw,
} from "lucide-react";
import { Spinner } from "@heroui/react";
import { toast } from "sonner";

import { CollapsibleCard } from "@/components/collapsible-card";
import { BandManagerModal } from "@/components/music/band-manager-modal";
import { ProductionStudioModal } from "@/components/music/production-studio-modal";
import { SongComments } from "@/components/music/song-comments";
import {
  ProductionSongProvider,
  useProductionSong,
} from "@/components/music/production-song-context";
import {
  fetchSongs,
  fetchProjects,
  createSong,
  deleteSong,
  updateSong,
} from "@/lib/music/client";
import type { MusicSongSummary, MusicProjectRecord } from "@/lib/music/types";
import { INSTRUMENT_FILTER_PRESETS } from "@/lib/music/instruments";

type ProductionStudioClientProps = {
  allowedTabs: Array<{ id: string; label: string }>;
  initialTab: string;
};

const GENRE_PRESETS = ["Rock", "Metal", "Pop", "Electronic", "Jazz", "Hip Hop", "Acoustic", "Indie", "Classical"];
const KEY_PRESETS = ["C Major", "A Minor", "G Major", "E Minor", "D Major", "B Minor", "F Major", "D Minor", "F# Minor"];
const EMOTION_PRESETS = ["Happy", "Sad", "Energetic", "Calm", "Aggressive", "Peaceful", "Romantic", "Melancholic", "Hopeful"];
const MOOD_PRESETS = ["Upbeat", "Dark", "Light", "Heavy", "Chill", "Intense", "Dreamy", "Gritty", "Ethereal"];
const INSTRUMENT_PRESETS = INSTRUMENT_FILTER_PRESETS;

const GENRE_COLORS: Record<string, string> = {
  "Rock": "#ef4444",
  "Metal": "#7c3aed",
  "Pop": "#ec4899",
  "Electronic": "#06b6d4",
  "Jazz": "#f59e0b",
  "Hip Hop": "#10b981",
  "Acoustic": "#84cc16",
  "Indie": "#f97316",
  "Classical": "#6366f1",
};

const GENRE_ICONS: Record<string, string> = {
  "Rock": "🎸",
  "Metal": "🤘",
  "Pop": "🎤",
  "Electronic": "🎹",
  "Jazz": "🎷",
  "Hip Hop": "🎧",
  "Acoustic": "🪕",
  "Indie": "🎵",
  "Classical": "🎻",
};

const SONG_TEMPLATES = [
  {
    id: "standard-pop",
    name: "Standard Pop",
    description: "Verse-Chorus structure with bridge",
    genre: "Pop",
    bpm: 120,
    musical_key: "C Major",
    structure: ["Verse 1", "Chorus", "Verse 2", "Chorus", "Bridge", "Chorus"],
    emotion: "Upbeat",
    icon: "🎵"
  },
  {
    id: "rock-ballad",
    name: "Rock Ballad",
    description: "Emotional rock with build-up",
    genre: "Rock",
    bpm: 80,
    musical_key: "A Minor",
    structure: ["Intro", "Verse 1", "Chorus", "Verse 2", "Chorus", "Solo", "Chorus", "Outro"],
    emotion: "Emotional",
    icon: "🎸"
  },
  {
    id: "electronic-dance",
    name: "Electronic Dance",
    description: "High energy EDM structure",
    genre: "Electronic",
    bpm: 128,
    musical_key: "F# Minor",
    structure: ["Intro", "Build-up", "Drop", "Verse", "Build-up", "Drop", "Breakdown", "Final Drop"],
    emotion: "Energetic",
    icon: "🎹"
  },
  {
    id: "hip-hop",
    name: "Hip Hop",
    description: "Rap-friendly structure",
    genre: "Hip Hop",
    bpm: 95,
    musical_key: "G Major",
    structure: ["Intro", "Verse 1", "Hook", "Verse 2", "Hook", "Verse 3", "Hook", "Outro"],
    emotion: "Confident",
    icon: "🎤"
  },
  {
    id: "acoustic-folk",
    name: "Acoustic Folk",
    description: "Simple acoustic arrangement",
    genre: "Acoustic",
    bpm: 100,
    musical_key: "D Major",
    structure: ["Verse 1", "Chorus", "Verse 2", "Chorus", "Bridge", "Chorus"],
    emotion: "Peaceful",
    icon: "🪕"
  },
  {
    id: "jazz-standard",
    name: "Jazz Standard",
    description: "Classic jazz progression",
    genre: "Jazz",
    bpm: 110,
    musical_key: "Bb Major",
    structure: ["A Section", "B Section", "A Section", "C Section", "A Section"],
    emotion: "Sophisticated",
    icon: "🎷"
  },
  {
    id: "metal",
    name: "Metal",
    description: "Heavy metal structure",
    genre: "Metal",
    bpm: 140,
    musical_key: "E Minor",
    structure: ["Intro", "Verse", "Pre-Chorus", "Chorus", "Verse", "Pre-Chorus", "Chorus", "Solo", "Chorus", "Outro"],
    emotion: "Aggressive",
    icon: "🤘"
  },
  {
    id: "blank",
    name: "Blank Canvas",
    description: "Start from scratch",
    genre: "",
    bpm: 120,
    musical_key: "C Major",
    structure: [],
    emotion: "",
    icon: "📝"
  }
];

function ProductionStudioDashboard() {
  const { setSelectedSongId, refreshSongs } = useProductionSong();
  const [songs, setSongs] = useState<MusicSongSummary[]>([]);
  const [projects, setProjects] = useState<MusicProjectRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedGenre, setSelectedGenre] = useState<string>("all");
  const [selectedKey, setSelectedKey] = useState<string>("all");
  const [selectedEmotion, setSelectedEmotion] = useState<string>("all");
  const [selectedMood, setSelectedMood] = useState<string>("all");
  const [selectedProjectSlug, setSelectedProjectSlug] = useState<string>("all");
  const [selectedInstrument, setSelectedInstrument] = useState<string>("all");
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  // Modals state
  const [isStudioModalOpen, setIsStudioModalOpen] = useState(false);
  const [studioInitialTab, setStudioInitialTab] = useState<string>("lyrics");
  const [isBandModalOpen, setIsBandModalOpen] = useState(false);
  const [projectToEdit, setProjectToEdit] = useState<MusicProjectRecord | null>(null);
  const [isNewSongModalOpen, setIsNewSongModalOpen] = useState(false);

  // Move song to band state
  const [moveSongTarget, setMoveSongTarget] = useState<MusicSongSummary | null>(null);
  const [moveSongSlug, setMoveSongSlug] = useState("");
  const [movingSong, setMovingSong] = useState(false);

  // Quick actions dropdown state
  const [quickActionsSong, setQuickActionsSong] = useState<string | null>(null);

  // Keyboard shortcuts help modal
  const [showShortcutsHelp, setShowShortcutsHelp] = useState(false);

  // Audio preview state
  const [previewingSong, setPreviewingSong] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  // Comments state
  const [commentsSong, setCommentsSong] = useState<{ id: string; title: string } | null>(null);

  // Tags state
  const [songTags, setSongTags] = useState<Record<string, string[]>>({});
  const [tagModalSong, setTagModalSong] = useState<MusicSongSummary | null>(null);
  const [newTag, setNewTag] = useState("");

  // Filter presets state
  const [filterPresets, setFilterPresets] = useState<Array<{ id: string; name: string; filters: { genre: string; key: string; emotion: string; mood: string; project: string; instrument: string } }>>([]);
  const [showPresetModal, setShowPresetModal] = useState(false);
  const [newPresetName, setNewPresetName] = useState("");

  // Command palette state
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [commandSearch, setCommandSearch] = useState("");

  // Sidebar state
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [selectedSongForSidebar, setSelectedSongForSidebar] = useState<MusicSongSummary | null>(null);

  // Search suggestions state
  const [searchFocused, setSearchFocused] = useState(false);

  // Accessibility state
  const [reducedMotion, setReducedMotion] = useState(false);
  const [highContrast, setHighContrast] = useState(false);

  // Drag and drop state
  const [draggedSong, setDraggedSong] = useState<string | null>(null);

  // Layout state
  const [viewMode, setViewMode] = useState<"grid" | "kanban" | "compact">("grid");

  // Load persisted preferences on mount
  useEffect(() => {
    const savedViewMode = localStorage.getItem("production_studio_view_mode");
    if (savedViewMode && ["grid", "kanban", "compact"].includes(savedViewMode)) {
      setViewMode(savedViewMode as "grid" | "kanban" | "compact");
    }

    const savedGenre = localStorage.getItem("production_studio_genre_filter");
    if (savedGenre) setSelectedGenre(savedGenre);

    const savedKey = localStorage.getItem("production_studio_key_filter");
    if (savedKey) setSelectedKey(savedKey);

    const savedInstrument = localStorage.getItem("production_studio_instrument_filter");
    if (savedInstrument) setSelectedInstrument(savedInstrument);

    // Load song tags
    const savedTags = localStorage.getItem("song_tags");
    if (savedTags) {
      try {
        setSongTags(JSON.parse(savedTags));
      } catch (error) {
        console.error("Failed to load song tags:", error);
      }
    }

    // Load filter presets
    const savedPresets = localStorage.getItem("filter_presets");
    if (savedPresets) {
      try {
        setFilterPresets(JSON.parse(savedPresets));
      } catch (error) {
        console.error("Failed to load filter presets:", error);
      }
    }

    // Load sidebar state
    const savedSidebarOpen = localStorage.getItem("production_studio_sidebar_open");
    if (savedSidebarOpen) {
      setIsSidebarOpen(savedSidebarOpen === "true");
    }

    // Load accessibility preferences
    const savedReducedMotion = localStorage.getItem("production_studio_reduced_motion");
    if (savedReducedMotion) {
      setReducedMotion(savedReducedMotion === "true");
    }

    const savedHighContrast = localStorage.getItem("production_studio_high_contrast");
    if (savedHighContrast) {
      setHighContrast(savedHighContrast === "true");
    }

    // Check system preferences
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setReducedMotion(true);
    }
  }, []);

  // Keyboard shortcuts for command palette
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setShowCommandPalette(true);
      }
      if (e.key === "Escape" && showCommandPalette) {
        setShowCommandPalette(false);
        setCommandSearch("");
      }
      if (e.key === "Escape" && isSidebarOpen) {
        setIsSidebarOpen(false);
      }
      if (e.key === "/" && !isSidebarOpen && document.activeElement?.tagName !== "INPUT") {
        e.preventDefault();
        const searchInput = document.querySelector('input[type="text"]');
        if (searchInput instanceof HTMLInputElement) {
          searchInput.focus();
        }
      }
      if (e.key === "s" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setIsSidebarOpen(!isSidebarOpen);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showCommandPalette, isSidebarOpen]);

  // Save preferences when they change
  useEffect(() => {
    localStorage.setItem("production_studio_view_mode", viewMode);
  }, [viewMode]);

  useEffect(() => {
    localStorage.setItem("production_studio_genre_filter", selectedGenre);
  }, [selectedGenre]);

  useEffect(() => {
    localStorage.setItem("production_studio_key_filter", selectedKey);
  }, [selectedKey]);

  useEffect(() => {
    localStorage.setItem("production_studio_instrument_filter", selectedInstrument);
  }, [selectedInstrument]);

  useEffect(() => {
    localStorage.setItem("production_studio_sidebar_open", String(isSidebarOpen));
  }, [isSidebarOpen]);

  useEffect(() => {
    localStorage.setItem("production_studio_reduced_motion", String(reducedMotion));
  }, [reducedMotion]);

  useEffect(() => {
    localStorage.setItem("production_studio_high_contrast", String(highContrast));
  }, [highContrast]);

  // Save song tags to localStorage
  useEffect(() => {
    localStorage.setItem("song_tags", JSON.stringify(songTags));
  }, [songTags]);

  // Save filter presets to localStorage
  useEffect(() => {
    localStorage.setItem("filter_presets", JSON.stringify(filterPresets));
  }, [filterPresets]);

  const handleSavePreset = () => {
    if (!newPresetName.trim()) {
      toast.error("Preset name is required");
      return;
    }

    const currentFilters = {
      genre: selectedGenre,
      key: selectedKey,
      emotion: selectedEmotion,
      mood: selectedMood,
      project: selectedProjectSlug,
      instrument: selectedInstrument,
    };

    const newPreset = {
      id: Date.now().toString(),
      name: newPresetName.trim(),
      filters: currentFilters
    };

    setFilterPresets([...filterPresets, newPreset]);
    setNewPresetName("");
    setShowPresetModal(false);
    toast.success("Filter preset saved");
  };

  const handleLoadPreset = (preset: typeof filterPresets[0]) => {
    setSelectedGenre(preset.filters.genre);
    setSelectedKey(preset.filters.key);
    setSelectedEmotion(preset.filters.emotion);
    setSelectedMood(preset.filters.mood);
    setSelectedProjectSlug(preset.filters.project);
    setSelectedInstrument(preset.filters.instrument || "all");
    toast.success(`Loaded preset: ${preset.name}`);
  };

  const handleDeletePreset = (presetId: string) => {
    setFilterPresets(filterPresets.filter(p => p.id !== presetId));
    toast.success("Preset deleted");
  };

  // Command palette actions
  const commandActions = [
    {
      id: "new-song",
      label: "Create new song",
      icon: <Plus className="h-4 w-4" />,
      action: () => {
        setIsNewSongModalOpen(true);
        setShowCommandPalette(false);
      },
      category: "Songs"
    },
    {
      id: "search",
      label: "Search songs",
      icon: <Search className="h-4 w-4" />,
      action: () => {
        const searchInput = document.querySelector('input[placeholder*="Search"]');
        if (searchInput instanceof HTMLInputElement) {
          searchInput.focus();
        }
        setShowCommandPalette(false);
      },
      category: "Navigation"
    },
    {
      id: "toggle-view",
      label: "Toggle view mode",
      icon: <LayoutGrid className="h-4 w-4" />,
      action: () => {
        if (viewMode === "grid") setViewMode("kanban");
        else if (viewMode === "kanban") setViewMode("compact");
        else setViewMode("grid");
        setShowCommandPalette(false);
      },
      category: "View"
    },
    {
      id: "save-preset",
      label: "Save filter preset",
      icon: <Bookmark className="h-4 w-4" />,
      action: () => {
        setShowPresetModal(true);
        setShowCommandPalette(false);
      },
      category: "Filters"
    },
    {
      id: "clear-filters",
      label: "Clear all filters",
      icon: <FilterX className="h-4 w-4" />,
      action: () => {
        setSelectedGenre("all");
        setSelectedKey("all");
        setSelectedEmotion("all");
        setSelectedMood("all");
        setSelectedProjectSlug("all");
        setSelectedInstrument("all");
        setSearch("");
        setShowCommandPalette(false);
        toast.success("Filters cleared");
      },
      category: "Filters"
    },
    {
      id: "refresh",
      label: "Refresh songs",
      icon: <RefreshCw className="h-4 w-4" />,
      action: () => {
        refreshSongs();
        setShowCommandPalette(false);
        toast.success("Songs refreshed");
      },
      category: "Actions"
    },
    ...songs.slice(0, 10).map(song => ({
      id: `song-${song.id}`,
      label: song.title,
      icon: <Music2 className="h-4 w-4" />,
      action: () => {
        handleOpenStudio(song.id, "lyrics");
        setShowCommandPalette(false);
      },
      category: "Songs"
    }))
  ];

  const filteredCommands = commandActions.filter(cmd =>
    cmd.label.toLowerCase().includes(commandSearch.toLowerCase()) ||
    cmd.category.toLowerCase().includes(commandSearch.toLowerCase())
  );

  // Smart search suggestions
  const searchSuggestions = useMemo(() => {
    if (!search.trim()) return [];
    const query = search.toLowerCase();
    const suggestions: Array<{ type: 'song' | 'genre' | 'emotion' | 'topic'; label: string; value: string }> = [];

    // Song suggestions
    songs.slice(0, 5).forEach(song => {
      if (song.title.toLowerCase().includes(query)) {
        suggestions.push({ type: 'song', label: song.title, value: song.id });
      }
    });

    // Genre suggestions
    GENRE_PRESETS.forEach(genre => {
      if (genre.toLowerCase().includes(query)) {
        suggestions.push({ type: 'genre', label: genre, value: genre });
      }
    });

    // Emotion suggestions
    EMOTION_PRESETS.forEach(emotion => {
      if (emotion.toLowerCase().includes(query)) {
        suggestions.push({ type: 'emotion', label: emotion, value: emotion });
      }
    });

    // Topic suggestions (from songs)
    const topics = Array.from(new Set(songs.map(s => s.topic).filter(Boolean) as string[]));
    topics.slice(0, 5).forEach(topic => {
      if (topic.toLowerCase().includes(query)) {
        suggestions.push({ type: 'topic', label: topic, value: topic });
      }
    });

    return suggestions.slice(0, 8);
  }, [search, songs]);

  const handleAddTag = (songId: string) => {
    if (!newTag.trim()) return;

    const currentTags = songTags[songId] || [];
    if (!currentTags.includes(newTag.trim())) {
      setSongTags({
        ...songTags,
        [songId]: [...currentTags, newTag.trim()]
      });
      setNewTag("");
      toast.success("Tag added");
    } else {
      toast.error("Tag already exists");
    }
  };

  const handleRemoveTag = (songId: string, tag: string) => {
    const currentTags = songTags[songId] || [];
    setSongTags({
      ...songTags,
      [songId]: currentTags.filter(t => t !== tag)
    });
    toast.success("Tag removed");
  };

  // New Song Draft State
  const [newSongTitle, setNewSongTitle] = useState("");
  const [newSongBpm, setNewSongBpm] = useState("120");
  const [newSongKey, setNewSongKey] = useState("A Minor");
  const [newSongGenre, setNewSongGenre] = useState("Rock");
  const [newSongProjectSlug, setNewSongProjectSlug] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState(SONG_TEMPLATES[7]); // Default to blank
  const [creatingSong, setCreatingSong] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const [songsRes, projectsRes] = await Promise.all([
        fetchSongs(),
        fetchProjects().catch(() => ({ projects: [] })),
      ]);
      setSongs(songsRes.songs || []);
      setProjects(projectsRes.projects || []);
    } catch (err) {
      toast.error((err as Error).message || "Failed to load songs and bands");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // This effect synchronizes the catalog with the authenticated API on mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadData();
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (quickActionsSong && !(event.target as Element).closest('.quick-actions-dropdown')) {
        setQuickActionsSong(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [quickActionsSong]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in inputs
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) {
        return;
      }

      // Cmd/Ctrl + N: New song
      if ((e.metaKey || e.ctrlKey) && e.key === 'n') {
        e.preventDefault();
        setNewSongProjectSlug(selectedProjectSlug !== "all" && selectedProjectSlug !== "solo" ? selectedProjectSlug : "");
        setIsNewSongModalOpen(true);
      }

      // Cmd/Ctrl + F: Focus search
      if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
        e.preventDefault();
        const searchInput = document.querySelector('input[placeholder*="Search"]') as HTMLInputElement;
        if (searchInput) searchInput.focus();
      }

      // Escape: Close modals
      if (e.key === 'Escape') {
        if (isNewSongModalOpen) setIsNewSongModalOpen(false);
        if (isBandModalOpen) setIsBandModalOpen(false);
        if (moveSongTarget) setMoveSongTarget(null);
        if (quickActionsSong) setQuickActionsSong(null);
      }

      // 1-4: Quick filter by project (if projects exist)
      if (e.key >= '1' && e.key <= '4' && projects.length >= parseInt(e.key)) {
        const projectIndex = parseInt(e.key) - 1;
        if (projects[projectIndex]) {
          setSelectedProjectSlug(projects[projectIndex].slug);
        }
      }

      // 0: Show all songs
      if (e.key === '0') {
        setSelectedProjectSlug('all');
      }

      // ?: Show keyboard shortcuts help
      if (e.key === '?') {
        e.preventDefault();
        setShowShortcutsHelp(!showShortcutsHelp);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedProjectSlug, projects, isNewSongModalOpen, isBandModalOpen, moveSongTarget, quickActionsSong, showShortcutsHelp]);

  const filteredSongs = useMemo(() => {
    return songs.filter((song) => {
      if (search.trim()) {
        const query = search.toLowerCase();
        const matchesTitle = song.title.toLowerCase().includes(query);
        const matchesTopic = song.topic?.toLowerCase().includes(query) || false;
        const matchesGenre = song.genre?.toLowerCase().includes(query) || false;
        const matchesEmotion = song.emotion?.toLowerCase().includes(query) || false;
        if (!matchesTitle && !matchesTopic && !matchesGenre && !matchesEmotion) {
          return false;
        }
      }

      if (selectedGenre !== "all" && song.genre !== selectedGenre) {
        return false;
      }

      if (selectedKey !== "all" && song.musical_key !== selectedKey) {
        return false;
      }

      if (selectedEmotion !== "all" && song.emotion !== selectedEmotion) {
        return false;
      }

      if (selectedMood !== "all" && song.topic?.toLowerCase().includes(selectedMood.toLowerCase())) {
        return false;
      }

      if (selectedProjectSlug !== "all") {
        if (selectedProjectSlug === "solo") {
          if (song.project_slug) return false;
        } else if (song.project_slug !== selectedProjectSlug) {
          return false;
        }
      }

      if (selectedInstrument !== "all" && song.instrumentation) {
        if (!song.instrumentation.toLowerCase().includes(selectedInstrument.toLowerCase())) {
          return false;
        }
      }

      return true;
    });
  }, [songs, search, selectedGenre, selectedKey, selectedEmotion, selectedMood, selectedProjectSlug, selectedInstrument]);

  const activeProject = useMemo(() => {
    if (selectedProjectSlug === "all" || selectedProjectSlug === "solo") return null;
    return projects.find((p) => p.slug === selectedProjectSlug) || null;
  }, [projects, selectedProjectSlug]);

  const projectButtonStyle = useMemo(() => {
    if (activeProject?.color) {
      return {
        from: activeProject.color,
        to: activeProject.color,
        textColor: 'white'
      };
    }
    return {
      from: 'var(--color-brass)',
      to: 'var(--color-gold)',
      textColor: 'black'
    };
  }, [activeProject]);

  const handleOpenStudio = (songId: string, tab: string = "lyrics") => {
    setSelectedSongId(songId);
    setStudioInitialTab(tab);
    setIsStudioModalOpen(true);
  };

  const handleCreateSong = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSongTitle.trim()) {
      toast.error("Song title is required");
      return;
    }

    try {
      setCreatingSong(true);
      const res = await createSong({
        title: newSongTitle.trim(),
        bpm: Number(newSongBpm) || 120,
        musical_key: newSongKey || null,
        genre: newSongGenre || null,
        project_slug: newSongProjectSlug || null,
      });

      toast.success(`Created "${res.song.song.title}"`);
      await loadData();
      await refreshSongs();
      setIsNewSongModalOpen(false);
      setNewSongTitle("");
      setSelectedTemplate(SONG_TEMPLATES[7]); // Reset to blank

      // Open in studio modal right away
      handleOpenStudio(res.song.song.id, "lyrics");
    } catch (err) {
      toast.error((err as Error).message || "Failed to create song");
    } finally {
      setCreatingSong(false);
    }
  };

  const handleTemplateSelect = (template: typeof SONG_TEMPLATES[0]) => {
    setSelectedTemplate(template);
    if (template.genre) setNewSongGenre(template.genre);
    if (template.bpm) setNewSongBpm(template.bpm.toString());
    if (template.musical_key) setNewSongKey(template.musical_key);
  };

  const handleDeleteSong = async (songId: string, songTitle: string) => {
    if (!confirm(`Are you sure you want to delete "${songTitle}"?`)) return;
    try {
      await deleteSong(songId);
      toast.success(`Deleted "${songTitle}"`);
      await loadData();
      await refreshSongs();
    } catch (err) {
      toast.error((err as Error).message || "Failed to delete song");
    }
  };

  const handleCloneSong = async (song: MusicSongSummary) => {
    try {
      const res = await createSong({
        title: `${song.title} (Copy)`,
        bpm: song.bpm || 120,
        musical_key: song.musical_key || null,
        genre: song.genre || null,
        project_slug: song.project_slug || null,
      });
      toast.success(`Cloned "${song.title}" as "${res.song.song.title}"`);
      await loadData();
      await refreshSongs();
    } catch (err) {
      toast.error((err as Error).message || "Failed to clone song");
    }
  };

  const handleShareSong = async (song: MusicSongSummary) => {
    // Share URL would be implemented based on your sharing system
    const shareUrl = `${window.location.origin}/production-studio?song=${song.id}`;
    await navigator.clipboard.writeText(shareUrl);
    toast.success("Share link copied to clipboard");
  };

  const handleExportSong = async (song: MusicSongSummary) => {
    try {
      // Basic export - would be expanded based on needs
      const exportData: Record<string, unknown> = {
        title: song.title,
        bpm: song.bpm,
        musical_key: song.musical_key,
        genre: song.genre,
        topic: song.topic,
        emotion: song.emotion,
      };
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${song.title.replace(/[^a-z0-9]/gi, '_')}_export.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(`Exported "${song.title}"`);
    } catch (err) {
      toast.error((err as Error).message || "Failed to export song");
    }
  };

  const handleAudioPreview = (songId: string) => {
    if (previewingSong === songId && isPlaying) {
      setIsPlaying(false);
      setPreviewingSong(null);
    } else {
      setPreviewingSong(songId);
      setIsPlaying(true);
      // Simulate audio preview - in real implementation, this would play actual audio
      toast.info(`Previewing "${songs.find(s => s.id === songId)?.title}"`);
      setTimeout(() => {
        setIsPlaying(false);
        setPreviewingSong(null);
      }, 3000); // 3 second preview
    }
  };

  const handleDragStart = (e: any, songId: string) => {
    setDraggedSong(songId);
    const dt = e.dataTransfer;
    if (dt) {
      dt.effectAllowed = "move";
    }
  };

  const handleDragOver = (e: any) => {
    e.preventDefault();
    const dt = e.dataTransfer;
    if (dt) {
      dt.dropEffect = "move";
    }
  };

  const handleDrop = (e: any, targetSongId: string) => {
    e.preventDefault();
    if (!draggedSong || draggedSong === targetSongId) return;

    const draggedIndex = songs.findIndex(s => s.id === draggedSong);
    const targetIndex = songs.findIndex(s => s.id === targetSongId);

    if (draggedIndex === -1 || targetIndex === -1) return;

    const newSongs = [...songs];
    const [removed] = newSongs.splice(draggedIndex, 1);
    newSongs.splice(targetIndex, 0, removed);

    setSongs(newSongs);
    setDraggedSong(null);
    toast.success("Song order updated");
  };

  const handleDragEnd = () => {
    setDraggedSong(null);
  };

  const openMoveModal = (song: MusicSongSummary) => {
    setMoveSongTarget(song);
    setMoveSongSlug(song.project_slug || "");
  };

  const handleMoveSong = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!moveSongTarget) return;
    setMovingSong(true);
    try {
      await updateSong(moveSongTarget.id, { project_slug: moveSongSlug || null });
      const destination = moveSongSlug
        ? (projects.find((p) => p.slug === moveSongSlug)?.name ?? moveSongSlug)
        : "Solo (No Band)";
      toast.success(`"${moveSongTarget.title}" moved to ${destination}`);
      setMoveSongTarget(null);
      await loadData();
      await refreshSongs();
    } catch (err) {
      toast.error((err as Error).message || "Failed to move song");
    } finally {
      setMovingSong(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Band & Project Hub Bar */}
      <CollapsibleCard
        defaultOpen={false}
        title="Bands & Project Workspaces"
        subtitle="Organize songs by band and collaborate with registered users across your private workspace (collapsed by default)"
        eyebrow="Shared Production"
        icon={<Users className="h-4 w-4 text-[var(--color-brass)]" />}
        badge={
          <span className="glass-pill px-2.5 py-0.5 text-[11px] font-bold text-[var(--color-brass)]">
            {projects.length} Bands
          </span>
        }
        headerActions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowShortcutsHelp(true)}
              title="Keyboard shortcuts (?)"
              className="flex h-8 w-8 items-center justify-center rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-sand-2)] transition hover:text-[var(--color-foreground)]"
            >
              <Search className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => {
                setProjectToEdit(null);
                setIsBandModalOpen(true);
              }}
              className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[var(--color-brass)] to-[var(--color-gold)] px-3.5 py-1.5 text-xs font-bold text-black shadow-sm transition hover:brightness-110 active:scale-95"
              style={{
                background: `linear-gradient(to right, ${projectButtonStyle.from}, ${projectButtonStyle.to})`,
                color: projectButtonStyle.textColor
              }}
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Create Band / Project</span>
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setSelectedProjectSlug("all")}
              className={`glass-pill flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold transition ${
                selectedProjectSlug === "all"
                  ? "glass-pill-active text-[var(--color-foreground)] border-[var(--color-info-border)]"
                  : "text-[var(--color-sand-2)] hover:text-[var(--color-foreground)]"
              }`}
            >
              <Globe2 className="h-3.5 w-3.5" />
              <span>All Workspace Songs</span>
              <span className="ml-1 rounded-full bg-[var(--color-surface-soft)] px-1.5 py-0.2 text-[10px]">
                {songs.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedProjectSlug("solo")}
              className={`glass-pill flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold transition ${
                selectedProjectSlug === "solo"
                  ? "glass-pill-active text-[var(--color-foreground)]"
                  : "text-[var(--color-sand-2)] hover:text-[var(--color-foreground)]"
              }`}
            >
              <Music className="h-3.5 w-3.5" />
              <span>Solo (No Band)</span>
              <span className="ml-1 rounded-full bg-[var(--color-surface-soft)] px-1.5 py-0.2 text-[10px]">
                {songs.filter((s) => !s.project_slug).length}
              </span>
            </button>

            {projects.map((proj) => {
              const isSelected = selectedProjectSlug === proj.slug;
              return (
                <div key={proj.id} className="flex items-center">
                  <button
                    type="button"
                    onClick={() => setSelectedProjectSlug(proj.slug)}
                    className={`glass-pill flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold transition ${
                      isSelected
                        ? "glass-pill-active text-[var(--color-foreground)] shadow-xs"
                        : "text-[var(--color-sand-2)] hover:text-[var(--color-foreground)]"
                    }`}
                  >
                    <div
                      className="flex h-6 w-6 items-center justify-center rounded-lg text-xs font-bold text-white shadow-xs"
                      style={{ backgroundColor: proj.color || "#f59e0b" }}
                    >
                      {proj.name.charAt(0).toUpperCase()}
                    </div>
                    <span>{proj.name}</span>
                    <span className="rounded-full bg-[var(--color-surface-soft)] px-1.5 py-0.2 text-[10px]">
                      {proj.songCount}
                    </span>
                  </button>
                </div>
              );
            })}
          </div>

          {activeProject && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-soft)] p-4">
              <div className="flex items-center gap-3">
                <div
                  className="flex h-12 w-12 items-center justify-center rounded-2xl text-xl text-white shadow-sm"
                  style={{ backgroundColor: activeProject.color || "#f59e0b" }}
                >
                  {activeProject.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3
                      className="text-sm font-bold"
                      style={{ color: activeProject.color || undefined }}
                    >
                      {activeProject.name}
                    </h3>
                    <span className="glass-pill px-2 py-0.5 text-[10px] text-[var(--color-brass)]">
                      {activeProject.memberCount} Members
                    </span>
                  </div>
                  {activeProject.description && (
                    <p className="line-clamp-1 text-xs text-[var(--color-sand-2)]">
                      {activeProject.description}
                    </p>
                  )}
                  <div className="mt-1 flex items-center gap-1">
                    {/* Simulated collaborator avatars */}
                    {[1, 2, 3].slice(0, Math.min(activeProject.memberCount, 3)).map((i) => (
                      <div
                        key={i}
                        className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--color-surface)] border border-[var(--color-border)] text-[8px] font-bold text-[var(--color-foreground)]"
                        style={{ marginLeft: i > 1 ? '-4px' : '0' }}
                      >
                        {String.fromCharCode(64 + i)}
                      </div>
                    ))}
                    {activeProject.memberCount > 3 && (
                      <div className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--color-surface)] border border-[var(--color-border)] text-[8px] font-bold text-[var(--color-sand-2)]">
                        +{activeProject.memberCount - 3}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setProjectToEdit(activeProject);
                  setIsBandModalOpen(true);
                }}
                className="flex items-center gap-1.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-xs font-semibold text-[var(--color-foreground)] shadow-xs transition hover:border-[var(--color-copper)]"
              >
                <Edit3 className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Manage Band & Members</span>
              </button>
            </div>
          )}
        </div>
      </CollapsibleCard>

      {/* 2. Songs Catalog & Search / Action Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <div className="relative min-w-[200px] flex-1 sm:min-w-[240px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-sand-2)]" />
            <input
              type="text"
              placeholder="Search songs... (⌘F)"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setTimeout(() => setSearchFocused(false), 200)}
              className="field pl-9 text-xs py-2"
            />
            <button
              type="button"
              onClick={() => setShowCommandPalette(true)}
              className="absolute right-2 top-1/2 -translate-y-1/2 flex h-6 w-6 items-center justify-center rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-sand-2)] transition hover:text-[var(--color-foreground)]"
              title="Command palette (⌘K)"
            >
              <Command className="h-3 w-3" />
            </button>

            {/* Search Suggestions Dropdown */}
            {searchFocused && searchSuggestions.length > 0 && (
              <div className="absolute top-full left-0 right-0 z-50 mt-2 overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-modal-surface)] shadow-xl">
                {searchSuggestions.map((suggestion, index) => (
                  <button
                    key={`${suggestion.type}-${suggestion.value}-${index}`}
                    type="button"
                    onClick={() => {
                      if (suggestion.type === 'song') {
                        handleOpenStudio(suggestion.value, 'lyrics');
                      } else if (suggestion.type === 'genre') {
                        setSelectedGenre(suggestion.value);
                      } else if (suggestion.type === 'emotion') {
                        setSelectedEmotion(suggestion.value);
                      } else if (suggestion.type === 'topic') {
                        setSearch(suggestion.value);
                      }
                      setSearch('');
                      setSearchFocused(false);
                    }}
                    className="flex items-center gap-3 px-4 py-2.5 text-left text-sm text-[var(--color-foreground)] transition hover:bg-[var(--color-surface-soft)]"
                  >
                    <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-[var(--color-surface)] text-[10px] font-bold uppercase text-[var(--color-sand-2)]">
                      {suggestion.type[0]}
                    </div>
                    <span className="flex-1">{suggestion.label}</span>
                    <span className="text-[10px] font-semibold text-[var(--color-sand-2)] capitalize">{suggestion.type}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                if (viewMode === "grid") setViewMode("kanban");
                else if (viewMode === "kanban") setViewMode("compact");
                else setViewMode("grid");
              }}
              title={`Switch to ${viewMode === "grid" ? "Kanban" : viewMode === "kanban" ? "Compact" : "Grid"} view`}
              className={`flex h-7 w-7 items-center justify-center rounded-lg border transition ${
                viewMode !== "grid"
                  ? "border-[var(--color-brass)] bg-[var(--color-brass)]/10 text-[var(--color-brass)]"
                  : "border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-sand-2)] hover:text-[var(--color-foreground)]"
              }`}
            >
              {viewMode === "grid" ? <Kanban className="h-3.5 w-3.5" /> : viewMode === "kanban" ? <LayoutGrid className="h-3.5 w-3.5" /> : <List className="h-3.5 w-3.5" />}
            </button>

            <button
              type="button"
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              title="Toggle song info sidebar"
              className={`flex h-7 w-7 items-center justify-center rounded-lg border transition ${
                isSidebarOpen
                  ? "border-[var(--color-copper)] bg-[var(--color-copper)]/10 text-[var(--color-copper)]"
                  : "border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-sand-2)] hover:text-[var(--color-foreground)]"
              }`}
            >
              <Layers className="h-3.5 w-3.5" />
            </button>

            <button
              type="button"
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              className={`flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition ${
                showAdvancedFilters
                  ? "border-[var(--color-copper)] bg-[var(--color-copper)]/10 text-[var(--color-copper)]"
                  : "border-[var(--color-border)] bg-[var(--color-surface-soft)] text-[var(--color-sand-2)] hover:text-[var(--color-foreground)]"
              }`}
            >
              <Filter className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Advanced</span>
              <ChevronDown className={`h-3 w-3 transition-transform ${showAdvancedFilters ? 'rotate-180' : ''}`} />
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={selectedGenre}
            onChange={(e) => setSelectedGenre(e.target.value)}
            className="field w-auto text-xs py-2"
          >
            <option value="all">All Genres</option>
            {GENRE_PRESETS.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>

          <select
            value={selectedKey}
            onChange={(e) => setSelectedKey(e.target.value)}
            className="field w-auto text-xs py-2"
          >
            <option value="all">All Keys</option>
            {KEY_PRESETS.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
        </div>

        {/* Advanced Filters */}
        <AnimatePresence>
          {showAdvancedFilters && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-soft)] p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={selectedEmotion}
                    onChange={(e) => setSelectedEmotion(e.target.value)}
                    className="field w-auto text-xs py-2"
                  >
                    <option value="all">All Emotions</option>
                    {EMOTION_PRESETS.map((e) => (
                      <option key={e} value={e}>
                        {e}
                      </option>
                    ))}
                  </select>

                  <select
                    value={selectedMood}
                    onChange={(e) => setSelectedMood(e.target.value)}
                    className="field w-auto text-xs py-2"
                  >
                    <option value="all">All Moods</option>
                    {MOOD_PRESETS.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>

                  <select
                    value={selectedInstrument}
                    onChange={(e) => setSelectedInstrument(e.target.value)}
                    className="field w-auto text-xs py-2"
                  >
                    <option value="all">All Instruments</option>
                    {INSTRUMENT_PRESETS.map((i) => (
                      <option key={i} value={i}>
                        {i}
                      </option>
                    ))}
                  </select>

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedGenre("all");
                      setSelectedKey("all");
                      setSelectedEmotion("all");
                      setSelectedMood("all");
                      setSelectedProjectSlug("all");
                      setSelectedInstrument("all");
                      setSearch("");
                    }}
                    className="flex items-center gap-1.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-xs font-semibold text-[var(--color-sand-2)] transition hover:text-[var(--color-foreground)] hover:border-red-500/30 hover:text-red-500"
                  >
                    <FilterX className="h-3.5 w-3.5" />
                    <span>Clear Filters</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowPresetModal(true)}
                    className="flex items-center gap-1.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-xs font-semibold text-[var(--color-sand-2)] transition hover:text-[var(--color-foreground)] hover:border-[var(--color-brass)]/50 hover:text-[var(--color-brass)]"
                  >
                    <Bookmark className="h-3.5 w-3.5" />
                    <span>Save Preset</span>
                  </button>

                  {filterPresets.length > 0 && (
                    <div className="flex items-center gap-1.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-soft)] px-3 py-1.5">
                      <span className="text-[10px] font-semibold text-[var(--color-sand-2)]">Presets:</span>
                      {filterPresets.slice(0, 3).map((preset) => (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => handleLoadPreset(preset)}
                          className="flex items-center gap-1 rounded-lg bg-[var(--color-surface)] px-2 py-1 text-[10px] font-semibold text-[var(--color-foreground)] transition hover:bg-[var(--color-brass)]/10 hover:text-[var(--color-brass)]"
                        >
                          <BookmarkCheck className="h-3 w-3" />
                          {preset.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <button
          type="button"
          onClick={() => {
            setNewSongProjectSlug(selectedProjectSlug !== "all" && selectedProjectSlug !== "solo" ? selectedProjectSlug : "");
            setIsNewSongModalOpen(true);
          }}
          className="flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[var(--color-brass)] to-[var(--color-gold)] px-5 py-2.5 text-xs font-bold text-black shadow-md transition hover:brightness-110 active:scale-95"
          style={{
            background: `linear-gradient(to right, ${projectButtonStyle.from}, ${projectButtonStyle.to})`,
            color: projectButtonStyle.textColor
          }}
        >
          <Plus className="h-4 w-4" />
          <span>New Song</span>
          <span className="hidden sm:inline text-[10px] opacity-75">⌘N</span>
        </button>
      </div>

      {/* 3. Songs Grid / Kanban */}
      {loading ? (
        <div className="flex min-h-[300px] flex-col items-center justify-center gap-3">
          <Spinner size="lg" color="warning" />
          <p className="text-xs text-[var(--color-sand-2)]">Loading song catalog...</p>
        </div>
      ) : filteredSongs.length === 0 ? (
        <div className="panel flex min-h-[260px] flex-col items-center justify-center gap-3 rounded-[1.75rem] p-8 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-soft)] text-[var(--color-brass)]">
            <Music2 className="h-6 w-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-[var(--color-foreground)]">No songs found</h3>
            <p className="text-xs text-[var(--color-sand-2)]">
              {search ? "No songs match your search filters." : "Create your first song to unlock the full production studio suite."}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsNewSongModalOpen(true)}
            className="mt-2 flex items-center gap-1.5 rounded-xl bg-[var(--color-copper)] px-4 py-2 text-xs font-bold text-white shadow-xs hover:brightness-110"
          >
            <Plus className="h-4 w-4" /> Create First Song
          </button>
        </div>
      ) : viewMode === "grid" ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredSongs.map((song, index) => {
            const songProject = projects.find((p) => p.slug === song.project_slug);
            return (
              <motion.div
                key={song.id}
                draggable
                onDragStart={(e) => handleDragStart(e as any, song.id)}
                onDragOver={(e) => handleDragOver(e as any)}
                onDrop={(e) => handleDrop(e as any, song.id)}
                onDragEnd={handleDragEnd}
                whileHover={{ y: -3 }}
                transition={{ type: "spring", stiffness: 320, damping: 24 }}
                className={`min-w-0 cursor-grab active:cursor-grabbing ${draggedSong === song.id ? 'opacity-50' : ''}`}
              >
                <CollapsibleCard
                  defaultOpen={index === 0}
                  title={song.title}
                  subtitle={[song.genre, song.emotion].filter(Boolean).join(" / ") || "Unclassified song"}
                  eyebrow={songProject ? songProject.name : "Solo track"}
                  eyebrowColor={songProject?.color || undefined}
                  icon={
                    <div
                      className="flex h-8 w-8 items-center justify-center rounded-xl text-lg shadow-sm text-white"
                      style={{ backgroundColor: songProject?.color || "var(--color-surface-strong)" }}
                    >
                      {GENRE_ICONS[song.genre || ""] || "🎵"}
                    </div>
                  }
                  badge={
                    <div className="flex items-center gap-1.5">
                      {song.musical_key && <span className="glass-pill px-2 py-0.5 text-[10px] font-bold text-[var(--color-copper)]">{song.musical_key}</span>}
                      {song.bpm && <span className="glass-pill px-2 py-0.5 text-[10px] font-bold text-[var(--color-brass)]">{song.bpm} BPM</span>}
                    </div>
                  }
                  headerActions={
                    <div className="flex items-center gap-1.5">
                      <div className="cursor-grab active:cursor-grabbing">
                        <GripVertical className="h-4 w-4 text-[var(--color-sand-2)]" />
                      </div>

                      <button
                        type="button"
                        onClick={() => handleAudioPreview(song.id)}
                        title="Preview audio"
                        className={`flex h-7 w-7 items-center justify-center rounded-lg border transition ${
                          previewingSong === song.id && isPlaying
                            ? "border-[var(--color-copper)] bg-[var(--color-copper)]/10 text-[var(--color-copper)]"
                            : "border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-sand-2)] hover:border-[var(--color-copper)]/40 hover:text-[var(--color-copper)]"
                        }`}
                      >
                        {previewingSong === song.id && isPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleOpenStudio(song.id, "lyrics")}
                        title={`Open ${song.title} in studio`}
                        className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-[var(--color-brass)] to-[var(--color-gold)] px-3 py-1.5 text-[11px] font-bold text-black shadow-sm transition hover:brightness-110 active:scale-95"
                        style={{
                          background: `linear-gradient(to right, ${projectButtonStyle.from}, ${projectButtonStyle.to})`,
                          color: projectButtonStyle.textColor
                        }}
                      >
                        <Disc3 className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">Open</span>
                      </button>

                      <div className="relative quick-actions-dropdown">
                        <button
                          type="button"
                          onClick={() => setQuickActionsSong(quickActionsSong === song.id ? null : song.id)}
                          title="Quick actions"
                          className="flex h-7 w-7 items-center justify-center rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-sand-2)] transition hover:border-[var(--color-brass)]/40 hover:text-[var(--color-brass)]"
                        >
                          <MoreVertical className="h-3.5 w-3.5" />
                        </button>

                        <AnimatePresence>
                          {quickActionsSong === song.id && (
                            <motion.div
                              initial={{ opacity: 0, scale: 0.95, y: -10 }}
                              animate={{ opacity: 1, scale: 1, y: 0 }}
                              exit={{ opacity: 0, scale: 0.95, y: -10 }}
                              transition={{ duration: 0.15 }}
                              className="absolute right-0 top-full z-50 mt-2 w-48 overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-modal-surface)] shadow-xl"
                            >
                              <div className="py-1">
                                <button
                                  type="button"
                                  onClick={() => {
                                    handleCloneSong(song);
                                    setQuickActionsSong(null);
                                  }}
                                  className="flex w-full items-center gap-2 px-3 py-2 text-xs text-[var(--color-foreground)] transition hover:bg-[var(--color-surface-soft)]"
                                >
                                  <Copy className="h-3.5 w-3.5 text-[var(--color-brass)]" />
                                  <span>Clone Song</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    handleShareSong(song);
                                    setQuickActionsSong(null);
                                  }}
                                  className="flex w-full items-center gap-2 px-3 py-2 text-xs text-[var(--color-foreground)] transition hover:bg-[var(--color-surface-soft)]"
                                >
                                  <Share2 className="h-3.5 w-3.5 text-[var(--color-copper)]" />
                                  <span>Share Link</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    handleExportSong(song);
                                    setQuickActionsSong(null);
                                  }}
                                  className="flex w-full items-center gap-2 px-3 py-2 text-xs text-[var(--color-foreground)] transition hover:bg-[var(--color-surface-soft)]"
                                >
                                  <Download className="h-3.5 w-3.5 text-[var(--color-mint)]" />
                                  <span>Export</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setCommentsSong({ id: song.id, title: song.title });
                                    setQuickActionsSong(null);
                                  }}
                                  className="flex w-full items-center gap-2 px-3 py-2 text-xs text-[var(--color-foreground)] transition hover:bg-[var(--color-surface-soft)]"
                                >
                                  <MessageSquare className="h-3.5 w-3.5 text-[var(--color-purple)]" />
                                  <span>Comments</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedSongForSidebar(song);
                                    setIsSidebarOpen(true);
                                    setQuickActionsSong(null);
                                  }}
                                  className="flex w-full items-center gap-2 px-3 py-2 text-xs text-[var(--color-foreground)] transition hover:bg-[var(--color-surface-soft)]"
                                >
                                  <Layers className="h-3.5 w-3.5 text-[var(--color-brass)]" />
                                  <span>Song Info</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setTagModalSong(song);
                                    setQuickActionsSong(null);
                                  }}
                                  className="flex w-full items-center gap-2 px-3 py-2 text-xs text-[var(--color-foreground)] transition hover:bg-[var(--color-surface-soft)]"
                                >
                                  <Tag className="h-3.5 w-3.5 text-[var(--color-copper)]" />
                                  <span>Manage Tags</span>
                                </button>
                                <div className="my-1 border-t border-[var(--color-stroke)]" />
                                <button
                                  type="button"
                                  onClick={() => {
                                    openMoveModal(song);
                                    setQuickActionsSong(null);
                                  }}
                                  className="flex w-full items-center gap-2 px-3 py-2 text-xs text-[var(--color-foreground)] transition hover:bg-[var(--color-surface-soft)]"
                                >
                                  <FolderInput className="h-3.5 w-3.5 text-[var(--color-brass)]" />
                                  <span>Move to project</span>
                                </button>
                                <div className="my-1 border-t border-[var(--color-stroke)]" />
                                <button
                                  type="button"
                                  onClick={() => {
                                    handleDeleteSong(song.id, song.title);
                                    setQuickActionsSong(null);
                                  }}
                                  className="flex w-full items-center gap-2 px-3 py-2 text-xs text-red-500 transition hover:bg-red-500/10"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                  <span>Delete Song</span>
                                </button>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>
                  }
                  variant="glass"
                  className="h-full"
                >
                  <div className="pt-4">
                    <p className="text-xs text-[var(--color-sand-2)]">{song.topic || "No description"}</p>
                  </div>
                </CollapsibleCard>
              </motion.div>
            );
          })}
        </div>
      ) : viewMode === "kanban" ? (
        // Kanban View - organize by project
        <div className="flex gap-4 overflow-x-auto pb-4">
          {[
            { id: "solo", name: "Solo Songs", songs: filteredSongs.filter(s => !s.project_slug) },
            ...projects.map(p => ({
              id: p.slug,
              name: p.name,
              songs: filteredSongs.filter(s => s.project_slug === p.slug),
              color: p.color
            }))
          ].filter(column => column.songs.length > 0).map(column => (
            <div key={column.id} className="flex-shrink-0 w-80">
              <div className="mb-3 flex items-center gap-2">
                <div
                  className="h-3 w-3 rounded-full"
                  style={{ backgroundColor: (column as any).color || "#f59e0b" }}
                />
                <h3
                  className="text-sm font-bold"
                  style={{ color: (column as any).color || undefined }}
                >
                  {column.name}
                </h3>
                <span className="text-xs text-[var(--color-sand-2)]">{column.songs.length}</span>
              </div>
              <div className="space-y-3">
                {column.songs.map((song) => (
                  <motion.div
                    key={song.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, song.id)}
                    onDragOver={(e) => handleDragOver(e)}
                    onDrop={(e) => handleDrop(e, song.id)}
                    onDragEnd={handleDragEnd}
                    whileHover={{ scale: 1.02 }}
                    transition={{ type: "spring", stiffness: 320, damping: 24 }}
                    className={`cursor-grab active:cursor-grabbing rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-soft)] p-3 ${draggedSong === song.id ? 'opacity-50' : ''}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <h4 className="text-xs font-bold text-[var(--color-foreground)]">{song.title}</h4>
                        <p className="text-[10px] text-[var(--color-sand-2)]">{song.genre || "Unclassified"}</p>
                      </div>
                      <GripVertical className="h-4 w-4 text-[var(--color-sand-2)]" />
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      {song.musical_key && (
                        <span className="glass-pill px-2 py-0.5 text-[9px] font-bold text-[var(--color-copper)]">{song.musical_key}</span>
                      )}
                      {song.bpm && (
                        <span className="glass-pill px-2 py-0.5 text-[9px] font-bold text-[var(--color-brass)]">{song.bpm} BPM</span>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        // Compact View - list view with minimal details
        <div className="space-y-2">
          {filteredSongs.map((song) => {
            const songProject = projects.find((p) => p.slug === song.project_slug);
            return (
              <motion.div
                key={song.id}
                draggable
                onDragStart={(e) => handleDragStart(e as any, song.id)}
                onDragOver={(e) => handleDragOver(e as any)}
                onDrop={(e) => handleDrop(e as any, song.id)}
                onDragEnd={handleDragEnd}
                whileHover={{ scale: 1.01 }}
                transition={{ type: "spring", stiffness: 320, damping: 24 }}
                className={`flex items-center gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-soft)] p-3 cursor-grab active:cursor-grabbing ${draggedSong === song.id ? 'opacity-50' : ''}`}
                style={{ borderLeft: `4px solid ${songProject?.color || GENRE_COLORS[song.genre || ""] || "#f59e0b"}` }}
              >
                <div
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-lg text-white shadow-sm"
                  style={{ backgroundColor: songProject?.color || "var(--color-surface-strong)" }}
                >
                  {GENRE_ICONS[song.genre || ""] || "🎵"}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-xs font-bold text-[var(--color-foreground)] truncate">{song.title}</h4>
                  <p className="text-[10px] text-[var(--color-sand-2)]">
                    {song.genre || "Unclassified"} • {songProject ? (
                      <span style={{ color: songProject.color || undefined }}>{songProject.name}</span>
                    ) : (
                      "Solo"
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {song.musical_key && <span className="glass-pill px-2 py-0.5 text-[9px] font-bold text-[var(--color-copper)]">{song.musical_key}</span>}
                  {song.bpm && <span className="glass-pill px-2 py-0.5 text-[9px] font-bold text-[var(--color-brass)]">{song.bpm}</span>}
                  <button
                    type="button"
                    onClick={() => handleOpenStudio(song.id, "lyrics")}
                    className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-r from-[var(--color-brass)] to-[var(--color-gold)] text-black shadow-sm hover:brightness-110"
                    style={{
                      background: `linear-gradient(to right, ${projectButtonStyle.from}, ${projectButtonStyle.to})`,
                      color: projectButtonStyle.textColor
                    }}
                  >
                    <Disc3 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* 4. Unified Studio Workspace Modal (Contains Lyrics, Song, Audio, Notation) */}
      <ProductionStudioModal
        isOpen={isStudioModalOpen}
        initialTab={studioInitialTab}
        songs={songs}
        projects={projects}
        onClose={() => setIsStudioModalOpen(false)}
      />

      {/* 5. Band Manager Modal */}
      <BandManagerModal
        isOpen={isBandModalOpen}
        projectToEdit={projectToEdit}
        onClose={() => setIsBandModalOpen(false)}
        onSaved={async () => {
          await loadData();
        }}
        onDeleted={async () => {
          setSelectedProjectSlug("all");
          await loadData();
        }}
      />

      {/* 6. Move Song to Band Modal */}
      <AnimatePresence>
        {moveSongTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMoveSongTarget(null)}
              className="fixed inset-0 bg-black/75 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 14 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 14 }}
              transition={{ type: "spring", stiffness: 350, damping: 28 }}
              className="relative z-10 w-full max-w-md overflow-hidden rounded-[1.75rem] border border-[var(--color-border)] bg-[var(--color-modal-surface)] shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-[var(--color-stroke)] px-6 py-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--color-brass)] text-black shadow-md">
                    <FolderInput className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="eyebrow text-[0.62rem]">Move Track</div>
                    <h2 className="text-lg font-bold tracking-tight text-[var(--color-foreground)]">
                      Move to Band / Project
                    </h2>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setMoveSongTarget(null)}
                  className="flex h-8 w-8 items-center justify-center rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-sand-2)] transition hover:text-[var(--color-foreground)]"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <form onSubmit={handleMoveSong} className="space-y-4 p-6">
                <p className="text-sm text-[var(--color-sand-2)]">
                  Moving{" "}
                  <span className="font-bold text-[var(--color-foreground)]">
                    &quot;{moveSongTarget.title}&quot;
                  </span>{" "}
                  from{" "}
                  <span className="font-semibold text-[var(--color-brass)]">
                    {moveSongTarget.project_slug
                      ? (projects.find((p) => p.slug === moveSongTarget.project_slug)?.name ?? moveSongTarget.project_slug)
                      : "Solo (No Band)"}
                  </span>
                </p>

                <div className="space-y-1.5">
                  <label className="field-label">Destination Band / Project</label>
                  <select
                    className="field text-sm"
                    value={moveSongSlug}
                    onChange={(e) => setMoveSongSlug(e.target.value)}
                  >
                    <option value="">Solo (No Band)</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.slug}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center justify-end gap-2.5 border-t border-[var(--color-stroke)] pt-3">
                  <button
                    type="button"
                    onClick={() => setMoveSongTarget(null)}
                    className="rounded-xl border border-[var(--color-border)] px-4 py-2 text-xs font-semibold text-[var(--color-sand-2)] transition hover:text-[var(--color-foreground)]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={movingSong || moveSongSlug === (moveSongTarget.project_slug ?? "")}
                    className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[var(--color-brass)] to-[var(--color-gold)] px-5 py-2 text-xs font-bold text-black shadow-md transition hover:brightness-110 active:scale-95 disabled:opacity-50"
                    style={{
                      background: `linear-gradient(to right, ${projectButtonStyle.from}, ${projectButtonStyle.to})`,
                      color: projectButtonStyle.textColor
                    }}
                  >
                    {movingSong ? <Spinner size="sm" color="current" /> : <FolderInput className="h-3.5 w-3.5" />}
                    <span>Move Track</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 7. Quick New Song Modal */}
      <AnimatePresence>
        {isNewSongModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsNewSongModalOpen(false)}
              className="fixed inset-0 bg-black/75 backdrop-blur-md"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 14 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 14 }}
              transition={{ type: "spring", stiffness: 350, damping: 28 }}
              className="relative z-10 w-full max-w-lg overflow-hidden rounded-[1.75rem] border border-[var(--color-border)] bg-[var(--color-modal-surface)] shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-[var(--color-stroke)] px-6 py-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--color-copper)] text-white shadow-md">
                    <Music2 className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="eyebrow text-[0.62rem]">Studio Project</div>
                    <h2 className="text-xl font-bold tracking-tight text-[var(--color-foreground)]">
                      Create New Song
                    </h2>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsNewSongModalOpen(false)}
                  className="flex h-8 w-8 items-center justify-center rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-sand-2)] transition hover:text-[var(--color-foreground)]"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <form onSubmit={handleCreateSong} className="space-y-4 p-6">
                {/* Template Selection */}
                <div className="space-y-2">
                  <label className="field-label">Choose a Template</label>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {SONG_TEMPLATES.map((template) => (
                      <button
                        key={template.id}
                        type="button"
                        onClick={() => handleTemplateSelect(template)}
                        className={`flex flex-col items-center gap-1.5 rounded-xl border p-3 text-center transition-all ${
                          selectedTemplate.id === template.id
                            ? "border-[var(--color-brass)] bg-[var(--color-brass)]/10 shadow-md"
                            : "border-[var(--color-border)] bg-[var(--color-surface-soft)] hover:border-[var(--color-copper)]/50 hover:bg-[var(--color-surface)]"
                        }`}
                      >
                        <span className="text-xl">{template.icon}</span>
                        <span className="text-[10px] font-bold text-[var(--color-foreground)]">{template.name}</span>
                      </button>
                    ))}
                  </div>
                  {selectedTemplate.description && (
                    <p className="text-[10px] text-[var(--color-sand-2)]">{selectedTemplate.description}</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label className="field-label">Song Title</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g., Midnight Horizon, Neon Requiem..."
                    value={newSongTitle}
                    onChange={(e) => setNewSongTitle(e.target.value)}
                    className="field text-sm font-bold"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="field-label">Tempo (BPM)</label>
                    <input
                      type="number"
                      min={40}
                      max={280}
                      value={newSongBpm}
                      onChange={(e) => setNewSongBpm(e.target.value)}
                      className="field text-sm"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="field-label">Musical Key</label>
                    <select
                      value={newSongKey}
                      onChange={(e) => setNewSongKey(e.target.value)}
                      className="field text-sm"
                    >
                      {KEY_PRESETS.map((k) => (
                        <option key={k} value={k}>
                          {k}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="field-label">Genre</label>
                    <select
                      value={newSongGenre}
                      onChange={(e) => setNewSongGenre(e.target.value)}
                      className="field text-sm"
                    >
                      {GENRE_PRESETS.map((g) => (
                        <option key={g} value={g}>
                          {g}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="field-label">Assign to Band / Project</label>
                    <select
                      value={newSongProjectSlug}
                      onChange={(e) => setNewSongProjectSlug(e.target.value)}
                      className="field text-sm"
                    >
                      <option value="">Solo (No Band)</option>
                      {projects.map((p) => (
                        <option key={p.id} value={p.slug}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[var(--color-stroke)]">
                  <button
                    type="button"
                    onClick={() => {
                      setIsNewSongModalOpen(false);
                      setSelectedTemplate(SONG_TEMPLATES[7]); // Reset to blank
                      setNewSongTitle("");
                      setNewSongBpm("120");
                      setNewSongKey("A Minor");
                      setNewSongGenre("Rock");
                      setNewSongProjectSlug("");
                    }}
                    className="rounded-xl border border-[var(--color-border)] px-4 py-2 text-xs font-semibold text-[var(--color-sand-2)] transition hover:text-[var(--color-foreground)]"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={creatingSong}
                    className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[var(--color-brass)] to-[var(--color-gold)] px-5 py-2 text-xs font-bold text-black shadow-md transition hover:brightness-110 active:scale-95 disabled:opacity-50"
                    style={{
                      background: `linear-gradient(to right, ${projectButtonStyle.from}, ${projectButtonStyle.to})`,
                      color: projectButtonStyle.textColor
                    }}
                  >
                    {creatingSong ? <Spinner size="sm" color="current" /> : <Sparkles className="h-3.5 w-3.5" />}
                    <span>Create & Launch Studio</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Keyboard Shortcuts Help Modal */}
      <AnimatePresence>
        {showShortcutsHelp && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowShortcutsHelp(false)}
              className="fixed inset-0 bg-black/75 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 14 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 14 }}
              transition={{ type: "spring", stiffness: 350, damping: 28 }}
              className="relative z-10 w-full max-w-lg overflow-hidden rounded-[1.75rem] border border-[var(--color-border)] bg-[var(--color-modal-surface)] shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-[var(--color-stroke)] px-6 py-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--color-brass)] text-black shadow-md">
                    <Search className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="eyebrow text-[0.62rem]">Keyboard Shortcuts</div>
                    <h2 className="text-lg font-bold tracking-tight text-[var(--color-foreground)]">
                      Quick Actions
                    </h2>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowShortcutsHelp(false)}
                  className="flex h-8 w-8 items-center justify-center rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-sand-2)] transition hover:text-[var(--color-foreground)]"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="space-y-4 p-6">
                <div className="space-y-2">
                  <h3 className="text-xs font-bold text-[var(--color-foreground)]">General</h3>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[var(--color-sand-2)]">New Song</span>
                      <kbd className="rounded bg-[var(--color-surface-soft)] px-2 py-1 text-[10px] font-mono text-[var(--color-foreground)]">⌘N</kbd>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[var(--color-sand-2)]">Focus Search</span>
                      <kbd className="rounded bg-[var(--color-surface-soft)] px-2 py-1 text-[10px] font-mono text-[var(--color-foreground)]">⌘F</kbd>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[var(--color-sand-2)]">Show Help</span>
                      <kbd className="rounded bg-[var(--color-surface-soft)] px-2 py-1 text-[10px] font-mono text-[var(--color-foreground)]">?</kbd>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[var(--color-sand-2)]">Close Modal</span>
                      <kbd className="rounded bg-[var(--color-surface-soft)] px-2 py-1 text-[10px] font-mono text-[var(--color-foreground)]">Esc</kbd>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <h3 className="text-xs font-bold text-[var(--color-foreground)]">Projects</h3>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[var(--color-sand-2)]">Show All Songs</span>
                      <kbd className="rounded bg-[var(--color-surface-soft)] px-2 py-1 text-[10px] font-mono text-[var(--color-foreground)]">0</kbd>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[var(--color-sand-2)]">Select Project 1-4</span>
                      <kbd className="rounded bg-[var(--color-surface-soft)] px-2 py-1 text-[10px] font-mono text-[var(--color-foreground)]">1-4</kbd>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <h3 className="text-xs font-bold text-[var(--color-foreground)]">Studio Modal</h3>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[var(--color-sand-2)]">Toggle Split View</span>
                      <kbd className="rounded bg-[var(--color-surface-soft)] px-2 py-1 text-[10px] font-mono text-[var(--color-foreground)]">⌘\</kbd>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[var(--color-sand-2)]">Toggle Fullscreen</span>
                      <kbd className="rounded bg-[var(--color-surface-soft)] px-2 py-1 text-[10px] font-mono text-[var(--color-foreground)]">⌘F</kbd>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[var(--color-sand-2)]">Switch Tabs</span>
                      <kbd className="rounded bg-[var(--color-surface-soft)] px-2 py-1 text-[10px] font-mono text-[var(--color-foreground)]">1-4</kbd>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Comments Modal */}
      {commentsSong && (
        <SongComments
          songId={commentsSong.id}
          songTitle={commentsSong.title}
          isOpen={!!commentsSong}
          onClose={() => setCommentsSong(null)}
        />
      )}

      {/* Tag Management Modal */}
      <AnimatePresence>
        {tagModalSong && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setTagModalSong(null)}
              className="fixed inset-0 bg-black/75 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 14 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 14 }}
              transition={{ type: "spring", stiffness: 350, damping: 28 }}
              className="relative z-10 w-full max-w-md overflow-hidden rounded-[1.75rem] border border-[var(--color-border)] bg-[var(--color-modal-surface)] shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-[var(--color-stroke)] px-6 py-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--color-copper)] text-white shadow-md">
                    <Tag className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="eyebrow text-[0.62rem]">Organization</div>
                    <h2 className="text-lg font-bold tracking-tight text-[var(--color-foreground)]">
                      Manage Tags - {tagModalSong.title}
                    </h2>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setTagModalSong(null)}
                  className="flex h-8 w-8 items-center justify-center rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-sand-2)] transition hover:text-[var(--color-foreground)]"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="space-y-4 p-6">
                {/* Add New Tag */}
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Add new tag..."
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddTag(tagModalSong.id);
                      }
                    }}
                    className="field flex-1 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => handleAddTag(tagModalSong.id)}
                    className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-r from-[var(--color-brass)] to-[var(--color-gold)] text-black shadow-md transition hover:brightness-110"
                    style={{
                      background: `linear-gradient(to right, ${projectButtonStyle.from}, ${projectButtonStyle.to})`,
                      color: projectButtonStyle.textColor
                    }}
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>

                {/* Existing Tags */}
                <div className="space-y-2">
                  <label className="field-label">Current Tags</label>
                  {songTags[tagModalSong.id]?.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {songTags[tagModalSong.id].map((tag) => (
                        <div
                          key={tag}
                          className="flex items-center gap-1.5 rounded-full border border-[var(--color-border)] bg-[var(--color-surface-soft)] px-3 py-1.5 text-xs font-semibold text-[var(--color-foreground)]"
                        >
                          <span>{tag}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveTag(tagModalSong.id, tag)}
                            className="text-[var(--color-sand-2)] hover:text-red-500"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-[var(--color-sand-2)]">No tags yet. Add your first tag above.</p>
                  )}
                </div>

                {/* Suggested Tags */}
                <div className="space-y-2">
                  <label className="field-label">Suggested Tags</label>
                  <div className="flex flex-wrap gap-2">
                    {["Work in Progress", "Demo", "Complete", "Favorite", "Collaboration", "Experiment"].map((suggestedTag) => (
                      <button
                        key={suggestedTag}
                        type="button"
                        onClick={() => {
                          if (!songTags[tagModalSong.id]?.includes(suggestedTag)) {
                            handleAddTag(tagModalSong.id);
                          }
                        }}
                        disabled={songTags[tagModalSong.id]?.includes(suggestedTag)}
                        className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                          songTags[tagModalSong.id]?.includes(suggestedTag)
                            ? "border-[var(--color-copper)] bg-[var(--color-copper)]/10 text-[var(--color-copper)] opacity-50"
                            : "border-[var(--color-border)] bg-[var(--color-surface-soft)] text-[var(--color-sand-2)] hover:border-[var(--color-copper)]/50 hover:text-[var(--color-copper)]"
                        }`}
                      >
                        {suggestedTag}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Filter Preset Modal */}
      <AnimatePresence>
        {showPresetModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowPresetModal(false)}
              className="fixed inset-0 bg-black/75 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 14 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 14 }}
              transition={{ type: "spring", stiffness: 350, damping: 28 }}
              className="relative z-10 w-full max-w-sm overflow-hidden rounded-[1.75rem] border border-[var(--color-border)] bg-[var(--color-modal-surface)] shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-[var(--color-stroke)] px-6 py-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--color-brass)] text-black shadow-md">
                    <Bookmark className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="eyebrow text-[0.62rem]">Filter Presets</div>
                    <h2 className="text-lg font-bold tracking-tight text-[var(--color-foreground)]">
                      Save Current Filters
                    </h2>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowPresetModal(false)}
                  className="flex h-8 w-8 items-center justify-center rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-sand-2)] transition hover:text-[var(--color-foreground)]"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="space-y-4 p-6">
                <div className="space-y-1.5">
                  <label className="field-label">Preset Name</label>
                  <input
                    type="text"
                    placeholder="e.g., My Rock Songs, Favorites..."
                    value={newPresetName}
                    onChange={(e) => setNewPresetName(e.target.value)}
                    className="field text-sm"
                  />
                </div>

                <div className="space-y-2">
                  <label className="field-label">Current Filters</label>
                  <div className="space-y-1 text-xs text-[var(--color-sand-2)]">
                    <div className="flex justify-between">
                      <span>Genre:</span>
                      <span className="font-semibold text-[var(--color-foreground)]">{selectedGenre}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Key:</span>
                      <span className="font-semibold text-[var(--color-foreground)]">{selectedKey}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Emotion:</span>
                      <span className="font-semibold text-[var(--color-foreground)]">{selectedEmotion}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Project:</span>
                      <span className="font-semibold text-[var(--color-foreground)]">{selectedProjectSlug}</span>
                    </div>
                  </div>
                </div>

                {filterPresets.length > 0 && (
                  <div className="space-y-2">
                    <label className="field-label">Existing Presets</label>
                    <div className="space-y-1">
                      {filterPresets.map((preset) => (
                        <div
                          key={preset.id}
                          className="flex items-center justify-between rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-soft)] px-3 py-2"
                        >
                          <button
                            type="button"
                            onClick={() => handleLoadPreset(preset)}
                            className="flex items-center gap-2 text-xs font-semibold text-[var(--color-foreground)] hover:text-[var(--color-brass)]"
                          >
                            <BookmarkCheck className="h-3.5 w-3.5" />
                            {preset.name}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeletePreset(preset.id)}
                            className="text-[var(--color-sand-2)] hover:text-red-500"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[var(--color-stroke)]">
                  <button
                    type="button"
                    onClick={() => setShowPresetModal(false)}
                    className="rounded-xl border border-[var(--color-border)] px-4 py-2 text-xs font-semibold text-[var(--color-sand-2)] transition hover:text-[var(--color-foreground)]"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSavePreset}
                    className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[var(--color-brass)] to-[var(--color-gold)] px-5 py-2 text-xs font-bold text-black shadow-md transition hover:brightness-110 active:scale-95"
                    style={{
                      background: `linear-gradient(to right, ${projectButtonStyle.from}, ${projectButtonStyle.to})`,
                      color: projectButtonStyle.textColor
                    }}
                  >
                    <Bookmark className="h-3.5 w-3.5" />
                    <span>Save Preset</span>
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Command Palette */}
      <AnimatePresence>
        {showCommandPalette && (
          <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowCommandPalette(false)}
              className="fixed inset-0 bg-black/75 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -20 }}
              transition={{ type: "spring", stiffness: 350, damping: 28 }}
              className="relative z-10 w-full max-w-2xl overflow-hidden rounded-[1.75rem] border border-[var(--color-border)] bg-[var(--color-modal-surface)] shadow-2xl"
            >
              <div className="flex items-center gap-3 border-b border-[var(--color-stroke)] px-6 py-4">
                <Command className="h-5 w-5 text-[var(--color-brass)]" />
                <input
                  type="text"
                  placeholder="Type a command or search..."
                  value={commandSearch}
                  onChange={(e) => setCommandSearch(e.target.value)}
                  className="flex-1 bg-transparent text-base text-[var(--color-foreground)] outline-none placeholder:text-[var(--color-sand-2)]"
                  autoFocus
                />
                <kbd className="flex h-6 items-center gap-1 rounded border border-[var(--color-border)] bg-[var(--color-surface-soft)] px-2 text-[10px] font-semibold text-[var(--color-sand-2)]">
                  <span>ESC</span>
                </kbd>
              </div>

              <div className="max-h-96 overflow-auto p-2">
                {commandSearch === "" ? (
                  <div className="space-y-1">
                    {["Songs", "Navigation", "View", "Filters", "Actions"].map(category => {
                      const categoryCommands = filteredCommands.filter(cmd => cmd.category === category);
                      if (categoryCommands.length === 0) return null;
                      return (
                        <div key={category} className="space-y-1">
                          <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-[var(--color-sand-2)]">
                            {category}
                          </div>
                          {categoryCommands.map(cmd => (
                            <button
                              key={cmd.id}
                              type="button"
                              onClick={cmd.action}
                              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-[var(--color-foreground)] transition hover:bg-[var(--color-surface-soft)]"
                            >
                              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--color-surface)] text-[var(--color-brass)]">
                                {cmd.icon}
                              </div>
                              <span className="flex-1 font-medium">{cmd.label}</span>
                            </button>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="space-y-1">
                    {filteredCommands.length === 0 ? (
                      <div className="px-3 py-8 text-center text-sm text-[var(--color-sand-2)]">
                        No results found for "{commandSearch}"
                      </div>
                    ) : (
                      filteredCommands.map(cmd => (
                        <button
                          key={cmd.id}
                          type="button"
                          onClick={cmd.action}
                          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-[var(--color-foreground)] transition hover:bg-[var(--color-surface-soft)]"
                        >
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--color-surface)] text-[var(--color-brass)]">
                            {cmd.icon}
                          </div>
                          <span className="flex-1 font-medium">{cmd.label}</span>
                          <span className="text-[10px] font-semibold text-[var(--color-sand-2)]">{cmd.category}</span>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between border-t border-[var(--color-stroke)] px-6 py-3">
                <div className="flex items-center gap-4 text-[10px] text-[var(--color-sand-2)]">
                  <div className="flex items-center gap-1">
                    <kbd className="flex h-5 items-center justify-center rounded border border-[var(--color-border)] bg-[var(--color-surface-soft)] px-1.5 font-semibold">
                      ↑↓
                    </kbd>
                    <span>Navigate</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <kbd className="flex h-5 items-center justify-center rounded border border-[var(--color-border)] bg-[var(--color-surface-soft)] px-1.5 font-semibold">
                      ↵
                    </kbd>
                    <span>Select</span>
                  </div>
                </div>
                <div className="text-[10px] text-[var(--color-sand-2)]">
                  {filteredCommands.length} result{filteredCommands.length !== 1 ? "s" : ""}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Collapsible Song Info Sidebar */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div
            initial={{ x: 400 }}
            animate={{ x: 0 }}
            exit={{ x: 400 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="fixed right-0 top-0 z-40 h-full w-96 border-l border-[var(--color-border)] bg-[var(--color-modal-surface)] shadow-2xl"
          >
            <div className="flex h-full flex-col">
              <div className="flex items-center justify-between border-b border-[var(--color-stroke)] px-6 py-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--color-brass)] text-black">
                    <Layers className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="eyebrow">Song Details</div>
                    <h2 className="text-lg font-bold text-[var(--color-foreground)]">
                      {selectedSongForSidebar?.title || "No song selected"}
                    </h2>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsSidebarOpen(false)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-sand-2)] transition hover:text-[var(--color-foreground)]"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="flex-1 overflow-auto p-6 space-y-6">
                {selectedSongForSidebar ? (
                  <>
                    <div className="space-y-2">
                      <label className="field-label">Basic Info</label>
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span className="text-[var(--color-sand-2)]">Genre:</span>
                          <span className="font-semibold text-[var(--color-foreground)]">{selectedSongForSidebar.genre || "—"}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-[var(--color-sand-2)]">Key:</span>
                          <span className="font-semibold text-[var(--color-foreground)]">{selectedSongForSidebar.musical_key || "—"}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-[var(--color-sand-2)]">BPM:</span>
                          <span className="font-semibold text-[var(--color-foreground)]">{selectedSongForSidebar.bpm || "—"}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-[var(--color-sand-2)]">Language:</span>
                          <span className="font-semibold text-[var(--color-foreground)]">{selectedSongForSidebar.language || "—"}</span>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="field-label">Mood & Emotion</label>
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span className="text-[var(--color-sand-2)]">Emotion:</span>
                          <span className="font-semibold text-[var(--color-foreground)]">{selectedSongForSidebar.emotion || "—"}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-[var(--color-sand-2)]">Topic:</span>
                          <span className="font-semibold text-[var(--color-foreground)] truncate max-w-[200px]">{selectedSongForSidebar.topic || "—"}</span>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="field-label">Structure</label>
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span className="text-[var(--color-sand-2)]">Sections:</span>
                          <span className="font-semibold text-[var(--color-foreground)]">{selectedSongForSidebar.section_count || 0}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-[var(--color-sand-2)]">Layers:</span>
                          <span className="font-semibold text-[var(--color-foreground)]">{selectedSongForSidebar.layer_count || 0}</span>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="field-label">Project</label>
                      <div className="text-sm">
                        <span className="font-semibold text-[var(--color-foreground)]">
                          {selectedSongForSidebar.project_slug ? projects.find(p => p.slug === selectedSongForSidebar.project_slug)?.name || "—" : "Solo track"}
                        </span>
                      </div>
                    </div>

                    {songTags[selectedSongForSidebar.id] && songTags[selectedSongForSidebar.id].length > 0 && (
                      <div className="space-y-2">
                        <label className="field-label">Tags</label>
                        <div className="flex flex-wrap gap-2">
                          {songTags[selectedSongForSidebar.id].map(tag => (
                            <span key={tag} className="glass-pill px-2 py-1 text-xs font-semibold text-[var(--color-sand-2)]">
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="space-y-2">
                      <label className="field-label">Stats</label>
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span className="text-[var(--color-sand-2)]">Last saved:</span>
                          <span className="font-semibold text-[var(--color-foreground)] text-xs">
                            {selectedSongForSidebar.saved_at ? new Date(selectedSongForSidebar.saved_at).toLocaleDateString() : "—"}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-[var(--color-sand-2)]">Synced:</span>
                          <span className="font-semibold text-[var(--color-foreground)] text-xs">
                            {new Date(selectedSongForSidebar.synced_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="flex h-full items-center justify-center text-center">
                    <div>
                      <Music2 className="mx-auto h-12 w-12 text-[var(--color-sand-2)] opacity-50" />
                      <p className="mt-4 text-sm text-[var(--color-sand-2)]">Select a song to view details</p>
                    </div>
                  </div>
                )}
              </div>

              <div className="border-t border-[var(--color-stroke)] p-4">
                <button
                  type="button"
                  onClick={() => {
                    if (selectedSongForSidebar) {
                      handleOpenStudio(selectedSongForSidebar.id, "lyrics");
                    }
                  }}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[var(--color-brass)] to-[var(--color-gold)] px-4 py-2.5 text-sm font-bold text-black shadow-md transition hover:brightness-110"
                  style={{
                    background: `linear-gradient(to right, ${projectButtonStyle.from}, ${projectButtonStyle.to})`,
                    color: projectButtonStyle.textColor
                  }}
                >
                  <Disc3 className="h-4 w-4" />
                  <span>Open in Studio</span>
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function ProductionStudioClient({}: ProductionStudioClientProps) {
  return (
    <ProductionSongProvider>
      <ProductionStudioDashboard />
    </ProductionSongProvider>
  );
}
