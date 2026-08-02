"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { authBearerHeaders } from "@/lib/crmAuth";
import { crmBrowserApiUrl } from "@/lib/crmAuthConstants";

export interface LocationOption {
  id: number;
  name: string;
}

interface LocationAutocompleteProps {
  label: string;
  placeholder?: string;
  value: string;            // selected id as string, "" = none
  options: LocationOption[];
  disabled?: boolean;
  /** Show a red asterisk next to the label */
  required?: boolean;
  /** Validation error message shown under the field */
  error?: string;
  /** POST endpoint to create a new entry, e.g. "/api/locations/districts" */
  createEndpoint?: string;
  /** Extra body fields to include when POSTing a new entry */
  createExtraBody?: Record<string, unknown>;
  onChange: (id: string, name: string) => void;
  onCreated?: (item: LocationOption) => void;
  /**
   * Opt in to the public site's form-control styling (.ctr-label /
   * .ctr-control) instead of the CRM's default look.
   *
   * A prop rather than a restyle because this component is shared with
   * CrmPropertyFullForm — the cabinet must keep its existing appearance. Omit it
   * and nothing changes.
   */
  publicStyle?: boolean;
}

const MIN_CREATE_LEN = 2;

export function LocationAutocomplete({
  label,
  placeholder = "— начните вводить —",
  value,
  options,
  disabled = false,
  required = false,
  error,
  createEndpoint,
  createExtraBody = {},
  onChange,
  onCreated,
  publicStyle = false,
}: LocationAutocompleteProps) {
  const selectedName = options.find((o) => String(o.id) === value)?.name ?? "";

  const [query, setQuery] = useState(selectedName);
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Keep display text in sync when value or options change (e.g. edit mode load)
  useEffect(() => {
    setQuery(selectedName);
  }, [selectedName]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) {
        setOpen(false);
        // Restore display to selected name if user typed but didn't select
        setQuery(selectedName);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [selectedName]);

  const filtered = query.trim()
    ? options.filter((o) => o.name.toLowerCase().includes(query.trim().toLowerCase()))
    : options;

  const showCreateOption =
    !!createEndpoint &&
    query.trim().length >= MIN_CREATE_LEN &&
    !options.some((o) => o.name.toLowerCase() === query.trim().toLowerCase());

  const selectOption = useCallback(
    (opt: LocationOption) => {
      onChange(String(opt.id), opt.name);
      setQuery(opt.name);
      setOpen(false);
    },
    [onChange],
  );

  const handleCreate = async () => {
    if (!createEndpoint || query.trim().length < MIN_CREATE_LEN) return;
    setCreating(true);
    try {
      const res = await fetch(crmBrowserApiUrl(createEndpoint), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authBearerHeaders() },
        body: JSON.stringify({ name: query.trim(), ...createExtraBody }),
      });
      if (!res.ok) {
        console.error("[LocationAutocomplete] create failed", res.status);
        return;
      }
      const created = (await res.json()) as { id: number; name: string };
      const item: LocationOption = { id: created.id, name: created.name };
      onCreated?.(item);
      selectOption(item);
    } catch (e) {
      console.error("[LocationAutocomplete] create error", e);
    } finally {
      setCreating(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open) {
      if (e.key === "ArrowDown" || e.key === "Enter") setOpen(true);
      return;
    }
    if (e.key === "Escape") {
      setOpen(false);
      setQuery(selectedName);
      return;
    }
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const items = wrapRef.current?.querySelectorAll<HTMLButtonElement>("[data-opt]");
      if (!items?.length) return;
      const current = wrapRef.current?.querySelector<HTMLButtonElement>("[data-opt]:focus");
      const idx = current ? Array.from(items).indexOf(current) : -1;
      const next = e.key === "ArrowDown" ? idx + 1 : idx - 1;
      items[Math.max(0, Math.min(next, items.length - 1))]?.focus();
    }
    if (e.key === "Enter") {
      e.preventDefault();
      if (filtered.length === 1) selectOption(filtered[0]);
    }
  };

  const inputClass = publicStyle
    ? "ctr-control"
    : "w-full rounded-md border bg-white px-3 py-2 text-sm text-gray-900 " +
      "placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent " +
      "disabled:cursor-not-allowed disabled:bg-gray-50 disabled:opacity-50 " +
      (error ? "border-red-500" : "border-gray-300");

  return (
    <div ref={wrapRef} className="relative">
      <label
        className={
          publicStyle
            ? "ctr-label mb-[7px]"
            : "block text-sm font-medium text-gray-700 mb-1"
        }
      >
        {label}
        {required && (
          <span className={publicStyle ? "ctr-label__req" : "text-red-500"}>
            {publicStyle ? "*" : " *"}
          </span>
        )}
      </label>
      <input
        ref={inputRef}
        type="text"
        className={inputClass}
        placeholder={disabled ? "—" : placeholder}
        value={query}
        disabled={disabled}
        autoComplete="off"
        onFocus={() => { if (!disabled) setOpen(true); }}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          // Clear selection if user edits away from selected name
          if (value && e.target.value !== selectedName) onChange("", "");
        }}
        onKeyDown={handleKeyDown}
      />

      {open && !disabled && (
        <ul
          className="absolute z-30 mt-1 max-h-56 w-full overflow-auto rounded-md border border-gray-200 bg-white py-1 shadow-lg text-sm"
          role="listbox"
        >
          {filtered.length === 0 && !showCreateOption && (
            <li className="px-3 py-2 text-gray-400 select-none">Ничего не найдено</li>
          )}

          {filtered.map((opt) => (
            <li key={opt.id} role="option" aria-selected={String(opt.id) === value}>
              <button
                data-opt
                type="button"
                className={
                  "w-full text-left px-3 py-1.5 hover:bg-blue-50 focus:bg-blue-50 focus:outline-none " +
                  (String(opt.id) === value ? "font-medium text-blue-700" : "text-gray-900")
                }
                onMouseDown={(e) => { e.preventDefault(); selectOption(opt); }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") { e.preventDefault(); selectOption(opt); }
                  if (e.key === "Escape") { setOpen(false); setQuery(selectedName); inputRef.current?.focus(); }
                }}
              >
                {opt.name}
              </button>
            </li>
          ))}

          {showCreateOption && (
            <li role="option" aria-selected={false}>
              <button
                data-opt
                type="button"
                disabled={creating}
                className="w-full text-left px-3 py-1.5 text-blue-600 hover:bg-blue-50 focus:bg-blue-50 focus:outline-none font-medium disabled:opacity-50"
                onMouseDown={(e) => { e.preventDefault(); void handleCreate(); }}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void handleCreate(); } }}
              >
                {creating ? "Создаётся…" : `+ Добавить «${query.trim()}»`}
              </button>
            </li>
          )}
        </ul>
      )}

      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  );
}
