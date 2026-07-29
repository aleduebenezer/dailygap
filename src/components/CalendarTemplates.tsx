import { Check } from "lucide-react";
import templateArtistic from "@/assets/template-artistic.jpg";
import templateVintage from "@/assets/template-vintage.jpg";
import templateRustic from "@/assets/template-rustic.jpg";
import templateMinimal from "@/assets/template-minimal.jpg";
import templateCelestial from "@/assets/template-celestial.jpg";
import templateBotanical from "@/assets/template-botanical.jpg";

export interface CalendarTemplate {
  id: string;
  name: string;
  preview: string;
  color: string;
  font: string;
  bgImage: string | null;
  bgOpacity: number;
  bgSize: "cover" | "contain";
}

const TEMPLATES: CalendarTemplate[] = [
  {
    id: "default",
    name: "Default",
    preview: "",
    color: "hsl(220, 90%, 56%)",
    font: "'Inter', sans-serif",
    bgImage: null,
    bgOpacity: 1,
    bgSize: "cover",
  },
  {
    id: "artistic",
    name: "Artistic",
    preview: templateArtistic,
    color: "hsl(350, 80%, 55%)",
    font: "'Playfair Display', serif",
    bgImage: templateArtistic,
    bgOpacity: 0.15,
    bgSize: "cover",
  },
  {
    id: "vintage",
    name: "Vintage",
    preview: templateVintage,
    color: "hsl(40, 90%, 55%)",
    font: "'Georgia', serif",
    bgImage: templateVintage,
    bgOpacity: 0.12,
    bgSize: "cover",
  },
  {
    id: "rustic",
    name: "Rustic",
    preview: templateRustic,
    color: "hsl(20, 70%, 50%)",
    font: "'Courier New', monospace",
    bgImage: templateRustic,
    bgOpacity: 0.12,
    bgSize: "cover",
  },
  {
    id: "minimal",
    name: "Minimal",
    preview: templateMinimal,
    color: "hsl(220, 10%, 30%)",
    font: "'Inter', sans-serif",
    bgImage: templateMinimal,
    bgOpacity: 0.08,
    bgSize: "cover",
  },
  {
    id: "celestial",
    name: "Celestial",
    preview: templateCelestial,
    color: "hsl(280, 70%, 55%)",
    font: "'Playfair Display', serif",
    bgImage: templateCelestial,
    bgOpacity: 0.18,
    bgSize: "cover",
  },
  {
    id: "botanical",
    name: "Botanical",
    preview: templateBotanical,
    color: "hsl(160, 60%, 45%)",
    font: "'Nunito', sans-serif",
    bgImage: templateBotanical,
    bgOpacity: 0.15,
    bgSize: "cover",
  },
];

interface CalendarTemplatesProps {
  selectedTemplate: string;
  onSelectTemplate: (template: CalendarTemplate) => void;
}

const CalendarTemplates = ({ selectedTemplate, onSelectTemplate }: CalendarTemplatesProps) => {
  return (
    <div>
      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
        Templates
      </label>
      <div className="grid grid-cols-3 gap-2 mt-2">
        {TEMPLATES.map((t) => (
          <button
            key={t.id}
            onClick={() => onSelectTemplate(t)}
            className={`relative rounded-lg overflow-hidden border-2 transition-all aspect-square ${
              selectedTemplate === t.id
                ? "border-primary ring-2 ring-primary/30 scale-105"
                : "border-transparent hover:border-muted-foreground/30"
            }`}
          >
            {t.preview ? (
              <img
                src={t.preview}
                alt={t.name}
                className="w-full h-full object-cover"
                loading="lazy"
              />
            ) : (
              <div className="w-full h-full bg-card flex items-center justify-center">
                <span className="text-[10px] text-muted-foreground font-medium">Default</span>
              </div>
            )}
            {selectedTemplate === t.id && (
              <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                <Check className="h-4 w-4 text-primary-foreground drop-shadow-md" />
              </div>
            )}
            <span className="absolute bottom-0 left-0 right-0 text-[9px] font-medium text-center py-0.5 bg-background/80 text-foreground">
              {t.name}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default CalendarTemplates;
