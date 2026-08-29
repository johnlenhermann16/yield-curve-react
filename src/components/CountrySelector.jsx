import { COUNTRIES } from '../constants'

// Country toggles as pill chips with a swatch matching the chart line colour —
// the design's "Countries" field pattern. 10Y-only countries draw a dot rather
// than a line (matching their diamond markers) and carry a "10Y only" tag. The
// real checkbox is kept rather than a drawn box so the control stays keyboard-
// and screen-reader-navigable; .chip:has(:focus-visible) rings the whole pill.
export default function CountrySelector({ selected, onToggle }) {
  return (
    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
      {COUNTRIES.map((country) => {
        const isOn = selected.includes(country.name)
        return (
          <label key={country.name} className={isOn ? 'chip chip-on' : 'chip'}>
            {/* Visually hidden, not removed: the chip's own fill and border
                carry the state visually, while the real checkbox keeps the
                control keyboard- and screen-reader-navigable and
                .chip:has(:focus-visible) still rings the whole pill. */}
            <input
              type="checkbox"
              className="sr-only"
              checked={isOn}
              onChange={() => onToggle(country.name)}
            />
            <span
              style={{
                display: 'inline-block', flex: 'none', background: country.color,
                width: country.tenYearOnly ? 9 : 22,
                height: country.tenYearOnly ? 9 : 3,
                borderRadius: country.tenYearOnly ? '50%' : 2,
              }}
            />
            <span>{country.name}</span>
            {country.tenYearOnly && <span className="tag tag-accent">10Y only</span>}
          </label>
        )
      })}
    </div>
  )
}
