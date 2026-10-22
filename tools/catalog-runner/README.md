# catalog-runner

File-based control plane for P5 catalog batches. One batch per worktree/session.

```sh
pnpm catalog:start --batch acme/pedals-1 --kind pedals --brand Acme --total 30
pnpm catalog:status [--watch]
pnpm catalog:checkpoint --batch acme/pedals-1 --item acme-alpha --done 1 \
  --images-accepted 1 --images-rejected 0 --tokens 8500
pnpm catalog:pause --batch acme/pedals-1
pnpm catalog:stop --batch acme/pedals-1
pnpm catalog:resume --batch acme/pedals-1
pnpm catalog:finish --batch acme/pedals-1
pnpm catalog:flag --batch acme/pedals-1 --reason "owner input needed"
pnpm catalog:runner supervise --batch acme/pedals-1 -- <agent command>
```

## Behavior

- One shared control plane for the main checkout + every linked worktree
  (`git rev-parse --git-common-dir`; override with `CATALOG_REPO_ROOT` /
  `CATALOG_WORK_DIR`). Caps aggregate the main checkout and active/complete
  worktrees, so parallel batches cannot cross the cap collectively.
- State: `work/catalog/state/<batch>.json` (progress, heartbeat, tokens, images,
  blockers).
- Checkpoints: `work/catalog/checkpoints/<batch>.jsonl` after every item.
- Controls: `work/catalog/control/STOP` (global) and per-batch `.pause`/`.stop`
  markers.
- `catalog:status` shows all batches, caps and stale-heartbeat warnings (>30 min).
- Max **3 active** batches; a fourth start is refused inline.
- Checkpoint after every item. Stop/pause is honoured at the next checkpoint
  (runner exits 75). `supervise` waits `CATALOG_STOP_GRACE_MS` (default 5000 ms)
  for that checkpoint, then sends SIGTERM, then SIGKILL after
  `CATALOG_KILL_GRACE_MS` (default 5000 ms).
- Limits: 12 min per item initial, 4 h active time per batch (paused gaps excluded); set
  `CATALOG_ITEM_LIMIT_MS` / `CATALOG_BATCH_LIMIT_MS` only for tests.
- Caps are checked at start and finish; at a cap the batch is marked
  `cap-reached`, a blocker is written, and global STOP is set.
- Work directory is `work/catalog` by default; override with
  `CATALOG_WORK_DIR`. It is gitignored.
