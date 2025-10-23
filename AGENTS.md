# Repository Guidance

## Porting objective
- This repository is in the process of porting the legacy Spriter plugin found under `scml/` to Construct's Addon SDK v2.
- Reference the official Construct guide on porting: <https://www.construct.net/en/make-games/manuals/addon-sdk/guide/porting-addon-sdk-v2>.
- While porting, take the opportunity to dramatically clean up the codebase—the legacy implementation is known to be messy, so prefer clear structure, modern patterns, and thorough documentation.

## Research expectations
- Use the linked Construct manual page as the primary starting point.
- Feel free to consult any additional reputable resources (docs, forums, source code, etc.) when answers are not present in the linked guide.
- Document any important findings that inform the port in code comments or relevant documentation updates.

## Handling missing SDK functionality
- If you discover or strongly suspect that required functionality is absent from the Addon SDK v2, or you encounter blocking questions you cannot resolve, record the details in the root-level file `requests for ashley.txt` so we can follow up.
- Each entry in `requests for ashley.txt` should include:
  - A concise title or question.
  - A short description of the missing capability or clarification needed.
  - Any references or investigation notes (Construct docs URLs, forum threads, etc.).

## General guidelines
- Strive for maintainable, well-organized code and avoid replicating legacy issues from the old plugin.
- Keep communication clear by updating `requests for ashley.txt` whenever follow-up from Ashley is required.
- Tests, linting, and validation steps should be run and documented whenever feasible to ensure the port is stable.
