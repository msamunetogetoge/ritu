import { type JSX } from "react";
import {
  BrowserRouter,
  Link,
  Outlet,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext.tsx";
import {
  FeatureFlagProvider,
  ProtectedFeature,
} from "./context/FeatureFlagContext.tsx";
import Today from "./routes/Today.tsx";
import Profile from "./routes/Profile.tsx";
import Community from "./routes/Community.tsx";
import NotificationSettingsPage from "./routes/NotificationSettings.tsx";
import BillingPage from "./routes/Billing.tsx";

function Layout() {
  const { user } = useAuth();
  const location = useLocation();

  return (
    <main className="phone" role="main">
      <div className="content">
        <header className="brand" aria-label="アプリ ヘッダー">
          <div className="brand-left">
            <div className="logo">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="12" cy="12" r="8"></circle>
                <circle cx="12" cy="12" r="4"></circle>
                <path d="M12 2v4M2 12h4M12 22v-4M22 12h-4"></path>
              </svg>
            </div>
            <p className="brand-title">RITU</p>
          </div>
          {user && (
            <Link to="/profile" className="avatar">
              {user.photoURL
                ? (
                  <img
                    src={user.photoURL}
                    alt="Me"
                    style={{ width: 32, height: 32, borderRadius: "50%" }}
                  />
                )
                : <span style={{ fontSize: "1.5rem" }}>👤</span>}
            </Link>
          )}
        </header>

        <Outlet />

        {user && (
          <nav className="bottom-nav">
            <Link to="/" className={location.pathname === "/" ? "active" : ""}>
              Today
            </Link>
            <ProtectedFeature flag="community">
              <Link
                to="/community"
                className={location.pathname === "/community" ? "active" : ""}
              >
                Community
              </Link>
            </ProtectedFeature>
            <Link
              to="/profile"
              className={location.pathname === "/profile" ? "active" : ""}
            >
              Profile
            </Link>
          </nav>
        )}
      </div>
      <div className="home-indicator" aria-hidden="true"></div>

      <style>
        {`
        /* Global override or addition for Router layout */
        .bottom-nav {
            position: fixed; bottom: 1.5rem; left: 0; right: 0;
            background: #1a1a1a; border-top: 1px solid #333;
            display: flex; justify-content: space-around; padding: 1rem;
            z-index: 100;
        }
        .bottom-nav a { color: #888; text-decoration: none; font-weight: bold; }
        .bottom-nav a.active { color: white; }
        /* Adjust main-scroll to not be hidden by nav */
        .main-scroll { padding-bottom: 5rem; }
      `}
      </style>
    </main>
  );
}

export default function App(): JSX.Element {
  return (
    <AuthProvider>
      <FeatureFlagProvider>
        <BrowserRouter>
          <Routes>
            <Route element={<Layout />}>
              <Route path="/" element={<Today />} />
              <Route
                path="/community"
                element={
                  <ProtectedFeature flag="community">
                    <Community />
                  </ProtectedFeature>
                }
              />
              <Route path="/profile" element={<Profile />} />
              <Route
                path="/settings/notifications"
                element={<NotificationSettingsPage />}
              />
              <Route path="/billing" element={<BillingPage />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </FeatureFlagProvider>
    </AuthProvider>
  );
}
