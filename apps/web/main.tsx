/** @jsxImportSource https://esm.sh/react@18.2.0?target=deno */
import { StrictMode } from "https://esm.sh/react@18.2.0?target=deno";
import { createRoot } from "https://esm.sh/react-dom@18.2.0/client?target=deno";
import App from "./app.tsx";

function bootstrap(): void {
  const container = document.getElementById("root");
  if (!(container instanceof HTMLElement)) {
    throw new Error("Failed to locate root element with id 'root'.");
  }

  const root = createRoot(container);
  root.render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

bootstrap();
