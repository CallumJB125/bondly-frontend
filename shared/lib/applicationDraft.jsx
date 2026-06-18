import React, { createContext, useContext, useState } from 'react';

const STORAGE_KEY = 'bondly_app_draft';

function loadFromStorage() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveToStorage(data) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // sessionStorage unavailable — silently ignore
  }
}

const ApplicationDraftContext = createContext(null);

export function ApplicationDraftProvider({ children }) {
  const [draft, setDraftState] = useState(() => {
    const persisted = loadFromStorage();
    return {
      income:       persisted.income       ?? null,
      debt:         persisted.debt         ?? null,
      savings:      persisted.savings      ?? null,
      affordability: persisted.affordability ?? null,
      source:       persisted.source       ?? null,
    };
  });

  function set(updates) {
    setDraftState(prev => {
      const next = { ...prev, ...updates };
      saveToStorage(next);
      return next;
    });
  }

  return (
    <ApplicationDraftContext.Provider value={{ ...draft, set }}>
      {children}
    </ApplicationDraftContext.Provider>
  );
}

export function useApplicationDraft() {
  const ctx = useContext(ApplicationDraftContext);
  if (!ctx) throw new Error('useApplicationDraft must be used within ApplicationDraftProvider');
  return ctx;
}

export default ApplicationDraftContext;
