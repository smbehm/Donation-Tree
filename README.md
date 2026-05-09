# Donation Tree

A real-time 3D fundraising visualizer built with React + Three.js.

## Setup

```bash
npm install
npm run dev
```

## Customization

Edit the two constants at the top of `src/DonationTree.jsx`:

```js
const TARGET_AMOUNT = 1000;   // fundraising goal in dollars
const TARGET_LABEL  = "Plumbing Repairs";  // campaign name
```

## How it works

- User types a dollar amount → vines on the 3D tree fill from root to canopy proportionally
- Vine color transitions from near-black (unfunded) → deep green → glowing emerald tip
- All animation runs via Three.js WebGL with a custom GLSL shader on the vine geometry
