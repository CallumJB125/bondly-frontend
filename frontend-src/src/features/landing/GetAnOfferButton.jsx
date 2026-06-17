// Primary hero CTA. On hover the arrow nudges slightly to the right —
// everything else (colour, size, background) stays unchanged.
export default function GetAnOfferButton({ onClick, className = '', children = 'Get an offer' }) {
  return (
    <button
      type="button"
      className={`ls-btn ls-btn--primary ls-btn--lg ls-get-offer ${className}`.trim()}
      onClick={onClick}
    >
      {children}
      <span className="ls-get-offer__arrow" aria-hidden="true">→</span>
    </button>
  );
}
