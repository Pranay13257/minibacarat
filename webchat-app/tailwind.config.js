/** @type {import('tailwindcss').Config} */

const range = (size) => {
  const output = {};
  for (let i = 1; i <= size; i++) {
    output[i] = `${i}`;
    output[`span-${i}`] = `span ${i} / span ${i}`;
  }
  return output;
};

module.exports = {
  content: [ './app/**/*.{js,ts,jsx,tsx,mdx}', // Note the addition of the `app` directory.
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
 
    // Or if using `src` directory:
    './src/**/*.{js,ts,jsx,tsx,mdx}',],
  theme: {
    extend: {
      backgroundImage: {
        'wood-pattern': "url('/assets/wood.png')",
        'logo-pattern': "url('/assets/ocean7.png')",

        
      },
      fontFamily: {
        questrial: ["Questrial", "sans-serif"],
        ramaraja: ["Ramaraja", "serif"],
      },
      keyframes: {
        glow: {
          '0%, 100%': { opacity: '0.50' }, // Start and end at 50% opacity
          '50%': { opacity: '0.1' }, // Middle of animation at 65% opacity
        },
      },
      animation: {
        glow: 'glow 2s infinite',
      },
      colors: {
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
}

