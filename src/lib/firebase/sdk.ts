/**
 * The parts of the Firebase SDK the app uses, gathered in one module that
 * ./client loads on demand. Importing them by name here (rather than
 * `import('firebase/auth')` as a whole) lets the build leave out the rest
 * of the SDK, as it did when Firebase was part of the first download.
 */
export { getApps, initializeApp } from 'firebase/app'
export {
  createUserWithEmailAndPassword,
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
} from 'firebase/auth'
