
import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { User, onAuthStateChanged } from "firebase/auth";
import { auth } from "../lib/firebase";

type AuthContextType = {
    currentUser: User | null;
    authToken: string;
    hasAdminClaim: boolean;
    isLoading: boolean;
};

const AuthContext = createContext<AuthContextType>({
    currentUser: null,
    authToken: "",
    hasAdminClaim: false,
    isLoading: true,
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [authToken, setAuthToken] = useState("");
    const [hasAdminClaim, setHasAdminClaim] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                try {
                    const [token, idTokenResult] = await Promise.all([
                        user.getIdToken(),
                        user.getIdTokenResult()
                    ]);
                    setCurrentUser(user);
                    setAuthToken(token);
                    setHasAdminClaim(Boolean(idTokenResult.claims?.admin));
                } catch (error) {
                    console.warn("トークン取得に失敗しました", error);
                    setCurrentUser(user);
                    setAuthToken("");
                    setHasAdminClaim(false);
                }
            } else {
                setCurrentUser(null);
                setAuthToken("");
                setHasAdminClaim(false);
            }
            setIsLoading(false);
        });
        return unsubscribe;
    }, []);

    return (
        <AuthContext.Provider value={{ currentUser, authToken, hasAdminClaim, isLoading }}>
            {children}
        </AuthContext.Provider>
    );
};
