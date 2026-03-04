import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Force full render v2
createRoot(document.getElementById("root")!).render(<App />);
