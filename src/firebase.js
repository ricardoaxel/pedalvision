// Your web app's Firebase configuration
import firebase from 'firebase/app'
import 'firebase/firestore'

var firebaseConfig = {
    apiKey: "AIzaSyBXbDlB7l3dP-FiF9TBBk8v9rgnx359BME",
    authDomain: "pedalvision-9ea13.firebaseapp.com",
    databaseURL: "https://pedalvision-9ea13.firebaseio.com",
    projectId: "pedalvision-9ea13",
    storageBucket: "pedalvision-9ea13.appspot.com",
    messagingSenderId: "437452844119",
    appId: "1:437452844119:web:588adb82ef9bcd6f4e4712",
    measurementId: "G-TSHSPTWWM1"
  };
  // Initialize Firebase
  
const fb =  firebase.initializeApp(firebaseConfig);
export const db = fb.firestore();

//firebase.analytics();