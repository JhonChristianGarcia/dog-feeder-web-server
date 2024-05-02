const { initializeApp } = require('firebase/app');
const { getFirestore } = require('firebase/firestore');

const firebaseConfig = {
    apiKey: "AIzaSyArDQgmofZWzdW7KQmXzKkwVimM1IqJ45k",
    authDomain: "dog-feeder-v2-7dc5e.firebaseapp.com",
    projectId: "dog-feeder-v2-7dc5e",
    storageBucket: "dog-feeder-v2-7dc5e.appspot.com",
    messagingSenderId: "930637951807",
    appId: "1:930637951807:web:c76469b7974a557602d98a"
  };

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

module.exports = { app, db };