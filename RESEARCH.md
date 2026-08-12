# SlopScore research notes

Research performed on 2026-08-12. The scanner is deliberately heuristic: these
patterns are common across hand-built, templated, and AI-assisted sites. They are
observable fingerprints, never proof of authorship.

## Sources consulted

- [v0 design systems](https://v0.dev/docs/design-systems) documents v0's default
  use of shadcn/ui and its Tailwind-oriented design-system workflow.
- [Lovable design guidance](https://docs.lovable.dev/features/design-guidance)
  lists recurring generated layout directions such as hero grids, split screens,
  bento grids, card grids, and curated font/color/layout choices. It also notes
  that early previews use generic copy and placeholders.
- [Bolt's website-builder documentation](https://bolt.new/use-cases/ai-website-builder)
  identifies React, Vite, Tailwind, and Node as defaults and emphasizes prompt-led
  generation and iterative refinement.
- [A current shadcn portfolio template](https://www.shadcn.io/template/taqui-786-portfolio)
  demonstrates the standardized configurable sections common to rapidly assembled
  portfolio sites: identity, social links, skills, projects, and education.
- [Framer's animation guidance](https://www.framer.com/blog/website-animation-examples/)
  describes fade, slide, pop-up, and especially fade-up entrance patterns while
  warning that entrance animation becomes tacky when overused.
- Practitioner discussions in [r/Frontend](https://www.reddit.com/r/Frontend/comments/1opi3h3/is_anyone_else_tired_of_every_tailwindshadcn_app/)
  and [r/UXDesign](https://www.reddit.com/r/UXDesign/comments/1msmlti/when_did_ui_become_so_obnoxious_gradients_glass/)
  repeatedly identify unmodified font/color/spacing defaults, repeated component
  geometry, gradients, glass effects, bento cards, and excessive animation as the
  source of a generic look. These discussions are treated as qualitative input,
  not ground truth.

## Signals selected

The MVP measures clusters rather than provenance-specific signatures:

1. Standardized hero assembly: a small pill above a large greeting, paired CTAs,
   a right-side image, gradient heading, and nearby social links.
2. Repeated component defaults: a high share of large radii, many pills, repeated
   translucent/blurred panels, bento-like grids, and same-shaped project cards.
3. Template copy and information architecture: cliché phrases, canonical portfolio
   navigation/section order, oversized skills lists, and badge-heavy projects.
4. Motion monoculture: many elements sharing opacity/translate entrance effects.
5. Stack context: framework, Lucide, and Motion fingerprints. These do not score
   meaningfully alone; they only support small combination bonuses.

The signals are useful because computed styles, geometry, visible text, links,
resources, and animation metadata can be normalized from a rendered page. No ML,
source-code ownership guess, or raw DOM transfer is required.

