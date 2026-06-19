import { LOCALES, LOCALE_LABELS, type Locale } from "@/lib/i18n";

export function LocaleSwitcher({ current, next }: { current: Locale; next: string }) {
  return (
    <form
      action="/api/locale"
      method="post"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        fontSize: 12,
        color: "var(--text-tertiary)"
      }}
    >
      <input type="hidden" name="next" value={next} />
      <label htmlFor="locale-switcher" style={{ fontWeight: 500 }}>
        Language
      </label>
      <select
        id="locale-switcher"
        name="locale"
        defaultValue={current}
        onChange={(event) => event.currentTarget.form?.requestSubmit()}
        style={{
          border: "1px solid var(--border)",
          borderRadius: 6,
          padding: "3px 8px",
          background: "var(--surface)",
          fontSize: 12
        }}
      >
        {LOCALES.map((locale) => (
          <option key={locale} value={locale}>
            {LOCALE_LABELS[locale]}
          </option>
        ))}
      </select>
      <noscript>
        <button type="submit" style={{ fontSize: 12 }}>
          Save
        </button>
      </noscript>
    </form>
  );
}
