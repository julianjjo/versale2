// Shared by the review and Q&A sections of the product detail page — both
// render an identical "the seller responded" callout, just over a different
// piece of seller-authored text (a review reply vs. a question's answer).
export function SellerReplyBlock({ text }: { text: string }) {
  return (
    <div className="mt-3 rounded-md border border-border bg-surface-muted p-3">
      <p className="text-xs font-semibold text-text-primary">
        Respuesta del vendedor
      </p>
      <p className="mt-1 text-sm text-text-primary">{text}</p>
    </div>
  );
}
