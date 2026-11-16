import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { api, apiError } from '../../api/client.js';
import { ErrorState, Field, PageLoader, Spinner } from '../../components/ui.jsx';
import { useSettings } from '../../context/SettingsContext.jsx';
import { DEFAULT_THEME, contrast, themeVars } from '../../utils/theme.js';

const COLOUR_FIELDS = [
  ['primary', 'Main colour', 'Buttons, links, headings and the footer'],
  ['accent', 'Accent colour', 'Highlights, labels and small details'],
  ['background', 'Background colour', 'The page background and cards'],
];
const PRESETS = [
  ['Classic wine', DEFAULT_THEME],
  ['Chocolate', { primary: '#5C3317', accent: '#C08A3E', background: '#FAF5EF' }],
  ['Rose', { primary: '#9C2F5B', accent: '#D4A15A', background: '#FDF6F8' }],
  ['Royal blue', { primary: '#1F3A8A', accent: '#C9A227', background: '#F6F8FC' }],
  ['Forest', { primary: '#2F5D3A', accent: '#C29B43', background: '#F7F8F2' }],
];

// The website's colours, with a live preview. The admin panel keeps its blue theme.
function ThemeSettings({ theme, onChange, disabled }) {
  const vars = themeVars(theme);
  const lowButton = contrast(theme.primary, '#FFFFFF') < 4.5;
  const lowText = contrast(theme.background, '#2B1A1E') < 4.5;
  const c = (name) => `rgb(var(--c-${name}))`;
  return (
    <div className="grid gap-5 [grid-template-columns:repeat(auto-fit,minmax(min(380px,100%),1fr))]">
      <div className="card card-b flex flex-col gap-4">
        <div>
          <span className="lbl">Ready-made looks</span>
          <div className="flex flex-wrap gap-2">
            {PRESETS.map(([name, p]) => (
              <button key={name} type="button" className="btn btn-o btn-sm" disabled={disabled} onClick={() => onChange(p)}>
                <span className="flex" aria-hidden="true">{[p.primary, p.accent, p.background].map((x) => <span key={x} className="h-4 w-4 rounded-full border border-black/10" style={{ background: x }} />)}</span>
                {name}
              </button>
            ))}
          </div>
        </div>
        {COLOUR_FIELDS.map(([key, label, help]) => (
          <Field key={key} label={label} htmlFor={`th-${key}`} help={help}>
            <div className="flex items-center gap-2">
              <input id={`th-${key}`} type="color" className="h-11 w-14 cursor-pointer rounded-lg border border-line bg-white p-1" value={theme[key]} disabled={disabled} onChange={(e) => onChange({ ...theme, [key]: e.target.value.toUpperCase() })} />
              <input className="in !w-32 font-mono uppercase" aria-label={`${label} code`} maxLength={7} value={theme[key]} disabled={disabled}
                onChange={(e) => { const v = e.target.value.trim(); if (/^#[0-9a-f]{6}$/i.test(v)) onChange({ ...theme, [key]: v.toUpperCase() }); }} />
            </div>
          </Field>
        ))}
        {lowButton && <p className="errbox">The main colour is too light for white button text. Choose a darker colour so buttons stay readable.</p>}
        {lowText && <p className="errbox">The background is too dark for the website text. Choose a lighter background.</p>}
        <button type="button" className="btn btn-ghost btn-sm self-start" disabled={disabled} onClick={() => onChange(DEFAULT_THEME)}>Reset to original colours</button>
      </div>
      <div className="card card-b">
        <span className="lbl">Preview</span>
        <div className="overflow-hidden rounded-xl border" style={{ ...vars, background: c('cream'), borderColor: c('line') }}>
          <div className="flex items-center gap-3 border-b px-4 py-3" style={{ background: c('paper'), borderColor: c('line-2') }}>
            <span className="flex h-9 w-9 items-center justify-center rounded-full text-sm font-extrabold" style={{ background: c('wine'), color: '#fff' }}>PB</span>
            <b style={{ color: c('wine') }}>Patiala Bakers</b>
            <span className="ml-auto text-xs font-bold" style={{ color: c('gold-d') }}>Cakes · Sweets</span>
          </div>
          <div className="flex flex-col gap-3 p-4">
            <span className="text-xs font-extrabold uppercase tracking-[.16em]" style={{ color: c('gold-d') }}>Fresh today</span>
            <b className="text-xl" style={{ color: c('wine-ink') }}>Rasmalai Cake</b>
            <div className="rounded-xl border p-3 text-sm" style={{ background: c('paper'), borderColor: c('line-2'), color: '#2B1A1E' }}>Cardamom sponge with saffron cream. <span className="rounded-full px-2 py-0.5 text-xs font-bold" style={{ background: c('gold-bg'), color: c('gold-d') }}>Bestseller</span></div>
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full px-4 py-2 text-sm font-bold" style={{ background: c('wine'), color: '#fff' }}>Add to cart</span>
              <span className="rounded-full border px-4 py-2 text-sm font-bold" style={{ borderColor: c('wine'), color: c('wine') }}>View menu</span>
            </div>
          </div>
          <div className="px-4 py-3 text-xs" style={{ background: c('wine-d'), color: '#FFF4E6' }}>Footer · 161 High St, Belmont</div>
        </div>
        <p className="help">Click Save colours to change the website. Visitors see the new colours when they next open a page.</p>
      </div>
    </div>
  );
}

// A page only reachable by its address, for staff with Settings access
export default function WebsiteColours() {
  const { reload: reloadPublic } = useSettings();
  const [saved, setSaved] = useState(null);
  const [theme, setTheme] = useState(null);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/admin/settings')
      .then(({ data }) => { const t = { ...DEFAULT_THEME, ...data.settings.theme }; setSaved(t); setTheme(t); })
      .catch((e) => setError(apiError(e).message));
  }, []);
  if (error) return <ErrorState message={error} />;
  if (!theme) return <PageLoader />;

  const dirty = JSON.stringify(theme) !== JSON.stringify(saved);
  const save = async () => {
    setSaving(true);
    try {
      const { data } = await api.patch('/admin/settings', { theme });
      const t = { ...DEFAULT_THEME, ...data.settings.theme };
      setSaved(t); setTheme(t);
      reloadPublic();
      toast.success('Website colours saved');
    } catch (e) {
      toast.error(apiError(e).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div>
        <h2 className="font-sans text-xl font-extrabold">Website colours</h2>
        <p className="text-sm muted">Changes the colours customers see on the website. The admin panel keeps its own colours.</p>
      </div>
      <ThemeSettings theme={theme} onChange={setTheme} disabled={saving} />
      <div className="sticky bottom-0 z-10 -mx-4 flex items-center gap-3 border-t border-line bg-paper/95 px-4 py-3 backdrop-blur lg:-mx-8 lg:px-8">
        <span className="flex-1 text-sm muted">{dirty ? 'You have unsaved changes.' : 'All changes saved.'}</span>
        {dirty && <button className="btn btn-o" disabled={saving} onClick={() => setTheme(saved)}>Undo changes</button>}
        <button className="btn btn-p" disabled={!dirty || saving} onClick={save}>{saving && <Spinner />} Save colours</button>
      </div>
    </>
  );
}