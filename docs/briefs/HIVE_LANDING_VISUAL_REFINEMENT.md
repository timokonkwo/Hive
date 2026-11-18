# Landing visual refinement

Approved plan: publish admin/wallet work first, then reduce default mobile copy by at least 40%, preserving the hero, branding, light/dark themes and interactions. Replace the brief editor with a visual walkthrough and merge the overlapping hiring guide. Seven sections: hero, work outputs, walkthrough, agent selection, owners, questions, closing. Use one Preview label per illustrative section, never fabricated earnings/reviews/performance. Preserve both workflow anchors and real app CTAs.

Release: admin/wallet changes committed as 046d336, pushed to main_redesign and merged/pushed to main before landing edits. public/images.jpeg stays untouched.

Implementation units:
- [x] Four distinct output compositions, with shared category selection linked to the hero.
- [x] One task-to-delivery walkthrough; retire duplicate editor/copy flow.
- [x] Visual agent anatomy and owner-to-agent workflow; concise copy.
- [x] Element motion, pause/reduced-motion, keyboard and mobile review.
- [x] Before/after word count, screenshots, build/types/lint/browser checks.

Landing refinements stay local for review. No additional page unit or automatic publication.

Validation: production build, typecheck, scoped lint and diff check pass. Visual browser checks: 132/132. Mobile audit: 24 layouts and 14 touch interactions pass, including enlarged text, smooth scroll, reduced motion and short landscape screens. Default mobile main copy: 362 to 179 words (50.6% reduction). Reviewed desktop light and mobile dark screenshots; increased walkthrough height to keep report annotations fully visible. Browser artifacts: /private/tmp/hive-redesign-qa/visual-*.png and landing-visual-results.json.

The existing broad build emits a MongoDB connection warning in this local environment; this UI review does not verify live database or wallet transactions.

## User correction: preserve the left-hand content
The user explicitly requested restoration across all landing sections. The previous 40% text reduction target is superseded: restore work headings and marketplace link, the working brief editor, descriptive hiring steps, service/history/proposal controls, and owner explanations. Keep the new output illustrations, task stages, profile visual and owner diagram on the right. Restore eight sections. Preserve the requested stronger owner positioning and avoid repeated Example labels.

Latest clarification: original headers, subheadings, hero and supporting copy restored as well. The original owner heading and copy are retained per this correction. Only the right-hand visual panels keep the new design.

Restoration validation: 133 browser checks including editable brief synchronization, 24 mobile layouts and 14 touch controls pass. Restored main copy is 318 words; the earlier 179-word result describes the superseded version. Screenshots: /private/tmp/hive-redesign-qa/restored-*.png.

## Brief cleanup and artwork fit
Removed the default draft notice, full-brief disclosure, introductory edit sentence and Preview label in the brief panel. Copy uses the clipboard directly with success/failure feedback. Preserved the other restored headings and left-hand controls. Artwork panels now size to their contents; proposal columns, profile tiles, avatar corners and owner arrows align consistently. Production build, typecheck, scoped lint, diff check and 134 landing browser checks pass, including actual edited clipboard content. Output and walkthrough screenshots checked at mobile and desktop sizes; measurements cover 320, 390, 768, 1024 and 1440px. Current isolated preview: http://localhost:3102.

## Scroll reveals and alternating backgrounds
Restored alternating canvas/soft section surfaces in both themes, preserving the closing accent band. Visual parts now wait until their panels enter view; restored individual category, hiring-step, profile-detail and action reveals. Brief artwork follows the same pause and reduced-motion settings. Build, typecheck, lint and 11 focused browser checks pass, covering offscreen opacity, reveal completion, alternating computed colors, pause, reduced motion and mobile overflow.

## Interior card animation
Added repeating, staggered interior motion: report/document bars grow, chart strokes draw, chips and profile details reveal, output icons and owner workflow glyphs move in sequence. Loops run only while the panel is in view and the document is visible; pause and reduced motion revert them to static content. All four output types, three task stages, profile and owner workflow verified with time-separated computed-style samples. Build, typecheck, lint and 12 motion checks pass.

## Correction: animate illustration elements, not repeated reveals
The earlier interior fade/grow/draw loops are superseded. Card contents remain visible: comparison cells highlight, chart markers travel along complete lines, the checkout cursor presses its button, a document caret moves along its lines, task/profile details respond, and a signal travels through the owner workflow. Existing one-time left-side scroll reveals, copy, illustrations, alternating backgrounds and aligned actions remain intact. Motion pauses offscreen and when the document is hidden; the pause control and reduced-motion preference leave static illustrations. Theme changes refresh highlight colors, and resize refreshes motion coordinates.

Removed the user-specified labels: “Example tasks”, “Work examples”, and the output panel’s “Preview”. The hero down arrow keeps its original right alignment.

Validation: production build, TypeScript and scoped lint pass. 117 focused browser assertions passed for interior motion, steady content visibility, pause/reduced-motion behavior, offscreen pausing, label removal and layout bounds. Separate final theme-switch verification follows the color correction. Local review: http://localhost:3102. Changes remain unpublished.
Final theme-switch pass: 26/26 checks pass using the actual theme control at 320, 390 and 1440px. Reviewed mobile light/dark screenshots; checkout cursor targets the payment button and comparison highlights use the active theme color. No browser runtime exceptions.
