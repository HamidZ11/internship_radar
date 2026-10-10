import { FormEvent, KeyboardEvent, ReactNode, useEffect, useId, useRef, useState } from "react";
import { createJob } from "../api";
import { useStore } from "../store";
import { Icon } from "../ui/primitives";
import { btnPrimary, btnSecondary, focusRing, inputCls } from "../ui/styles";

// Manual entry: the existing POST /jobs form. The backend scores the role.

const ROLE_TYPES = [
  { label: "Placement", value: "placement" },
  { label: "Internship", value: "internship" },
  { label: "Graduate scheme", value: "graduate" },
  { label: "Apprenticeship", value: "apprenticeship" },
  { label: "Work experience", value: "work experience" },
  { label: "Other", value: "other" },
];

const SOURCES = [
  { label: "Manual", value: "manual" },
  { label: "RateMyPlacement", value: "ratemyplacement" },
  { label: "Gradcracker", value: "gradcracker" },
  { label: "Bright Network", value: "brightnetwork" },
  { label: "Prospects", value: "prospects" },
  { label: "Other", value: "other" },
];

const EMPTY = {
  title: "", company: "", location: "", url: "", source: "manual", role_type: "placement", description: "", deadline: "",
};

export function AddRoleDialog({ onClose }: { onClose: () => void }) {
  const { addJob } = useStore();
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const set = (k: keyof typeof EMPTY, v: string) => setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    const returnTo = document.activeElement as HTMLElement | null;
    panelRef.current?.querySelector<HTMLElement>("input")?.focus();
    return () => returnTo?.focus();
  }, []);

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === "Escape") { e.stopPropagation(); onClose(); return; }
    if (e.key !== "Tab") return;
    // Keep focus inside the dialog.
    const items = [...(panelRef.current?.querySelectorAll<HTMLElement>("input, select, textarea, button, a[href]") ?? [])]
      .filter((el) => !el.hasAttribute("disabled"));
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!form.title.trim() || !form.company.trim() || !form.url.trim()) {
      setError("Title, company and URL are required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const job = await createJob({ ...form, deadline: form.deadline || null, posted_date: null });
      addJob(job);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't add the role.");
      setSaving(false);
    }
  }

  return (
    <div
      className="ui-fade fixed inset-0 z-50 grid place-items-end bg-[#0F1217]/30 sm:place-items-center sm:p-6"
      onPointerDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onKeyDown={onKeyDown}
        className="ui-pop flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-[12px] border border-[#E3E6EA] bg-white shadow-[0_24px_64px_rgb(15_18_23/0.24)] sm:max-w-[520px] sm:rounded-[12px]"
      >
        <div className="flex h-12 shrink-0 items-center justify-between border-b border-[#EDEFF2] pl-5 pr-2">
          <h2 id={titleId} className="text-[14px] font-semibold">Add a role</h2>
          <button onClick={onClose} aria-label="Close" className={`grid h-8 w-8 place-items-center rounded-[7px] text-[#5F6570] hover:bg-[#F1F3F5] hover:text-[#0F1217] ${focusRing}`}>
            <Icon name="x" size={16} />
          </button>
        </div>

        <form id="add-role" onSubmit={submit} noValidate className="flex flex-col gap-3.5 overflow-y-auto overscroll-contain px-5 py-4">
          {error && (
            <p role="alert" className="rounded-[7px] bg-[#FBE9E6] px-3 py-2 text-[12.5px] text-[#8F2A1F]">{error}</p>
          )}
          <Field label="Title" required>
            {(id) => <input id={id} required value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="Software Engineer Placement" className={inputCls} />}
          </Field>
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
            <Field label="Company" required>
              {(id) => <input id={id} required value={form.company} onChange={(e) => set("company", e.target.value)} placeholder="Acme Corp" className={inputCls} />}
            </Field>
            <Field label="Location">
              {(id) => <input id={id} value={form.location} onChange={(e) => set("location", e.target.value)} placeholder="Manchester, UK" className={inputCls} />}
            </Field>
          </div>
          <Field label="Listing URL" required>
            {(id) => <input id={id} type="url" required value={form.url} onChange={(e) => set("url", e.target.value)} placeholder="https://…" className={inputCls} />}
          </Field>
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
            <Field label="Role type">
              {(id) => (
                <select id={id} value={form.role_type} onChange={(e) => set("role_type", e.target.value)} className={inputCls}>
                  {ROLE_TYPES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              )}
            </Field>
            <Field label="Source">
              {(id) => (
                <select id={id} value={form.source} onChange={(e) => set("source", e.target.value)} className={inputCls}>
                  {SOURCES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              )}
            </Field>
            <Field label="Deadline">
              {(id) => <input id={id} type="date" value={form.deadline} onChange={(e) => set("deadline", e.target.value)} className={inputCls} />}
            </Field>
          </div>
          <Field label="Description">
            {(id) => (
              <textarea
                id={id}
                rows={5}
                value={form.description}
                onChange={(e) => set("description", e.target.value)}
                placeholder="Paste the listing text. The fit score is calculated from it."
                className={`${inputCls} h-auto resize-y py-2 leading-[1.5]`}
              />
            )}
          </Field>
        </form>

        <div className="flex shrink-0 items-center justify-end gap-2 border-t border-[#EDEFF2] px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <button type="button" onClick={onClose} className={btnSecondary}>Cancel</button>
          <button type="submit" form="add-role" disabled={saving} className={btnPrimary}>
            {saving ? "Adding…" : "Add role"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: (id: string) => ReactNode }) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[12px] font-medium text-[#5F6570]">
        {label}{required && <span aria-hidden className="text-[#B23A2C]"> *</span>}
      </label>
      {children(id)}
    </div>
  );
}
