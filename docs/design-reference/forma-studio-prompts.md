# Forma Studio: исходные промпты

Источник: `C:/.personal/.development/hakaton/VEYRA/Prompts.pdf`

Извлечено из PDF: 4 страницы. Удалены повторяющиеся колонтитулы и номера страниц, склеены переносы строк. Английские формулировки сохранены; это оригинальный архитектурный референс, а не требования к ARES-MED.

## Промпт 1 — интерактивный 3D hero

Страницы 1–2.

Build only a cinematic, interactive 3D hero for Forma Studio, a premium architectural visualization studio. Find the buildingʼs GLB file in the project folder and preserve its architecture, materials, and existing snow. Use Three.js, Blender, or suitable tools, and take creative ownership of the finishing details.

Create a realistic winter environment with the building naturally grounded at the waterline, gently animated water, accurate rippling reflections, and layered natural snowfall. Use overcast lighting, atmospheric depth, midnight and slate blues, icy-cyan highlights, and the buildingʼs warm vermilion tones. Add restrained warm window lighting and soft bloom. Give the scene a subtle clear glass-like polish that softens rough model details while keeping the architecture crisp and visible. Avoid washed-out haze, heavy blur, visible cloud graphics, and excessive darkness.

Create five complete scroll-triggered camera transitions: three-quarter approach, low reflection view, diagonal rise across the roof layers, elevated near-top-down view, and a final architectural composition. One deliberate scroll gesture triggers one complete 1.2–1.6-second movement, then waits; reverse scrolling reverses the sequence. Prevent trackpad momentum from skipping stages. Vary elevation, distance, and focus while keeping at least half the building visible throughout. In the fifth view, show most of the building prominently within the right 60% of the desktop viewport, leaving space for text on the left. Avoid heavy cropping and distant framing.

Add noticeable, smoothly eased cursor-driven camera parallax that creates depth without shaking or losing the composition. Blend it seamlessly with camera transitions. On building hover, reveal a localized wireframe through a feathered, irregular mask with subtle icy-cyan glow. Animate a few architectural guides, brackets, and anchor points around the hovered features, aligned with the model. Fade them out on pointer exit.

Design a distinctive editorial interface with expressive display typography, selective italic and colored words, precise supporting text, fine architectural rules, and generous spacing. Each camera stage gets a short headline and description that reveal within 0.25–0.4 seconds alongside the camera movement. On headline hover only, run a detailed 1.2–1.6-second scan across the letterforms using a luminous band, delicate outlines, and fine scan lines. Keep words readable and prevent repeated restarts between letters.

Include a refined wordmark, animated navigation hover states, a transparent Views panel in all five stages, and a compact secondary information area with an “Explore the Structure” inspection action and a slowly looping strip of architectural labels. Position these around the building without obstructing it. Add a custom architectural inspection cursor with contextual hover feedback and a polished loading state.

Make the hero responsive, support touch and keyboard stage controls and reduced motion, and adapt rendering quality to device performance. Keep snowfall and water moving while the camera rests. Inspect all five stages and resolve framing, loading, cursor, and interaction issues.

## Промпт 2 — дополнительные секции, звук и интеграция

Страницы 2–4.

Extend the existing Forma Studio Extend the existing Forma Studio website with two distinctive sections and a polished footer. Preserve the completed hero and its five camera stages. Review the attached recording for its animation techniques, especially the top-to-bottom architectural reveal and the floor plan that assembles progressively during scrolling. Create original compositions and assets that match our winter atmosphere, midnight-blue palette, icy-cyan accents, warm architectural materials, and editorial typography.

1. From Structure to Atmosphere

Create a spacious split composition with a large architectural visualization on the left and a compelling headline, concise studio description, and service details on the right.

As the user scrolls, reveal the architecture from top to bottom: fine structural outlines appear first, followed by materials, lighting, and the finished visualization. Use an aligned scanning boundary and layered masks so it feels like one building developing from a drawing into a finished scene. Keep this progression smoothly connected to scrolling and reversible when scrolling upward.

Create an original architectural concept related to our studioʼs visual identity. Add restrained annotation lines, small architectural labels, and subtle pointer parallax.

Organize the supporting content around three services: Architectural Imagery, Cinematic Films, and Interactive Experiences.

2. Inside the Design

Create an immersive section featuring an original architectural floor plan or axonometric drawing. As the user scrolls, assemble it progressively: outer boundaries, structural walls, interior partitions, openings, furniture, then annotations and highlighted points of interest.

Use individually animated SVG paths or layered geometry so the drawing genuinely builds piece by piece. Keep the plan internally coherent and present it as a conceptual studio study. Pair it with short explanations of our process— Concept, Material, Light, and Experience—that appear alongside the corresponding drawing layers.

Add a few interactive markers that reveal concise design notes on hover or keyboard focus. Use delicate cyan linework, soft-white details, and selective warm accents against a dark background. Allow a brief pinned sequence if useful, but keep scrolling responsive and release naturally when the drawing is complete.

Assets through Higgfield

Use the connected Higgfield CLI to generate original assets. Use GPT Image 2.5 for images and Seedance 2.5 for video where available through the connected tools. Keep the same architecture and framing across any outline and finished-image layers so the reveal aligns accurately.

Prefer images, SVG, and real-time animation for these sections. If video genuinely improves the design, generate at most one video, no longer than five seconds, with a seamless loop. Do not generate additional video clips or variations.

Sound and interaction

Use Hexfieldʼs available audio tools to create a subtle winter ambient soundtrack: soft atmospheric tones, gentle wind, and restrained water ambience. Add quiet, refined sound effects for the heroʼs camera transitions, building inspection hover, and selected interactive elements. Use a soft whoosh for camera movement and a delicate tonal cue for inspection.

Start audio only after the visitor enables it through a clearly visible global sound toggle. Keep levels balanced, prevent overlapping hover sounds, and trigger each transition sound once per camera movement. Avoid repeatedly firing sounds during continuous scrolling. If audio generation is unavailable, implement the sound controls and integration points and report the missing assets accurately.

Footer and integration

Finish with an elegant “Letʼs Shape Your Next Vision” contact invitation, the Forma Studio wordmark, working section navigation, available contact details, copyright, sound control, and back-to-top action. Do not invent contact information or client credentials.

After the fifth hero stage, the next downward scroll should flow naturally into the new sections. Restore the heroʼs stage interaction appropriately when returning upward. Extend the existing custom cursor, typography interactions, and architectural hover details consistently throughout the page.

Make the complete experience responsive, accessible, and smooth, with reduced-motion support and optimized asset loading. Verify the hero-to-content transition, both reveal sequences, audio controls, and footer on desktop and mobile.
