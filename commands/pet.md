---
description: Show your code-pet's status, rename it, or log a milestone.
---

Run the pet CLI and show the user its output verbatim:

```
!node "${CLAUDE_PLUGIN_ROOT}/bin/pet.js" $ARGUMENTS
```

If `$ARGUMENTS` is empty, it defaults to `status`. Supported: `status`, `rename <name>`, `milestone <description>`, `start`, and `stop`. (There is no adopt command — every pet starts as an egg and hatches into a random creature.)
