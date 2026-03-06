import { useState } from "react";
import { ChevronUp, ChevronDown, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const AdSenseBar = () => {
  const [collapsed, setCollapsed] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <div
      className={cn(
        "sticky bottom-0 z-40 border-t border-border bg-card/95 backdrop-blur-sm transition-all duration-300 ease-in-out",
        collapsed ? "h-10" : "h-[110px]"
      )}
    >
      <div className="flex items-center justify-center gap-2 h-10 px-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setCollapsed(!collapsed)}
          className="h-7 w-7 rounded-full border border-border bg-card shadow-sm hover:bg-accent"
          title={collapsed ? "Expandir anúncio" : "Recolher anúncio"}
        >
          {collapsed ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </Button>
        {!collapsed && (
          <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Publicidade</p>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setDismissed(true)}
          className="h-6 w-6 text-muted-foreground hover:text-foreground"
          title="Fechar anúncio"
        >
          <X className="h-3 w-3" />
        </Button>
      </div>

      {!collapsed && (
        <div className="flex items-center justify-center px-4 pb-3">
          {/* Ad slot - replace with real AdSense script tag */}
          <div className="flex items-center justify-center rounded-lg border border-dashed border-border bg-muted/30 text-xs text-muted-foreground h-[60px] w-full max-w-[728px]">
            <span>Ad 728×60</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdSenseBar;
