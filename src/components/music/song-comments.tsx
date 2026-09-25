"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  MessageSquare,
  Send,
  X,
  Trash2,
  Clock,
  User,
} from "lucide-react";
import { toast } from "sonner";

type Comment = {
  id: string;
  songId: string;
  author: string;
  content: string;
  timestamp: string;
};

type SongCommentsProps = {
  songId: string;
  songTitle: string;
  isOpen: boolean;
  onClose: () => void;
};

// Simulated comments storage (in real app, this would be backed by a database)
import { readStored, useCurrentUserId, userKey, writeStored } from "@/lib/persist";

const COMMENTS_STORAGE_KEY = "song_comments";
const COMMENT_AUTHOR_KEY = "comment_author";

function commentsKey(userId: string | null) {
  return userId ? userKey(userId, COMMENTS_STORAGE_KEY) : COMMENTS_STORAGE_KEY;
}

function authorKey(userId: string | null) {
  return userId ? userKey(userId, COMMENT_AUTHOR_KEY) : COMMENT_AUTHOR_KEY;
}

function getComments(userId: string | null): Comment[] {
  if (typeof window === "undefined") return [];
  return readStored<Comment[]>(commentsKey(userId), []);
}

function saveComments(userId: string | null, comments: Comment[]) {
  if (typeof window === "undefined") return;
  try {
    writeStored(commentsKey(userId), comments);
  } catch (error) {
    console.error("Failed to save comments:", error);
  }
}

export function SongComments({ songId, songTitle, isOpen, onClose }: SongCommentsProps) {
  const userId = useCurrentUserId();
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [author, setAuthor] = useState("");

  useEffect(() => {
    if (isOpen) {
      const allComments = getComments(userId);
      const songComments = allComments.filter((c) => c.songId === songId);
      setComments(songComments);

      // Load saved author name
      const savedAuthor = readStored<string>(authorKey(userId), "");
      if (savedAuthor) setAuthor(savedAuthor);
    }
  }, [isOpen, songId, userId]);

  const handleAddComment = () => {
    if (!newComment.trim()) {
      toast.error("Comment cannot be empty");
      return;
    }

    if (!author.trim()) {
      toast.error("Please enter your name");
      return;
    }

    const comment: Comment = {
      id: Date.now().toString(),
      songId,
      author: author.trim(),
      content: newComment.trim(),
      timestamp: new Date().toISOString(),
    };

    const allComments = getComments(userId);
    allComments.push(comment);
    saveComments(userId, allComments);

    setComments([...comments, comment]);
    setNewComment("");
    writeStored(authorKey(userId), author.trim());
    toast.success("Comment added");
  };

  const handleDeleteComment = (commentId: string) => {
    const allComments = getComments(userId);
    const filtered = allComments.filter((c) => c.id !== commentId);
    saveComments(userId, filtered);

    const songComments = filtered.filter((c) => c.songId === songId);
    setComments(songComments);
    toast.success("Comment deleted");
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
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
                  <MessageSquare className="h-5 w-5" />
                </div>
                <div>
                  <div className="eyebrow text-[0.62rem]">Collaboration</div>
                  <h2 className="text-lg font-bold tracking-tight text-[var(--color-foreground)]">
                    Comments - {songTitle}
                  </h2>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="flex h-8 w-8 items-center justify-center rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-sand-2)] transition hover:text-[var(--color-foreground)]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex h-[400px] flex-col">
              {/* Comments List */}
              <div className="flex-1 overflow-y-auto p-6">
                {comments.length === 0 ? (
                  <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-soft)] text-[var(--color-sand-2)]">
                      <MessageSquare className="h-6 w-6" />
                    </div>
                    <div className="space-y-1">
                      <h3 className="text-sm font-bold text-[var(--color-foreground)]">No comments yet</h3>
                      <p className="text-xs text-[var(--color-sand-2)]">Be the first to leave a comment on this song</p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {comments.map((comment) => (
                      <motion.div
                        key={comment.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="group rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-soft)] p-4"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3">
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--color-brass)] text-xs font-bold text-black">
                              {comment.author.charAt(0).toUpperCase()}
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-[var(--color-foreground)]">{comment.author}</span>
                                <span className="flex items-center gap-1 text-[10px] text-[var(--color-sand-2)]">
                                  <Clock className="h-3 w-3" />
                                  {formatTimestamp(comment.timestamp)}
                                </span>
                              </div>
                              <p className="mt-1 text-xs text-[var(--color-foreground)]">{comment.content}</p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleDeleteComment(comment.id)}
                            className="opacity-0 transition-opacity group-hover:opacity-100"
                          >
                            <Trash2 className="h-3.5 w-3.5 text-red-500 hover:text-red-600" />
                          </button>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>

              {/* Add Comment Form */}
              <div className="border-t border-[var(--color-stroke)] p-4">
                <div className="space-y-3">
                  <input
                    type="text"
                    placeholder="Your name"
                    value={author}
                    onChange={(e) => setAuthor(e.target.value)}
                    className="field text-xs"
                  />
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Add a comment..."
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleAddComment();
                        }
                      }}
                      className="field flex-1 text-xs"
                    />
                    <button
                      type="button"
                      onClick={handleAddComment}
                      className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-r from-[var(--color-brass)] to-[var(--color-gold)] text-black shadow-md transition hover:brightness-110 active:scale-95"
                    >
                      <Send className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}