import { useState, useRef, useCallback, useEffect } from "react";
import { ImagePlus, Trash2, Move } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Decoration {
  id: string;
  calendar_id: string;
  user_id: string;
  image_url: string;
  x_percent: number;
  y_percent: number;
  width_percent: number;
  height_percent: number;
  z_index: number;
}

interface CalendarDecorationsProps {
  calendarId: string | null;
  userId: string;
}

const useCalendarDecorations = ({ calendarId, userId }: CalendarDecorationsProps) => {
  const [decorations, setDecorations] = useState<Decoration[]>([]);
  const [editMode, setEditMode] = useState(false);
  const [dragging, setDragging] = useState<string | null>(null);
  const [resizing, setResizing] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragStart = useRef({ x: 0, y: 0, ox: 0, oy: 0 });
  const resizeStart = useRef({ x: 0, y: 0, ow: 0, oh: 0 });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchDecorations = useCallback(async () => {
    if (!calendarId) return;
    const { data } = await supabase
      .from("calendar_decorations")
      .select("*")
      .eq("calendar_id", calendarId);
    setDecorations(data || []);
  }, [calendarId]);

  useEffect(() => { fetchDecorations(); }, [fetchDecorations]);

  const handleUpload = async (file: File) => {
    if (!calendarId) return;
    if (!file.type.startsWith("image/")) { toast.error("Please upload an image"); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error("Max 5MB"); return; }

    const ext = file.name.split(".").pop();
    const path = `${userId}/${calendarId}/${crypto.randomUUID()}.${ext}`;
    const { error: uploadError } = await supabase.storage.from("calendar-images").upload(path, file);
    if (uploadError) { toast.error("Upload failed"); return; }

    const { data: { publicUrl } } = supabase.storage.from("calendar-images").getPublicUrl(path);

    const { data, error } = await supabase
      .from("calendar_decorations")
      .insert({
        calendar_id: calendarId,
        user_id: userId,
        image_url: publicUrl,
        x_percent: 5 + Math.random() * 20,
        y_percent: 5 + Math.random() * 20,
        width_percent: 25,
        height_percent: 25,
        z_index: decorations.length + 1,
      })
      .select()
      .single();

    if (error) { toast.error("Failed to save"); return; }
    setDecorations((prev) => [...prev, data]);
    setSelectedId(data.id);
    toast.success("Image added! Drag to position it.");
  };

  const handleDelete = async (id: string) => {
    const dec = decorations.find((d) => d.id === id);
    if (!dec) return;
    const urlParts = dec.image_url.split("/calendar-images/");
    if (urlParts[1]) {
      await supabase.storage.from("calendar-images").remove([decodeURIComponent(urlParts[1])]);
    }
    await supabase.from("calendar_decorations").delete().eq("id", id);
    setDecorations((prev) => prev.filter((d) => d.id !== id));
    if (selectedId === id) setSelectedId(null);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file?.type.startsWith("image/")) {
      if (!editMode) setEditMode(true);
      handleUpload(file);
    }
  };

  const startDrag = (e: React.MouseEvent, id: string) => {
    if (!editMode) return;
    e.stopPropagation();
    e.preventDefault();
    const dec = decorations.find((d) => d.id === id);
    if (!dec) return;
    setDragging(id);
    setSelectedId(id);
    dragStart.current = { x: e.clientX, y: e.clientY, ox: dec.x_percent, oy: dec.y_percent };
  };

  const startResize = (e: React.MouseEvent, id: string) => {
    if (!editMode) return;
    e.stopPropagation();
    e.preventDefault();
    const dec = decorations.find((d) => d.id === id);
    if (!dec) return;
    setResizing(id);
    resizeStart.current = { x: e.clientX, y: e.clientY, ow: dec.width_percent, oh: dec.height_percent };
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();

    if (dragging) {
      const dx = ((e.clientX - dragStart.current.x) / rect.width) * 100;
      const dy = ((e.clientY - dragStart.current.y) / rect.height) * 100;
      setDecorations((prev) =>
        prev.map((d) =>
          d.id === dragging
            ? { ...d, x_percent: Math.max(-5, Math.min(90, dragStart.current.ox + dx)), y_percent: Math.max(-5, Math.min(90, dragStart.current.oy + dy)) }
            : d
        )
      );
    }

    if (resizing) {
      const dx = ((e.clientX - resizeStart.current.x) / rect.width) * 100;
      const dy = ((e.clientY - resizeStart.current.y) / rect.height) * 100;
      setDecorations((prev) =>
        prev.map((d) =>
          d.id === resizing
            ? { ...d, width_percent: Math.max(5, Math.min(80, resizeStart.current.ow + dx)), height_percent: Math.max(5, Math.min(80, resizeStart.current.oh + dy)) }
            : d
        )
      );
    }
  }, [dragging, resizing]);

  const handleMouseUp = useCallback(async () => {
    const id = dragging || resizing;
    if (id) {
      const dec = decorations.find((d) => d.id === id);
      if (dec) {
        await supabase.from("calendar_decorations").update({
          x_percent: dec.x_percent,
          y_percent: dec.y_percent,
          width_percent: dec.width_percent,
          height_percent: dec.height_percent,
        }).eq("id", id);
      }
    }
    setDragging(null);
    setResizing(null);
  }, [dragging, resizing, decorations]);

  useEffect(() => {
    if (dragging || resizing) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
      return () => {
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
      };
    }
  }, [dragging, resizing, handleMouseMove, handleMouseUp]);

  return {
    editMode,
    setEditMode,
    decorations,
    selectedId,
    setSelectedId,
    containerRef,
    fileInputRef,
    handleUpload,
    handleDelete,
    onDrop,
    startDrag,
    startResize,
  };
};

export default useCalendarDecorations;

// Toolbar component
export const DecorationToolbar = ({
  editMode,
  setEditMode,
  setSelectedId,
  fileInputRef,
  handleUpload,
}: {
  editMode: boolean;
  setEditMode: (v: boolean) => void;
  setSelectedId: (v: string | null) => void;
  fileInputRef: React.RefObject<HTMLInputElement>;
  handleUpload: (file: File) => void;
}) => (
  <div className="flex flex-wrap items-center gap-2 mb-3">
    <Button
      variant={editMode ? "default" : "outline"}
      size="sm"
      className="gap-1.5 text-xs h-9"
      onClick={() => { setEditMode(!editMode); setSelectedId(null); }}
    >
      <ImagePlus className="h-3.5 w-3.5" />
      {editMode ? "Done Editing" : "Add Illustrations"}
    </Button>
    {editMode && (
      <>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 text-xs h-9"
          onClick={() => fileInputRef.current?.click()}
        >
          Upload Image
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleUpload(f);
            if (fileInputRef.current) fileInputRef.current.value = "";
          }}
        />
      </>
    )}
  </div>
);

// Overlay component
export const DecorationOverlay = ({
  editMode,
  decorations,
  selectedId,
  setSelectedId,
  containerRef,
  onDrop,
  startDrag,
  startResize,
  handleDelete,
}: {
  editMode: boolean;
  decorations: Array<{
    id: string;
    image_url: string;
    x_percent: number;
    y_percent: number;
    width_percent: number;
    height_percent: number;
    z_index: number;
  }>;
  selectedId: string | null;
  setSelectedId: (v: string | null) => void;
  containerRef: React.RefObject<HTMLDivElement>;
  onDrop: (e: React.DragEvent) => void;
  startDrag: (e: React.MouseEvent, id: string) => void;
  startResize: (e: React.MouseEvent, id: string) => void;
  handleDelete: (id: string) => void;
}) => (
  <div
    ref={containerRef}
    className="absolute inset-0 z-10"
    style={{ pointerEvents: editMode ? "auto" : "none" }}
    onDragOver={(e) => e.preventDefault()}
    onDrop={onDrop}
    onClick={() => { if (editMode) setSelectedId(null); }}
  >
    {editMode && decorations.length === 0 && (
      <div className="absolute inset-0 flex items-center justify-center border-2 border-dashed border-primary/20 rounded-2xl pointer-events-none">
        <p className="text-xs text-muted-foreground">Drag & drop images here to decorate</p>
      </div>
    )}

    {decorations.map((dec) => (
      <div
        key={dec.id}
        className={`absolute ${editMode ? "cursor-move" : ""}`}
        style={{
          left: `${dec.x_percent}%`,
          top: `${dec.y_percent}%`,
          width: `${dec.width_percent}%`,
          height: `${dec.height_percent}%`,
          zIndex: dec.z_index,
          pointerEvents: editMode ? "auto" : "none",
        }}
        onMouseDown={(e) => startDrag(e, dec.id)}
        onClick={(e) => { e.stopPropagation(); if (editMode) setSelectedId(dec.id); }}
      >
        <img
          src={dec.image_url}
          alt="Decoration"
          className={`w-full h-full object-contain select-none ${
            editMode && selectedId === dec.id ? "ring-2 ring-primary rounded-lg" : ""
          }`}
          draggable={false}
        />
        {editMode && selectedId === dec.id && (
          <>
            <button
              className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-1 shadow-md hover:scale-110 transition-transform z-20"
              onClick={(e) => { e.stopPropagation(); handleDelete(dec.id); }}
            >
              <Trash2 className="h-3 w-3" />
            </button>
            <div className="absolute top-1 left-1 bg-background/80 rounded p-0.5">
              <Move className="h-3 w-3 text-muted-foreground" />
            </div>
            <div
              className="absolute bottom-0 right-0 w-4 h-4 bg-primary rounded-tl-md cursor-se-resize z-20"
              onMouseDown={(e) => startResize(e, dec.id)}
            />
          </>
        )}
      </div>
    ))}
  </div>
);
