import { useState, useEffect, useRef } from "react";
import { ImagePlus, Trash2, Image, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface GalleryImage {
  id: string;
  image_url: string;
  filename: string | null;
  created_at: string;
}

interface ImageGalleryProps {
  userId: string;
}

const ImageGallery = ({ userId }: ImageGalleryProps) => {
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchImages();
  }, [userId]);

  const fetchImages = async () => {
    const { data, error } = await supabase
      .from("gallery_images")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (error) {
      toast.error("Failed to load gallery");
    } else {
      setImages(data as GalleryImage[]);
    }
    setLoading(false);
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        if (!file.type.startsWith("image/")) {
          toast.error(`${file.name} is not an image`);
          continue;
        }
        if (file.size > 5 * 1024 * 1024) {
          toast.error(`${file.name} exceeds 5MB limit`);
          continue;
        }

        const ext = file.name.split(".").pop();
        const path = `${userId}/${crypto.randomUUID()}.${ext}`;

        const { error: uploadErr } = await supabase.storage
          .from("gallery-images")
          .upload(path, file);
        if (uploadErr) throw uploadErr;

        const { data: urlData } = supabase.storage
          .from("gallery-images")
          .getPublicUrl(path);

        const { error: insertErr } = await supabase
          .from("gallery_images")
          .insert({
            user_id: userId,
            image_url: urlData.publicUrl,
            filename: file.name,
          });
        if (insertErr) throw insertErr;
      }

      toast.success("Images uploaded!");
      fetchImages();
    } catch (err: any) {
      toast.error(err.message || "Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleDelete = async (img: GalleryImage) => {
    try {
      // Extract storage path from URL
      const url = new URL(img.image_url);
      const pathParts = url.pathname.split("/gallery-images/");
      if (pathParts[1]) {
        await supabase.storage.from("gallery-images").remove([pathParts[1]]);
      }

      const { error } = await supabase
        .from("gallery_images")
        .delete()
        .eq("id", img.id);
      if (error) throw error;

      setImages((prev) => prev.filter((i) => i.id !== img.id));
      toast.success("Image deleted");
    } catch (err: any) {
      toast.error(err.message || "Failed to delete");
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Image Gallery
        </h3>
        <Button
          variant="ghost"
          size="sm"
          className="gap-1 text-xs"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <ImagePlus className="h-3 w-3" />
          )}
          Add
        </Button>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={handleUpload}
      />

      {loading ? (
        <div className="text-center py-4">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground mx-auto" />
        </div>
      ) : images.length === 0 ? (
        <button
          onClick={() => fileRef.current?.click()}
          className="w-full glass rounded-xl p-6 text-center hover:bg-card/90 transition-all border-2 border-dashed border-border"
        >
          <Image className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">
            Upload images to attach to your LinkedIn posts
          </p>
        </button>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {images.map((img) => (
            <div
              key={img.id}
              className="relative group aspect-square rounded-lg overflow-hidden"
            >
              <img
                src={img.image_url}
                alt={img.filename || "Gallery image"}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-white hover:text-destructive"
                  onClick={() => handleDelete(img)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {images.length > 0 && (
        <p className="text-xs text-muted-foreground text-center">
          {images.length} image{images.length !== 1 ? "s" : ""} • Random image attached to each LinkedIn post
        </p>
      )}
    </div>
  );
};

export default ImageGallery;
