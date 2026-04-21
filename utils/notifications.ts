import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

// Expo Go en SDK 53+ ya no soporta notificaciones remotas en Android.
// Se captura esto para evitar que la aplicación arroje error al estar probando en Expo Go.
if (Constants.appOwnership !== "expo") {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });
}

export async function registerForPushNotificationsAsync() {
  // Si estamos en Expo Go, evitamos ejectutar cualquier lógica de Notificaciones
  if (Constants.appOwnership === "expo") {
    console.warn(
      "Las Push Notifications no están soportadas dentro de Expo Go en SDK 53+. Usando un entorno de desarrollo en su lugar.",
    );
    return null;
  }

  let token;

  if (Platform.OS === "android") {
    Notifications.setNotificationChannelAsync("default", {
      name: "default",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#FF231F7C",
    });
  }

  if (Device.isDevice) {
    const { status: existingStatus } =
      await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== "granted") {
      console.log("Failed to get push token for push notification!");
      return null;
    }

    const projectId =
      Constants?.expoConfig?.extra?.eas?.projectId ??
      Constants?.easConfig?.projectId;

    if (!projectId) {
      console.log(
        "Project ID is missing. Ensure you have an app.json with an eas project id.",
      );
    }

    try {
      token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
      console.log("Push token:", token);
    } catch (e) {
      token = `${e}`;
    }
  } else {
    console.log("Must use physical device for Push Notifications");
  }

  return token;
}

export async function savePushTokenToSupabase(
  userId: string,
  token: string | null,
) {
  if (!token) return;
  // TODO: Implement your logic to save the token. e.g.:
  // const { error } = await supabase.from('users').update({ push_token: token }).eq('id', userId);
}
