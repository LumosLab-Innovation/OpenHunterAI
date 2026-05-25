# Contributing

Thanks for helping improve `openhack`.

Before opening a pull request:

- Keep generated run artifacts out of commits. `runs/**`, target checkouts, and
  review outputs are local data.
- Add new commands as `openhack` subcommands in
  `src/openhack/cli.py`; keep shared behavior in the package.
- Preserve the durable workflow:
  `recon item -> scenario -> result -> finding candidate -> triage -> finding`.
  Scenario experts may propose finding candidates, but final findings require
  recorded finding-triage decisions.
- Run `openhack validate-run` before submitting changes.
