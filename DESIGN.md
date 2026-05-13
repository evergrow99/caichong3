# AICHONG Design Direction

## Product Position

AICHONG is a task-publishing workspace for people who do not operate their own Agent. The product lets a human describe a creative need, attach reference files, pay for the task, receive multiple submissions, preview attachments, and choose the best result.

The demand-side experience should feel like AICHONG owns the user relationship. Do not expose integration mechanics, partner platform wording, API language, or internal sync concepts in the core user journey. The `/work` guide may mention external Agent onboarding when the user explicitly wants to receive tasks.

## Visual Feeling

The interface should feel calm, capable, and slightly futuristic: dark surfaces, controlled green accents, quiet hierarchy, and a focused writing area. It can borrow the confidence of trading/AI workspaces without looking like a crypto exchange, dashboard, or official partner site.

Use dark green-black as atmosphere, green as the primary action and active state, and off-white text for clarity. Avoid bright neon overload, decorative blobs, heavy gradients, or marketing-style clutter.

## Layout Principles

- Keep the left sidebar operational and compact: brand, new task, history, market rules, receiver guide, and account.
- The homepage first viewport is a product workspace, not a landing page. The task input is the main object.
- Default homepage hierarchy: welcome headline, one-line explanation, low-friction task publisher, then examples.
- Task detail pages remain functional and status-led. Do not visually hide deadlines, submissions, attachments, or selection actions.
- Static informational pages such as `/market-rules` and `/work` should still feel like AICHONG: dark green-black surfaces, restrained green accents, shared navigation, and concise product copy. Do not use a separate white marketplace/landing-page style for them.
- Use cards for repeated items and modals. Avoid nesting cards inside cards.

## Task Publisher

The publisher should feel like a natural command/input surface, similar to Codex-style composition areas:

- One calm container, not several boxed fields.
- The textarea should feel integrated into the container, with minimal border treatment.
- Attachment, price, and publish controls should read as a compact action bar.
- The publish button is the visual anchor; secondary controls stay quiet until hover/focus.
- Validation should happen through clear messages, not permanent instructional clutter.

## Color Roles

- Page background: near-black green, with very subtle grid or depth.
- Primary action: fresh green, high contrast against dark surfaces.
- Main surface: deep charcoal-green with soft shadow.
- Secondary surface: transparent or very low-contrast dark tint.
- Text: warm off-white for headings, desaturated green-gray for supporting text.
- Warning/danger: keep red/orange clear and readable even in dark mode.

## Typography

Use large, confident headings on the homepage, but keep operational pages compact. Body copy should be short and practical. Do not over-explain mechanics. Prefer user-facing language over platform/internal terms.

## Interaction States

All clickable controls need hover and focus states. Disabled states should be visible but not visually noisy. Login-gated actions may open the login modal; do not block users from drafting a task before login.

Icons should come from the approved Figma icon library (`yWZTSzMR9aC8l9DBljE31C`) and keep one consistent line style, stroke weight, and optical size. Do not hand-draw or imitate replacement icons in code.

## Do Not

- Do not reveal Caichong or integration wording in demand-side task creation, order detail, or history surfaces.
- Do not add decorative UI that competes with the task input.
- Do not use many borders around the publisher; prefer spacing, contrast, and soft surface depth.
- Do not change backend contracts, task status mapping, payment flow, or API behavior when making visual changes.
- Do not use hand-drawn placeholder icons when a matching icon should be selected from the Figma icon library.
