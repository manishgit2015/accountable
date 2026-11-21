import type { ReactNode } from "react";

interface PanelProps {
  title?: string;
  aside?: ReactNode;
  className?: string;
  children: ReactNode;
}

/** A white panel with 12px corners and a soft shadow (spec 3.9). */
export function Panel({ title, aside, className, children }: PanelProps) {
  return (
    <section className={className ? `panel ${className}` : "panel"}>
      {title !== undefined && (
        <div className="panel-head">
          <h2>{title}</h2>
          {aside}
        </div>
      )}
      {children}
    </section>
  );
}
