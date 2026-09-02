import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import App from "./app/App";
import SpotifyView from "./app/SpotifyView";
import "./styles/index.css";

// Minimal hash router: "#/spotify" (and its OAuth callback) shows the Spotify
// screen; anything else is the mixer.
function Root() {
  const [hash, setHash] = useState(() => window.location.hash);
  useEffect(() => {
    const on = () => setHash(window.location.hash);
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);

  const isSpotify = hash.startsWith("#/spotify");
  return isSpotify
    ? <SpotifyView onExit={() => { window.location.hash = "#/"; }} />
    : <App onOpenSpotify={() => { window.location.hash = "#/spotify"; }} />;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Root />
  </StrictMode>
);
