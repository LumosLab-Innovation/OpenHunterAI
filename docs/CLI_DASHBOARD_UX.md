# CLI and dashboard entrypoints

OpenHunterAI has one scan/report engine with two entrypoints. The dashboard
uses one compact assessment workspace; the CLI starts with an
ANSI true-color portrait sampled from its character asset in an
interactive terminal. The brand image is a standalone
transparent character cutout at `tools/cli/assets/hunter-character.png`, not a
representation of a validated finding.

The image was generated with the built-in image tool from the user's visual
reference. Final prompt:

> Use case: background-extraction. Edit Image 1 into a clean dashboard asset:
> keep only the single hooded hunter character from hood peak through upper
> torso, deep navy-black fabric, glossy dark visor, two angled teal glowing
> eyes, narrow teal glowing smile and cyan rim light. Preserve the recognizable
> character silhouette; remove all other objects including laptop, hands, mug,
> desk, room, screens, words, logos and target symbols. Centered standalone
> bust with genuine transparent RGBA background, no extra scene or people.

Product path: authorized host → safe scan → worker/candidate status → report
with validated findings or explicit coverage gaps. A URL alone must not imply
that authenticated business logic, IDOR, or every hunter family was tested.

English is the default product language. Vietnamese is the next localization
target, Simplified Chinese follows. Translation must cover workflow labels,
errors, report sections, and CLI prompts together; partial translation should
not be advertised as a supported locale.
