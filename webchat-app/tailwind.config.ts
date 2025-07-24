import type { Config } from "tailwindcss";

const range = (size) => {
  const output = {};
  for (let i = 1; i <= size; i++) {
    output[i] = `${i}`;
    output[`span-${i}`] = `span ${i} / span ${i}`;
  }
  return output;
};

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
      gridColumnStart: range(31), // adds col-start-1...col-start-31
      gridColumnEnd: range(31),   // adds col-end-1...col-end-31
      gridColumn: range(31), 
    },
  },
  plugins: [],
} satisfies Config;
