// src/firebase.js
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyA6x2AdGIpHAw5raa5dGpxZ3nSIuf_qx6M",
  authDomain: "duldulze.firebaseapp.com",
  projectId: "duldulze",
  storageBucket: "duldulze.firebaseapp.com",
  messagingSenderId: "262019588776",
  appId: "1:262019588776:web:399e3e44b1c7610367189d",
  measurementId: "G-LSST5V2948"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app); 