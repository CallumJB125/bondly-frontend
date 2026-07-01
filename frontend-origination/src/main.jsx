import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import { ThemeProvider } from './context/ThemeContext.jsx';
import { ToastProvider } from '@bondly/ui/components/Toast.jsx';
import { ApplicationDraftProvider } from '@bondly/ui/lib/applicationDraft.jsx';
import '@bondly/ui/styles/fonts.css';
import '@bondly/ui/styles/tokens.css';
import '@bondly/ui/styles/base.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ThemeProvider>
      <AuthProvider>
        <ToastProvider>
          <ApplicationDraftProvider>
            <App />
          </ApplicationDraftProvider>
        </ToastProvider>
      </AuthProvider>
    </ThemeProvider>
  </React.StrictMode>
);
