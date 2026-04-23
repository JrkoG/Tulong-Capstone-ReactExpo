import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { doc, updateDoc } from 'firebase/firestore';
import { useState } from 'react';
import { Platform } from 'react-native';
import { db } from '../config/firebase';

// @ts-ignore
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export const usePushNotifications = () => {
  const [expoPushToken, setExpoPushToken] = useState<string>('');

  const registerForPushNotificationsAsync = async (uid: string): Promise<string | undefined> => {
    let token;

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
      });
    }

    if (Device.isDevice) {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      
      if (finalStatus !== 'granted') {
        return;
      }

      token = (await Notifications.getExpoPushTokenAsync()).data;
      setExpoPushToken(token);

      try {
        const userRef = doc(db, 'users', uid);
        await updateDoc(userRef, {
          expoPushToken: token
        });
      } catch (error) {
        console.error("Firestore Save Error:", error);
      }

    } else {
      console.log('Use a physical device for Push Notifications');
    }

    return token;
  };

  return { registerForPushNotificationsAsync, expoPushToken };
};