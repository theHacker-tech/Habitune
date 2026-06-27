/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ['Cabin', 'system-ui', 'sans-serif'],
        body: ['Nunito Sans', 'system-ui', 'sans-serif'],
      },
      colors: {
        'forest-canopy': 'hsl(var(--forest-canopy))',
        'sunrise-glow': 'hsl(var(--sunrise-glow))',
        'cloud-cover': 'hsl(var(--cloud-cover))',
        'river-stone': 'hsl(var(--river-stone))',
        'mountain-mist': 'hsl(var(--mountain-mist))',
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}