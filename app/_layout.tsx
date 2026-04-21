import { ThemeProvider } from "@/context/ThemeContext";
import { useColorScheme } from "@/hooks/use-color-scheme";
import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider as NavigationThemeProvider,
} from "@react-navigation/native";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import "react-native-reanimated";
import { supabase } from "../lib/supabase";

export const unstable_settings = {
  initialRouteName: "index",
};

function RootLayoutNav() {
  const colorScheme = useColorScheme();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    let isMounted = true;

    let timeoutId: NodeJS.Timeout | null = null;

    const handleSessionTimeout = (session: any) => {
      if (!session) return;

      // session.expires_at está en segundos (Unix timestamp)
      const expiresAt = session.expires_at * 1000;
      const timeRemaining = expiresAt - Date.now();

      if (timeRemaining <= 0) {
        // Ya expiró la hora original, cerrar de inmediato
        supabase.auth.signOut();
      } else {
        // Aún queda tiempo de la hora original, programar el cierre por el tiempo restante exacto
        if (timeoutId) clearTimeout(timeoutId);
        timeoutId = setTimeout(async () => {
          await supabase.auth.signOut();
        }, timeRemaining);
      }
    };

    const checkAuth = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!isMounted) return;

      if (session) {
        handleSessionTimeout(session);
      }

      const inAuthGroup = segments[0] === "(tabs)";
      // Solo hacer el chequeo si el enrutador ya montó los segmentos iniciales
      if (segments.length === 0) return;

      if (!session && inAuthGroup) {
        // Redirigir al login si no tiene sesión pero intenta entrar a (tabs)
        router.replace("/login");
      } else if (
        session &&
        (segments[0] === "login" || segments[0] === "register")
      ) {
        // Redirigir al feed si ya tiene sesión activa
        router.replace("/(tabs)");
      }
    };

    checkAuth();

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (!isMounted) return;

        if (timeoutId) {
          clearTimeout(timeoutId);
        }

        if (session) {
          handleSessionTimeout(session);
        }

        const inAuthGroup = segments[0] === "(tabs)";

        if (
          session &&
          (segments[0] === "login" || segments[0] === "register")
        ) {
          router.replace("/(tabs)");
        } else if (!session && inAuthGroup) {
          router.replace("/login");
        }
      },
    );

    return () => {
      isMounted = false;
      if (timeoutId) clearTimeout(timeoutId);
      authListener.subscription.unsubscribe();
    };
  }, [segments, router]);

  return (
    <NavigationThemeProvider
      value={colorScheme === "dark" ? DarkTheme : DefaultTheme}
    >
      <Stack>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="register" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="modal"
          options={{ presentation: "modal", title: "Modal" }}
        />
      </Stack>
      <StatusBar style="auto" />
    </NavigationThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <RootLayoutNav />
    </ThemeProvider>
  );
}
