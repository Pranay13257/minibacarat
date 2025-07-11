import type { Config } from "tailwindcss";

export default {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}', // Note the addition of the `app` directory.
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
 
    // Or if using `src` directory:
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        'vdarkRed' : "#450A03",
        'darkRed': "#741003",
        'midRed' : "#911606",
        'vlightRed' : "#A42210",
        'lightBrown' : "#F0DEAD",
        'darkBrown' : "#DEBE83",
        'randomBrown' : "#915A14",
      },
    },
  },
  plugins: [],
} satisfies Config;
