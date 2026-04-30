import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCHebcC5r_5fkgroUSTLAAR4NMcURKVFt4",
  authDomain: "aureon-tickets.firebaseapp.com",
  projectId: "aureon-tickets",
  storageBucket: "aureon-tickets.firebasestorage.app",
  messagingSenderId: "882881962216",
  appId: "1:882881962216:web:92ec813a3d322d7cdaa95d",
  measurementId: "G-VR16T8GNT7"
};

export const app = initializeApp(firebaseConfig);
export const analytics = getAnalytics(app);
export const db = getFirestore(app);