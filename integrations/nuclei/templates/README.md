# OpenHunterAI Nuclei Templates

This directory is the only template bundle that may be copied into the Nuclei runtime image.

V1 policy:
- Add only reviewed internal templates.
- Keep intrusive, destructive, brute-force, credential attack, malware, evasion, and DoS templates out.
- Do not download or auto-update community templates at runtime.

The Nuclei adapter must report `TOOL_UNAVAILABLE` until a reviewed template bundle and execution policy are wired.
