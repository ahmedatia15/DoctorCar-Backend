// Override via Vite env (.env / .env.local):
//   VITE_API_URL=http://localhost:5555
//   VITE_CENTER_ID=center1
//
// Default points at the same deployed Railway backend the Flutter app uses
// (Mobile/.env -> BASE_URL). Change it if you spin up a different host.
export const API_URL =
  import.meta.env.VITE_API_URL ||
  "https://doctorcar-backend-production.up.railway.app";

export const CENTER_ID =
  import.meta.env.VITE_CENTER_ID || "center1";
