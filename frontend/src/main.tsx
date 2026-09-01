import { createContext, StrictMode, useContext, useEffect, useState, type ComponentType, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate, createBrowserRouter, RouterProvider } from 'react-router-dom'
import './index.css'
import { Dashboard } from './Dashboard.tsx'
import LoginPg from './LoginPg.tsx'
import Song from './Song.tsx'
import MusicEditor from './MusicEditor.tsx'
import FallbackErrDisplay from './FallbackErrDisplay.tsx'
import { Toaster, useToaster } from './components/Toaster.tsx'
import type { Toaster as ToasterType } from './services/types.ts';

export let globalZCounter = 100;

export function incGlobalZCounter() {
  globalZCounter += 1
  return globalZCounter;
}

//expose the writetofallback to non react components like the api.ts
//expose the toaster now too
function createEmitter<T>() {
  type Listener = (val: T) => void;
  const listeners = new Set<Listener>();

  return {
    subscribe(fn: Listener) {
      listeners.add(fn);
      return () => void listeners.delete(fn);
    },
    trigger(val: T) {
      listeners.forEach((fn) => fn(val));
    },
  };
}

export const errorEmitter = createEmitter<{ title: string; mssg: string }>();
export const toastEmitter = createEmitter<{ mssg: string; color?: string }>();

function App() {

  const toaster = useToaster(3000);
  const [fallbackErrMssg, writeToFallbackErrScreen] = useState({ title: '', mssg: '' });

  useEffect(() => {
    return errorEmitter.subscribe(writeToFallbackErrScreen);
  }, [])

  useEffect(() => {
    return toastEmitter.subscribe(({ mssg, color }) => {
      toaster.add_message(mssg, color);
    });
  }, [toaster]);

  return (
    <>
      <ToasterProvider toaster={toaster}>
        <Toaster toaster={toaster} />
        <FallbackErrDisplay mssg={fallbackErrMssg} setMssg={writeToFallbackErrScreen} />
        <RouterProvider router={router} />
      </ToasterProvider>
    </>
  )

}

const ToasterContext = createContext<ToasterType | null>(null);

export function ToasterProvider({ toaster, children }: { toaster: ToasterType; children: ReactNode }) {
  return <ToasterContext.Provider value={toaster}>{children}</ToasterContext.Provider>;
}

export function useToasterContext() {
  const context = useContext(ToasterContext);
  if (!context) throw new Error("useToasterContext must be used within a ToasterProvider");
  return context;
}

export const router = createBrowserRouter([
  { path: "/", element: <LoginPg /> },
  { path: "/dashboard", element: <Dashboard /> },
  { path: "/play", element: <Song /> },
  { path: "/edit", element: <MusicEditor /> },
  { path: "*", element: <Navigate to="/" replace /> },
]);

//largely for dev... keeps only one version of app active at a time so that
//to prevent modaldialog stacking... safe to keep in deployment
const container = document.getElementById('root')!;
let root = (container as any)._reactRoot;
if (!root) {
  root = createRoot(container);
  (container as any)._reactRoot = root;
}

root.render(
  <StrictMode>
    <App />
  </StrictMode>,
)