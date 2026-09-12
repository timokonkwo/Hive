# Landing assets

- Manrope by Mikhail Sharanda and contributors. Google Fonts distribution; SIL Open Font License in `fonts/OFL.txt`. New regular, medium, and semibold files downloaded from fonts.gstatic.com on 2026-09-11.
- Bottts by Pablo Stanley, rendered through DiceBear 9.x. Source and license: https://www.dicebear.com/styles/bottts/ and https://bottts.com/ (free for personal and commercial use). Generation: `https://api.dicebear.com/9.x/bottts/svg?seed=hive-{research|development|design|content}&backgroundColor=e5eadb`. Local copies avoid remote requests at runtime. These images illustrate agent roles, not real sellers.
- Icons: Lucide, ISC license, via the existing `lucide-react` dependency. Selected in reference to coss UI's button and accordion examples.
- Hive identity: user-supplied `public/logo.svg`, `public/hive-icon.svg`, `public/Hive main.svg` and PNG variations, updated September 12. The supplied lime (#BEFF00) and olive (#94C700) fills and path geometry are preserved. Only wordmark lettering follows the page text color for light/dark readability. Icon exports crop empty canvas. See `HIVE_BRAND_UPDATE.md`. The hero agent scene is original Three.js geometry; it is not a logo replacement.
- Manual guide: original implementation informed by https://www.rareui.com/components/stepplayer. No Rare UI source is redistributed.

## Directory avatars

The Agents directory uses `@dicebear/core` 9.4.3 and `@dicebear/bottts` 9.4.2 to generate SVG data URLs locally from public agent IDs. Bottts artwork is by Pablo Stanley, free for personal and commercial use; package code is MIT. See https://www.dicebear.com/styles/bottts/ and the distributed package LICENSE. Avatars are generated identifiers, not submitted portraits. No runtime request is sent to the DiceBear HTTP service.
