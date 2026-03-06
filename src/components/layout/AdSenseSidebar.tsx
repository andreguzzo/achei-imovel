import { useState } from "react";
import { ChevronRight, ChevronLeft, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const AdPlaceholder = ({ className, label }: { className?: string; label: string }) => (
  <div className={cn("flex items-center justify-center rounded-lg border border-dashed border-border bg-muted/30 text-xs text-muted-foreground", className)}>
    <span>{label}</span>
  </div>
);

const AdSenseSidebar = () => {
  const [collapsed, setCollapsed] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <aside
      className={cn(
        "hidden xl:flex flex-col shrink-0 border-l border-border bg-card/50 transition-all duration-300 ease-in-out relative",
        collapsed ? "w-10" : "w-[200px]"
      )}
    >
      {/* Toggle button */}
      <div className="sticky top-20 flex flex-col items-center">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setCollapsed(!collapsed)}
          className="h-8 w-8 rounded-full border border-border bg-card shadow-sm hover:bg-accent mt-2"
          title={collapsed ? "Expandir anúncios" : "Recolher anúncios"}
        >
          {collapsed ? <ChevronLeft className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        </Button>

        {!collapsed && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setDismissed(true)}
            className="h-6 w-6 mt-1 text-muted-foreground hover:text-foreground"
            title="Fechar anúncios"
          >
            <X className="h-3 w-3" />
          </Button>
        )}

        {!collapsed && (
          <div className="mt-4 px-3 w-full space-y-4">
            <p className="text-[10px] text-muted-foreground text-center uppercase tracking-widest">Publicidade</p>
            
            {/* Ad slots - replace with real AdSense script tags */}
            <AdPlaceholder className="h-[250px] w-full" label="Ad 160×250" />
            <AdPlaceholder className="h-[300px] w-full" label="Ad 160×300" />
            <AdPlaceholder className="h-[250px] w-full" label="Ad 160×250" />
          </div>
        )}
      </div>
    </aside>
  );
};

export default AdSenseSidebar;
