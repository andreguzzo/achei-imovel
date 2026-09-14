import type { ReactNode } from "react";

interface SectionHeaderProps {
  title: string;
  description?: string;
  count?: number | string;
  action?: ReactNode;
}

export const SectionHeader = ({ title, description, count, action }: SectionHeaderProps) => (
  <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-4">
    <div className="min-w-0">
      <div className="flex items-center gap-2">
        <h2 className="font-display text-xl font-semibold text-foreground">{title}</h2>
        {count !== undefined && (
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">
            {count}
          </span>
        )}
      </div>
      {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
    </div>
    {action && <div className="shrink-0">{action}</div>}
  </div>
);

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}

export const EmptyState = ({ icon, title, description, action }: EmptyStateProps) => (
  <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-14 text-center">
    {icon && <div className="mb-3 text-muted-foreground">{icon}</div>}
    <p className="font-medium text-foreground">{title}</p>
    {description && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>}
    {action && <div className="mt-4">{action}</div>}
  </div>
);

export default SectionHeader;
