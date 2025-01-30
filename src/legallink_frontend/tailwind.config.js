/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        "translucent": "rgba(255, 255, 255, 0.3)",
      },
      fontFamily: {
        "open-sans": "Open Sans, sans-serif",
        "montserrat": "Montserrat, sans-serif",
        "poppins": "Poppins, sans-serif",
      },
      transitionDuration: {
        "short": "200ms",
      },
    },
  },
  plugins: ["prettier-plugin-tailwindcss"],
};
