import { useState, useRef, useEffect } from 'react';
import { LOCATIONS, buildLinks } from '../lib/propertyLinks.js';
import './PropertySearchCTA.css';

const fmt = n => 'R ' + Math.round(n).toLocaleString('en-ZA');

// Default locations shown before typing (one per province, most popular)
const DEFAULTS = ['Cape Town', 'Johannesburg', 'Durban', 'Pretoria', 'Gqeberha', 'Bloemfontein', 'Polokwane', 'Nelspruit', 'Kimberley', 'Rustenburg'];
const defaultLocations = DEFAULTS.map(name => LOCATIONS.find(l => l.city === name)).filter(Boolean);

export default function PropertySearchCTA({ maxBond, compact = false, defaultExpanded = false }) {
  const [expanded,  setExpanded]  = useState(defaultExpanded);
  const [query,     setQuery]     = useState('');
  const [selected,  setSelected]  = useState(null);
  const [dropOpen,  setDropOpen]  = useState(false);
  const inputRef    = useRef(null);
  const containerRef = useRef(null);

  // Close dropdown on outside click — must be before the early return to satisfy Rules of Hooks
  useEffect(() => {
    if (!dropOpen) return;
    function onDown(e) {
      if (!containerRef.current?.contains(e.target)) setDropOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [dropOpen]);

  if (!maxBond || maxBond < 100000) return null;

  const q = query.trim().toLowerCase();
  const filtered = q.length < 2
    ? defaultLocations
    : LOCATIONS.filter(l =>
        l.city.toLowerCase().includes(q) ||
        l.province.toLowerCase().includes(q)
      ).slice(0, 12);

  function pick(loc) {
    setSelected(loc);
    setQuery(loc.city);
    setDropOpen(false);
  }

  function reset() {
    setSelected(null);
    setQuery('');
    setDropOpen(true);
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  function onExpand() {
    setExpanded(x => !x);
    if (!expanded) setTimeout(() => { inputRef.current?.focus(); setDropOpen(true); }, 120);
  }

  const links = selected ? buildLinks(selected, maxBond) : null;

  return (
    <div className={`prop-cta ${compact ? 'prop-cta--compact' : ''}`} ref={containerRef}>
      <button className="prop-cta__trigger" onClick={onExpand} type="button">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
          <polyline points="9 22 9 12 15 12 15 22"/>
        </svg>
        Browse homes in your price range
        <svg
          className={`prop-cta__chevron ${expanded ? 'prop-cta__chevron--open' : ''}`}
          width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
          aria-hidden="true"
        >
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>

      {expanded && (
        <div className="prop-cta__body fade-in">

          {/* Search input */}
          <div className="prop-cta__search-wrap">
            <svg className="prop-cta__search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              ref={inputRef}
              className="prop-cta__search-input"
              placeholder="Search your city or area..."
              value={query}
              onChange={e => { setQuery(e.target.value); setDropOpen(true); if (selected) setSelected(null); }}
              onFocus={() => setDropOpen(true)}
              autoComplete="off"
              spellCheck="false"
              aria-label="Search location"
              aria-autocomplete="list"
            />
            {query && (
              <button className="prop-cta__search-clear" onClick={reset} type="button" aria-label="Clear search">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            )}
          </div>

          {/* Dropdown */}
          {dropOpen && !selected && (
            <div className="prop-cta__dropdown" role="listbox">
              {q.length < 2 && (
                <div className="prop-cta__drop-heading">Popular locations</div>
              )}
              {filtered.map((loc, i) => (
                <button
                  key={i}
                  className="prop-cta__drop-item"
                  onMouseDown={e => { e.preventDefault(); pick(loc); }}
                  type="button"
                  role="option"
                >
                  <span className="prop-cta__drop-city">{loc.city}</span>
                  <span className="prop-cta__drop-prov">{loc.province}</span>
                </button>
              ))}
              {q.length >= 2 && filtered.length === 0 && (
                <div className="prop-cta__drop-empty">
                  No match — try your province name (e.g. "Western Cape")
                </div>
              )}
              {q.length < 2 && (
                <div className="prop-cta__drop-hint">Type to search all 60+ SA cities and towns</div>
              )}
            </div>
          )}

          {/* Results */}
          {selected && links && (
            <div className="prop-cta__result fade-in">
              <div className="prop-cta__selected-row">
                <span className="prop-cta__selected-name">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                    <circle cx="12" cy="10" r="3"/>
                  </svg>
                  {selected.city}, {selected.province}
                </span>
                <button className="prop-cta__change" onClick={reset} type="button">Change</button>
              </div>

              <div className="prop-cta__range">
                Homes {fmt(links.lo)} – {fmt(links.hi)}
                {!links.citySpecific && (
                  <span className="prop-cta__range-note"> · showing all of {selected.province}</span>
                )}
              </div>

              <div className="prop-cta__links">
                <a
                  className="prop-cta__link prop-cta__link--p24"
                  href={links.p24}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                    <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
                  </svg>
                  Property24
                </a>
                <a
                  className="prop-cta__link prop-cta__link--pp"
                  href={links.pp}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                    <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
                  </svg>
                  Private Property
                </a>
              </div>

              <p className="prop-cta__disclaimer">
                Links open the property portals — Bondly has no affiliation with either site.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
