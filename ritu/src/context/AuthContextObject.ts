import { createContext } from "react";
import type { AuthContextType } from "./auth-types.ts";

export const AuthContext = createContext<AuthContextType | undefined>(undefined);
