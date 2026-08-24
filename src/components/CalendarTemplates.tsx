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
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 mt-2">
        {TEMPLATES.map((t) => (
          <button
            key={t.id}
            onClick={() => onSelectTemplate(t)}
            className={`relative rounded-xl overflow-hidden border-2 transition-all aspect-square text-left focus:outline-none ${
              selectedTemplate === t.id
                ? "border-primary ring-2 ring-primary/30 scale-[1.02] shadow-sm"
                : "border-border/60 hover:border-muted-foreground/40 bg-card"
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
                <span className="text-xs text-muted-foreground font-medium">Default</span>
              </div>
            )}
            {selectedTemplate === t.id && (
              <div className="absolute inset-0 bg-primary/20 backdrop-blur-[1px] flex items-center justify-center">
                <div className="h-6 w-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-md">
                  <Check className="h-3.5 w-3.5 stroke-[3]" />
                </div>
              </div>
            )}
            <span className="absolute bottom-0 left-0 right-0 text-[10px] sm:text-xs font-medium text-center py-1 bg-background/90 text-foreground backdrop-blur-xs border-t border-border/40 truncate px-1">
              {t.name}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default CalendarTemplates;
