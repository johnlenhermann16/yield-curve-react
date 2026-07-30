import { COUNTRIES } from '../constants'

// Country toggles as checkbox rows with a line swatch matching the chart line
// colour — the design's "Countries" field pattern. 10Y-only countries carry a
// small "10Y only" tag.
export default function CountrySelector({ selected, onToggle }) {
  return (
    <div style={{ display: 'flex', gap: 'var(--space-6)', flexWrap: 'wrap', alignItems: 'center' }}>
      {COUNTRIES.map((country) => {
        const isOn = selected.includes(country.name)
        return (
          <label
            key={country.name}
            style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontSize: 15, cursor: 'pointer' }}
          >
            <input type="checkbox" checked={isOn} onChange={() => onToggle(country.name)} />
            <span
              style={{
                display: 'inline-block', background: country.color,
                width: country.tenYearOnly ? 8 : 20,
                height: country.tenYearOnly ? 8 : 3,
                borderRadius: country.tenYearOnly ? '50%' : 0,
              }}
            />
            <span style={{ opacity: isOn ? 1 : 0.7 }}>{country.name}</span>
            {country.tenYearOnly && <span className="tag tag-neutral">10Y only</span>}
          </label>
        )
      })}
    </div>
  )
}
