import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./ui/App";
import { Daily } from "./ui/Daily";
import "./styles.css";

// `?daily` is the daily puzzle; everything else is the cracker. A query string works on any static host.
const daily = new URLSearchParams(location.search).has("daily");
if (daily) document.title = "crypta daily: find the five cables";

createRoot(document.getElementById("root")!).render(<StrictMode>{daily ? <Daily /> : <App />}</StrictMode>);
