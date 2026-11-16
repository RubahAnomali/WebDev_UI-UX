import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import '@fontsource-variable/inter';
import '@fontsource/lora/400.css';
import './styles/global.css';
import { App } from './App';
import { AuthProvider } from './services/auth/AuthContext';
import { SavedPetsProvider } from './services/pets/SavedPetsContext';

const root = document.getElementById('root');
if (!root) throw new Error('Root element #root not found');

createRoot(root).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <SavedPetsProvider>
          <App />
        </SavedPetsProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
