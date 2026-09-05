// Comparar leilões — tiny global store (no prop threading needed).
// Lets the user pick up to 4 lots (imóveis or veículos) and compare them.
import { useState, useEffect } from "react";

export const compareStore = {
  ids: [],
  listeners: new Set(),
  MAX: 4,
  has(id) { return this.ids.includes(id); },
  toggle(id) {
    if (this.has(id)) {
      this.ids = this.ids.filter(x => x !== id);
    } else {
      if (this.ids.length >= this.MAX) {
        window.dispatchEvent(new CustomEvent("leiloe:toast", { detail: `Dá pra comparar até ${this.MAX} leilões por vez` }));
        return;
      }
      this.ids = [...this.ids, id];
    }
    this.emit();
  },
  remove(id) { this.ids = this.ids.filter(x => x !== id); this.emit(); },
  clear() { this.ids = []; this.emit(); },
  emit() { this.listeners.forEach(fn => fn()); },
  subscribe(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); },
};

export function useCompare() {
  const [, setN] = useState(0);
  useEffect(() => compareStore.subscribe(() => setN(n => n + 1)), []);
  return compareStore;
}
