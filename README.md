# RITU

RITU is a routine management application designed to help users build and track daily habits.

## 📂 Project Structure

This is a monorepo containing:

- **`ritu/`**: Frontend application (React + Vite).
- **`api/`**: Backend API (Deno + Hono).
- **`docs/`**: Project documentation and specifications.

## 🚀 Getting Started

### Prerequisites
- Node.js (for Frontend)
- Deno (for Backend)
- Java (for Firebase Emulators)

### Development

1.  **Frontend**:
    ```bash
    cd ritu
    npm install
    npm run dev
    ```
    Access at `http://localhost:5173`

2.  **Backend**:
    ```bash
    cd api
    deno task dev
    ```
    Access at `http://localhost:8000`

3.  **Firebase Emulators** (Auth, Firestore):
    ```bash
    deno task emulator
    ```
    *Requires Java installed.*

## 🛠️ Testing

- **Backend Logic**:
    ```bash
    cd api
    deno test
    ```
