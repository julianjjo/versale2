import type { ReactNode } from "react";
import { PageContainer } from "@/components/ui";

export function StaticPage({
  title,
  intro,
  children,
}: {
  title: string;
  intro: string;
  children?: ReactNode;
}) {
  return (
    <PageContainer size="narrow" className="py-16 sm:py-20">
      <h1 className="heading-section text-text-primary">{title}</h1>
      <p className="mt-4 max-w-[560px] text-base leading-relaxed text-text-muted">
        {intro}
      </p>
      {children && (
        <div className="mt-8 space-y-6 text-sm leading-relaxed text-text-muted">
          {children}
        </div>
      )}
    </PageContainer>
  );
}
