import { FontAwesome5 } from "@expo/vector-icons";
import * as ExpoLinking from "expo-linking";
import { Link, useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { supabase } from "../lib/supabase";

const COLORS = {
  background: "#FAF7F2",
  primaryText: "#4A2A14",
  secondaryText: "#7A6451",
  orangePrimary: "#FDB664",
  inputBg1: "#FEE0B8",
  buttonBg: "#8A5A19",
  linkBlue: "#165D8B",
};

WebBrowser.maybeCompleteAuthSession();

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [genericAlert, setGenericAlert] = useState<{
    title: string;
    message: string;
  } | null>(null);

  // Función para procesar y extraer tokens de una URL (venga de WebBrowser o de Deep Link)
  const processAuthUrl = async (url: string) => {
    if (!url) return;
    const paramsStr = url.split("#")[1] || url.split("?")[1];
    if (paramsStr) {
      const parsed = paramsStr.split("&").reduce((acc: any, item) => {
        const [key, value] = item.split("=");
        if (key && value) {
          acc[key] = decodeURIComponent(value);
        }
        return acc;
      }, {});

      if (parsed.access_token && parsed.refresh_token) {
        setGoogleLoading(true);
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: parsed.access_token,
          refresh_token: parsed.refresh_token,
        });
        setGoogleLoading(false);

        if (sessionError) {
          setGenericAlert({
            title: "Error en sesión",
            message: sessionError.message,
          });
        } else {
          router.replace("/(tabs)");
        }
      }
    }
  };

  useEffect(() => {
    // 1. Escuchar URLs entrantes (Deep Linking) cuando la app ya está abierta
    const linkingListener = ExpoLinking.addEventListener("url", (event) => {
      processAuthUrl(event.url);
    });

    // 2. Verificar la URL inicial por si la app se abrió desde un estado cerrado
    ExpoLinking.getInitialURL().then((url) => {
      if (url) processAuthUrl(url);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        router.replace("/(tabs)");
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        router.replace("/(tabs)");
      }
    });

    return () => {
      subscription.unsubscribe();
      linkingListener.remove();
    };
  }, []);

  const handleLogin = async () => {
    if (!email || !password) {
      setGenericAlert({
        title: "Error",
        message: "Por favor ingresa tu correo y contraseña.",
      });
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setLoading(false);

    if (error) {
      setGenericAlert({
        title: "Error al iniciar sesión",
        message: error.message,
      });
    } else {
      router.replace("/(tabs)");
    }
  };

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    try {
      const redirectUrl = ExpoLinking.createURL(""); // Usa el scheme de expo (ej. tuapp://)
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: redirectUrl,
          skipBrowserRedirect: true,
        },
      });

      if (error) throw error;

      if (data?.url) {
        const result = await WebBrowser.openAuthSessionAsync(
          data.url,
          redirectUrl,
        );
        if (result.type === "success" && result.url) {
          processAuthUrl(result.url);
        }
      }
    } catch (error: any) {
      setGenericAlert({
        title: "Error con Google",
        message: error.message || "Ocurrió un error al intentar iniciar sesión",
      });
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.logoContainer}>
            <FontAwesome5 name="paw" size={40} color="#000" />
          </View>
          <Text style={styles.mainTitle}>PetConnect</Text>
          <Text style={styles.subtitle}>
            Bienvenido de nuevo a la mejor comunidad de amantes de mascotas.
          </Text>
        </View>

        <View style={styles.formContainer}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>CORREO ELECTRÓNICO</Text>
            <TextInput
              style={styles.input}
              placeholder="tu@email.com"
              keyboardType="email-address"
              placeholderTextColor="#CFA67A"
              autoCapitalize="none"
              value={email}
              onChangeText={setEmail}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>CONTRASEÑA</Text>
            <TextInput
              style={styles.input}
              placeholder="••••••••"
              secureTextEntry
              placeholderTextColor="#CFA67A"
              value={password}
              onChangeText={setPassword}
            />
          </View>

          <TouchableOpacity
            style={[styles.mainButton, loading && { opacity: 0.7 }]}
            onPress={handleLogin}
            disabled={loading || googleLoading}
          >
            {loading ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={styles.mainButtonText}>Iniciar sesión</Text>
            )}
          </TouchableOpacity>

          <View style={styles.dividerContainer}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>O continúa con</Text>
            <View style={styles.dividerLine} />
          </View>

          <TouchableOpacity
            style={[styles.googleButton, googleLoading && { opacity: 0.7 }]}
            onPress={handleGoogleLogin}
            disabled={loading || googleLoading}
          >
            {googleLoading ? (
              <ActivityIndicator color="#000" />
            ) : (
              <>
                <FontAwesome5
                  name="google"
                  size={18}
                  color="#8A5A19"
                  style={styles.googleIcon}
                />
                <Text style={styles.googleButtonText}>
                  Continuar con Google
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.footerRow}>
          <Text style={styles.footerText}>¿Aún no tienes cuenta? </Text>
          <Link href="/register" asChild>
            <TouchableOpacity>
              <Text style={styles.footerLink}>Regístrate aquí</Text>
            </TouchableOpacity>
          </Link>
        </View>
      </View>

      {/* Generic Alert Modal */}
      {genericAlert && (
        <Modal transparent animationType="fade" visible={true}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContentCentered}>
              <Text style={styles.modalTitle}>{genericAlert.title}</Text>
              <Text style={styles.modalText}>{genericAlert.message}</Text>
              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalButtonPrimary]}
                  onPress={() => setGenericAlert(null)}
                >
                  <Text style={styles.modalButtonTextPrimary}>OK</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingTop: Platform.OS === "android" ? 30 : 0,
  },
  container: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  header: {
    alignItems: "center",
    marginBottom: 40,
  },
  logoContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.orangePrimary,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
    marginTop: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  mainTitle: {
    fontSize: 42,
    fontWeight: "900",
    color: COLORS.primaryText,
    marginBottom: 10,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.secondaryText,
    textAlign: "center",
    lineHeight: 24,
    paddingHorizontal: 20,
  },
  formContainer: {
    width: "100%",
    backgroundColor: "#FFF3E3",
    borderRadius: 24,
    padding: 24,
    marginBottom: 30,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.primaryText,
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: COLORS.inputBg1,
    borderRadius: 30,
    paddingHorizontal: 20,
    paddingVertical: 16,
    fontSize: 16,
    color: COLORS.primaryText,
  },
  mainButton: {
    backgroundColor: COLORS.buttonBg,
    width: "100%",
    paddingVertical: 18,
    borderRadius: 30,
    alignItems: "center",
    marginTop: 10,
    shadowColor: "#8A5A19",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 5,
  },
  mainButtonText: {
    color: "#FFF",
    fontSize: 18,
    fontWeight: "bold",
  },
  dividerContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: COLORS.secondaryText,
    opacity: 0.3,
  },
  dividerText: {
    marginHorizontal: 10,
    fontSize: 14,
    color: COLORS.secondaryText,
  },
  googleButton: {
    flexDirection: "row",
    backgroundColor: "#FFF",
    borderWidth: 1,
    borderColor: "#E0E0E0",
    width: "100%",
    paddingVertical: 16,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  googleIcon: {
    marginRight: 10,
  },
  googleButtonText: {
    color: "#333",
    fontSize: 16,
    fontWeight: "bold",
  },
  footerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
  },
  footerText: {
    color: COLORS.secondaryText,
    fontSize: 15,
  },
  footerLink: {
    color: COLORS.linkBlue,
    fontSize: 15,
    fontWeight: "bold",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
  },
  modalContentCentered: {
    backgroundColor: "#ffffff",
    borderRadius: 24,
    margin: 24,
    padding: 24,
    alignItems: "center",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: COLORS.primaryText,
    marginBottom: 10,
    textAlign: "center",
  },
  modalText: {
    fontSize: 16,
    color: COLORS.secondaryText,
    textAlign: "center",
    marginBottom: 20,
    lineHeight: 24,
  },
  modalButtons: {
    flexDirection: "row",
    justifyContent: "center",
    width: "100%",
  },
  modalButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    minWidth: 100,
    alignItems: "center",
  },
  modalButtonPrimary: {
    backgroundColor: COLORS.buttonBg,
  },
  modalButtonTextPrimary: {
    color: "#FFF",
    fontWeight: "bold",
    fontSize: 14,
  },
});
