module.exports = {
    darkMode: 'class',
    content: [
        './app/**/*.{js,ts,jsx,tsx}',         // App directory
        './pages/**/*.{js,ts,jsx,tsx}',       // Pages directory (if used)
        './components/**/*.{js,ts,jsx,tsx}',  // Any components folder
    ],
    theme: {
        extend: {
            colors: {
                primary: '#003366',   // Deep Indigo
                secondary: '#50e2c3', // Mint Green
                accent: '#4b91e2',    // Sky Blue
                neutral: '#cceff1',   // Soft Teal
                moniblue: '#264C73',
                monigreen: '#6CB5AB',
            },
        },
    },
    plugins: [],
}