---
description: Show your claude-pet's status, or adopt/rename/log a milestone.
---

Run the pet CLI and show the user its output verbatim:

```
!node "${CLAUDE_PLUGIN_ROOT}/bin/pet.js" $ARGUMENTS
```

If `$ARGUMENTS` is empty, it defaults to `status`. Supported: `status`, `adopt <species>`, `rename <name>`, `milestone <description>`.
