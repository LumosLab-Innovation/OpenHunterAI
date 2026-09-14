# Issue tracker

The only repository in scope is
[LumosLab-Innovation/OpenHunterAI](https://github.com/LumosLab-Innovation/OpenHunterAI).
Verify the current Git remote before operating; use explicit `--repo` when unsure.

| Read-only action | Command |
| --- | --- |
| Read issue and comments | `gh issue view <number> --repo LumosLab-Innovation/OpenHunterAI --comments` |
| List open issues | `gh issue list --repo LumosLab-Innovation/OpenHunterAI --state open --json number,title,labels` |
| Inspect available labels | `gh label list --repo LumosLab-Innovation/OpenHunterAI` |

Create/comment/edit/close issues only when the user's task authorizes that write.
“Review”, “diagnose”, and “fetch the ticket” do not authorize publication.

When publication is requested, use `gh issue create --repo LumosLab-Innovation/OpenHunterAI
--title "..." --body-file <prepared-markdown-file>`. A body file avoids shell-specific
heredoc/quoting problems on Windows.

Remove credentials, raw target traffic, and sensitive evidence before posting.
Use [private disclosure](../../SECURITY.md) for vulnerabilities and
[triage labels](triage-labels.md) for issue status.
