// FILE: types/global.d.ts

// This tells TypeScript that the global Window object will have a gtag function.
// This function can accept any number of arguments.
interface Window {
    gtag: (...args: any[]) => void;
  }